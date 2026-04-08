# HC - Desde 2020 | Catálogo Digital

Catálogo SPA (Single Page Application) com estética Cyberpunk/Dark Mode para gerenciamento de produtos de vape com integração Supabase.

## 🎨 Design

- **Estilo:** Cyberpunk Futurista Minimalista
- **Cores:** Neon Verde (#39FF14) + Prata Cromada (#C0C0C0) + Preto Absoluto (#000000)
- **Tipografia:** Orbitron (display) + Roboto Mono (body)
- **Responsividade:** 100% Mobile-First

## 🚀 Funcionalidades

### Catálogo Público (`/`)
- ✅ Listagem de produtos em tempo real (Supabase)
- ✅ Filtros por marca (IGNITE, ELF BAR, BLACK SHEEP, SEX ADDICT, WAKA)
- ✅ Seletor de sabor por produto
- ✅ Carrinho flutuante com glassmorphism
- ✅ Lógica de estoque (botão "Esgotado" quando estoque ≤ 0)
- ✅ Checkout via WhatsApp (+55 81 9739-0944)

### Admin Protegido (`/admin`)
- ✅ Autenticação Supabase (email + senha)
- ✅ Dashboard com tabela de produtos
- ✅ Edição de estoque em tempo real
- ✅ Estatísticas (total, em estoque, esgotados)
- ✅ RLS (Row Level Security) configurado

## 📋 Pré-requisitos

- **Node.js** 18+ (recomendado 20+)
- **pnpm** (gerenciador de pacotes)
- **Conta Supabase** (gratuita em supabase.com)

## 🔧 Setup Local

### 1. Clonar/Baixar o Projeto

```bash
# Se tiver Git
git clone <seu-repositorio>
cd hc-vape-catalogo

# Ou baixe o ZIP e extraia
```

### 2. Instalar Dependências

```bash
# Instalar pnpm (se não tiver)
npm install -g pnpm

# Instalar dependências do projeto
pnpm install
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https
VITE_SUPABASE_ANON_KEY=
```

### 4. Configurar Banco de Dados (Supabase)

#### a. Criar Tabela `produtos`

Acesse [supabase.com](https://supabase.com), vá para seu projeto e abra o **SQL Editor**. Execute este script:

```sql
-- Criar tabela de produtos
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  preco DECIMAL(10, 2) NOT NULL,
  estoque INTEGER NOT NULL DEFAULT 0,
  sabores TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices
CREATE INDEX idx_produtos_marca ON produtos(marca);
CREATE INDEX idx_produtos_estoque ON produtos(estoque);

-- Habilitar RLS
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública
CREATE POLICY "Produtos são públicos para leitura"
  ON produtos FOR SELECT
  USING (true);

-- Política de escrita apenas para autenticados
CREATE POLICY "Apenas usuários autenticados podem atualizar"
  ON produtos FOR UPDATE
  USING (auth.role() = 'authenticated');
```

#### b. Inserir Dados de Exemplo

```sql
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

#### c. Criar Usuário para Admin

No painel Supabase, vá para **Authentication → Users** e clique em **Invite user**. Defina um email e senha para fazer login na área admin.

### 5. Rodar Localmente

```bash
# Modo desenvolvimento (com hot reload)
pnpm dev

# Abrirá em http://localhost:5173
```

### 6. Build para Produção

```bash
# Fazer build
pnpm build

# Testar build localmente
pnpm preview
```

## 📂 Estrutura do Projeto

```
hc-vape-catalogo/
├── client/
│   ├── public/              # Arquivos estáticos (favicon, etc)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx     # Catálogo público
│   │   │   └── Admin.tsx    # Dashboard de admin
│   │   ├── lib/
│   │   │   └── supabase.ts  # Serviço Supabase
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── App.tsx          # Router principal
│   │   ├── main.tsx         # Entry point
│   │   └── index.css        # Estilos globais (Tailwind)
│   └── index.html           # HTML principal
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

## 🔐 Segurança

- ✅ Credenciais Supabase em variáveis de ambiente
- ✅ RLS (Row Level Security) ativado no banco
- ✅ Autenticação protegida para admin
- ✅ Sem exposição de chaves sensíveis no código

## 🐛 Troubleshooting

### Tela Branca ao Abrir

**Problema:** A aplicação abre mas fica em branco.

**Soluções:**
1. Verifique o console do navegador (F12 → Console)
2. Confirme que `.env.local` está na raiz do projeto
3. Verifique se as variáveis de ambiente estão corretas
4. Limpe o cache: `pnpm install` e `pnpm dev` novamente

### Erro: "Variáveis de ambiente não configuradas"

**Solução:** Crie o arquivo `.env.local` com as credenciais Supabase.

### Produtos não aparecem no catálogo

**Solução:** 
1. Verifique se a tabela `produtos` foi criada no Supabase
2. Confirme que há dados inseridos
3. Verifique o RLS está configurado corretamente

### Erro ao fazer login no admin

**Solução:**
1. Confirme que criou um usuário em **Authentication → Users**
2. Verifique email e senha
3. Verifique se o RLS permite UPDATE para usuários autenticados

## 📱 Acessar a Aplicação

- **Catálogo:** `http://localhost:5173/` (ou porta configurada)
- **Admin:** `http://localhost:5173/admin`

## 🚀 Deploy

### Opção 1: Manus (Recomendado)
Clique em **Publish** no painel Manus para publicar automaticamente.

### Opção 2: Vercel
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Opção 3: Netlify
```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

## 📞 Suporte

Para dúvidas sobre Supabase, visite: https://supabase.com/docs

## 📄 Licença

MIT

---

**Desenvolvido com ❤️ para HC - Desde 2020**
"# HCvape" 
