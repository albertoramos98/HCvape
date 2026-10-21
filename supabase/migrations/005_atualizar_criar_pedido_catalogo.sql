-- =========================================================================
-- HC VAPE - MIGRAÇÃO 005: ATUALIZAÇÃO DA RPC CRIAR_PEDIDO_CATALOGO
-- Validação prévia de disponibilidade de estoque por zona e sabor
-- Idempotente: CREATE OR REPLACE FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION criar_pedido_catalogo(dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_novo_pedido pedidos%ROWTYPE;
  v_item JSONB;
  v_prod_id UUID;
  v_sabor_solicitado TEXT;
  v_qtd INT;
  v_zona_id VARCHAR(50);
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_disponivel INT;
BEGIN
  v_zona_id := resolver_zona_id(dados->>'zona');

  -- 1. Validar disponibilidade de estoque para cada item (exceto ilimitados)
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(dados->'itens', '[]'::jsonb)) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_sabor_solicitado := v_item->>'sabor';
    v_qtd := COALESCE((v_item->>'quantidade')::int, 0);

    IF v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para o item "%"', COALESCE(v_item->>'nome', 'Item');
    END IF;

    SELECT * INTO v_produto 
    FROM produtos 
    WHERE id = v_prod_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível ou não encontrado no catálogo: "%"', COALESCE(v_item->>'nome', v_prod_id::text);
    END IF;

    -- Se o produto for ilimitado, não valida estoque numérico
    IF v_produto.estoque_ilimitado THEN
      CONTINUE;
    END IF;

    v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

    -- Verifica suporte à zona
    IF NOT (v_estoque_zonas ? v_zona_id) THEN
      IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
        v_zona_id := 'sul_oeste';
      ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN
        v_zona_id := 'norte';
      ELSE
        RAISE EXCEPTION 'O produto "%" está indisponível para entrega na região "%".', v_produto.nome, v_zona_id;
      END IF;
    END IF;

    v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
    v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);

    IF v_chave_sabor IS NULL THEN
      RAISE EXCEPTION 'O sabor "%" do produto "%" está esgotado ou indisponível na região "%".', 
        v_sabor_solicitado, v_produto.nome, v_zona_id;
    END IF;

    v_saldo_disponivel := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

    IF v_saldo_disponivel < v_qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%"). Disponível: % un, Solicitado: % un.',
        v_produto.nome, v_chave_sabor, v_saldo_disponivel, v_qtd;
    END IF;
  END LOOP;

  -- 2. Se todos os itens possuem estoque suficiente, insere o pedido
  INSERT INTO pedidos (
    nome_cliente,
    telefone_cliente,
    indicacao,
    zona,
    itens,
    total,
    desconto,
    total_final,
    status_checklist,
    notas,
    excluido
  )
  VALUES (
    (dados->>'nome_cliente'),
    (dados->>'telefone_cliente'),
    (dados->>'indicacao'),
    v_zona_id,
    (dados->'itens'),
    (dados->>'total')::numeric,
    COALESCE((dados->>'desconto')::numeric, 0),
    (dados->>'total_final')::numeric,
    false,
    (dados->>'notas'),
    false
  )
  RETURNING * INTO v_novo_pedido;

  RETURN jsonb_build_object(
    'id', v_novo_pedido.id,
    'numero_pedido', v_novo_pedido.numero_pedido,
    'total_final', v_novo_pedido.total_final
  );
END;
$$;

-- Permissões: pública para clientes anônimos e autenticados
GRANT EXECUTE ON FUNCTION criar_pedido_catalogo(JSONB) TO anon, authenticated;
