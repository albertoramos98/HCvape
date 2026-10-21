-- =========================================================================
-- HC VAPE - SUÍTE COMPLETA DE TESTES SQL EM TRANSAÇÃO REVERSÍVEL (AUTO-CONTIDA)
-- Execução: Pode ser colada inteira no SQL Editor do Supabase.
-- NENHUM dado é salvo (termina com ROLLBACK).
-- Inclui as definições das funções para execução autônoma em qualquer estado.
-- =========================================================================

BEGIN;

-- 1. Simular JWT de usuário autenticado
SELECT set_config(
  'request.jwt.claims', 
  '{"sub": "00000000-0000-0000-0000-000000000001", "email": "auditor@hcvape.com", "role": "authenticated"}', 
  true
);

-- -------------------------------------------------------------------------
-- DEFINIÇÃO DAS FUNÇÕES DENTRO DA TRANSAÇÃO (REVERSÍVEL)
-- -------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION normalizar_sabor(p_texto TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_texto IS NULL THEN RETURN ''; END IF;
  RETURN LOWER(TRIM(REGEXP_REPLACE(extensions.unaccent(p_texto), '\s+', ' ', 'g')));
END;
$$;

CREATE OR REPLACE FUNCTION encontrar_chave_sabor(p_sabores_estoque JSONB, p_sabor_procurado TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_chave TEXT; v_norm_procurado TEXT;
BEGIN
  IF p_sabores_estoque IS NULL OR p_sabor_procurado IS NULL THEN RETURN NULL; END IF;
  IF p_sabores_estoque ? p_sabor_procurado THEN RETURN p_sabor_procurado; END IF;
  v_norm_procurado := normalizar_sabor(p_sabor_procurado);
  FOR v_chave IN SELECT jsonb_object_keys(p_sabores_estoque) LOOP
    IF normalizar_sabor(v_chave) = v_norm_procurado THEN RETURN v_chave; END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION recalcular_estoque_produto(p_produto_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_produto RECORD; v_estoque_zonas JSONB;
  v_sabores_estoque_consolidado JSONB := '{}'::jsonb;
  v_estoque_total INT := 0; v_zona_key TEXT; v_zona_data JSONB;
  v_sabor_key TEXT; v_qtd_sabor INT; v_qtd_zona_total INT;
  v_novo_estoque_zonas JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_produto FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id; END IF;
  v_estoque_zonas := v_produto.estoque_zonas;
  IF v_estoque_zonas IS NULL OR v_estoque_zonas = '{}'::jsonb THEN
    RAISE EXCEPTION 'Produto "%" (ID: %) possui estoque_zonas vazio. Recálculo abortado para evitar zeramento acidental.', 
      v_produto.nome, p_produto_id;
  END IF;
  IF v_produto.estoque_ilimitado THEN
    RETURN jsonb_build_object('produto_id', p_produto_id, 'estoque_ilimitado', true, 'estoque', v_produto.estoque);
  END IF;
  FOR v_zona_key, v_zona_data IN SELECT * FROM jsonb_each(v_estoque_zonas) LOOP
    v_qtd_zona_total := 0;
    IF v_zona_data ? 'sabores_estoque' AND jsonb_typeof(v_zona_data->'sabores_estoque') = 'object' THEN
      FOR v_sabor_key, v_qtd_sabor IN SELECT key, value::int FROM jsonb_each_text(v_zona_data->'sabores_estoque') LOOP
        v_qtd_zona_total := v_qtd_zona_total + v_qtd_sabor;
        v_sabores_estoque_consolidado := jsonb_set(
          v_sabores_estoque_consolidado, ARRAY[v_sabor_key],
          to_jsonb(COALESCE((v_sabores_estoque_consolidado->>v_sabor_key)::int, 0) + v_qtd_sabor)
        );
      END LOOP;
    ELSE
      v_qtd_zona_total := COALESCE((v_zona_data->>'estoque')::int, 0);
    END IF;
    v_zona_data := jsonb_set(v_zona_data, '{estoque}', to_jsonb(v_qtd_zona_total));
    v_novo_estoque_zonas := jsonb_set(v_novo_estoque_zonas, ARRAY[v_zona_key], v_zona_data);
    v_estoque_total := v_estoque_total + v_qtd_zona_total;
  END LOOP;
  UPDATE public.produtos
  SET estoque = v_estoque_total, sabores_estoque = v_sabores_estoque_consolidado, estoque_zonas = v_novo_estoque_zonas
  WHERE id = p_produto_id;
  RETURN jsonb_build_object('produto_id', p_produto_id, 'novo_estoque', v_estoque_total, 'sabores_estoque', v_sabores_estoque_consolidado);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_zona_id(p_zona_input TEXT)
RETURNS VARCHAR(50) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_norm TEXT;
BEGIN
  IF p_zona_input IS NULL OR TRIM(p_zona_input) = '' THEN RETURN 'recife'; END IF;
  v_norm := LOWER(TRIM(p_zona_input));
  v_norm := REGEXP_REPLACE(v_norm, '[áàãâä]', 'a', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[éèêë]', 'e', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[íìîï]', 'i', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[óòõôö]', 'o', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[úùûü]', 'u', 'g');
  v_norm := REGEXP_REPLACE(v_norm, '[ç]', 'c', 'g');
  IF v_norm = 'recife' OR v_norm = 'rec' OR v_norm LIKE '%recife%' THEN RETURN 'recife';
  ELSIF v_norm = 'norte' OR v_norm LIKE '%norte%' THEN RETURN 'norte';
  ELSIF v_norm = 'sul_oeste' OR v_norm = 'suloeste' OR v_norm LIKE '%sul%oeste%' THEN RETURN 'sul_oeste';
  ELSIF v_norm = 'sul' OR v_norm = 'oeste' OR v_norm LIKE '%sul%' OR v_norm LIKE '%oeste%' THEN RETURN 'sul_oeste';
  ELSIF v_norm = 'gravata' OR v_norm LIKE '%gravata%' THEN RETURN 'gravata';
  END IF;
  RETURN 'recife';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_zona_id(p_zona_input VARCHAR)
RETURNS VARCHAR(50) LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN public.resolver_zona_id(p_zona_input::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_zona_id(TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_zona_id(VARCHAR) TO PUBLIC, anon, authenticated;

-- Limpar sobrecargas de ajustar_estoque
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, VARCHAR, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION ajustar_estoque(
  p_produto_id UUID, p_zona_id VARCHAR(50), p_sabor TEXT, p_operacao TEXT, p_valor INT,
  p_motivo TEXT DEFAULT 'ajuste_manual', p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_produto RECORD; v_estoque_zonas JSONB; v_sabores_zona JSONB; v_chave_sabor TEXT;
  v_saldo_antes INT; v_saldo_depois INT; v_delta INT; v_usuario TEXT;
BEGIN
  IF p_operacao NOT IN ('definir', 'delta') THEN
    RAISE EXCEPTION 'Operação inválida: "%". Permitidas: "definir" ou "delta".', p_operacao;
  END IF;
  v_usuario := COALESCE(NULLIF(TRIM(p_usuario), ''), current_setting('request.jwt.claims', true)::jsonb->>'email', auth.uid()::text, 'sistema');
  SELECT * INTO v_produto FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id; END IF;
  v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
  IF NOT (v_estoque_zonas ? p_zona_id) THEN
    v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[p_zona_id], jsonb_build_object('estoque', 0, 'sabores_estoque', '{}'::jsonb));
  END IF;
  v_sabores_zona := COALESCE(v_estoque_zonas->p_zona_id->'sabores_estoque', '{}'::jsonb);
  v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, p_sabor);
  IF v_chave_sabor IS NULL THEN v_chave_sabor := TRIM(p_sabor); END IF;
  v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);
  IF p_operacao = 'definir' THEN
    IF p_valor < 0 THEN RAISE EXCEPTION 'Estoque não pode ser negativo: %', p_valor; END IF;
    v_saldo_depois := p_valor; v_delta := v_saldo_depois - v_saldo_antes;
  ELSIF p_operacao = 'delta' THEN
    v_delta := p_valor; v_saldo_depois := v_saldo_antes + v_delta;
    IF v_saldo_depois < 0 THEN RAISE EXCEPTION 'Ajuste resultaria em saldo negativo (%)', v_saldo_depois; END IF;
  END IF;
  v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
  v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[p_zona_id, 'sabores_estoque'], v_sabores_zona);
  UPDATE public.produtos SET estoque_zonas = v_estoque_zonas WHERE id = p_produto_id;
  IF v_delta <> 0 THEN
    INSERT INTO public.movimentos_estoque (produto_id, zona, sabor, delta, saldo_antes, saldo_depois, tipo, usuario, motivo)
    VALUES (p_produto_id, p_zona_id, v_chave_sabor, v_delta, v_saldo_antes, v_saldo_depois, 'ajuste', v_usuario, COALESCE(p_motivo, 'ajuste_manual'));
  END IF;
  PERFORM recalcular_estoque_produto(p_produto_id);
  RETURN jsonb_build_object('success', true, 'produto_id', p_produto_id, 'zona', p_zona_id, 'sabor', v_chave_sabor, 'saldo_antes', v_saldo_antes, 'saldo_depois', v_saldo_depois, 'delta', v_delta);
END;
$$;

CREATE OR REPLACE FUNCTION ajustar_estoque(
  p_produto_id UUID, p_zona VARCHAR(50), p_sabor VARCHAR(255), p_nova_qtd INT,
  p_motivo TEXT DEFAULT 'ajuste_manual', p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  RETURN ajustar_estoque(p_produto_id, p_zona, p_sabor, 'definir', p_nova_qtd, p_motivo, p_usuario);
END;
$$;

DROP FUNCTION IF EXISTS public.baixar_estoque_pedido(UUID);
DROP FUNCTION IF EXISTS public.baixar_estoque_pedido(UUID, TEXT);

CREATE OR REPLACE FUNCTION baixar_estoque_pedido(p_pedido_id UUID, p_usuario TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_pedido RECORD; v_item JSONB; v_prod_id UUID; v_sabor_solicitado TEXT; v_qtd INT;
  v_zona_id VARCHAR(50); v_produto RECORD; v_estoque_zonas JSONB; v_sabores_zona JSONB;
  v_chave_sabor TEXT; v_saldo_antes INT; v_saldo_depois INT; v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(NULLIF(TRIM(p_usuario), ''), current_setting('request.jwt.claims', true)::jsonb->>'email', auth.uid()::text, 'sistema');
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id; END IF;
  IF v_pedido.status_checklist = true THEN RAISE EXCEPTION 'Pedido #% já teve o estoque baixado anteriormente.', v_pedido.numero_pedido; END IF;
  IF v_pedido.excluido = true THEN RAISE EXCEPTION 'Não é permitido dar baixa em pedido excluído (Pedido #%).', v_pedido.numero_pedido; END IF;
  v_zona_id := public.resolver_zona_id(COALESCE(v_pedido.zona::text, 'recife'));
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_pedido.itens, '[]'::jsonb)) LOOP
    v_prod_id := (v_item->>'id')::UUID; v_sabor_solicitado := v_item->>'sabor'; v_qtd := COALESCE((v_item->>'quantidade')::int, 0);
    IF v_qtd <= 0 THEN CONTINUE; END IF;
    SELECT * INTO v_produto FROM public.produtos WHERE id = v_prod_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado para o item "%" (ID: %) no Pedido #%', COALESCE(v_item->>'nome', 'Item'), v_prod_id, v_pedido.numero_pedido; END IF;
    IF v_produto.estoque_ilimitado THEN CONTINUE; END IF;
    v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
    IF NOT (v_estoque_zonas ? v_zona_id) THEN
      IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN v_zona_id := 'sul_oeste';
      ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN v_zona_id := 'norte';
      ELSE RAISE EXCEPTION 'Produto "%" não possui estoque configurado para a região "%" (Pedido #%)', v_produto.nome, v_zona_id, v_pedido.numero_pedido; END IF;
    END IF;
    v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
    v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);
    IF v_chave_sabor IS NULL THEN RAISE EXCEPTION 'Sabor "%" não encontrado para o produto "%" na região "%" (Pedido #%)', v_sabor_solicitado, v_produto.nome, v_zona_id, v_pedido.numero_pedido; END IF;
    v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);
    IF v_saldo_antes < v_qtd THEN RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%", Região: "%"). Saldo disponível: %, Solicitado: % (Pedido #%)', v_produto.nome, v_chave_sabor, v_zona_id, v_saldo_antes, v_qtd, v_pedido.numero_pedido; END IF;
    v_saldo_depois := v_saldo_antes - v_qtd;
    v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
    v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);
    UPDATE public.produtos SET estoque_zonas = v_estoque_zonas WHERE id = v_prod_id;
    INSERT INTO public.movimentos_estoque (produto_id, zona, sabor, delta, saldo_antes, saldo_depois, tipo, pedido_id, usuario, motivo)
    VALUES (v_prod_id, v_zona_id, v_chave_sabor, -v_qtd, v_saldo_antes, v_saldo_depois, 'venda', p_pedido_id, v_usuario, 'baixa_checklist');
    PERFORM recalcular_estoque_produto(v_prod_id);
  END LOOP;
  UPDATE public.pedidos SET status_checklist = true WHERE id = p_pedido_id;
  RETURN jsonb_build_object('success', true, 'pedido_id', p_pedido_id, 'numero_pedido', v_pedido.numero_pedido, 'status_checklist', true);
