-- =========================================================================
-- HC VAPE - MIGRAÇÃO 004: REGISTRO E ESTORNO ATÔMICOS DE TROCAS COM GARANTIA
-- Idempotente: CREATE OR REPLACE FUNCTION
-- =========================================================================

-- 1. RPC: Registrar troca de vape defeituoso com baixa atômica opcional
CREATE OR REPLACE FUNCTION registrar_troca(
  p_dados JSONB,
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nova_troca trocas%ROWTYPE;
  v_prod_id UUID;
  v_sabor_trocado TEXT;
  v_zona_id VARCHAR(50);
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_abater BOOLEAN;
BEGIN
  v_abater := COALESCE((p_dados->>'abateu_estoque')::boolean, (p_dados->>'abater_estoque')::boolean, false);
  v_prod_id := CASE WHEN (p_dados->>'produto_trocado_id') IS NOT NULL AND (p_dados->>'produto_trocado_id') <> '' 
                    THEN (p_dados->>'produto_trocado_id')::UUID 
                    ELSE NULL END;

  -- 1. Inserir o registro na tabela trocas
  INSERT INTO trocas (
    cliente_nome,
    cliente_telefone,
    data_troca,
    vape_defeito,
    sabor_defeito,
    motivo,
    motivo_detalhes,
    vape_trocado,
    sabor_trocado,
    produto_trocado_id,
    zona,
    abateu_estoque,
    status,
    observacoes
  ) VALUES (
    (p_dados->>'cliente_nome'),
    (p_dados->>'cliente_telefone'),
    COALESCE((p_dados->>'data_troca')::timestamptz, CURRENT_TIMESTAMP),
    (p_dados->>'vape_defeito'),
    (p_dados->>'sabor_defeito'),
    (p_dados->>'motivo'),
    (p_dados->>'motivo_detalhes'),
    (p_dados->>'vape_trocado'),
    (p_dados->>'sabor_trocado'),
    v_prod_id,
    (p_dados->>'zona'),
    v_abater,
    COALESCE(p_dados->>'status', 'concluida'),
    (p_dados->>'observacoes')
  ) RETURNING * INTO v_nova_troca;

  -- 2. Se marcado para abater estoque e houver produto substituto selecionado
  IF v_abater AND v_prod_id IS NOT NULL THEN
    SELECT * INTO v_produto 
    FROM produtos 
    WHERE id = v_prod_id 
    FOR UPDATE;

    IF FOUND AND NOT v_produto.estoque_ilimitado THEN
      v_zona_id := resolver_zona_id(v_nova_troca.zona);
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

      IF NOT (v_estoque_zonas ? v_zona_id) THEN
        v_zona_id := 'recife';
      END IF;

      v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
      v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_nova_troca.sabor_trocado);

      IF v_chave_sabor IS NULL THEN
        v_chave_sabor := TRIM(v_nova_troca.sabor_trocado);
      END IF;

      v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

      IF v_saldo_antes < 1 THEN
        RAISE EXCEPTION 'Estoque insuficiente para abater troca do produto "%" (Sabor: "%", Região: "%"). Saldo atual: 0.',
          v_produto.nome, v_chave_sabor, v_zona_id;
      END IF;

      v_saldo_depois := v_saldo_antes - 1;

      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
      v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

      UPDATE produtos 
      SET estoque_zonas = v_estoque_zonas 
      WHERE id = v_prod_id;

      INSERT INTO movimentos_estoque (
        produto_id,
        zona,
        sabor,
        delta,
        saldo_antes,
        saldo_depois,
        tipo,
        troca_id,
        usuario
      ) VALUES (
        v_prod_id,
        v_zona_id,
        v_chave_sabor,
        -1,
        v_saldo_antes,
        v_saldo_depois,
        'troca',
        v_nova_troca.id,
        p_usuario
      );

      PERFORM recalcular_estoque_produto(v_prod_id);
    END IF;
  END IF;

  RETURN to_jsonb(v_nova_troca);
