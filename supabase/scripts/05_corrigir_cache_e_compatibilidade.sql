-- =========================================================================
-- HC VAPE - SCRIPT MASTER 05: CORREÇÃO COMPLETA DE FUNÇÕES E CACHE POSTGREST
-- Execução: Cole e execute este script completo no SQL Editor do Supabase.
-- Objetivo: Instalar de forma definitiva e permanente todas as RPCs necessárias
--           para o funcionamento exato do estoque, pedidos, trocas e checklist,
--           garantindo compatibilidade com abas antigas e novas, e recarregando o cache.
-- =========================================================================

-- 0. Garantir tabela de auditoria, colunas e extensão unaccent
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS unaccent;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estoque_ilimitado BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.movimentos_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  zona VARCHAR(50) NOT NULL,
  sabor TEXT NOT NULL,
  delta INT NOT NULL,
  saldo_antes INT NOT NULL,
  saldo_depois INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  troca_id UUID,
  usuario TEXT,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Apenas authenticated le movimentos" ON public.movimentos_estoque;
CREATE POLICY "Apenas authenticated le movimentos" ON public.movimentos_estoque FOR SELECT TO authenticated USING (true);

-- 0.1 Migração idempotente de produtos legados com estoque_zonas vazio ou nulo
DO $$
DECLARE
  v_prod RECORD;
  v_zona_alvo VARCHAR(50);
  v_novas_zonas TEXT[];
  v_zona_item TEXT;
  v_estoque_zonas_novo JSONB;
BEGIN
  FOR v_prod IN 
    SELECT id, nome, estoque, sabores_estoque, zonas, estoque_zonas
    FROM public.produtos
    WHERE estoque_zonas IS NULL 
       OR estoque_zonas = '{}'::jsonb
  LOOP
    IF v_prod.zonas IS NOT NULL AND array_length(v_prod.zonas, 1) > 0 THEN
      IF 'norte' = ANY(v_prod.zonas) THEN
        v_zona_alvo := 'norte';
      ELSIF 'sul_oeste' = ANY(v_prod.zonas) OR 'sul' = ANY(v_prod.zonas) OR 'oeste' = ANY(v_prod.zonas) THEN
        v_zona_alvo := 'sul_oeste';
      ELSE
        v_zona_alvo := 'recife';
      END IF;
    ELSE
      v_zona_alvo := 'recife';
    END IF;

    v_novas_zonas := ARRAY[]::TEXT[];
    IF v_prod.zonas IS NOT NULL THEN
      FOREACH v_zona_item IN ARRAY v_prod.zonas LOOP
        IF v_zona_item IN ('sul', 'oeste', 'sul_oeste') THEN
          IF NOT ('sul_oeste' = ANY(v_novas_zonas)) THEN
            v_novas_zonas := array_append(v_novas_zonas, 'sul_oeste');
          END IF;
        ELSE
          IF NOT (v_zona_item = ANY(v_novas_zonas)) THEN
            v_novas_zonas := array_append(v_novas_zonas, v_zona_item);
          END IF;
        END IF;
      END LOOP;
    END IF;

    IF array_length(v_novas_zonas, 1) IS NULL OR array_length(v_novas_zonas, 1) = 0 THEN
      v_novas_zonas := ARRAY[v_zona_alvo];
    END IF;

    v_estoque_zonas_novo := jsonb_build_object(
      v_zona_alvo, jsonb_build_object(
        'estoque', COALESCE(v_prod.estoque, 0),
        'sabores_estoque', COALESCE(v_prod.sabores_estoque, '{}'::jsonb)
      )
    );

    UPDATE public.produtos
    SET estoque_zonas = v_estoque_zonas_novo,
        zonas = v_novas_zonas
    WHERE id = v_prod.id;
  END LOOP;
END $$;