END;
$$;

DROP FUNCTION IF EXISTS public.estornar_estoque_pedido(UUID);
DROP FUNCTION IF EXISTS public.estornar_estoque_pedido(UUID, TEXT);

CREATE OR REPLACE FUNCTION estornar_estoque_pedido(p_pedido_id UUID, p_usuario TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_pedido RECORD; v_item_mov RECORD; v_produto RECORD; v_estoque_zonas JSONB;
  v_sabores_zona JSONB; v_saldo_antes INT; v_saldo_depois INT; v_qtd_repor INT;
  v_usuario TEXT; v_teve_movimento BOOLEAN := false;
BEGIN
  v_usuario := COALESCE(NULLIF(TRIM(p_usuario), ''), current_setting('request.jwt.claims', true)::jsonb->>'email', auth.uid()::text, 'sistema');
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id; END IF;
  IF v_pedido.status_checklist = false THEN RAISE EXCEPTION 'Pedido #% não está com o checklist baixado para estorno.', v_pedido.numero_pedido; END IF;
  FOR v_item_mov IN 
    SELECT produto_id, zona, sabor, -SUM(delta) AS qtd_repor FROM public.movimentos_estoque 
    WHERE pedido_id = p_pedido_id GROUP BY produto_id, zona, sabor HAVING -SUM(delta) > 0
  LOOP
    v_teve_movimento := true; v_qtd_repor := v_item_mov.qtd_repor;
    SELECT * INTO v_produto FROM public.produtos WHERE id = v_item_mov.produto_id FOR UPDATE;
    IF FOUND THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
      v_sabores_zona := COALESCE(v_estoque_zonas->v_item_mov.zona->'sabores_estoque', '{}'::jsonb);
      v_saldo_antes := COALESCE((v_sabores_zona->>v_item_mov.sabor)::int, 0);
      v_saldo_depois := v_saldo_antes + v_qtd_repor;
      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_item_mov.sabor], to_jsonb(v_saldo_depois));
      v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_item_mov.zona, 'sabores_estoque'], v_sabores_zona);
      UPDATE public.produtos SET estoque_zonas = v_estoque_zonas WHERE id = v_item_mov.produto_id;
      INSERT INTO public.movimentos_estoque (produto_id, zona, sabor, delta, saldo_antes, saldo_depois, tipo, pedido_id, usuario, motivo)
      VALUES (v_item_mov.produto_id, v_item_mov.zona, v_item_mov.sabor, v_qtd_repor, v_saldo_antes, v_saldo_depois, 'estorno', p_pedido_id, v_usuario, 'reabertura_ou_cancelamento_pedido');
      PERFORM recalcular_estoque_produto(v_item_mov.produto_id);
    END IF;
  END LOOP;
  UPDATE public.pedidos SET status_checklist = false WHERE id = p_pedido_id;
  RETURN jsonb_build_object('success', true, 'pedido_id', p_pedido_id, 'numero_pedido', v_pedido.numero_pedido, 'status_checklist', false, 'movimentos_estornados', v_teve_movimento);
