-- =========================================================================
-- HC VAPE - MIGRAÇÃO 004: GESTÃO ATÔMICA DE TROCAS COM CANCELAMENTO LÓGICO
-- Idempotente: CREATE OR REPLACE FUNCTION
-- =========================================================================

-- 1. RPC: Registrar troca com baixa atômica opcional
CREATE OR REPLACE FUNCTION registrar_troca(
  p_cliente_nome TEXT,
  p_cliente_telefone TEXT,
  p_vape_defeito TEXT,
  p_sabor_defeito TEXT,
  p_motivo TEXT,
  p_motivo_detalhes TEXT,
  p_vape_trocado TEXT,
  p_sabor_trocado TEXT,
  p_produto_trocado_id UUID,
  p_zona VARCHAR(50),
  p_abater_estoque BOOLEAN,
  p_observacoes TEXT DEFAULT NULL,
  p_data_troca TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_troca_id UUID := gen_random_uuid();
  v_zona_id VARCHAR(50);
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_usuario TEXT;
BEGIN
  -- Obter usuário do JWT com segurança
  v_usuario := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  v_zona_id := resolver_zona_id(p_zona);

  -- 1. Se foi solicitado abater estoque, processar com lock atômico
  IF p_abater_estoque AND p_produto_trocado_id IS NOT NULL THEN
    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = p_produto_trocado_id 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto trocado não encontrado: %', p_produto_trocado_id;
    END IF;

    IF NOT v_produto.estoque_ilimitado THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

      IF NOT (v_estoque_zonas ? v_zona_id) THEN
        IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
          v_zona_id := 'sul_oeste';
        ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN
          v_zona_id := 'norte';
        ELSE
          RAISE EXCEPTION 'Produto "%" não possui estoque na região "%" para efetuar a troca.', 
            v_produto.nome, v_zona_id;
        END IF;
      END IF;

      v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
      v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, p_sabor_trocado);

      IF v_chave_sabor IS NULL THEN
        RAISE EXCEPTION 'Sabor "%" não encontrado para o produto "%" na região "%".', 
          p_sabor_trocado, v_produto.nome, v_zona_id;
      END IF;

      v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

      IF v_saldo_antes < 1 THEN
        RAISE EXCEPTION 'Estoque insuficiente para efetuar a troca do produto "%" (Sabor: "%", Região: "%"). Saldo: 0.',
          v_produto.nome, v_chave_sabor, v_zona_id;
      END IF;

      v_saldo_depois := v_saldo_antes - 1;

      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
      v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

      UPDATE public.produtos 
      SET estoque_zonas = v_estoque_zonas
      WHERE id = p_produto_trocado_id;

      -- Inserir o registro de troca primeiro para respeitar a chave estrangeira RESTRICT
      INSERT INTO public.trocas (
        id,
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
        v_troca_id,
        p_cliente_nome,
        p_cliente_telefone,
        p_data_troca,
        p_vape_defeito,
        p_sabor_defeito,
        p_motivo,
        p_motivo_detalhes,
        p_vape_trocado,
        p_sabor_trocado,
        p_produto_trocado_id,
        v_zona_id,
        p_abater_estoque,
        'concluida',
        p_observacoes
      );

      -- Registrar movimento
      INSERT INTO public.movimentos_estoque (
        produto_id,
        zona,
        sabor,
        delta,
        saldo_antes,
        saldo_depois,
        tipo,
        troca_id,
        usuario,
        motivo
      ) VALUES (
        p_produto_trocado_id,
        v_zona_id,
        v_chave_sabor,
        -1,
        v_saldo_antes,
        v_saldo_depois,
        'troca',
        v_troca_id,
        v_usuario,
        'troca_cliente'
      );

      PERFORM recalcular_estoque_produto(p_produto_trocado_id);

      RETURN jsonb_build_object(
        'success', true,
        'troca_id', v_troca_id,
        'abateu_estoque', true,
        'status', 'concluida'
      );
    END IF;
  END IF;

  -- Se não houve baixa de estoque, apenas insere o registro da troca
  INSERT INTO public.trocas (
    id,
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
    v_troca_id,
    p_cliente_nome,
    p_cliente_telefone,
    p_data_troca,
    p_vape_defeito,
    p_sabor_defeito,
    p_motivo,
    p_motivo_detalhes,
    p_vape_trocado,
    p_sabor_trocado,
    p_produto_trocado_id,
    v_zona_id,
    p_abater_estoque,
    'concluida',
    p_observacoes
  );

  RETURN jsonb_build_object(
    'success', true,
    'troca_id', v_troca_id,
    'abateu_estoque', false,
    'status', 'concluida'
  );
