-- =========================================================================
-- HC VAPE - SCRIPT 02: PRODUTOS LEGADOS COM ZONAS DESATUALIZADAS
-- Lista produtos com zonas 'sul'/'oeste' ou estoque_zonas vazio/nulo
-- =========================================================================

SELECT 
  id,
  marca,
  nome,
  estoque,
  ativo,
  zonas,
  estoque_zonas,
  sabores_estoque,
  CASE 
    WHEN estoque_zonas IS NULL OR estoque_zonas = '{}'::jsonb THEN 'SEM estoque_zonas (migrado na 000_migrar_legados.sql)'
    WHEN 'sul' = ANY(zonas) OR 'oeste' = ANY(zonas) THEN 'Zonas antigas a unificar em sul_oeste'
    ELSE 'OK'
  END AS situacao_legada
FROM public.produtos
WHERE 
  estoque_zonas IS NULL 
  OR estoque_zonas = '{}'::jsonb
  OR 'sul' = ANY(zonas)
  OR 'oeste' = ANY(zonas)
ORDER BY ativo DESC, marca, nome;
