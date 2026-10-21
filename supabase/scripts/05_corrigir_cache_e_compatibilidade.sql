-- =========================================================================
-- HC VAPE - SCRIPT 05: CORREÇÃO DEFINITIVA DE CACHE E COMPATIBILIDADE POSTGREST
-- Objetivo: Resolver o erro "Could not find the function public.baixar_estoque_pedido(p_pedido_id, p_usuario) in the schema cache"
-- Execução: Cole e execute este script completo no SQL Editor do Supabase Dashboard.
-- Efeito: 
--   1. Remove sobrecargas ambíguas de versões antigas.
--   2. Registra assinaturas com "p_usuario TEXT DEFAULT NULL" (compatível tanto
--      com navegadores antigos que enviam p_usuario quanto com versões novas).
--   3. Concede permissões para authenticated.
--   4. Emite NOTIFY pgrst, 'reload schema' para atualizar o cache do Supabase sem reiniciar o banco.
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

  v_norm := LOWER(TRIM(p_zona_input));
  v_norm := REGEXP_REPLACE(v_norm, '[áàãâä]', 'a', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[éèêë]', 'e', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[íìîï]', 'i', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[óòõôö]', 'o', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[úùûü]', 'u', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[ç]', 'c', 'g');

  IF v_norm = 'recife' OR v_norm = 'rec' THEN
    RETURN 'recife';
  ELSIF v_norm = 'norte' OR v_norm LIKE '%norte%' THEN
    RETURN 'norte';
  ELSIF v_norm = 'sul_oeste' OR v_norm LIKE '%sul%' OR v_norm LIKE '%oeste%' THEN
    RETURN 'sul_oeste';
  ELSIF v_norm = 'gravata' OR v_norm LIKE '%gravata%' THEN
    RETURN 'gravata';
  END IF;

  RETURN 'recife';
END;
$$;

-- 2. Limpar sobrecargas anteriores de baixar_estoque_pedido
DROP FUNCTION IF EXISTS public.baixar_estoque_pedido(UUID);
DROP FUNCTION IF EXISTS public.baixar_estoque_pedido(UUID, TEXT);

-- Criar baixar_estoque_pedido com p_usuario opcional (DEFAULT NULL)
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

    -- Atualizar a fonte única da verdade (estoque_zonas)
    v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
    v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

    UPDATE public.produtos 
    SET estoque_zonas = v_estoque_zonas
    WHERE id = v_prod_id;

    -- Registrar histórico do movimento para rastreabilidade e estorno simétrico
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
      v_prod_id,
      v_zona_id,
      v_chave_sabor,
      -v_qtd,
      v_saldo_antes,
      v_saldo_depois,
      'venda',
      p_pedido_id,
      v_usuario,
      'baixa_checklist'
    );

    -- Recalcular colunas derivadas (estoque, sabores_estoque)
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

-- 3. Limpar sobrecargas anteriores de estornar_estoque_pedido
DROP FUNCTION IF EXISTS public.estornar_estoque_pedido(UUID);
DROP FUNCTION IF EXISTS public.estornar_estoque_pedido(UUID, TEXT);

-- Criar estornar_estoque_pedido com p_usuario opcional (DEFAULT NULL)
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

-- 4. Limpar sobrecargas anteriores de ajustar_estoque
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT);

