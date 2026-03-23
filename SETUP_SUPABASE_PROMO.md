# Setup Supabase - Campos de Promoção

Execute este script SQL no painel Supabase (SQL Editor) para adicionar os campos de promoção à tabela `produtos`.

## Script SQL

```sql
-- Adicionar coluna is_promo (se não existir)
ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT FALSE;

-- Adicionar coluna preco_promo (se não existir)
ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS preco_promo DECIMAL(10, 2) DEFAULT NULL;

-- Criar índice para queries de promoção
CREATE INDEX IF NOT EXISTS idx_produtos_is_promo ON produtos(is_promo);

-- Atualizar RLS para permitir UPDATE de is_promo e preco_promo
-- (A política já existente deve funcionar)
```

## Passos:

1. Acesse [supabase.com](https://supabase.com)
2. Vá para seu projeto
3. Clique em **SQL Editor**
4. Cole o script acima
5. Clique em **Run** (ou Ctrl+Enter)

Pronto! Os campos foram adicionados à tabela.

---

## Verificar se funcionou:

Execute esta query para confirmar:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'produtos';
```

Você deve ver as colunas `is_promo` (boolean) e `preco_promo` (numeric).
