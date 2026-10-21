-- =========================================================================
-- HC VAPE - MIGRAÇÃO 003: BAIXA E ESTORNO ATÔMICOS POR SALDO LÍQUIDO
-- Idempotente: CREATE OR REPLACE FUNCTION
-- =========================================================================

-- 1. Função canônica para resolver identificador de zona
CREATE OR REPLACE FUNCTION resolver_zona_id(p_zona_input TEXT)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_norm TEXT;
BEGIN
  IF p_zona_input IS NULL OR TRIM(p_zona_input) = '' THEN
    RETURN 'recife';
  END IF;

  v_norm := normalizar_sabor(p_zona_input);

  IF v_norm = 'recife' OR v_norm = 'rec' OR v_norm LIKE '%recife%' THEN
    RETURN 'recife';
  ELSIF v_norm = 'norte' OR v_norm LIKE '%norte%' THEN
    RETURN 'norte';
  ELSIF v_norm = 'sul_oeste' OR v_norm = 'suloeste' OR v_norm LIKE '%sul%oeste%' THEN
    RETURN 'sul_oeste';
  ELSIF v_norm = 'sul' OR v_norm = 'oeste' THEN
    RETURN 'sul_oeste';
  END IF;

  IF p_zona_input IN ('recife', 'norte', 'sul_oeste') THEN
    RETURN p_zona_input::VARCHAR(50);
  END IF;

  RETURN 'recife';
END;
$$;

-- 2. RPC: Baixar estoque de pedido com validação atômica, lock e sem clamp
-- Obtém o usuário autenticado diretamente de auth.jwt() / auth.uid()
CREATE OR REPLACE FUNCTION baixar_estoque_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pedido RECORD;
  v_item JSONB;
  v_prod_id UUID;
  v_sabor_solicitado TEXT;
  v_qtd INT;
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

  -- 1. Lock exclusivo no pedido para impedir concorrência
  SELECT * INTO v_pedido 
  FROM public.pedidos 
  WHERE id = p_pedido_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id;
  END IF;

  -- Idempotência: só baixa se status_checklist for false
  IF v_pedido.status_checklist = true THEN
    RAISE EXCEPTION 'Pedido #% já teve o estoque baixado anteriormente.', v_pedido.numero_pedido;
  END IF;

  IF v_pedido.excluido = true THEN
    RAISE EXCEPTION 'Não é permitido dar baixa em pedido excluído (Pedido #%).', v_pedido.numero_pedido;
  END IF;

  v_zona_id := resolver_zona_id(v_pedido.zona);

  -- 2. Processar cada item do pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_pedido.itens, '[]'::jsonb)) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_sabor_solicitado := v_item->>'sabor';
    v_qtd := COALESCE((v_item->>'quantidade')::int, 0);

    IF v_qtd <= 0 THEN
      CONTINUE;
    END IF;

    -- Lock exclusivo no produto
    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_prod_id 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado para o item "%" (ID: %) no Pedido #%', 
        COALESCE(v_item->>'nome', 'Item'), v_prod_id, v_pedido.numero_pedido;
    END IF;

    -- Produtos com estoque ilimitado não sofrem baixa
    IF v_produto.estoque_ilimitado THEN
      CONTINUE;
    END IF;

    v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

    -- Verificar se a zona existe no produto
    IF NOT (v_estoque_zonas ? v_zona_id) THEN
      -- Se a zona for 'recife' e o produto tiver sul_oeste ou norte, tentar alternativa
      IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
        v_zona_id := 'sul_oeste';
      ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN
        v_zona_id := 'norte';
      ELSE
        RAISE EXCEPTION 'Produto "%" não possui estoque configurado para a região "%" (Pedido #%)', 
          v_produto.nome, v_zona_id, v_pedido.numero_pedido;
      END IF;
    END IF;

    v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);

    -- Localizar sabor exato ou por casamento normalizado
    v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);

    IF v_chave_sabor IS NULL THEN
      RAISE EXCEPTION 'Sabor "%" não encontrado para o produto "%" na região "%" (Pedido #%). Sabores existentes: %', 
        v_sabor_solicitado, v_produto.nome, v_zona_id, v_pedido.numero_pedido,
        (SELECT string_agg(key, ', ') FROM jsonb_each_text(v_sabores_zona));
    END IF;

    v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

    -- Validação estrita sem clamp silencioso
    IF v_saldo_antes < v_qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%", Região: "%"). Saldo disponível: %, Solicitado: % (Pedido #%)',
        v_produto.nome, v_chave_sabor, v_zona_id, v_saldo_antes, v_qtd, v_pedido.numero_pedido;
    END IF;

    v_saldo_depois := v_saldo_antes - v_qtd;

    -- Atualiza a fonte única (estoque_zonas)
    v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
    v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

    UPDATE public.produtos 
    SET estoque_zonas = v_estoque_zonas
    WHERE id = v_prod_id;

    -- Registrar histórico do movimento
    INSERT INTO public.movimentos_estoque (
      produto_id,
      zona,
      sabor,
      delta,
      saldo_antes,
      saldo_depois,
      tipo,
      pedido_id,
      usuario
    ) VALUES (
      v_prod_id,
      v_zona_id,
      v_chave_sabor,
      -v_qtd,
      v_saldo_antes,
      v_saldo_depois,
      'venda',
      p_pedido_id,
      v_usuario
    );

    -- Recalcula colunas derivadas
    PERFORM recalcular_estoque_produto(v_prod_id);
  END LOOP;

  -- 3. Atualizar status do checklist do pedido
  UPDATE public.pedidos 
  SET status_checklist = true 
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'numero_pedido', v_pedido.numero_pedido,
    'status_checklist', true
  );