END;
$$;

DROP FUNCTION IF EXISTS public.estornar_troca(UUID);
DROP FUNCTION IF EXISTS public.estornar_troca(UUID, TEXT);

CREATE OR REPLACE FUNCTION estornar_troca(p_troca_id UUID, p_usuario TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_troca RECORD; v_mov_agrupado RECORD; v_produto RECORD; v_estoque_zonas JSONB;
  v_sabores_zona JSONB; v_saldo_antes INT; v_saldo_depois INT; v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(NULLIF(TRIM(p_usuario), ''), current_setting('request.jwt.claims', true)::jsonb->>'email', auth.uid()::text, 'sistema');
  SELECT * INTO v_troca FROM public.trocas WHERE id = p_troca_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de troca não encontrado: %', p_troca_id; END IF;
  IF v_troca.status = 'cancelada' THEN RAISE EXCEPTION 'Registro de troca já se encontra cancelado.'; END IF;
  IF v_troca.abateu_estoque = true THEN
    FOR v_mov_agrupado IN 
      SELECT produto_id, zona, sabor, -SUM(delta) AS qtd_repor FROM public.movimentos_estoque 
      WHERE troca_id = p_troca_id GROUP BY produto_id, zona, sabor HAVING -SUM(delta) > 0
    LOOP
      SELECT * INTO v_produto FROM public.produtos WHERE id = v_mov_agrupado.produto_id FOR UPDATE;
      IF FOUND THEN
        v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
        v_sabores_zona := COALESCE(v_estoque_zonas->v_mov_agrupado.zona->'sabores_estoque', '{}'::jsonb);
        v_saldo_antes := COALESCE((v_sabores_zona->>v_mov_agrupado.sabor)::int, 0);
        v_saldo_depois := v_saldo_antes + v_mov_agrupado.qtd_repor;
        v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_mov_agrupado.sabor], to_jsonb(v_saldo_depois));
        v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_mov_agrupado.zona, 'sabores_estoque'], v_sabores_zona);
        UPDATE public.produtos SET estoque_zonas = v_estoque_zonas WHERE id = v_mov_agrupado.produto_id;
        INSERT INTO public.movimentos_estoque (produto_id, zona, sabor, delta, saldo_antes, saldo_depois, tipo, troca_id, usuario, motivo)
        VALUES (v_mov_agrupado.produto_id, v_mov_agrupado.zona, v_mov_agrupado.sabor, v_mov_agrupado.qtd_repor, v_saldo_antes, v_saldo_depois, 'troca_estorno', p_troca_id, v_usuario, 'cancelamento_troca');
        PERFORM recalcular_estoque_produto(v_mov_agrupado.produto_id);
      END IF;
    END LOOP;
  END IF;
  UPDATE public.trocas SET status = 'cancelada' WHERE id = p_troca_id;
  RETURN jsonb_build_object('success', true, 'troca_id', p_troca_id, 'status', 'cancelada');
