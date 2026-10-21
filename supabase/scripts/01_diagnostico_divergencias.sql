-- =========================================================================
-- HC VAPE - SCRIPT 01: DIAGNÓSTICO DE DIVERGÊNCIAS ENTRE SABORES E ZONAS
-- Compara os saldos de cada sabor entre sabores_estoque e a soma em estoque_zonas
-- Normaliza sabores via unaccent, sem FULL OUTER JOIN com linhas nulas
-- =========================================================================

WITH sabores_gerais AS (
  SELECT 
    p.id AS produto_id,
    p.nome AS produto_nome,
    key AS sabor_original,
    normalizar_sabor(key) AS sabor_norm,
    COALESCE(value::int, 0) AS saldo_geral
  FROM public.produtos p,
       jsonb_each_text(COALESCE(p.sabores_estoque, '{}'::jsonb))
),
sabores_por_zonas AS (
  SELECT 
    p.id AS produto_id,
    normalizar_sabor(sabor_kv.key) AS sabor_norm,
    SUM(COALESCE(sabor_kv.value::int, 0)) AS saldo_zonas_soma
  FROM public.produtos p,
       jsonb_each(COALESCE(p.estoque_zonas, '{}'::jsonb)) AS zona_kv,
       jsonb_each_text(COALESCE(zona_kv.value->'sabores_estoque', '{}'::jsonb)) AS sabor_kv
  GROUP BY p.id, normalizar_sabor(sabor_kv.key)
)
SELECT 
  sg.produto_id,
  sg.produto_nome,
  sg.sabor_original,
  sg.saldo_geral,
  COALESCE(sz.saldo_zonas_soma, 0) AS saldo_somado_zonas,
  (sg.saldo_geral - COALESCE(sz.saldo_zonas_soma, 0)) AS divergencia
FROM sabores_gerais sg
LEFT JOIN sabores_por_zonas sz 
  ON sg.produto_id = sz.produto_id 
 AND sg.sabor_norm = sz.sabor_norm
WHERE sg.saldo_geral != COALESCE(sz.saldo_zonas_soma, 0)
ORDER BY sg.produto_nome, sg.sabor_original;