-- 1. Função auxiliar de normalização de sabor (com fallback se unaccent não existir)
CREATE OR REPLACE FUNCTION public.normalizar_sabor(p_texto TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_res TEXT;
BEGIN
  IF p_texto IS NULL THEN
    RETURN '';
  END IF;

  BEGIN
    v_res := extensions.unaccent(p_texto);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_res := unaccent(p_texto);
    EXCEPTION WHEN OTHERS THEN
      v_res := p_texto;
    END;
  END;

  v_res := LOWER(TRIM(v_res));
  v_res := REGEXP_REPLACE(v_res, '[áàãâä]', 'a', 'g');
  v_res := REGEXP_REPLACE(v_res, '[éèêë]', 'e', 'g');
  v_res := REGEXP_REPLACE(v_res, '[íìîï]', 'i', 'g');
  v_res := REGEXP_REPLACE(v_res, '[óòõôö]', 'o', 'g');
  v_res := REGEXP_REPLACE(v_res, '[úùûü]', 'u', 'g');
  v_res := REGEXP_REPLACE(v_res, '[ç]', 'c', 'g');
  v_res := REGEXP_REPLACE(v_res, '\s+', ' ', 'g');

  RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalizar_sabor(p_texto VARCHAR)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN public.normalizar_sabor(p_texto::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalizar_sabor(TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalizar_sabor(VARCHAR) TO PUBLIC, anon, authenticated;

-- 2. Função para localizar chave exata ou normalizada dentro do JSONB de sabores
CREATE OR REPLACE FUNCTION public.encontrar_chave_sabor(
  p_sabores_estoque JSONB,
  p_sabor_procurado TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_chave TEXT;
  v_norm_procurado TEXT;
BEGIN
  IF p_sabores_estoque IS NULL OR p_sabor_procurado IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_sabores_estoque ? p_sabor_procurado THEN
    RETURN p_sabor_procurado;
  END IF;

  v_norm_procurado := public.normalizar_sabor(p_sabor_procurado);

  FOR v_chave IN SELECT jsonb_object_keys(p_sabores_estoque) LOOP
    IF public.normalizar_sabor(v_chave) = v_norm_procurado THEN
      RETURN v_chave;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.encontrar_chave_sabor(
  p_sabores_estoque JSONB,
  p_sabor_procurado VARCHAR
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN public.encontrar_chave_sabor(p_sabores_estoque, p_sabor_procurado::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.encontrar_chave_sabor(JSONB, TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encontrar_chave_sabor(JSONB, VARCHAR) TO PUBLIC, anon, authenticated;

-- 3. Função para recalcular colunas derivadas a partir da fonte única estoque_zonas
CREATE OR REPLACE FUNCTION public.recalcular_estoque_produto(p_produto_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_estoque_consolidado JSONB := '{}'::jsonb;
  v_estoque_total INT := 0;
  v_zona_key TEXT;
  v_zona_data JSONB;
  v_sabor_key TEXT;
  v_qtd_sabor INT;
  v_qtd_zona_total INT;
  v_novo_estoque_zonas JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_produto 
  FROM public.produtos 
  WHERE id = p_produto_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  v_estoque_zonas := v_produto.estoque_zonas;

  -- Salvaguarda: se estoque_zonas estiver vazio, auto-recupera a partir de sabores_estoque ou preserva
  IF v_estoque_zonas IS NULL OR v_estoque_zonas = '{}'::jsonb THEN
    IF v_produto.sabores_estoque IS NOT NULL AND v_produto.sabores_estoque <> '{}'::jsonb THEN
      v_estoque_zonas := jsonb_build_object(
        'recife', jsonb_build_object(
          'estoque', COALESCE(v_produto.estoque, 0),
          'sabores_estoque', v_produto.sabores_estoque
        )
      );
    ELSE
      RETURN jsonb_build_object(
        'produto_id', p_produto_id,
        'aviso', 'estoque_zonas vazio mantido sem alteração'
      );
    END IF;
  END IF;

  IF v_produto.estoque_ilimitado THEN
    RETURN jsonb_build_object(
      'produto_id', p_produto_id,
      'estoque_ilimitado', true,
      'estoque', v_produto.estoque
    );
  END IF;

  FOR v_zona_key, v_zona_data IN SELECT * FROM jsonb_each(v_estoque_zonas) LOOP
    v_qtd_zona_total := 0;

    IF v_zona_data ? 'sabores_estoque' AND jsonb_typeof(v_zona_data->'sabores_estoque') = 'object' THEN
      FOR v_sabor_key, v_qtd_sabor IN 
        SELECT key, value::int FROM jsonb_each_text(v_zona_data->'sabores_estoque') 
      LOOP
        v_qtd_zona_total := v_qtd_zona_total + v_qtd_sabor;
        v_sabores_estoque_consolidado := jsonb_set(
          v_sabores_estoque_consolidado,
          ARRAY[v_sabor_key],
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
  SET estoque = v_estoque_total,
      sabores_estoque = v_sabores_estoque_consolidado,
      estoque_zonas = v_novo_estoque_zonas
  WHERE id = p_produto_id;

  RETURN jsonb_build_object(
    'produto_id', p_produto_id,
    'novo_estoque', v_estoque_total,
    'sabores_estoque', v_sabores_estoque_consolidado
  );
END;
$$;

REVOKE ALL ON FUNCTION recalcular_estoque_produto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION recalcular_estoque_produto(UUID) TO authenticated;

-- 4. Função canônica para resolver identificador de zona (suporta TEXT e VARCHAR)
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

-- 5. Limpar sobrecargas anteriores de ajustar_estoque
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, VARCHAR, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, VARCHAR, INT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, VARCHAR, INT);

-- RPC Ajustar Estoque: suporta 'definir' (inventário físico) e 'delta' (entradas/saídas)
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

  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  SELECT * INTO v_produto 
  FROM public.produtos 
  WHERE id = p_produto_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

  IF NOT (v_estoque_zonas ? p_zona_id) THEN
    v_estoque_zonas := jsonb_set(
      v_estoque_zonas, 
      ARRAY[p_zona_id], 
      jsonb_build_object('estoque', 0, 'sabores_estoque', '{}'::jsonb)
    );
  END IF;

  v_sabores_zona := COALESCE(v_estoque_zonas->p_zona_id->'sabores_estoque', '{}'::jsonb);
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

  v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
  v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[p_zona_id, 'sabores_estoque'], v_sabores_zona);

  UPDATE public.produtos 
  SET estoque_zonas = v_estoque_zonas
  WHERE id = p_produto_id;

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

-- Sobrecarga de compatibilidade para código ou abas antigas que enviavam p_nova_qtd INT
CREATE OR REPLACE FUNCTION ajustar_estoque(
  p_produto_id UUID,
  p_zona VARCHAR(50),
  p_sabor VARCHAR(255),
  p_nova_qtd INT,
  p_motivo TEXT DEFAULT 'ajuste_manual',
  p_usuario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN ajustar_estoque(
    p_produto_id => p_produto_id,
    p_zona_id => p_zona,
    p_sabor => p_sabor,
    p_operacao => 'definir',
    p_valor => p_nova_qtd,
    p_motivo => p_motivo,
    p_usuario => p_usuario
  );
END;
$$;

REVOKE ALL ON FUNCTION ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION ajustar_estoque(UUID, VARCHAR, VARCHAR, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ajustar_estoque(UUID, VARCHAR, VARCHAR, INT, TEXT, TEXT) TO authenticated;

-- 6. Limpar sobrecargas anteriores de baixar_estoque_pedido
DROP FUNCTION IF EXISTS public.baixar_estoque_pedido(UUID);
DROP FUNCTION IF EXISTS public.baixar_estoque_pedido(UUID, TEXT);

-- RPC Baixar Estoque Pedido com lock e auditoria
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
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  SELECT * INTO v_pedido 
  FROM public.pedidos 
  WHERE id = p_pedido_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id;
  END IF;

  IF v_pedido.status_checklist = true THEN
    RAISE EXCEPTION 'Pedido #% já teve o estoque baixado anteriormente.', v_pedido.numero_pedido;
  END IF;

  IF v_pedido.excluido = true THEN
    RAISE EXCEPTION 'Não é permitido dar baixa em pedido excluído (Pedido #%).', v_pedido.numero_pedido;
  END IF;

  v_zona_id := public.resolver_zona_id(COALESCE(v_pedido.zona::text, 'recife'));

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_pedido.itens, '[]'::jsonb)) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_sabor_solicitado := v_item->>'sabor';
    v_qtd := COALESCE((v_item->>'quantidade')::int, 0);

    IF v_qtd <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_prod_id 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado para o item "%" (ID: %) no Pedido #%', 
        COALESCE(v_item->>'nome', 'Item'), v_prod_id, v_pedido.numero_pedido;
    END IF;

    IF v_produto.estoque_ilimitado THEN
      CONTINUE;
    END IF;

    v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

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
    v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);

    IF v_chave_sabor IS NULL THEN
      RAISE EXCEPTION 'Sabor "%" não encontrado para o produto "%" na região "%" (Pedido #%). Sabores existentes: %', 
        v_sabor_solicitado, v_produto.nome, v_zona_id, v_pedido.numero_pedido,
        (SELECT string_agg(key, ', ') FROM jsonb_each_text(v_sabores_zona));
    END IF;

    v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

    IF v_saldo_antes < v_qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%", Região: "%"). Saldo disponível: %, Solicitado: % (Pedido #%)',
        v_produto.nome, v_chave_sabor, v_zona_id, v_saldo_antes, v_qtd, v_pedido.numero_pedido;
    END IF;

    v_saldo_depois := v_saldo_antes - v_qtd;

    v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
    v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

    UPDATE public.produtos 
    SET estoque_zonas = v_estoque_zonas
    WHERE id = v_prod_id;

    INSERT INTO public.movimentos_estoque (
      produto_id, zona, sabor, delta, saldo_antes, saldo_depois, tipo, pedido_id, usuario, motivo
    ) VALUES (
      v_prod_id, v_zona_id, v_chave_sabor, -v_qtd, v_saldo_antes, v_saldo_depois, 'venda', p_pedido_id, v_usuario, 'baixa_checklist'
    );

    PERFORM recalcular_estoque_produto(v_prod_id);
  END LOOP;

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

REVOKE ALL ON FUNCTION baixar_estoque_pedido(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION baixar_estoque_pedido(UUID, TEXT) TO authenticated;

-- 7. Limpar sobrecargas anteriores de estornar_estoque_pedido
DROP FUNCTION IF EXISTS public.estornar_estoque_pedido(UUID);
DROP FUNCTION IF EXISTS public.estornar_estoque_pedido(UUID, TEXT);

-- RPC Estornar Estoque Pedido por Saldo Líquido (-SUM(delta))
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
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  SELECT * INTO v_pedido 
  FROM public.pedidos 
  WHERE id = p_pedido_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id;
  END IF;

  IF v_pedido.status_checklist = false THEN
    RAISE EXCEPTION 'Pedido #% não está com o checklist baixado para estorno.', v_pedido.numero_pedido;
  END IF;

  FOR v_item_mov IN 
    SELECT produto_id, zona, sabor, -SUM(delta) AS qtd_repor
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

      INSERT INTO public.movimentos_estoque (
        produto_id, zona, sabor, delta, saldo_antes, saldo_depois, tipo, pedido_id, usuario, motivo
      ) VALUES (
        v_item_mov.produto_id, v_item_mov.zona, v_item_mov.sabor, v_qtd_repor, v_saldo_antes, v_saldo_depois, 'estorno', p_pedido_id, v_usuario, 'reabertura_ou_cancelamento_pedido'
      );

      PERFORM recalcular_estoque_produto(v_item_mov.produto_id);
    END IF;
  END LOOP;

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

REVOKE ALL ON FUNCTION estornar_estoque_pedido(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION estornar_estoque_pedido(UUID, TEXT) TO authenticated;

-- 8. Limpar sobrecargas anteriores de estornar_troca
DROP FUNCTION IF EXISTS public.estornar_troca(UUID);
DROP FUNCTION IF EXISTS public.estornar_troca(UUID, TEXT);

-- RPC Estornar Troca (cancelamento lógico sem apagar a linha)
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
  v_usuario := COALESCE(
    NULLIF(TRIM(p_usuario), ''),
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

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

REVOKE ALL ON FUNCTION estornar_troca(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION estornar_troca(UUID, TEXT) TO authenticated;

-- 9. RPC Registrar Troca com baixa atômica opcional
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
  v_usuario := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    auth.uid()::text,
    'sistema'
  );

  IF p_cliente_nome IS NULL OR TRIM(p_cliente_nome) = '' THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório para registrar a troca.';
  END IF;

  IF p_vape_defeito IS NULL OR TRIM(p_vape_defeito) = '' THEN
    RAISE EXCEPTION 'Vape com defeito é obrigatório.';
  END IF;

  IF p_abater_estoque = true THEN
    IF p_produto_trocado_id IS NULL THEN
      RAISE EXCEPTION 'Produto entregue deve ser selecionado para abater estoque.';
    END IF;

    IF p_sabor_trocado IS NULL OR TRIM(p_sabor_trocado) = '' THEN
      RAISE EXCEPTION 'Sabor do vape entregue é obrigatório para abater estoque.';
    END IF;

    v_zona_id := public.resolver_zona_id(COALESCE(p_zona::text, 'recife'));

    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = p_produto_trocado_id 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto trocado não encontrado (ID: %).', p_produto_trocado_id;
    END IF;

    IF NOT v_produto.estoque_ilimitado THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

      IF NOT (v_estoque_zonas ? v_zona_id) THEN
        IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
          v_zona_id := 'sul_oeste';
        ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN
          v_zona_id := 'norte';
        ELSE
          RAISE EXCEPTION 'Produto "%" não possui estoque configurado para a região "%".', v_produto.nome, v_zona_id;
        END IF;
      END IF;

      v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
      v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, p_sabor_trocado);

      IF v_chave_sabor IS NULL THEN
        RAISE EXCEPTION 'Sabor "%" não encontrado para o produto "%" na região "%".', p_sabor_trocado, v_produto.nome, v_zona_id;
      END IF;

      v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

      IF v_saldo_antes < 1 THEN
        RAISE EXCEPTION 'Estoque insuficiente para troca do produto "%" (Sabor: "%", Região: "%"). Saldo disponível: 0.',
          v_produto.nome, v_chave_sabor, v_zona_id;
      END IF;

      v_saldo_depois := v_saldo_antes - 1;

      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
      v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[v_zona_id, 'sabores_estoque'], v_sabores_zona);

      UPDATE public.produtos 
      SET estoque_zonas = v_estoque_zonas
      WHERE id = p_produto_trocado_id;

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
        'troca_saida',
        v_troca_id,
        v_usuario,
        COALESCE(p_motivo, 'troca_garantia')
      );

      PERFORM recalcular_estoque_produto(p_produto_trocado_id);
    END IF;
  END IF;

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
    observacoes,
    status
  ) VALUES (
    v_troca_id,
    TRIM(p_cliente_nome),
    TRIM(COALESCE(p_cliente_telefone, '')),
    COALESCE(p_data_troca, now()),
    TRIM(p_vape_defeito),
    TRIM(COALESCE(p_sabor_defeito, '')),
    TRIM(COALESCE(p_motivo, '')),
    TRIM(COALESCE(p_motivo_detalhes, '')),
    TRIM(COALESCE(p_vape_trocado, '')),
    TRIM(COALESCE(p_sabor_trocado, '')),
    p_produto_trocado_id,
    p_zona,
    COALESCE(p_abater_estoque, false),
    TRIM(COALESCE(p_observacoes, '')),
    'concluida'
  );

  RETURN jsonb_build_object(
    'success', true,
    'troca_id', v_troca_id,
    'status', 'concluida',
    'abateu_estoque', COALESCE(p_abater_estoque, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION registrar_troca FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_troca TO authenticated;

-- 10. RPC Criar Pedido Catálogo (assinatura canônica nomeada)
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
  IF p_nome_cliente IS NULL OR TRIM(p_nome_cliente) = '' THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório.';
  END IF;

  IF p_telefone_cliente IS NULL OR TRIM(p_telefone_cliente) = '' THEN
    RAISE EXCEPTION 'WhatsApp do cliente é obrigatório.';
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O pedido deve conter pelo menos um item.';
  END IF;

  v_zona_id := public.resolver_zona_id(COALESCE(p_zona::text, 'recife'));

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_sabor_solicitado := v_item->>'sabor';
    v_qtd := COALESCE((v_item->>'quantidade')::int, 0);

    IF v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para o item "%": deve ser um número inteiro maior que zero.', 
        COALESCE(v_item->>'nome', 'Item');
    END IF;

    SELECT * INTO v_produto 
    FROM public.produtos 
    WHERE id = v_prod_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado: %', v_prod_id;
    END IF;

    IF v_produto.ativo = false THEN
      RAISE EXCEPTION 'O produto "%" está indisponível para pedidos no momento.', v_produto.nome;
    END IF;

    IF NOT v_produto.estoque_ilimitado THEN
      v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

      IF NOT (v_estoque_zonas ? v_zona_id) THEN
        IF v_zona_id = 'recife' AND (v_estoque_zonas ? 'sul_oeste') THEN
          v_zona_id := 'sul_oeste';
        ELSIF v_zona_id = 'recife' AND (v_estoque_zonas ? 'norte') THEN
          v_zona_id := 'norte';
        ELSE
          RAISE EXCEPTION 'Produto "%" não possui estoque configurado para a região "%".', v_produto.nome, v_zona_id;
        END IF;
      END IF;

      v_sabores_zona := COALESCE(v_estoque_zonas->v_zona_id->'sabores_estoque', '{}'::jsonb);
      v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, v_sabor_solicitado);

      IF v_chave_sabor IS NULL THEN
        RAISE EXCEPTION 'Sabor "%" não disponível para o produto "%" na região "%".', 
          v_sabor_solicitado, v_produto.nome, v_zona_id;
      END IF;

      v_saldo_disponivel := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);
      IF v_saldo_disponivel < v_qtd THEN
        RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Sabor: "%"). Disponível: %, Solicitado: %.',
          v_produto.nome, v_chave_sabor, v_saldo_disponivel, v_qtd;
      END IF;
    ELSE
      v_chave_sabor := v_sabor_solicitado;
    END IF;

    IF v_produto.is_promo = true AND v_produto.preco_promo IS NOT NULL AND v_produto.preco_promo > 0 THEN
      v_preco_unitario := v_produto.preco_promo;
    ELSE
      v_preco_unitario := v_produto.preco;
    END IF;

    v_item_total := v_preco_unitario * v_qtd;
    v_total_recalculado := v_total_recalculado + v_item_total;

    v_itens_higienizados := v_itens_higienizados || jsonb_build_object(
      'id', v_prod_id,
      'marca', v_produto.marca,
      'nome', v_produto.nome,
      'sabor', v_chave_sabor,
      'quantidade', v_qtd,
      'preco_unitario', v_preco_unitario,
      'total', v_item_total,
      'is_promo', COALESCE(v_produto.is_promo, false)
    );
  END LOOP;

  v_desconto_aplicado := GREATEST(0, COALESCE(p_desconto, 0));
  IF v_desconto_aplicado > v_total_recalculado THEN
    v_desconto_aplicado := v_total_recalculado;
  END IF;

  v_total_final_calculado := GREATEST(0, v_total_recalculado - v_desconto_aplicado);

  SELECT COALESCE(MAX(numero_pedido), 1000) + 1 INTO v_numero_pedido 
  FROM public.pedidos;

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

GRANT EXECUTE ON FUNCTION criar_pedido_catalogo(TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;

-- Sobrecarga de compatibilidade para chamadas via RPC com payload { dados: { ... } }
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

-- 11. Recarregar cache de schema do PostgREST imediatamente em toda a instância
NOTIFY pgrst, 'reload schema';