END;
$$;

CREATE OR REPLACE FUNCTION registrar_troca(
  p_cliente_nome TEXT, p_cliente_telefone TEXT, p_vape_defeito TEXT, p_sabor_defeito TEXT,
  p_motivo TEXT, p_motivo_detalhes TEXT, p_vape_trocado TEXT, p_sabor_trocado TEXT,
  p_produto_trocado_id UUID, p_zona VARCHAR(50), p_abater_estoque BOOLEAN,
  p_observacoes TEXT DEFAULT NULL, p_data_troca TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_troca_id UUID := gen_random_uuid(); v_zona_id VARCHAR(50); v_produto RECORD;
  v_estoque_zonas JSONB; v_sabores_zona JSONB; v_chave_sabor TEXT;
  v_saldo_antes INT; v_saldo_depois INT; v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'email', auth.uid()::text, 'sistema');
  IF p_cliente_nome IS NULL OR TRIM(p_cliente_nome) = '' THEN RAISE EXCEPTION 'Nome do cliente é obrigatório.'; END IF;
  IF p_vape_defeito IS NULL OR TRIM(p_vape_defeito) = '' THEN RAISE EXCEPTION 'Vape com defeito é obrigatório.'; END IF;
  IF p_abater_estoque = true THEN
    IF p_produto_trocado_id IS NULL THEN RAISE EXCEPTION 'Produto entregue deve ser selecionado.'; END IF;
    IF p_sabor_trocado IS NULL OR TRIM(p_sabor_trocado) = '' THEN RAISE EXCEPTION 'Sabor do vape entregue é obrigatório.'; END IF;
    v_zona_id := public.resolver_zona_id(COALESCE(p_zona::text, 'recife'));
    SELECT * INTO v_produto FROM public.produtos WHERE id = p_produto_trocado_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto trocado não encontrado (ID: %).', p_produto_trocado_id; END IF;
    IF NOT v_produto.estoque_ilimitado THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
      IF NOT (v_estoque_zonas ? v_zona_id) THEN
        IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN v_zona_id := 'sul_oeste';
        ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN v_zona_id := 'norte';
        ELSE RAISE EXCEPTION 'Produto "%" não possui estoque configurado para a região "%".', v_produto.nome, v_zona_id; END IF;
      END IF;
      v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
      v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, p_sabor_trocado);
      IF v_chave_sabor IS NULL THEN RAISE EXCEPTION 'Sabor "%" não encontrado para o produto "%" na região "%".', p_sabor_trocado, v_produto.nome, v_zona_id; END IF;
      v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);
      IF v_saldo_antes < 1 THEN RAISE EXCEPTION 'Estoque insuficiente para troca do produto "%" (Sabor: "%"). Saldo disponível: 0.', v_produto.nome, v_chave_sabor; END IF;
      v_saldo_depois := v_saldo_antes - 1;
      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
      v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);
      UPDATE public.produtos SET estoque_zonas = v_estoque_zonas WHERE id = p_produto_trocado_id;
      INSERT INTO public.movimentos_estoque (produto_id, zona, sabor, delta, saldo_antes, saldo_depois, tipo, troca_id, usuario, motivo)
      VALUES (p_produto_trocado_id, v_zona_id, v_chave_sabor, -1, v_saldo_antes, v_saldo_depois, 'troca_saida', v_troca_id, v_usuario, COALESCE(p_motivo, 'troca_garantia'));
      PERFORM recalcular_estoque_produto(p_produto_trocado_id);
    END IF;
  END IF;
  INSERT INTO public.trocas (id, cliente_nome, cliente_telefone, data_troca, vape_defeito, sabor_defeito, motivo, motivo_detalhes, vape_trocado, sabor_trocado, produto_trocado_id, zona, abater_estoque, observacoes, status)
  VALUES (v_troca_id, TRIM(p_cliente_nome), TRIM(COALESCE(p_cliente_telefone, '')), COALESCE(p_data_troca, now()), TRIM(p_vape_defeito), TRIM(COALESCE(p_sabor_defeito, '')), TRIM(COALESCE(p_motivo, '')), TRIM(COALESCE(p_motivo_detalhes, '')), TRIM(COALESCE(p_vape_trocado, '')), TRIM(COALESCE(p_sabor_trocado, '')), p_produto_trocado_id, p_zona, COALESCE(p_abater_estoque, false), TRIM(COALESCE(p_observacoes, '')), 'concluida');
  RETURN jsonb_build_object('success', true, 'troca_id', v_troca_id, 'status', 'concluida', 'abateu_estoque', COALESCE(p_abater_estoque, false));
