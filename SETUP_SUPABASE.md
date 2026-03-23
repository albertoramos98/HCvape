# Setup do Supabase para HC Vape Catálogo

## 1. Criar Tabela de Produtos

Execute este SQL no editor SQL do Supabase (SQL Editor → New Query):

```sql
-- Criar tabela de produtos
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  preco DECIMAL(10, 2) NOT NULL,
  estoque INTEGER NOT NULL DEFAULT 0,
  sabores TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_promo BOOLEAN DEFAULT false,
  preco_promo DECIMAL(10, 2),
  imagem_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para melhor performance
CREATE INDEX idx_produtos_marca ON produtos(marca);
CREATE INDEX idx_produtos_estoque ON produtos(estoque);
CREATE INDEX idx_produtos_is_promo ON produtos(is_promo);

-- Habilitar RLS (Row Level Security)
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública (qualquer um pode ler)
CREATE POLICY "Produtos são públicos para leitura"
  ON produtos FOR SELECT
  USING (true);

-- Política de escrita apenas para usuários autenticados
CREATE POLICY "Apenas usuários autenticados podem modificar"
  ON produtos FOR ALL
  USING (auth.role() = 'authenticated');
```

### Se a tabela já existir (migração)

Se você já tem a tabela criada sem o campo `imagem_url`, execute apenas:

```sql
-- Adicionar coluna de imagem (se ainda não existir)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Adicionar campos de promoção (se ainda não existirem)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_promo DECIMAL(10, 2);

-- Criar índice para promoções (se ainda não existir)
CREATE INDEX IF NOT EXISTS idx_produtos_is_promo ON produtos(is_promo);
```

---

## 2. Configurar o Supabase Storage (para imagens)

### 2.1 Criar o bucket

1. No painel Supabase, vá para **Storage**
2. Clique em **New bucket**
3. Nome do bucket: `produto-imagens`
4. Marque como **Public bucket** (para que as imagens sejam acessíveis publicamente)
5. Clique em **Create bucket**

### 2.2 Configurar políticas de acesso do Storage

Execute este SQL no editor SQL do Supabase:

```sql
-- Permitir leitura pública das imagens
CREATE POLICY "Imagens são públicas para leitura"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produto-imagens');

-- Permitir upload apenas para usuários autenticados
CREATE POLICY "Apenas autenticados podem fazer upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'produto-imagens'
    AND auth.role() = 'authenticated'
  );

-- Permitir atualização apenas para usuários autenticados
CREATE POLICY "Apenas autenticados podem atualizar imagens"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'produto-imagens'
    AND auth.role() = 'authenticated'
  );

-- Permitir exclusão apenas para usuários autenticados
CREATE POLICY "Apenas autenticados podem deletar imagens"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'produto-imagens'
    AND auth.role() = 'authenticated'
  );
```

---

## 3. Inserir Dados de Exemplo

```sql
-- Inserir produtos de exemplo
INSERT INTO produtos (marca, nome, preco, estoque, sabores) VALUES
  ('IGNITE', 'IGNITE 8.000', 115.00, 50, ARRAY['Limão com Manga', 'Banana e Cereja', 'Mirtilo com Limão', 'Melancia Congelada', 'Cactus']),
  ('IGNITE', 'IGNITE 40.000 MIX', 165.00, 30, ARRAY['Banana Ice / Morango Ice', 'Maracujá com Kiwi Azedo / Abacaxi Ice']),
  ('ELF BAR', 'ELF BAR 23.000', 135.00, 45, ARRAY['Maça Verde', 'Sakura Grape', 'Kiwi com Fruta do Dragão']),
  ('BLACK SHEEP', 'BLACK SHEEP 10.000', 125.00, 40, ARRAY['Morango Selvagem', 'Blueberry Mint', 'Tropical Mix']),
  ('BLACK SHEEP', 'BLACK SHEEP 20.000', 155.00, 25, ARRAY['Grape Ice', 'Peach Mango', 'Watermelon Freeze']),
  ('SEX ADDICT', 'SEX ADDICT 15.000', 140.00, 35, ARRAY['Strawberry Passion', 'Mango Tango', 'Cherry Bomb']),
  ('WAKA', 'WAKA 9.000', 120.00, 50, ARRAY['Lychee Ice', 'Pineapple Coconut', 'Mixed Berries']),
  ('WAKA', 'WAKA 18.000', 150.00, 28, ARRAY['Menta Gelada', 'Frutas Vermelhas', 'Citrus Explosion']);
```

---

## 4. Configurar Autenticação

1. Vá para **Authentication → Users** no painel Supabase
2. Clique em **Invite user** ou crie um usuário manualmente
3. Use esse email/senha para fazer login na área de admin

---

## 5. Configurar Variáveis de Ambiente

No arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://lmhtptakvzpzftcygxmo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_4Y7jeM4fEfLH4UMMYNR5Bw_dzUAuK0J
```

---

## 6. Acessar a Aplicação

- **Catálogo público**: `/` (qualquer pessoa)
- **Admin (protegido)**: `/admin` (apenas usuários autenticados)

---

## Estrutura da Tabela `produtos`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID único do produto |
| marca | VARCHAR(50) | Nome da marca (IGNITE, ELF BAR, etc) |
| nome | VARCHAR(255) | Nome do produto |
| preco | DECIMAL(10,2) | Preço em reais |
| estoque | INTEGER | Quantidade em estoque |
| sabores | TEXT[] | Array de sabores disponíveis |
| is_promo | BOOLEAN | Se o produto está em promoção |
| preco_promo | DECIMAL(10,2) | Preço promocional (menor que preco) |
| imagem_url | TEXT | URL pública da imagem no Supabase Storage |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data da última atualização |

---

## Funcionamento do CRUD de Imagens

O sistema utiliza o **Supabase Storage** para armazenar imagens dos produtos no bucket `produto-imagens`.

| Operação | Comportamento |
|----------|--------------|
| **Upload** | Imagem enviada para `produtos/{id}-{timestamp}.ext` |
| **Atualização** | Imagem antiga é deletada, nova é enviada |
| **Remoção** | Imagem deletada do Storage, campo `imagem_url` definido como `null` |
| **Exclusão do produto** | Imagem associada é automaticamente deletada do Storage |

---

## Troubleshooting

### Erro: "Variáveis de ambiente não configuradas"
- Verifique se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão no arquivo `.env`
- Reinicie o servidor após adicionar as variáveis

### Erro: "Unauthorized" ao tentar atualizar estoque
- Verifique se você está autenticado (fez login na área admin)
- Confirme que o usuário foi criado no Supabase

### Produtos não aparecem
- Verifique se a tabela `produtos` foi criada e tem dados
- Confirme que o RLS está habilitado corretamente

### Erro ao fazer upload de imagem
- Confirme que o bucket `produto-imagens` foi criado como **público**
- Verifique se as políticas de Storage foram aplicadas corretamente
- Certifique-se de estar autenticado no painel admin antes de fazer upload

### Imagens não aparecem no catálogo
- Verifique se o bucket está configurado como público
- Confirme que a URL no campo `imagem_url` está acessível
