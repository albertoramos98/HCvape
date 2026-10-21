-- =========================================================================
-- HC VAPE - SCRIPT 04: TEMPLATE PARA APLICAÇÃO DE CONTAGEM FÍSICA INICIAL
-- Aplica a contagem física real dos produtos via RPC ajustar_estoque ('definir')
-- Registra movimentos com tipo = 'contagem_inicial' e recalcula produtos
-- =========================================================================

-- Execute em bloco de transação para segurança total:
BEGIN;

-- Exemplo de ajustes por produto, zona e sabor:
-- SELECT ajustar_estoque(
--   'UUID-DO-PRODUTO'::UUID,
--   'recife',                        -- zona ('recife', 'norte', 'sul_oeste')
--   'Nome Exato do Sabor',          -- sabor (ou novo sabor em produtos.sabores)
--   'definir',                      -- operacao ('definir' para contagem física)
--   10,                             -- nova quantidade física real contada
--   'contagem_inicial'              -- motivo (gera tipo = 'contagem_inicial')
-- );

-- Exemplos adicionais:
-- SELECT ajustar_estoque('UUID-PRODUTO-1'::UUID, 'recife', 'Menta Ice', 'definir', 8, 'contagem_inicial');
-- SELECT ajustar_estoque('UUID-PRODUTO-1'::UUID, 'norte', 'Menta Ice', 'definir', 4, 'contagem_inicial');
-- SELECT ajustar_estoque('UUID-PRODUTO-2'::UUID, 'sul_oeste', 'Uva Ice', 'definir', 15, 'contagem_inicial');

COMMIT;
-- Em caso de divergência ou erro, execute:
-- ROLLBACK;