END;
$$;

-- 2. RPC: Estornar estoque ao deletar troca que havia abatido unidade
CREATE OR REPLACE FUNCTION estornar_troca(
  p_troca_id UUID,
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_troca RECORD;
  v_mov RECORD;
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_zona_id VARCHAR(50);
  v_chave_sabor TEXT;
BEGIN
  SELECT * INTO v_troca 
  FROM trocas 
  WHERE id = p_troca_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de troca não encontrado: %', p_troca_id;
  END IF;

  -- Se a troca abateu estoque, estorna simetricamente
  IF v_troca.abateu_estoque = true THEN
    -- Busca movimento registrado
    SELECT * INTO v_mov 
    FROM movimentos_estoque 
    WHERE troca_id = p_troca_id AND tipo = 'troca'
    LIMIT 1;

    IF FOUND THEN
      SELECT * INTO v_produto 
      FROM produtos 
      WHERE id = v_mov.produto_id 
      FOR UPDATE;

      IF FOUND THEN
        v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
        v_sabores_zona := COALESCE(v_estoque_zonas->v_mov.zona->'sabores_estoque', '{}'::jsonb);

        v_saldo_antes := COALESCE((v_sabores_zona->>v_mov.sabor)::int, 0);
        v_saldo_depois := v_saldo_antes + 1;

        v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_mov.sabor], to_jsonb(v_saldo_depois));
        v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_mov.zona, 'sabores_estoque'], v_sabores_zona);

        UPDATE produtos 
        SET estoque_zonas = v_estoque_zonas 
        WHERE id = v_mov.produto_id;

        INSERT INTO movimentos_estoque (
          produto_id,
          zona,
          sabor,
          delta,
          saldo_antes,
          saldo_depois,
          tipo,
          troca_id,
          usuario
        ) VALUES (
          v_mov.produto_id,
          v_mov.zona,
          v_mov.sabor,
          1,
          v_saldo_antes,
          v_saldo_depois,
          'troca_estorno',
          p_troca_id,
          p_usuario
        );

        PERFORM recalcular_estoque_produto(v_mov.produto_id);
      END IF;
    ELSIF v_troca.produto_trocado_id IS NOT NULL THEN
      -- Fallback para troca legada sem registro em movimentos_estoque
      SELECT * INTO v_produto 
      FROM produtos 
      WHERE id = v_troca.produto_trocado_id 
      FOR UPDATE;

      IF FOUND AND NOT v_produto.estoque_ilimitado THEN
        v_zona_id := resolver_zona_id(v_troca.zona);
        v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
        v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
        v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_troca.sabor_trocado);

        IF v_chave_sabor IS NULL THEN
          v_chave_sabor := TRIM(v_troca.sabor_trocado);
        END IF;

        v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);
        v_saldo_depois := v_saldo_antes + 1;

        v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
        v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

        UPDATE produtos 
        SET estoque_zonas = v_estoque_zonas 
        WHERE id = v_troca.produto_trocado_id;

        INSERT INTO movimentos_estoque (
          produto_id,
          zona,
          sabor,
          delta,
          saldo_antes,
          saldo_depois,
          tipo,
          troca_id,
          usuario
        ) VALUES (
          v_troca.produto_trocado_id,
          v_zona_id,
          v_chave_sabor,
          1,
          v_saldo_antes,
          v_saldo_depois,
          'troca_estorno',
          p_troca_id,
          p_usuario
        );

        PERFORM recalcular_estoque_produto(v_troca.produto_trocado_id);
      END IF;
    END IF;
  END IF;

  -- 3. Deletar a troca
  DELETE FROM trocas WHERE id = p_troca_id;

  RETURN jsonb_build_object(
    'success', true,
    'troca_id', p_troca_id
  );
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION registrar_troca(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_troca(JSONB, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION estornar_troca(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION estornar_troca(UUID, TEXT) TO authenticated;