END;
$$;

-- Permissões registrar_troca
REVOKE ALL ON FUNCTION registrar_troca FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_troca TO authenticated;

-- 2. RPC: Estornar troca (NÃO deleta o registro: atualiza status para 'cancelada')
CREATE OR REPLACE FUNCTION estornar_troca(p_troca_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_troca RECORD;
  v_mov_agrupado RECORD;
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_usuario TEXT;
BEGIN
  -- Obter usuário do JWT com segurança
  v_usuario := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  -- 1. Lock exclusivo na troca
  SELECT * INTO v_troca 
  FROM public.trocas 
  WHERE id = p_troca_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de troca não encontrado: %', p_troca_id;
  END IF;

  IF v_troca.status = 'cancelada' THEN
    RAISE EXCEPTION 'Registro de troca já se encontra cancelado.';
  END IF;

  -- 2. Se a troca baixou estoque, repor o saldo líquido
  IF v_troca.abateu_estoque = true THEN
    FOR v_mov_agrupado IN 
      SELECT 
        produto_id, 
        zona, 
        sabor, 
        -SUM(delta) AS qtd_repor
      FROM public.movimentos_estoque 
      WHERE troca_id = p_troca_id
      GROUP BY produto_id, zona, sabor
      HAVING -SUM(delta) > 0
    LOOP
      SELECT * INTO v_produto 
      FROM public.produtos 
      WHERE id = v_mov_agrupado.produto_id 
      FOR UPDATE;

      IF FOUND THEN
        v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
        v_sabores_zona := COALESCE(v_estoque_zonas->v_mov_agrupado.zona->'sabores_estoque', '{}'::jsonb);

        v_saldo_antes := COALESCE((v_sabores_zona->>v_mov_agrupado.sabor)::int, 0);
        v_saldo_depois := v_saldo_antes + v_mov_agrupado.qtd_repor;

        v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_mov_agrupado.sabor], to_jsonb(v_saldo_depois));
        v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_mov_agrupado.zona, 'sabores_estoque'], v_sabores_zona);

        UPDATE public.produtos 
        SET estoque_zonas = v_estoque_zonas
        WHERE id = v_mov_agrupado.produto_id;

        INSERT INTO public.movimentos_estoque (
          produto_id,
          zona,
          sabor,
          delta,
          saldo_antes,
          saldo_depois,
          tipo,
          troca_id,
          usuario,
          motivo
        ) VALUES (
          v_mov_agrupado.produto_id,
          v_mov_agrupado.zona,
          v_mov_agrupado.sabor,
          v_mov_agrupado.qtd_repor,
          v_saldo_antes,
          v_saldo_depois,
          'troca_estorno',
          p_troca_id,
          v_usuario,
          'cancelamento_troca'
        );

        PERFORM recalcular_estoque_produto(v_mov_agrupado.produto_id);
      END IF;
    END LOOP;
  END IF;

  -- 3. Atualizar status da troca para 'cancelada' (NÃO apaga a linha!)
  UPDATE public.trocas 
  SET status = 'cancelada' 
  WHERE id = p_troca_id;

  RETURN jsonb_build_object(
    'success', true,
    'troca_id', p_troca_id,
    'status', 'cancelada'
  );
END;
$$;

-- Permissões estornar_troca
REVOKE ALL ON FUNCTION estornar_troca(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION estornar_troca(UUID) TO authenticated;
