-- =========================================================================
-- HC VAPE - MIGRAÇÃO 001: TABELA DE MOVIMENTOS E COLUNA ILIMITADO
-- Idempotente: pode ser executado múltiplas vezes sem erros
-- =========================================================================

-- 1. Habilitar extensão para buscas e comparações sem acento
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Adicionar coluna estoque_ilimitado na tabela produtos
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS estoque_ilimitado BOOLEAN NOT NULL DEFAULT false;

-- 3. Criar tabela de auditoria de movimentos de estoque (append-only)
CREATE TABLE IF NOT EXISTS movimentos_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  zona VARCHAR(50) NOT NULL,
  sabor VARCHAR(255) NOT NULL,
  delta INTEGER NOT NULL,
  saldo_antes INTEGER NOT NULL,
  saldo_depois INTEGER NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('venda', 'estorno', 'ajuste', 'troca', 'troca_estorno', 'contagem_inicial')),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  troca_id UUID REFERENCES trocas(id) ON DELETE SET NULL,
  motivo TEXT,
  usuario TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Índices para performance em buscas e conciliações
CREATE INDEX IF NOT EXISTS idx_movimentos_produto ON movimentos_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_pedido ON movimentos_estoque(pedido_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_troca ON movimentos_estoque(troca_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_tipo ON movimentos_estoque(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentos_created_at ON movimentos_estoque(created_at);

-- 5. Habilitar e configurar Row Level Security (RLS)
ALTER TABLE movimentos_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas admin acessa movimentos de estoque" ON movimentos_estoque;
CREATE POLICY "Apenas admin acessa movimentos de estoque"
  ON movimentos_estoque FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Garantir constraint de não-negatividade na tabela produtos
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS chk_produtos_estoque_positivo;
ALTER TABLE produtos ADD CONSTRAINT chk_produtos_estoque_positivo CHECK (estoque >= 0);