-- Criar ajustar_estoque com p_usuario opcional (DEFAULT NULL)
CREATE OR REPLACE FUNCTION ajustar_estoque(
  p_produto_id UUID,
  p_zona_id VARCHAR(50),
  p_sabor TEXT,
  p_operacao TEXT, -- 'definir' ou 'delta'
  p_valor INT,
  p_motivo TEXT DEFAULT 'ajuste_manual',
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_antes INT;
  v_saldo_depois INT;
  v_delta INT;
  v_usuario TEXT;
BEGIN
  IF p_operacao NOT IN ('definir', 'delta') THEN
    RAISE EXCEPTION 'Operação inválida: "%". As operações permitidas são "definir" ou "delta".', p_operacao;
  END IF;

  -- Obter usuário com prioridade: parâmetro explícito -> JWT -> auth.uid() -> 'sistema'
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  -- 1. Lock exclusivo no produto
  SELECT * INTO v_produto 
  FROM public.produtos 
  WHERE id = p_produto_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

  -- Se o produto não possui a chave da zona, inicializar
  IF NOT (v_estoque_zonas ? p_zona_id) THEN
    v_estoque_zonas := jsonb_set(
      v_estoque_zonas, 
      ARRAY[p_zona_id], 
      jsonb_build_object('estoque', 0, 'sabores_estoque', '{}'::jsonb)
    );
  END IF;

  v_sabores_zona := COALESCE(v_estoque_zonas->p_zona_id->'sabores_estoque', '{}'::jsonb);

  -- Localizar o sabor exato ou por casamento
  v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, p_sabor);
  IF v_chave_sabor IS NULL THEN
    v_chave_sabor := TRIM(p_sabor);
  END IF;

  v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

  IF p_operacao = 'definir' THEN
    IF p_valor < 0 THEN
      RAISE EXCEPTION 'Estoque não pode ser definido para valor negativo: %', p_valor;
    END IF;
    v_saldo_depois := p_valor;
    v_delta := v_saldo_depois - v_saldo_antes;
  ELSIF p_operacao = 'delta' THEN
    v_delta := p_valor;
    v_saldo_depois := v_saldo_antes + v_delta;
    IF v_saldo_depois < 0 THEN
      RAISE EXCEPTION 'Ajuste de delta % resultaria em saldo negativo (%) para o produto "%" (Sabor: %, Zona: %)',
        v_delta, v_saldo_depois, v_produto.nome, v_chave_sabor, p_zona_id;
    END IF;
  END IF;

  -- 2. Atualizar estoque_zonas
  v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
  v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[p_zona_id, 'sabores_estoque'], v_sabores_zona);

  UPDATE public.produtos 
  SET estoque_zonas = v_estoque_zonas
  WHERE id = p_produto_id;

  -- 3. Registrar na tabela de movimentos se houve alteração real
  IF v_delta <> 0 THEN
    INSERT INTO public.movimentos_estoque (
      produto_id,
      zona,
      sabor,
      delta,
      saldo_antes,
      saldo_depois,
      tipo,
      usuario,
      motivo
    ) VALUES (
      p_produto_id,
      p_zona_id,
      v_chave_sabor,
      v_delta,
      v_saldo_antes,
      v_saldo_depois,
      'ajuste',
      v_usuario,
      COALESCE(p_motivo, 'ajuste_manual')
    );
  END IF;

  -- 4. Recalcular campos derivados
  PERFORM recalcular_estoque_produto(p_produto_id);

  RETURN jsonb_build_object(
    'success', true,
    'produto_id', p_produto_id,
    'zona', p_zona_id,
    'sabor', v_chave_sabor,
    'saldo_antes', v_saldo_antes,
    'saldo_depois', v_saldo_depois,
    'delta', v_delta
  );
END;
$$;

-- Permissões ajustar_estoque
REVOKE ALL ON FUNCTION ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated;

-- 5. Limpar sobrecargas anteriores de estornar_troca
DROP FUNCTION IF EXISTS public.estornar_troca(UUID);
DROP FUNCTION IF EXISTS public.estornar_troca(UUID, TEXT);

-- Criar estornar_troca com p_usuario opcional (DEFAULT NULL)
CREATE OR REPLACE FUNCTION estornar_troca(
  p_troca_id UUID,
  p_usuario TEXT DEFAULT NULL
)
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
  -- Obter usuário com prioridade: parâmetro explícito -> JWT -> auth.uid() -> 'sistema'
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
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

  -- 2. Se abateu estoque, estornar o saldo líquido registrado nos movimentos
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
REVOKE ALL ON FUNCTION estornar_troca(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION estornar_troca(UUID, TEXT) TO authenticated;

-- 6. Recarregar cache de schema do PostgREST imediatamente em toda a instância
NOTIFY pgrst, 'reload schema';
