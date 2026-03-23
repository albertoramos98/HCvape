# Deploy na Vercel - HC Catálogo

Guia passo a passo para fazer deploy do projeto na Vercel.

## 📋 Pré-requisitos

- Conta GitHub com o repositório do projeto
- Conta Vercel (gratuita em vercel.com)
- Credenciais Supabase (URL e Anon Key)

## 🚀 Passos para Deploy

### 1. Preparar o Repositório GitHub

```bash
# Se ainda não tiver Git inicializado
git init
git add .
git commit -m "Initial commit: HC Catálogo com Promoções e CRUD"
git branch -M main
git remote add origin https://github.com/seu-usuario/hc-vape-catalogo.git
git push -u origin main
```

### 2. Acessar Vercel

1. Vá para [vercel.com](https://vercel.com)
2. Clique em **"New Project"**
3. Selecione **"Import Git Repository"**
4. Conecte sua conta GitHub
5. Selecione o repositório `hc-vape-catalogo`

### 3. Configurar Variáveis de Ambiente

Na tela de configuração do Vercel, adicione as variáveis:

```
VITE_SUPABASE_URL=https://lmhtptakvzpzftcygxmo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_4Y7jeM4fEfLH4UMMYNR5Bw_dzUAuK0J
```

### 4. Configurar Build

- **Framework Preset:** Vite
- **Build Command:** `pnpm build`
- **Output Directory:** `dist`
- **Install Command:** `pnpm install`

### 5. Deploy

Clique em **"Deploy"** e aguarde a conclusão!

---

## ✅ Após o Deploy

1. Seu site estará disponível em: `https://seu-projeto.vercel.app`
2. Qualquer push para `main` fará deploy automático
3. Acesse `/admin` para gerenciar produtos

---

## 🔧 Configurar Domínio Customizado

1. No painel Vercel, vá para **Settings → Domains**
2. Adicione seu domínio customizado
3. Configure os DNS records conforme instruções

---

## 📝 Atualizar Banco de Dados

Não esqueça de executar o script SQL no Supabase para adicionar os campos de promoção:

```sql
ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT FALSE;

ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS preco_promo DECIMAL(10, 2) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_is_promo ON produtos(is_promo);
```

---

## 🆘 Troubleshooting

### Erro: "Variáveis de ambiente não configuradas"
- Verifique se as variáveis estão corretas no painel Vercel
- Redeploy após adicionar variáveis

### Erro: "Produtos não aparecem"
- Confirme que a tabela `produtos` existe no Supabase
- Verifique se há dados inseridos
- Cheque o RLS (Row Level Security)

### Erro: "Admin não funciona"
- Confirme que criou um usuário em Supabase → Authentication → Users
- Verifique as credenciais
- Cheque o RLS para UPDATE

---

## 📞 Suporte

Para dúvidas sobre Vercel: https://vercel.com/docs
Para dúvidas sobre Supabase: https://supabase.com/docs
