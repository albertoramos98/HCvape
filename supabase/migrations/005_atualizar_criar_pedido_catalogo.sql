-- =========================================================================
-- HC VAPE - MIGRAÇÃO 005: CRIAÇÃO DE PEDIDO COM VALIDAÇÃO DE SALDO E
-- RECÁLCULO FINANCEIRO SEGURO NO BANCO DE DADOS
-- Idempotente: CREATE OR REPLACE FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION criar_pedido_catalogo(
  p_nome_cliente TEXT,
  p_telefone_cliente TEXT,
  p_indicacao TEXT,
  p_zona TEXT,
  p_itens JSONB,
  p_total NUMERIC DEFAULT 0,
  p_desconto NUMERIC DEFAULT 0,
  p_total_final NUMERIC DEFAULT 0,
  p_notas TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pedido_id UUID := gen_random_uuid();
  v_numero_pedido INT;
  v_zona_id VARCHAR(50);
  v_item JSONB;
  v_prod_id UUID;
  v_sabor_solicitado TEXT;
  v_qtd INT;
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_disponivel INT;
  v_preco_unitario NUMERIC(10,2);
  v_item_total NUMERIC(10,2);
  v_total_recalculado NUMERIC(10,2) := 0;
  v_desconto_aplicado NUMERIC(10,2);
  v_total_final_calculado NUMERIC(10,2);
  v_itens_higienizados JSONB := '[]'::jsonb;
BEGIN
  -- 1. Validar preenchimento obrigatório básico
  IF p_nome_cliente IS NULL OR TRIM(p_nome_cliente) = '' THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório.';
  END IF;

  IF p_telefone_cliente IS NULL OR TRIM(p_telefone_cliente) = '' THEN
    RAISE EXCEPTION 'WhatsApp do cliente é obrigatório.';
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O pedido deve conter pelo menos um item.';
  END IF;

  v_zona_id := resolver_zona_id(p_zona);

  -- 2. Validar cada item: integridade, quantidade > 0, saldo e preços reais
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_sabor_solicitado := v_item->>'sabor';
    v_qtd := (v_item->>'quantidade')::INT;

    -- Validação de quantidade inteira estritamente positiva
    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Item "%" possui quantidade inválida (% un). A quantidade deve ser um número inteiro maior que zero.',
        COALESCE(v_item->>'nome', 'Item'), COALESCE(v_qtd, 0);
    END IF;

    -- Buscar produto no banco
    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_prod_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado: %', v_prod_id;
    END IF;

    -- Recalcular o preço unitário real do produto no banco (não confia no cliente)
    IF v_produto.is_promo AND v_produto.preco_promo IS NOT NULL AND v_produto.preco_promo > 0 THEN
      v_preco_unitario := v_produto.preco_promo;
    ELSE
      v_preco_unitario := v_produto.preco;
    END IF;

    v_item_total := v_preco_unitario * v_qtd;
    v_total_recalculado := v_total_recalculado + v_item_total;

    -- Adicionar item com preço unitário oficial do banco
    v_itens_higienizados := v_itens_higienizados || jsonb_build_array(
      jsonb_set(
        jsonb_set(v_item, '{preco_unitario}', to_jsonb(v_preco_unitario)),
        '{quantidade}', to_jsonb(v_qtd)
      )
    );

    -- Se produto não tiver estoque ilimitado, pré-validar disponibilidade na região
    IF NOT v_produto.estoque_ilimitado THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

      IF NOT (v_estoque_zonas ? v_zona_id) THEN
        IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
          v_zona_id := 'sul_oeste';
        ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN
          v_zona_id := 'norte';
        ELSE
          RAISE EXCEPTION 'O produto "%" não possui estoque configurado para a região selecionada ("%").', 
            v_produto.nome, v_zona_id;
        END IF;
      END IF;

      v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
      v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);

      IF v_chave_sabor IS NULL THEN
        RAISE EXCEPTION 'Sabor "%" esgotado ou indisponível para o produto "%" na região "%".', 
          v_sabor_solicitado, v_produto.nome, v_zona_id;
      END IF;

      v_saldo_disponivel := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

      IF v_saldo_disponivel < v_qtd THEN
        RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%", Região: "%"). Saldo disponível: %, Solicitado: %.',
          v_produto.nome, v_chave_sabor, v_zona_id, v_saldo_disponivel, v_qtd;
      END IF;
    END IF;
  END LOOP;

  -- 3. Calcular totais financeiros finais seguros
  v_desconto_aplicado := COALESCE(p_desconto, 0);
  IF v_desconto_aplicado < 0 THEN
    v_desconto_aplicado := 0;
  END IF;

  v_total_final_calculado := GREATEST(0, v_total_recalculado - v_desconto_aplicado);

  -- 4. Gerar número sequencial do pedido
  SELECT COALESCE(MAX(numero_pedido), 1000) + 1 INTO v_numero_pedido FROM public.pedidos;

  -- 5. Inserir o pedido com totais calculados pelo servidor
  INSERT INTO public.pedidos (
    id,
    numero_pedido,
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
  ) VALUES (
    v_pedido_id,
    v_numero_pedido,
    TRIM(p_nome_cliente),
    TRIM(p_telefone_cliente),
    TRIM(COALESCE(p_indicacao, '')),
    v_zona_id,
    v_itens_higienizados,
    v_total_recalculado,
    v_desconto_aplicado,
    v_total_final_calculado,
    false,
    TRIM(COALESCE(p_notas, '')),
    false
  );

  RETURN jsonb_build_object(
    'id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'nome_cliente', TRIM(p_nome_cliente),
    'telefone_cliente', TRIM(p_telefone_cliente),
    'zona', v_zona_id,
    'total', v_total_recalculado,
    'desconto', v_desconto_aplicado,
    'total_final', v_total_final_calculado,
    'status_checklist', false
  );
END;
$$;

-- Permissões: liberar para clientes anônimos e autenticados
GRANT EXECUTE ON FUNCTION criar_pedido_catalogo(TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;

-- Sobrecarga de compatibilidade retroativa para payloads no formato { dados: { ... } }
CREATE OR REPLACE FUNCTION criar_pedido_catalogo(dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN criar_pedido_catalogo(
    p_nome_cliente => (dados->>'nome_cliente'),
    p_telefone_cliente => (dados->>'telefone_cliente'),
    p_indicacao => (dados->>'indicacao'),
    p_zona => (dados->>'zona'),
    p_itens => (dados->'itens'),
    p_total => COALESCE((dados->>'total')::numeric, 0),
    p_desconto => COALESCE((dados->>'desconto')::numeric, 0),
    p_total_final => COALESCE((dados->>'total_final')::numeric, 0),
    p_notas => COALESCE((dados->>'notas'), '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION criar_pedido_catalogo(JSONB) TO anon, authenticated;

-- Recarregar cache de schema do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';
