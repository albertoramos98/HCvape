-- =========================================================================
-- HC VAPE - SCRIPT 03: CANDIDATOS A ESTOQUE ILIMITADO
-- Identifica produtos com flag is_promo ou estoque/sabores >= 900
-- Permite ao lojista conferir quais devem receber estoque_ilimitado = true
-- =========================================================================

SELECT 
  id,
  marca,
  nome,
  preco,
  preco_promo,
  is_promo,
  estoque_ilimitado,
  estoque,
  sabores_estoque,
  estoque_zonas
FROM produtos
WHERE 
  is_promo = true 
  OR estoque >= 900
  OR EXISTS (
    SELECT 1 FROM jsonb_each_text(COALESCE(sabores_estoque, '{}'::jsonb)) kv
    WHERE (kv.value)::numeric >= 900
  )
ORDER BY is_promo DESC, marca, nome;

-- =========================================================================
-- EXEMPLO DE COMANDO PARA ATIVAR O ESTOQUE ILIMITADO EM PRODUTOS ESPECÍFICOS:
-- =========================================================================
-- UPDATE produtos 
-- SET estoque_ilimitado = true 
-- WHERE id IN (
--   'UUID-1',
--   'UUID-2'
-- );
