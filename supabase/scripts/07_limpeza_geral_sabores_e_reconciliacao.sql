-- =========================================================================
-- HC VAPE - SCRIPT 07: LIMPEZA GERAL DE SABORES ÓRFÃOS, UNIFICAÇÃO DE ZONAS
-- E RECONCILIAÇÃO PRECISA DE ESTOQUE DE TODOS OS PRODUTOS
-- =========================================================================
-- Resolve de forma definitiva discrepâncias em todos os produtos (ex: ELF BAR 23K,
-- OXBAR MAZE, etc.), onde sabores antigos renomeados, duplicados ou de zonas
-- legadas ficaram acumulados no JSON, inflando a contagem total de unidades.
-- =========================================================================

-- -------------------------------------------------------------------------
-- PASSO 1: DIAGNÓSTICO PRÉVIO
-- Mostra a situação atual dos produtos antes da limpeza
-- -------------------------------------------------------------------------
SELECT 
  p.id,
  p.marca,
  p.nome,
  p.estoque AS estoque_atual,
  p.zonas,
  p.sabores,
  p.sabores_estoque,
  p.estoque_zonas
FROM public.produtos p
ORDER BY p.marca, p.nome;

-- -------------------------------------------------------------------------
-- PASSO 2: ATUALIZAR FUNÇÃO CANÔNICA recalcular_estoque_produto
-- Garante que o recálculo NUNCA mais acumule sabores órfãos ou zonas desativadas
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_estoque_produto(p_produto_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_produto RECORD;
  v_sabores_limpos JSONB := '{}'::jsonb;
  v_estoque_total INT := 0;
  v_sabor TEXT;
  v_chave_encontrada TEXT;
  v_qtd INT;
  v_novo_estoque_zonas JSONB;
  v_fonte_recife JSONB;
  v_fonte_geral JSONB;
BEGIN
  SELECT * INTO v_produto 
  FROM public.produtos 
  WHERE id = p_produto_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  -- 1. Se for produto promocional ou com estoque ilimitado
  IF COALESCE(v_produto.estoque_ilimitado, false) OR COALESCE(v_produto.is_promo, false) THEN
    IF v_produto.sabores IS NOT NULL AND array_length(v_produto.sabores, 1) > 0 THEN
      FOREACH v_sabor IN ARRAY v_produto.sabores LOOP
        v_sabores_limpos := jsonb_set(v_sabores_limpos, ARRAY[v_sabor], to_jsonb(999));
      END LOOP;
    END IF;
    
    v_novo_estoque_zonas := jsonb_build_object(
      'recife', jsonb_build_object('estoque', 999, 'sabores_estoque', v_sabores_limpos)
    );

    UPDATE public.produtos
    SET estoque = 999,
        sabores_estoque = v_sabores_limpos,
        estoque_zonas = v_novo_estoque_zonas,
        zonas = ARRAY['recife'],
        updated_at = now()
    WHERE id = p_produto_id;

    RETURN jsonb_build_object(
      'produto_id', p_produto_id,
      'novo_estoque', 999,
      'sabores_estoque', v_sabores_limpos
    );
  END IF;

  -- 2. Fontes de dados para reconciliação
  v_fonte_recife := COALESCE(v_produto.estoque_zonas->'recife'->'sabores_estoque', '{}'::jsonb);
  v_fonte_geral  := COALESCE(v_produto.sabores_estoque, '{}'::jsonb);

  -- 3. Se o produto possui lista de sabores oficiais, ela é a FONTE DA VERDADE
  IF v_produto.sabores IS NOT NULL AND array_length(v_produto.sabores, 1) > 0 THEN
    FOREACH v_sabor IN ARRAY v_produto.sabores LOOP
      v_qtd := 0;

      -- A) Prioridade 1: Busca exata na zona Recife
      IF v_fonte_recife ? v_sabor THEN
        v_qtd := COALESCE((v_fonte_recife->>v_sabor)::int, 0);

      -- B) Prioridade 2: Busca normalizada na zona Recife
      ELSIF public.encontrar_chave_sabor(v_fonte_recife, v_sabor) IS NOT NULL THEN
        v_chave_encontrada := public.encontrar_chave_sabor(v_fonte_recife, v_sabor);
        v_qtd := COALESCE((v_fonte_recife->>v_chave_encontrada)::int, 0);

      -- C) Prioridade 3: Busca exata no sabores_estoque consolidado
      ELSIF v_fonte_geral ? v_sabor THEN
        v_qtd := COALESCE((v_fonte_geral->>v_sabor)::int, 0);

      -- D) Prioridade 4: Busca normalizada no sabores_estoque consolidado
      ELSIF public.encontrar_chave_sabor(v_fonte_geral, v_sabor) IS NOT NULL THEN
        v_chave_encontrada := public.encontrar_chave_sabor(v_fonte_geral, v_sabor);
        v_qtd := COALESCE((v_fonte_geral->>v_chave_encontrada)::int, 0);

      -- E) Prioridade 5: Busca em outras zonas antigas (ex: sul_oeste, norte) para não perder saldo
      ELSE
        IF v_produto.estoque_zonas IS NOT NULL AND v_produto.estoque_zonas <> '{}'::jsonb THEN
          DECLARE
            v_z_key TEXT;
            v_z_val JSONB;
            v_ch_z TEXT;
          BEGIN
            FOR v_z_key, v_z_val IN SELECT * FROM jsonb_each(v_produto.estoque_zonas) LOOP
              IF v_z_key <> 'recife' AND v_z_val ? 'sabores_estoque' THEN
                v_ch_z := public.encontrar_chave_sabor(v_z_val->'sabores_estoque', v_sabor);
                IF v_ch_z IS NOT NULL THEN
                  v_qtd := v_qtd + COALESCE((v_z_val->'sabores_estoque'->>v_ch_z)::int, 0);
                END IF;
              END IF;
            END LOOP;
          END;
        END IF;
      END IF;

      -- Não permitir saldos negativos
      v_qtd := GREATEST(0, v_qtd);
      v_sabores_limpos := jsonb_set(v_sabores_limpos, ARRAY[v_sabor], to_jsonb(v_qtd));
      v_estoque_total := v_estoque_total + v_qtd;
    END LOOP;
  ELSE
    -- Produto sem array de sabores: preserva total
    v_estoque_total := COALESCE(v_produto.estoque, 0);
  END IF;

  -- 4. Montar estoque_zonas estritamente limpo e unificado em Recife
  v_novo_estoque_zonas := jsonb_build_object(
    'recife', jsonb_build_object(
      'estoque', v_estoque_total,
      'sabores_estoque', v_sabores_limpos
    )
  );

  -- 5. Gravação final: higieniza estoque, sabores_estoque, estoque_zonas e zonas
  UPDATE public.produtos
  SET estoque = v_estoque_total,
      sabores_estoque = v_sabores_limpos,
      estoque_zonas = v_novo_estoque_zonas,
      zonas = ARRAY['recife'],
      updated_at = now()
  WHERE id = p_produto_id;

  RETURN jsonb_build_object(
    'produto_id', p_produto_id,
    'novo_estoque', v_estoque_total,
    'sabores_estoque', v_sabores_limpos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_estoque_produto(UUID) TO PUBLIC, anon, authenticated, service_role;

-- -------------------------------------------------------------------------
-- PASSO 3: EXECUÇÃO EM MASSA DA LIMPEZA E RECONCILIAÇÃO PARA TODOS OS PRODUTOS
-- -------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_res JSONB;
  v_total INT := 0;
BEGIN
  RAISE NOTICE 'Iniciando limpeza e reconciliação precisa em todos os produtos do catálogo...';
  
  FOR r IN SELECT id, nome FROM public.produtos ORDER BY marca, nome LOOP
    v_res := public.recalcular_estoque_produto(r.id);
    v_total := v_total + 1;
    RAISE NOTICE 'Produto higienizado: % | Novo Saldo: %', r.nome, v_res->>'novo_estoque';
  END LOOP;

  RAISE NOTICE 'Limpeza concluída com sucesso! Total de produtos processados: %', v_total;
END;
$$;

-- -------------------------------------------------------------------------
-- PASSO 4: NOTIFICAR RECARGA IMEDIATA DO SCHEMA CACHE NO POSTGREST
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- -------------------------------------------------------------------------
-- PASSO 5: RESULTADO FINAL CONSOLIDADO (TODOS OS PRODUTOS LIMPOS)
-- -------------------------------------------------------------------------
SELECT 
  p.id,
  p.marca,
  p.nome,
  p.estoque AS total_unidades,
  p.zonas,
  p.sabores_estoque,
  p.estoque_zonas->'recife'->'sabores_estoque' AS sabores_recife
FROM public.produtos p
ORDER BY p.marca, p.nome;
