-- =========================================================================
-- HC VAPE - MIGRAÇÃO 002: FUNÇÕES DE NORMALIZAÇÃO, RECALCULO E AJUSTE
-- Idempotente: CREATE OR REPLACE FUNCTION
-- =========================================================================

-- 1. Função de normalização rigorosa de texto (remove acentos, caixa baixa, colapsa espaços)
CREATE OR REPLACE FUNCTION normalizar_sabor(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(TRIM(REGEXP_REPLACE(public.unaccent(COALESCE(p_texto, '')), '\s+', ' ', 'g')));
$$;

-- 2. Função para encontrar a chave exata ou normalizada do sabor no JSONB da zona
CREATE OR REPLACE FUNCTION encontrar_chave_sabor(p_sabores_obj JSONB, p_sabor_procurado TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_chave TEXT;
  v_procurado_norm TEXT;
BEGIN
  IF p_sabores_obj IS NULL OR p_sabor_procurado IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1º Passo: Casamento Exato
  IF p_sabores_obj ? p_sabor_procurado THEN
    RETURN p_sabor_procurado;
  END IF;

  -- 2º Passo: Casamento Normalizado
  v_procurado_norm := normalizar_sabor(p_sabor_procurado);
  FOR v_chave IN SELECT jsonb_object_keys(p_sabores_obj) LOOP
    IF normalizar_sabor(v_chave) = v_procurado_norm THEN
      RETURN v_chave;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- 3. Função que recalcula 'estoque' e 'sabores_estoque' a partir da FONTE ÚNICA 'estoque_zonas'
CREATE OR REPLACE FUNCTION recalcular_estoque_produto(p_produto_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_produto RECORD;
  v_zona_key TEXT;
  v_sabor_key TEXT;
  v_qtd INT;
  v_total_geral INT := 0;
  v_total_zona INT;
  v_sabores_estoque_consolidado JSONB := '{}'::jsonb;
  v_sabores_zona JSONB;
  v_estoque_zonas_atualizado JSONB;
  v_qtd_acumulada INT;
BEGIN
  SELECT * INTO v_produto 
  FROM produtos 
  WHERE id = p_produto_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Se for ilimitado, mantém estoque virtual sem travar
  IF v_produto.estoque_ilimitado THEN
    UPDATE produtos 
    SET estoque = 999,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_produto_id;
    RETURN;
  END IF;

  v_estoque_zonas_atualizado := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);

  -- Iterar sobre cada zona configurada em estoque_zonas
  FOR v_zona_key IN SELECT jsonb_object_keys(v_estoque_zonas_atualizado) LOOP
    v_sabores_zona := COALESCE(v_estoque_zonas_atualizado->v_zona_key->'sabores_estoque', '{}'::jsonb);
    v_total_zona := 0;

    -- Iterar sobre cada sabor da zona
    FOR v_sabor_key, v_qtd IN 
      SELECT key, COALESCE((value)::int, 0) 
      FROM jsonb_each_text(v_sabores_zona) 
    LOOP
      v_total_zona := v_total_zona + v_qtd;

      -- Acumular sabor no total consolidado geral
      v_qtd_acumulada := COALESCE((v_sabores_estoque_consolidado->>v_sabor_key)::int, 0) + v_qtd;
      v_sabores_estoque_consolidado := jsonb_set(
        v_sabores_estoque_consolidado, 
        ARRAY[v_sabor_key], 
        to_jsonb(v_qtd_acumulada)
      );
    END LOOP;

    -- Atualiza o total numérico da própria zona
    v_estoque_zonas_atualizado := jsonb_set(
      v_estoque_zonas_atualizado,
      ARRAY[v_zona_key, 'estoque'],
      to_jsonb(v_total_zona)
    );

    v_total_geral := v_total_geral + v_total_zona;
  END LOOP;

  -- Atualizar colunas derivadas do produto
  UPDATE produtos 
  SET estoque = v_total_geral,
      sabores_estoque = v_sabores_estoque_consolidado,
      estoque_zonas = v_estoque_zonas_atualizado,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_produto_id;
END;
$$;

-- 4. RPC atômica para ajuste manual e contagem inicial de estoque
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
AS $$
DECLARE
  v_produto RECORD;
  v_estoque_zonas JSONB;
  v_sabores_zona JSONB;
  v_chave_sabor TEXT;
  v_saldo_antes INT;
  v_delta INT;
  v_tipo_movimento VARCHAR(50);
BEGIN
  IF p_nova_qtd < 0 THEN
    RAISE EXCEPTION 'A quantidade de estoque não pode ser negativa: %', p_nova_qtd;
  END IF;

  SELECT * INTO v_produto 
  FROM produtos 
  WHERE id = p_produto_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  v_estoque_zonas := COALESCE(v_produto.estoque_zonas, '{}'::jsonb);
  
  -- Se a zona não existir no objeto, inicializa
  IF NOT (v_estoque_zonas ? p_zona) THEN
    v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[p_zona], '{"estoque": 0, "sabores_estoque": {}}'::jsonb);
  END IF;

  v_sabores_zona := COALESCE(v_estoque_zonas->p_zona->'sabores_estoque', '{}'::jsonb);

  -- Localiza sabor exato ou normalizado
  v_chave_sabor := encontrar_chave_sabor(v_sabores_zona, p_sabor);
  IF v_chave_sabor IS NULL THEN
    -- Se não existia ainda nesta zona, adota o nome fornecido
    v_chave_sabor := TRIM(p_sabor);
  END IF;

  v_saldo_antes := COALESCE((v_sabores_zona->>v_chave_sabor)::int, 0);
  v_delta := p_nova_qtd - v_saldo_antes;

  -- Determinar tipo de movimento
  IF p_motivo = 'contagem_inicial' THEN
    v_tipo_movimento := 'contagem_inicial';
  ELSE
    v_tipo_movimento := 'ajuste';
  END IF;

  -- Atualiza o JSONB da zona
  v_sabores_zona := jsonb_set(v_sabores_zona, ARRAY[v_chave_sabor], to_jsonb(p_nova_qtd));
  v_estoque_zonas := jsonb_set(v_estoque_zonas, ARRAY[p_zona, 'sabores_estoque'], v_sabores_zona);

  UPDATE produtos 
  SET estoque_zonas = v_estoque_zonas
  WHERE id = p_produto_id;

  -- Registrar no histórico imutável
  INSERT INTO movimentos_estoque (
    produto_id,
    zona,
    sabor,
    delta,
    saldo_antes,
    saldo_depois,
    tipo,
    motivo,
    usuario
  ) VALUES (
    p_produto_id,
    p_zona,
    v_chave_sabor,
    v_delta,
    v_saldo_antes,
    p_nova_qtd,
    v_tipo_movimento,
    p_motivo,
    p_usuario
  );

  -- Recalcula colunas derivadas
  PERFORM recalcular_estoque_produto(p_produto_id);

  RETURN jsonb_build_object(
    'success', true,
    'produto_id', p_produto_id,
    'zona', p_zona,
    'sabor', v_chave_sabor,
    'saldo_antes', v_saldo_antes,
    'saldo_depois', p_nova_qtd,
    'delta', v_delta
  );
END;
$$;

-- Permissões: apenas administradores autenticados podem rodar ajuste
REVOKE ALL ON FUNCTION ajustar_estoque(UUID, VARCHAR, VARCHAR, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ajustar_estoque(UUID, VARCHAR, VARCHAR, INT, TEXT, TEXT) TO authenticated;
