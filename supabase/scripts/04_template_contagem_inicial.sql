-- =========================================================================
-- HC VAPE - SCRIPT 04: TEMPLATE PARA APLICAÇÃO DE CONTAGEM FÍSICA INICIAL
-- Aplica a contagem física real dos produtos via RPC ajustar_estoque
-- Registra movimentos com tipo = 'contagem_inicial' e recalcula produtos
-- =========================================================================

-- Execute em bloco de transação para segurança:
BEGIN;

-- Exemplo de ajustes por produto, zona e sabor:
-- SELECT ajustar_estoque(
--   'UUID-DO-PRODUTO'::UUID,
--   'recife',                        -- zona
--   'Nome Exato do Sabor',          -- sabor
--   10,                             -- nova quantidade física real contada
--   'contagem_inicial',             -- motivo
--   'alberto'                       -- usuario executor
-- );

-- Adicione suas linhas de contagem abaixo:
-- SELECT ajustar_estoque('...', 'recife', '...', 5, 'contagem_inicial', 'alberto');

COMMIT;
-- Em caso de erro na contagem, substitua por ROLLBACK;