END;
$$;

CREATE OR REPLACE FUNCTION criar_pedido_catalogo(
  p_nome_cliente TEXT, p_telefone_cliente TEXT, p_indicacao TEXT, p_zona TEXT,
  p_itens JSONB, p_total NUMERIC DEFAULT 0, p_desconto NUMERIC DEFAULT 0,
  p_total_final NUMERIC DEFAULT 0, p_notas TEXT DEFAULT ''
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_pedido_id UUID := gen_random_uuid(); v_numero_pedido INT; v_zona_id VARCHAR(50);
  v_item JSONB; v_prod_id UUID; v_sabor_solicitado TEXT; v_qtd INT; v_produto RECORD;
  v_estoque_zonas JSONB; v_sabores_zona JSONB; v_chave_sabor TEXT; v_saldo_disponivel INT;
  v_preco_unitario NUMERIC(10,2); v_item_total NUMERIC(10,2); v_total_recalculado NUMERIC(10,2) := 0;
  v_desconto_aplicado NUMERIC(10,2); v_total_final_calculado NUMERIC(10,2);
  v_itens_higienizados JSONB := '[]'::jsonb;
BEGIN
  IF p_nome_cliente IS NULL OR TRIM(p_nome_cliente) = '' THEN RAISE EXCEPTION 'Nome do cliente é obrigatório.'; END IF;
  IF p_telefone_cliente IS NULL OR TRIM(p_telefone_cliente) = '' THEN RAISE EXCEPTION 'WhatsApp do cliente é obrigatório.'; END IF;
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'O pedido deve conter pelo menos um item.'; END IF;
  v_zona_id := public.resolver_zona_id(COALESCE(p_zona::text, 'recife'));
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := (v_item->>'id')::UUID; v_sabor_solicitado := v_item->>'sabor'; v_qtd := COALESCE((v_item->>'quantidade')::int, 0);
    IF v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida para o item "%"', COALESCE(v_item->>'nome', 'Item'); END IF;
    SELECT * INTO v_produto FROM public.produtos WHERE id = v_prod_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado: %', v_prod_id; END IF;
    IF v_produto.ativo = false THEN RAISE EXCEPTION 'O produto "%" está indisponível.', v_produto.nome; END IF;
    IF NOT v_produto.estoque_ilimitado THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
      IF NOT (v_estoque_zonas ? v_zona_id) THEN
        IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN v_zona_id := 'sul_oeste';
        ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN v_zona_id := 'norte';
        ELSE RAISE EXCEPTION 'Produto "%" não possui estoque configurado para a região "%".', v_produto.nome, v_zona_id; END IF;
      END IF;
      v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
      v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);
      IF v_chave_sabor IS NULL THEN RAISE EXCEPTION 'Sabor "%" não disponível para o produto "%" na região "%".', v_sabor_solicitado, v_produto.nome, v_zona_id; END IF;
      v_saldo_disponivel := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);
      IF v_saldo_disponivel < v_qtd THEN RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%"). Disponível: %, Solicitado: %.', v_produto.nome, v_chave_sabor, v_saldo_disponivel, v_qtd; END IF;
    ELSE
      v_chave_sabor := v_sabor_solicitado;
    END IF;
    IF v_produto.is_promo = true AND v_produto.preco_promo IS NOT NULL AND v_produto.preco_promo > 0 THEN v_preco_unitario := v_produto.preco_promo;
    ELSE v_preco_unitario := v_produto.preco; END IF;
    v_item_total := v_preco_unitario * v_qtd;
    v_total_recalculado := v_total_recalculado + v_item_total;
    v_itens_higienizados := v_itens_higienizados || jsonb_build_object('id', v_prod_id, 'marca', v_produto.marca, 'nome', v_produto.nome, 'sabor', v_chave_sabor, 'quantidade', v_qtd, 'preco_unitario', v_preco_unitario, 'total', v_item_total, 'is_promo', COALESCE(v_produto.is_promo, false));
  END LOOP;
  v_desconto_aplicado := GREATEST(0, COALESCE(p_desconto, 0));
  IF v_desconto_aplicado > v_total_recalculado THEN v_desconto_aplicado := v_total_recalculado; END IF;
  v_total_final_calculado := GREATEST(0, v_total_recalculado - v_desconto_aplicado);
  SELECT COALESCE(MAX(numero_pedido), 1000) + 1 INTO v_numero_pedido FROM public.pedidos;
  INSERT INTO public.pedidos (id, numero_pedido, nome_cliente, telefone_cliente, indicacao, zona, itens, total, desconto, total_final, status_checklist, notas, excluido)
  VALUES (v_pedido_id, v_numero_pedido, TRIM(p_nome_cliente), TRIM(p_telefone_cliente), TRIM(COALESCE(p_indicacao, '')), v_zona_id, v_itens_higienizados, v_total_recalculado, v_desconto_aplicado, v_total_final_calculado, false, TRIM(COALESCE(p_notas, '')), false);
  RETURN jsonb_build_object('id', v_pedido_id, 'numero_pedido', v_numero_pedido, 'nome_cliente', TRIM(p_nome_cliente), 'telefone_cliente', TRIM(p_telefone_cliente), 'zona', v_zona_id, 'total', v_total_recalculado, 'desconto', v_desconto_aplicado, 'total_final', v_total_final_calculado, 'status_checklist', false);