END;
$$;

-- Permissões baixar_estoque_pedido
REVOKE ALL ON FUNCTION baixar_estoque_pedido(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION baixar_estoque_pedido(UUID) TO authenticated;

-- 3. RPC: Estornar estoque de pedido com reposição por SALDO LÍQUIDO (-SUM(delta))
-- Sem fallback por itens para pedidos legados anteriores à migração
CREATE OR REPLACE FUNCTION estornar_estoque_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pedido RECORD;
  v_item_mov RECORD;
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_qtd_repor INT;
  v_usuario TEXT;
  v_teve_movimento BOOLEAN := false;
BEGIN
  -- Obter usuário do JWT com segurança
  v_usuario := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  -- 1. Lock exclusivo no pedido
  SELECT * INTO v_pedido 
  FROM public.pedidos 
  WHERE id = p_pedido_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id;
  END IF;

  -- Idempotência: só estorna se status_checklist for true
  IF v_pedido.status_checklist = false THEN
    RAISE EXCEPTION 'Pedido #% não está com o checklist baixado para estorno.', v_pedido.numero_pedido;
  END IF;

  -- 2. Repor o NEGATIVO DA SOMA dos deltas daquele pedido por (produto, zona, sabor)
  -- Isso impede duplicações em ciclos múltiplos de baixa/estorno
  FOR v_item_mov IN 
    SELECT 
      produto_id, 
      zona, 
      sabor, 
      -SUM(delta) AS qtd_repor
    FROM public.movimentos_estoque 
    WHERE pedido_id = p_pedido_id
    GROUP BY produto_id, zona, sabor
    HAVING -SUM(delta) > 0
  LOOP
    v_teve_movimento := true;
    v_qtd_repor := v_item_mov.qtd_repor;

    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_item_mov.produto_id 
    FOR UPDATE;

    IF FOUND THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
      v_sabores_zona := COALESCE(v_estoque_zonas->v_item_mov.zona->'sabores_estoque', '{}'::jsonb);

      v_saldo_antes := COALESCE((v_sabores_zona->>v_item_mov.sabor)::int, 0);
      v_saldo_depois := v_saldo_antes + v_qtd_repor;

      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_item_mov.sabor], to_jsonb(v_saldo_depois));
      v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_item_mov.zona, 'sabores_estoque'], v_sabores_zona);

      UPDATE public.produtos 
      SET estoque_zonas = v_estoque_zonas
      WHERE id = v_item_mov.produto_id;

      -- Registrar movimento de estorno
      INSERT INTO public.movimentos_estoque (
        produto_id,
        zona,
        sabor,
        delta,
        saldo_antes,
        saldo_depois,
        tipo,
        pedido_id,
        usuario,
        motivo
      ) VALUES (
        v_item_mov.produto_id,
        v_item_mov.zona,
        v_item_mov.sabor,
        v_qtd_repor,
        v_saldo_antes,
        v_saldo_depois,
        'estorno',
        p_pedido_id,
        v_usuario,
        'reabertura_ou_cancelamento_pedido'
      );

      PERFORM recalcular_estoque_produto(v_item_mov.produto_id);
    END IF;
  END LOOP;

  -- Para pedidos conferidos antes da migração (sem movimentos registrados),
  -- o estoque NÃO é alterado, pois já está embutido na contagem física inicial.
  -- NÃO há fallback por itens.

  -- 3. Atualizar status do checklist do pedido para false
  UPDATE public.pedidos 
  SET status_checklist = false 
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'numero_pedido', v_pedido.numero_pedido,
    'status_checklist', false,
    'movimentos_estornados', v_teve_movimento
  );
END;
$$;

-- Permissões estornar_estoque_pedido
REVOKE ALL ON FUNCTION estornar_estoque_pedido(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION estornar_estoque_pedido(UUID) TO authenticated;
