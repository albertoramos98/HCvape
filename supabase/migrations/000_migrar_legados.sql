-- =========================================================================
-- HC VAPE - MIGRAÇÃO 000: PREPARAÇÃO DE EXTENSÕES E MIGRAÇÃO DE PRODUTOS LEGADOS
-- Ordem: Deve ser executada PRIMEIRO, antes de qualquer RPC de estoque
-- =========================================================================

-- 1. Habilitar extensão oficial de remoção de acentos no schema extensions
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- 2. Migrar produtos legados que possuem estoque_zonas vazio ou nulo
-- Constrói estoque_zonas a partir de sabores_estoque e unifica 'sul'/'oeste' em 'sul_oeste'
DO $$
DECLARE
  v_prod RECORD;
  v_zona_alvo VARCHAR(50);
  v_novas_zonas TEXT[];
  v_zona_item TEXT;
  v_estoque_zonas_novo JSONB;
  v_migrados INT := 0;
  v_unificados INT := 0;
BEGIN
  -- A. Migrar produtos onde estoque_zonas é nulo ou vazio ({})
  FOR v_prod IN 
    SELECT id, nome, estoque, sabores_estoque, zonas, estoque_zonas
    FROM produtos
    WHERE estoque_zonas IS NULL 
       OR estoque_zonas = '{}'::jsonb
  LOOP
    -- Determinar zona canônica baseada nas zonas cadastradas no produto
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

    -- Unificar zonas no array 'zonas' (substitui 'sul' e 'oeste' por 'sul_oeste')
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

    -- Montar o objeto estoque_zonas estruturado com os dados reais existentes
    v_estoque_zonas_novo := jsonb_build_object(
      v_zona_alvo, jsonb_build_object(
        'estoque', COALESCE(v_prod.estoque, 0),
        'sabores_estoque', COALESCE(v_prod.sabores_estoque, '{}'::jsonb)
      )
    );

    UPDATE produtos
    SET estoque_zonas = v_estoque_zonas_novo,
        zonas = v_novas_zonas
    WHERE id = v_prod.id;

    v_migrados := v_migrados + 1;
  END LOOP;

  -- B. Unificar chaves legadas 'sul' ou 'oeste' em produtos que já possuem estoque_zonas
  FOR v_prod IN 
    SELECT id, nome, estoque_zonas, zonas
    FROM produtos
    WHERE estoque_zonas ? 'sul' OR estoque_zonas ? 'oeste'
  LOOP
    v_estoque_zonas_novo := v_prod.estoque_zonas;

    -- Se tiver 'sul' e não tiver 'sul_oeste', move 'sul' para 'sul_oeste'
    IF v_estoque_zonas_novo ? 'sul' AND NOT (v_estoque_zonas_novo ? 'sul_oeste') THEN
      v_estoque_zonas_novo := jsonb_set(v_estoque_zonas_novo, '{sul_oeste}', v_estoque_zonas_novo->'sul');
      v_estoque_zonas_novo := v_estoque_zonas_novo - 'sul';
    END IF;

    -- Se tiver 'oeste' e não tiver 'sul_oeste', move 'oeste' para 'sul_oeste'
    IF v_estoque_zonas_novo ? 'oeste' AND NOT (v_estoque_zonas_novo ? 'sul_oeste') THEN
      v_estoque_zonas_novo := jsonb_set(v_estoque_zonas_novo, '{sul_oeste}', v_estoque_zonas_novo->'oeste');
      v_estoque_zonas_novo := v_estoque_zonas_novo - 'oeste';
    END IF;

    -- Atualiza array de zonas também
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

    UPDATE produtos
    SET estoque_zonas = v_estoque_zonas_novo,
        zonas = v_novas_zonas
    WHERE id = v_prod.id;

    v_unificados := v_unificados + 1;
  END LOOP;

  RAISE NOTICE 'Migração 000 concluída com sucesso: % produtos legados populados com estoque_zonas e % produtos com zonas unificadas para sul_oeste.', 
    v_migrados, v_unificados;
END;
$$;