END;
$$;

CREATE OR REPLACE FUNCTION criar_pedido_catalogo(dados JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  RETURN criar_pedido_catalogo(
    (dados->>'nome_cliente'), (dados->>'telefone_cliente'), (dados->>'indicacao'), (dados->>'zona'),
    (dados->'itens'), COALESCE((dados->>'total')::numeric, 0), COALESCE((dados->>'desconto')::numeric, 0),
    COALESCE((dados->>'total_final')::numeric, 0), COALESCE((dados->>'notas'), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION recalcular_estoque_produto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION recalcular_estoque_produto(UUID) TO authenticated;
REVOKE ALL ON FUNCTION ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION baixar_estoque_pedido(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION baixar_estoque_pedido(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION estornar_estoque_pedido(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION estornar_estoque_pedido(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION registrar_troca FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_troca TO authenticated;
REVOKE ALL ON FUNCTION estornar_troca(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION estornar_troca(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION criar_pedido_catalogo(TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION criar_pedido_catalogo(JSONB) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- EXECUÇÃO DOS 15 CENÁRIOS DE TESTE EM TRANSAÇÃO REVERSÍVEL
-- -------------------------------------------------------------------------

DO $$
DECLARE
  v_prod_id UUID := gen_random_uuid();
  v_prod_legado_id UUID := gen_random_uuid();
  v_prod_ilim_id UUID := gen_random_uuid();
  v_pedido_res JSONB;
  v_pedido_id UUID;
  v_pedido_insuficiente_id UUID;
  v_troca_res JSONB;
  v_troca_id UUID;
  v_res JSONB;
  v_estoque_final INT;
  v_deu_erro BOOLEAN := false;
  v_saldo_menta INT;
  v_saldo_uva INT;
BEGIN
  RAISE NOTICE '=== INICIANDO SUÍTE DE TESTES DE ESTOQUE BLINDADO ===';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 1: Recálculo em produto legado com estoque_zonas vazio DEVE ABORTAR
  -- -----------------------------------------------------------------------
  INSERT INTO public.produtos (
    id, marca, nome, preco, estoque, sabores, sabores_estoque, zonas, estoque_zonas, ativo
  ) VALUES (
    v_prod_legado_id, 'TESTE_LEGADO', 'PROD SEM ZONAS', 100, 10,
    ARRAY['Menta Ice'], '{"Menta Ice": 10}'::jsonb,
    ARRAY['recife'], '{}'::jsonb, true
  );

  BEGIN
    PERFORM recalcular_estoque_produto(v_prod_legado_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 1 [PASSOU]: recalcular_estoque_produto abortou com sucesso em produto legado vazio: %', SQLERRM;
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 1: recalcular_estoque_produto deveria ter abortado para estoque_zonas vazio!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 2: Criação de produto de teste com 2 sabores e ajustes atômicos
  -- -----------------------------------------------------------------------
  INSERT INTO public.produtos (
    id, marca, nome, preco, estoque, sabores, sabores_estoque, zonas, estoque_zonas, ativo
  ) VALUES (
    v_prod_id, 'TESTE', 'POD MULTI SABORES', 100.00, 20,
    ARRAY['Menta Ice', 'Uva Ice'],
    '{"Menta Ice": 10, "Uva Ice": 10}'::jsonb,
    ARRAY['recife', 'norte'],
    jsonb_build_object(
      'recife', jsonb_build_object(
        'estoque', 20,
        'sabores_estoque', jsonb_build_object('Menta Ice', 10, 'Uva Ice', 10)
      )
    ),
    true
  );

  -- Teste de ajustar_estoque modo 'definir'
  PERFORM ajustar_estoque(v_prod_id, 'recife', 'Menta Ice', 'definir', 15, 'ajuste_teste');
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta 
  FROM public.produtos WHERE id = v_prod_id;
  ASSERT v_saldo_menta = 15, 'FALHA: saldo Menta Ice deveria ser 15';

  -- Teste de ajustar_estoque modo 'delta'
  PERFORM ajustar_estoque(v_prod_id, 'recife', 'Uva Ice', 'delta', -2, 'ajuste_teste_delta');
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int INTO v_saldo_uva 
  FROM public.produtos WHERE id = v_prod_id;
  ASSERT v_saldo_uva = 8, 'FALHA: saldo Uva Ice deveria ser 8';
  RAISE NOTICE 'CENÁRIO 2 [PASSOU]: ajustar_estoque definir e delta funcionando perfeitamente.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 3: Pedido com 2 sabores do mesmo produto e recálculo financeiro no servidor
  -- -----------------------------------------------------------------------
  v_pedido_res := criar_pedido_catalogo(
    'Cliente Teste',
    '81999999999',
    'Amigo',
    'recife',
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD MULTI SABORES', 'sabor', 'Menta Ice', 'quantidade', 2),
      jsonb_build_object('id', v_prod_id, 'nome', 'POD MULTI SABORES', 'sabor', 'Uva Ice', 'quantidade', 1)
    ),
    10.00,
    0.00,
    10.00
  );

  v_pedido_id := (v_pedido_res->>'id')::UUID;
  ASSERT (v_pedido_res->>'total')::numeric = 300.00, 'FALHA: banco não recalculou total do pedido com base nos preços reais!';
  RAISE NOTICE 'CENÁRIO 3 [PASSOU]: criar_pedido_catalogo validou itens e recalculou total financeiro no servidor (R$ 300,00).';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 4: Baixa atômica nos 2 sabores do produto
  -- -----------------------------------------------------------------------
  v_res := baixar_estoque_pedido(v_pedido_id);
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: baixa_estoque_pedido falhou';

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta FROM public.produtos WHERE id = v_prod_id;
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int INTO v_saldo_uva FROM public.produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 13, 'FALHA: saldo Menta Ice após baixa deveria ser 13';
  ASSERT v_saldo_uva = 7, 'FALHA: saldo Uva Ice após baixa deveria ser 7';
  RAISE NOTICE 'CENÁRIO 4 [PASSOU]: Baixa atômica em múltiplos sabores do mesmo produto executada com sucesso.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 5: Idempotência da baixa (segunda baixa deve falhar)
  -- -----------------------------------------------------------------------
  BEGIN
    PERFORM baixar_estoque_pedido(v_pedido_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 5 [PASSOU]: Segunda baixa rejeitada com sucesso (Idempotência).';
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 5: Segunda baixa deveria ter sido recusada!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 6: Estorno atômico por Saldo Líquido (-SUM(delta))
  -- -----------------------------------------------------------------------
  v_res := estornar_estoque_pedido(v_pedido_id);
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: estorno falhou';

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta FROM public.produtos WHERE id = v_prod_id;
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int INTO v_saldo_uva FROM public.produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 15, 'FALHA: saldo Menta Ice após estorno deveria voltar a ser 15';
  ASSERT v_saldo_uva = 8, 'FALHA: saldo Uva Ice após estorno deveria voltar a ser 8';
  RAISE NOTICE 'CENÁRIO 6 [PASSOU]: Estorno por saldo líquido restaurou exatamente as quantidades debitadas.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 7: Idempotência do estorno (segundo estorno deve falhar)
  -- -----------------------------------------------------------------------
  BEGIN
    PERFORM estornar_estoque_pedido(v_pedido_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 7 [PASSOU]: Segundo estorno rejeitado com sucesso (Idempotência).';
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 7: Segundo estorno deveria ter sido recusado!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 8: Teste de quantidade inválida (quantidade <= 0)
  -- -----------------------------------------------------------------------
  BEGIN
    PERFORM criar_pedido_catalogo(
      'Cliente Invalido',
      '81999999999',
      '',
      'recife',
      jsonb_build_array(
        jsonb_build_object('id', v_prod_id, 'nome', 'POD', 'sabor', 'Menta Ice', 'quantidade', 0)
      )
    );
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 8 [PASSOU]: Pedido com quantidade zero rejeitado pelo banco.';
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 8: Pedido com quantidade <= 0 deveria ter sido recusado!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 10: Compatibilidade de Parâmetros e Cache PostgREST (1 e 2 parâmetros)
  -- -----------------------------------------------------------------------
  v_res := baixar_estoque_pedido(v_pedido_id, 'sessao_legada@hcvape.com');
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: baixar_estoque_pedido com 2 parâmetros falhou';

  ASSERT (
    SELECT usuario 
    FROM public.movimentos_estoque 
    WHERE pedido_id = v_pedido_id AND tipo = 'venda' 
    ORDER BY created_at DESC 
    LIMIT 1
  ) = 'sessao_legada@hcvape.com', 'FALHA: usuário da chamada legada não foi gravado na auditoria';

  v_res := estornar_estoque_pedido(v_pedido_id, 'sessao_legada@hcvape.com');
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: estornar_estoque_pedido com 2 parâmetros falhou';

  RAISE NOTICE 'CENÁRIO 10 [PASSOU]: Compatibilidade total de 1 e 2 parâmetros validada para baixa e estorno.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 11: Troca com Abatimento Atômico de Estoque (registrar_troca)
  -- -----------------------------------------------------------------------
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta 
  FROM public.produtos WHERE id = v_prod_id;

  v_troca_res := registrar_troca(
    p_cliente_nome => 'Cliente Teste Troca',
    p_cliente_telefone => '81999998888',
    p_vape_defeito => 'POD ANTIGO COM DEFEITO',
    p_sabor_defeito => 'Menta Ice',
    p_motivo => 'Gosto de Queimado',
    p_motivo_detalhes => 'Parou de vaporizar',
    p_vape_trocado => 'POD MULTI SABORES',
    p_sabor_trocado => 'Menta Ice',
    p_produto_trocado_id => v_prod_id,
    p_zona => 'recife',
    p_abater_estoque => true
  );

  v_troca_id := (v_troca_res->>'troca_id')::UUID;
  ASSERT (v_troca_res->>'success')::boolean = true, 'FALHA: registrar_troca falhou';

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_uva 
  FROM public.produtos WHERE id = v_prod_id;
  ASSERT v_saldo_uva = v_saldo_menta - 1, 'FALHA: estoque de Menta Ice não foi abatido pela troca';
  RAISE NOTICE 'CENÁRIO 11 [PASSOU]: Troca com abatimento atômico executada com sucesso.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 12: Cancelamento e Estorno de Troca (estornar_troca)
  -- -----------------------------------------------------------------------
  v_res := estornar_troca(v_troca_id);
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: estornar_troca falhou';
  ASSERT (v_res->>'status') = 'cancelada', 'FALHA: status da troca não ficou cancelada';

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_uva 
  FROM public.produtos WHERE id = v_prod_id;
  ASSERT v_saldo_uva = v_saldo_menta, 'FALHA: estoque não foi restaurado após cancelamento da troca';

  BEGIN
    PERFORM estornar_troca(v_troca_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 12 [PASSOU]: Cancelamento e estorno de troca e idempotência validados.';
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 12: Segundo estorno de troca deveria ter sido recusado!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 13: Produto com Estoque Ilimitado (estoque_ilimitado = true)
  -- -----------------------------------------------------------------------
  INSERT INTO public.produtos (
    id, marca, nome, preco, estoque, sabores, sabores_estoque, zonas, estoque_zonas, estoque_ilimitado, ativo
  ) VALUES (
    v_prod_ilim_id, 'TESTE_ILIMITADO', 'POD PROMOCIONAL LIVRE', 80.00, 999,
    ARRAY['Sabor Livre'], '{"Sabor Livre": 999}'::jsonb,
    ARRAY['recife'],
    '{"recife": {"estoque": 999, "sabores_estoque": {"Sabor Livre": 999}}}'::jsonb,
    true, true
  );

  v_pedido_res := criar_pedido_catalogo(
    'Cliente Ilimitado',
    '81999990000',
    '',
    'recife',
    jsonb_build_array(
      jsonb_build_object('id', v_prod_ilim_id, 'nome', 'POD PROMOCIONAL LIVRE', 'sabor', 'Sabor Livre', 'quantidade', 5)
    )
  );

  v_res := baixar_estoque_pedido((v_pedido_res->>'id')::UUID);
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: baixa em produto ilimitado falhou';

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Sabor Livre')::int INTO v_saldo_uva 
  FROM public.produtos WHERE id = v_prod_ilim_id;
  ASSERT v_saldo_uva = 999, 'FALHA: produto com estoque ilimitado não deveria ter saldo debitado';
  RAISE NOTICE 'CENÁRIO 13 [PASSOU]: Pedido com estoque ilimitado validado sem restrição.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 14: Tentativa de Compra com Saldo Insuficiente
  -- -----------------------------------------------------------------------
  v_pedido_res := criar_pedido_catalogo(
    'Cliente Sem Saldo',
    '81999991111',
    '',
    'recife',
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD MULTI SABORES', 'sabor', 'Uva Ice', 'quantidade', 500)
    )
  );
  v_pedido_insuficiente_id := (v_pedido_res->>'id')::UUID;

  BEGIN
    PERFORM baixar_estoque_pedido(v_pedido_insuficiente_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 14 [PASSOU]: Baixa com saldo insuficiente rejeitada pelo banco: %', SQLERRM;
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 14: Baixa com saldo insuficiente deveria ter sido recusada!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 15: Edição de Produto e Não-Interferência no Estoque
  -- -----------------------------------------------------------------------
  UPDATE public.produtos 
  SET nome = 'POD MULTI SABORES RENOMEADO', preco = 150.00
  WHERE id = v_prod_id;

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta 
  FROM public.produtos WHERE id = v_prod_id;
  SELECT estoque INTO v_estoque_final FROM public.produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 15, 'FALHA: estoque_zonas corrompido após edição cadastral do produto';
  ASSERT v_estoque_final = 23, 'FALHA: estoque total corrompido após edição cadastral do produto';
  RAISE NOTICE 'CENÁRIO 15 [PASSOU]: Edição cadastral preservou integralmente o estoque e sabores_estoque.';

  RAISE NOTICE '=== TODOS OS 15 CENÁRIOS SQL PASSARAM COM 100%% DE SUCESSO! ===';
END;
$$;

-- -----------------------------------------------------------------------
-- CENÁRIO 9: Validação de Segurança de Permissão para Usuário Anônimo (anon)
-- -----------------------------------------------------------------------
DO $$
BEGIN
  ASSERT has_function_privilege('authenticated', 'baixar_estoque_pedido(uuid, text)', 'EXECUTE') = true, 
    'FALHA: authenticated deve ter permissão de EXECUTE em baixar_estoque_pedido';
    
  ASSERT has_function_privilege('anon', 'baixar_estoque_pedido(uuid, text)', 'EXECUTE') = false, 
    'FALHA: anon NÃO pode ter permissão em baixar_estoque_pedido';

  ASSERT has_function_privilege('authenticated', 'estornar_estoque_pedido(uuid, text)', 'EXECUTE') = true, 
    'FALHA: authenticated deve ter permissão de EXECUTE em estornar_estoque_pedido';

  ASSERT has_function_privilege('anon', 'estornar_estoque_pedido(uuid, text)', 'EXECUTE') = false, 
    'FALHA: anon NÃO pode ter permissão em estornar_estoque_pedido';

  ASSERT has_function_privilege('anon', 'criar_pedido_catalogo(text,text,text,text,jsonb,numeric,numeric,numeric,text)', 'EXECUTE') = true, 
    'FALHA: anon deve poder criar pedidos no catálogo';

  RAISE NOTICE 'CENÁRIO 9 [PASSOU]: Permissões estritas validadas: anon bloqueado e authenticated liberado.';
END;
$$;

-- NADA É GRAVADO NO BANCO DE DADOS
ROLLBACK;
