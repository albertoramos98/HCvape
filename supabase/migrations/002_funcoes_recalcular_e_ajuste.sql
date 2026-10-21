-- =========================================================================
-- HC VAPE - MIGRAÇÃO 002: NORMALIZAÇÃO, RECÁLCULO SEGURO E AJUSTE ATÔMICO
-- Idempotente: CREATE OR REPLACE FUNCTION
-- =========================================================================

-- 1. Função auxiliar de normalização de sabor via extensão unaccent
CREATE OR REPLACE FUNCTION normalizar_sabor(p_texto TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_texto IS NULL THEN
    RETURN '';
  END IF;
  -- Remove acentos via schema extensions, converte para minúsculas e remove espaços extras
  RETURN LOWER(TRIM(REGEXP_REPLACE(extensions.unaccent(p_texto), '\s+', ' ', 'g')));
END;
$$;

-- 2. Função para localizar chave exata ou normalizada dentro do JSONB de sabores
CREATE OR REPLACE FUNCTION encontrar_chave_sabor(
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

  -- 1. Casamento exato prioritário
  IF p_sabores_estoque ? p_sabor_procurado THEN
    RETURN p_sabor_procurado;
  END IF;

  -- 2. Casamento normalizado (sem acentos, minúsculo, espaços unificados)
  v_norm_procurado := normalizar_sabor(p_sabor_procurado);

  FOR v_chave IN SELECT jsonb_object_keys(p_sabores_estoque) LOOP
    IF normalizar_sabor(v_chave) = v_norm_procurado THEN
      RETURN v_chave;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- 3. Função para recalcular colunas derivadas a partir de estoque_zonas
-- REGRA DE OURO: NUNCA zera produto com estoque_zonas vazio ou nulo (aborta com erro).
CREATE OR REPLACE FUNCTION recalcular_estoque_produto(p_produto_id UUID)
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
  -- Lock FOR UPDATE para evitar escrita concorrente desordenada
  SELECT * INTO v_produto 
  FROM public.produtos 
  WHERE id = p_produto_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  v_estoque_zonas := v_produto.estoque_zonas;

  -- SALVAGUARDA ABSOLUTA: Se estoque_zonas estiver vazio ou nulo, não zera!
  IF v_estoque_zonas IS NULL OR v_estoque_zonas = '{}'::jsonb THEN
    RAISE EXCEPTION 'Produto "%" (ID: %) possui estoque_zonas vazio. Recálculo abortado para evitar zeramento acidental.', 
      v_produto.nome, p_produto_id;
  END IF;

  -- Se produto for marcado como estoque ilimitado, não força recálculo
  IF v_produto.estoque_ilimitado THEN
    RETURN jsonb_build_object(
      'produto_id', p_produto_id,
      'estoque_ilimitado', true,
      'estoque', v_produto.estoque
    );
  END IF;

  -- Iterar sobre cada zona em estoque_zonas
  FOR v_zona_key, v_zona_data IN SELECT * FROM jsonb_each(v_estoque_zonas) LOOP
    v_qtd_zona_total := 0;

    -- Iterar sobre os sabores da zona
    IF v_zona_data ? 'sabores_estoque' AND jsonb_typeof(v_zona_data->'sabores_estoque') = 'object' THEN
      FOR v_sabor_key, v_qtd_sabor IN 
        SELECT key, value::int FROM jsonb_each_text(v_zona_data->'sabores_estoque') 
      LOOP
        v_qtd_zona_total := v_qtd_zona_total + v_qtd_sabor;
        
        -- Consolidar no total do sabor geral
        v_sabores_estoque_consolidado := jsonb_set(
          v_sabores_estoque_consolidado,
          ARRAY[v_sabor_key],
          to_jsonb(COALESCE((v_sabores_estoque_consolidado->>v_sabor_key)::int, 0) + v_qtd_sabor)
        );
      END LOOP;
    ELSE
      v_qtd_zona_total := COALESCE((v_zona_data->>'estoque')::int, 0);
    END IF;

    -- Garantir que a zona tenha seu subtotal sincronizado
    v_zona_data := jsonb_set(v_zona_data, '{estoque}', to_jsonb(v_qtd_zona_total));
    v_novo_estoque_zonas := jsonb_set(v_novo_estoque_zonas, ARRAY[v_zona_key], v_zona_data);
    v_estoque_total := v_estoque_total + v_qtd_zona_total;
  END LOOP;

  -- Atualizar o produto com os valores derivados e validados
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

-- Permissões recalcular_estoque_produto
REVOKE ALL ON FUNCTION recalcular_estoque_produto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION recalcular_estoque_produto(UUID) TO authenticated;

-- 4. Limpar sobrecargas de ajustar_estoque
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT);

-- Função atômica para ajustar estoque (definir contagem física ou delta entrada/saída)
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
  v_tipo_movimento VARCHAR(30);
  v_usuario TEXT;
BEGIN
  IF p_operacao NOT IN ('definir', 'delta') THEN
    RAISE EXCEPTION 'Operação inválida: "%". As operações permitidas são "definir" ou "delta".', p_operacao;
  END IF;

  -- Obter usuário com fallback seguro
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

  -- 2. Verificar/Criar zona sob demanda se constar em produtos.zonas
  IF NOT (v_estoque_zonas ? p_zona_id) THEN
    IF v_produto.zonas IS NOT NULL AND (p_zona_id = ANY(v_produto.zonas)) THEN
      v_estoque_zonas := jsonb_set(
        v_estoque_zonas, 
        ARRAY[p_zona_id], 
        jsonb_build_object('estoque', 0, 'sabores_estoque', '{}'::jsonb)
      );
    ELSE
      RAISE EXCEPTION 'Região "%" não cadastrada para o produto "%". Regiões disponíveis: %', 
        p_zona_id, v_produto.nome, COALESCE(array_to_string(v_produto.zonas, ', '), 'nenhuma');
    END IF;
  END IF;

  v_sabores_zona := COALESCE(v_estoque_zonas->p_zona_id->'sabores_estoque', '{}'::jsonb);

  -- 3. Localizar chave do sabor ou criar se constar em produtos.sabores
  v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, p_sabor);

  IF v_chave_sabor IS NULL THEN
    -- Se o sabor procurado está cadastrado na lista de sabores do produto, cria a chave com 0
    IF v_produto.sabores IS NOT NULL AND (
      p_sabor = ANY(v_produto.sabores) OR 
      EXISTS (SELECT 1 FROM unnest(v_produto.sabores) s WHERE normalizar_sabor(s) = normalizar_sabor(p_sabor))
    ) THEN
      v_chave_sabor := p_sabor;
      v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], '0'::jsonb);
    ELSE
      RAISE EXCEPTION 'Sabor "%" não pertence ao produto "%". Sabores válidos: %', 
        p_sabor, v_produto.nome, COALESCE(array_to_string(v_produto.sabores, ', '), 'nenhum');
    END IF;
  END IF;

  v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);

  -- 4. Calcular delta e novo saldo conforme operação
  IF p_operacao = 'definir' THEN
    IF p_valor < 0 THEN
      RAISE EXCEPTION 'Valor de contagem física não pode ser negativo (% un).', p_valor;
    END IF;
    v_saldo_depois := p_valor;
    v_delta := v_saldo_depois - v_saldo_antes;
  ELSE -- 'delta'
    v_delta := p_valor;
    v_saldo_depois := v_saldo_antes + v_delta;
  END IF;

  IF v_saldo_depois < 0 THEN
    RAISE EXCEPTION 'Operação resultaria em saldo negativo (% un) para o produto "%" (Sabor: "%", Região: "%"). Saldo atual: %, Delta: %', 
      v_saldo_depois, v_produto.nome, v_chave_sabor, p_zona_id, v_saldo_antes, v_delta;
  END IF;

  -- Se não houve alteração real, retorna sem criar movimento redundante
  IF v_delta = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'produto_id', p_produto_id,
      'zona', p_zona_id,
      'sabor', v_chave_sabor,
      'saldo', v_saldo_antes,
      'delta', 0
    );
  END IF;

  -- 5. Atualizar estoque_zonas
  v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(v_saldo_depois));
  v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[p_zona_id, 'sabores_estoque'], v_sabores_zona);

  UPDATE public.produtos
  SET estoque_zonas = v_estoque_zonas
  WHERE id = p_produto_id;

  -- Definir tipo de movimento
  IF p_motivo = 'contagem_inicial' THEN
    v_tipo_movimento := 'contagem_inicial';
  ELSE
    v_tipo_movimento := 'ajuste';
  END IF;

  -- 6. Gravar movimento na tabela imutável
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
    v_tipo_movimento,
    v_usuario,
    p_motivo
  );

  -- 7. Recalcular derived columns no banco
  PERFORM recalcular_estoque_produto(p_produto_id);

  RETURN jsonb_build_object(
    'success', true,
    'produto_id', p_produto_id,
    'zona', p_zona_id,
    'sabor', v_chave_sabor,
    'saldo_antes', v_saldo_antes,
    'saldo_depois', v_saldo_depois,
    'delta', v_delta,
    'operacao', p_operacao
  );
END;
$$;

-- Permissões ajustar_estoque
REVOKE ALL ON FUNCTION ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ajustar_estoque(UUID, VARCHAR, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated;

-- Recarregar cache de schema do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';
