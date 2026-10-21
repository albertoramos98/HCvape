-- =========================================================================
-- HC VAPE - MIGRAÇÃO 003: BAIXA E ESTORNO ATÔMICOS POR SALDO LÍQUIDO
-- Com compatibilidade universal de parâmetros e recarga do cache PostgREST
-- =========================================================================

-- 1. Função canônica para resolver identificador de zona (suporta TEXT e VARCHAR)
CREATE OR REPLACE FUNCTION public.resolver_zona_id(p_zona_input TEXT)
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

  v_norm := LOWER(TRIM(p_zona_input));
  v_norm := REGEXP_REPLACE(v_norm, '[áàãâä]', 'a', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[éèêë]', 'e', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[íìîï]', 'i', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[óòõôö]', 'o', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[úùûü]', 'u', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[ç]', 'c', 'g');

  IF v_norm = 'recife' OR v_norm = 'rec' OR v_norm LIKE '%recife%' THEN
    RETURN 'recife';
  ELSIF v_norm = 'norte' OR v_norm LIKE '%norte%' THEN
    RETURN 'norte';
  ELSIF v_norm = 'sul_oeste' OR v_norm = 'suloeste' OR v_norm LIKE '%sul%oeste%' THEN
    RETURN 'sul_oeste';
  ELSIF v_norm = 'sul' OR v_norm = 'oeste' OR v_norm LIKE '%sul%' OR v_norm LIKE '%oeste%' THEN
    RETURN 'sul_oeste';
  ELSIF v_norm = 'gravata' OR v_norm LIKE '%gravata%' THEN
    RETURN 'gravata';
  END IF;

  RETURN 'recife';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_zona_id(p_zona_input VARCHAR)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN public.resolver_zona_id(p_zona_input::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_zona_id(TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_zona_id(VARCHAR) TO PUBLIC, anon, authenticated;

-- 2. Limpar sobrecargas anteriores para evitar conflitos de cache no PostgREST
DROP FUNCTION IF EXISTS public.baixar_estoque_pedido(UUID);
DROP FUNCTION IF EXISTS public.baixar_estoque_pedido(UUID, TEXT);

-- 3. RPC: Baixar estoque de pedido com validação atômica, lock e sem clamp
-- Aceita p_pedido_id (novo) e p_usuario opcional (compatibilidade com versões em cache)
CREATE OR REPLACE FUNCTION baixar_estoque_pedido(
  p_pedido_id UUID,
  p_usuario TEXT DEFAULT NULL
)
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
  -- Obter usuário com prioridade: parâmetro explícito -> JWT -> auth.uid() -> 'sistema'
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
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

  v_zona_id := public.resolver_zona_id(COALESCE(v_pedido.zona::text, 'recife'));

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
REVOKE ALL ON FUNCTION baixar_estoque_pedido(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION baixar_estoque_pedido(UUID, TEXT) TO authenticated;

-- 4. Limpar sobrecargas anteriores de estorno
DROP FUNCTION IF EXISTS public.estornar_estoque_pedido(UUID);
DROP FUNCTION IF EXISTS public.estornar_estoque_pedido(UUID, TEXT);

-- 5. RPC: Estornar estoque de pedido com reposição por SALDO LÍQUIDO (-SUM(delta))
CREATE OR REPLACE FUNCTION estornar_estoque_pedido(
  p_pedido_id UUID,
  p_usuario TEXT DEFAULT NULL
)
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
  -- Obter usuário com prioridade: parâmetro explícito -> JWT -> auth.uid() -> 'sistema'
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
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
REVOKE ALL ON FUNCTION estornar_estoque_pedido(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION estornar_estoque_pedido(UUID, TEXT) TO authenticated;

-- 6. Recarregar cache de schema do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';
