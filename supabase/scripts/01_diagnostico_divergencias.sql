-- =========================================================================
-- HC VAPE - SCRIPT 01: DIAGNÓSTICO DE DIVERGÊNCIAS
-- Compara sabores_estoque x estoque_zonas para identificar divergências
-- Hipótese: sabores_estoque está correto e estoque_zonas ficou defasado
-- =========================================================================

WITH sabores_gerais AS (
  SELECT 
    p.id,
    p.marca,
    p.nome,
    p.estoque,
    p.is_promo,
    p.estoque_ilimitado,
    kv.key AS sabor,
    (kv.value)::numeric AS qtd_sabores_estoque
  FROM produtos p,
  LATERAL jsonb_each_text(COALESCE(p.sabores_estoque, '{}'::jsonb)) kv
),
sabores_por_zona AS (
  SELECT 
    p.id,
    z.key AS zona,
    s.key AS sabor,
    (s.value)::numeric AS qtd_zona
  FROM produtos p,
  LATERAL jsonb_each(COALESCE(p.estoque_zonas, '{}'::jsonb)) z,
  LATERAL jsonb_each_text(COALESCE(z.value->'sabores_estoque', '{}'::jsonb)) s
),
consolidado_zonas AS (
  SELECT 
    id,
    sabor,
    SUM(qtd_zona) AS total_em_zonas,
    string_agg(zona || ': ' || qtd_zona, ' | ') AS detalhe_zonas
  FROM sabores_por_zona
  GROUP BY id, sabor
)
SELECT 
  sg.marca,
  sg.nome AS produto,
  sg.sabor,
  sg.qtd_sabores_estoque AS saldo_sabores_estoque,
  COALESCE(cz.total_em_zonas, 0) AS saldo_total_zonas,
  COALESCE(cz.detalhe_zonas, 'Sem registro em estoque_zonas') AS detalhe_zonas,
  (COALESCE(cz.total_em_zonas, 0) - sg.qtd_sabores_estoque) AS diferenca,
  CASE 
    WHEN COALESCE(cz.total_em_zonas, 0) > sg.qtd_sabores_estoque THEN 'estoque_zonas MAIOR que sabores_estoque (baixa não refletida em zonas)'
    WHEN COALESCE(cz.total_em_zonas, 0) < sg.qtd_sabores_estoque THEN 'sabores_estoque MAIOR que estoque_zonas'
    ELSE 'OK'
  END AS diagnostico
FROM sabores_gerais sg
FULL OUTER JOIN consolidado_zonas cz 
  ON sg.id = cz.id AND LOWER(TRIM(sg.sabor)) = LOWER(TRIM(cz.sabor))
WHERE COALESCE(cz.total_em_zonas, 0) <> sg.qtd_sabores_estoque
ORDER BY diferenca DESC, sg.marca, sg.nome, sg.sabor;
