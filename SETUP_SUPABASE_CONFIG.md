# Setup Supabase - Configurações Dinâmicas

Execute este script SQL no painel Supabase (SQL Editor) para criar a tabela de configurações e habilitar o controle dinâmico de dias e horários das promoções.

## Script SQL

```sql
-- Criar tabela de configuracoes se não existir
CREATE TABLE IF NOT EXISTS configuracoes (
  chave VARCHAR(50) PRIMARY KEY,
  valor JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserir valor padrão para horário promocional (Segunda a Quarta das 09:00 às 15:25)
INSERT INTO configuracoes (chave, valor)
VALUES (
  'promo_schedule',
  '{"dias_semana": [1, 2, 3], "hora_inicio": "09:00", "hora_fim": "15:25"}'::jsonb
)
ON CONFLICT (chave) DO NOTHING;

-- Habilitar RLS (Row Level Security)
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública (qualquer um pode ler as configurações)
CREATE POLICY "Configurações são públicas para leitura"
  ON configuracoes FOR SELECT
  USING (true);

-- Política de escrita/modificação apenas para usuários autenticados
CREATE POLICY "Apenas usuários autenticados podem modificar configurações"
  ON configuracoes FOR ALL
  USING (auth.role() = 'authenticated');
```

## Passos:

1. Acesse [supabase.com](https://supabase.com)
2. Vá para seu projeto
3. Clique em **SQL Editor**
4. Clique em **New query**
5. Cole o script acima
6. Clique em **Run** (ou Ctrl+Enter)

Pronto! A tabela de configurações foi criada e o catálogo já poderá se atualizar de forma dinâmica.
