-- =========================================================================
-- HC VAPE - SCRIPT 02: PRODUTOS LEGADOS COM ZONAS DESATUALIZADAS
-- Lista produtos com zonas 'sul'/'oeste' ou estoque_zonas vazio/nulo
-- Permite ao lojista decidir destino (migrar para 'recife' ou inativar)
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
    WHEN estoque_zonas IS NULL OR estoque_zonas = '{}'::jsonb THEN 'SEM estoque_zonas (necessita contagem ou carga inicial)'
    WHEN 'sul' = ANY(zonas) OR 'oeste' = ANY(zonas) THEN 'Zonas antigas separadas (sul/oeste)'
    ELSE 'OK'
  END AS situacao_legada
FROM produtos
WHERE 
  estoque_zonas IS NULL 
  OR estoque_zonas = '{}'::jsonb
  OR 'sul' = ANY(zonas)
  OR 'oeste' = ANY(zonas)
ORDER BY ativo DESC, marca, nome;

-- =========================================================================
-- EXEMPLO DE COMANDO PARA MIGRAR UM PRODUTO LEGADO PARA A ZONA 'recife':
-- =========================================================================
-- UPDATE produtos
-- SET zonas = ARRAY['recife'],
--     estoque_zonas = jsonb_build_object(
--       'recife', jsonb_build_object(
--         'estoque', estoque,
--         'sabores_estoque', sabores_estoque
--       )
--     )
-- WHERE id = 'UUID-DO-PRODUTO';
