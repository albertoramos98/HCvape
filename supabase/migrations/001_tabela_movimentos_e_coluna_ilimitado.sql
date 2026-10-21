-- =========================================================================
-- HC VAPE - MIGRAÇÃO 001: TABELA IMUTÁVEL DE MOVIMENTOS E ESTOQUE ILIMITADO
-- Idempotente: Executável com segurança múltiplas vezes
-- =========================================================================

-- 1. Assegurar extensão unaccent
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- 2. Adicionar coluna estoque_ilimitado na tabela produtos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'produtos' 
      AND column_name = 'estoque_ilimitado'
  ) THEN
    ALTER TABLE public.produtos 
    ADD COLUMN estoque_ilimitado BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Adicionar constraint CHECK para garantir estoque >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'produtos_estoque_nao_negativo'
  ) THEN
    ALTER TABLE public.produtos 
    ADD CONSTRAINT produtos_estoque_nao_negativo CHECK (estoque >= 0);
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'Aviso: Existem produtos com estoque negativo que devem ser ajustados antes da constraint rígida.';
END $$;

-- 4. Criar tabela movimentos_estoque (ESTRITAMENTE APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.movimentos_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  zona VARCHAR(50) NOT NULL,
  sabor TEXT NOT NULL,
  delta INT NOT NULL,
  saldo_antes INT NOT NULL,
  saldo_depois INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  troca_id UUID REFERENCES public.trocas(id) ON DELETE RESTRICT,
  usuario TEXT,
  motivo TEXT,
  
  -- Validações de integridade
  CONSTRAINT movimentos_estoque_tipo_check CHECK (
    tipo IN ('venda', 'estorno', 'ajuste', 'troca', 'troca_estorno', 'contagem_inicial')
  ),
  CONSTRAINT movimentos_estoque_saldo_depois_check CHECK (saldo_depois >= 0),
  CONSTRAINT movimentos_estoque_consistencia_check CHECK (saldo_antes + delta = saldo_depois)
);

-- Índices de alta performance para concorrência e auditoria
CREATE INDEX IF NOT EXISTS idx_movimentos_estoque_prod_zona_sabor 
  ON public.movimentos_estoque (produto_id, zona, sabor);

CREATE INDEX IF NOT EXISTS idx_movimentos_estoque_pedido_id 
  ON public.movimentos_estoque (pedido_id) 
  WHERE pedido_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimentos_estoque_troca_id 
  ON public.movimentos_estoque (troca_id) 
  WHERE troca_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimentos_estoque_created_at 
  ON public.movimentos_estoque (created_at DESC);

-- 5. Segurança RLS Append-Only Rigorosa:
-- Ninguém pode fazer UPDATE, DELETE ou TRUNCATE.
-- authenticated pode apenas fazer SELECT para histórico.
-- INSERT é feito exclusivamente por funções SECURITY DEFINER.
ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_movimentos" ON public.movimentos_estoque;
CREATE POLICY "authenticated_select_movimentos" 
  ON public.movimentos_estoque 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Revoga explicitamente permissões de mutação direta
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.movimentos_estoque FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.movimentos_estoque TO authenticated;
