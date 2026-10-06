# 🚀 GUIA COMPLETO DO SISTEMA HC VAPE — DOSSIÊ PARA PROPAGANDA & VENDAS

Este documento reúne **absolutamente tudo** sobre o sistema **HC Vape (Catálogo Digital & Gestão Completa para Tabacarias e Vape Shops)**. 

Você pode usar este material como base de conhecimento, roteiro de vendas ou **copiar e colar os prompts prontos no final** em qualquer Inteligência Artificial (ChatGPT, Gemini, Claude, etc.) para criar anúncios, vídeos, posts, carrosséis, emails e páginas de vendas de altíssima conversão.

---

## 📌 1. RESUMO EXECUTIVO DO SISTEMA

- **Nome do Sistema:** HC Vape — Plataforma Integrada de Catálogo Digital & Painel de Gestão Operacional
- **Público-Alvo do Software:** Donos de Tabacarias, Vape Shops, Distribuidores e Vendedores de Pods Descartáveis / Vapes / E-líquidos.
- **Proposta de Valor Principal:** Transforma uma tabacaria que atende de forma desorganizada pelo WhatsApp em uma **operação profissional, futurista e automatizada**, integrando catálogo público com controle de estoque por sabor/zona, CRM de clientes, gestão de trocas/garantia, controle de metas financeiras e checkout inteligente direto no WhatsApp.
- **Slogan / Posicionamento:** *"A plataforma definitiva para quem quer parar de perder vendas no WhatsApp e profissionalizar sua operação de vape do catálogo ao pós-venda."*

---

## 🎨 2. IDENTIDADE VISUAL & EXPERIÊNCIA DO USUÁRIO (DESIGN PREMIUM)

- **Estética:** *Cyberpunk Futurista Minimalista + Luxury Dark Glassmorphism*.
- **Paleta de Cores:**
  - Fundo: Preto Absoluto / Obsidiana (`#070908` / `#000000`) transmitindo sofisticação e tecnologia.
  - Verde Cyber Neon (`#76FF03` / `#00F59B`): Destaque para compras imediatas, status ativo e energia.
  - Coral / Magenta Neon (`#FF3366` / `#FF006E`): Destaque para promoções relâmpago, escassez e exclusividade.
  - Efeitos: Bordas em neon glow, painéis translúcidos de vidro (Glassmorphism), microanimações e transições ultra-suaves.
- **Tipografia:** Moderna e de alto impacto (Outfit para títulos marcantes + Plus Jakarta Sans para leitura confortável).
- **Responsividade 100% Mobile-First:** Projetado sob medida para a tela do smartphone, onde ocorrem 95%+ das compras desse nicho.

---

## 🛍️ 3. RECURSOS DO CLIENTE (FRONT-END / CATÁLOGO PÚBLICO)

### 📍 3.1. Seletor Geográfico de Zonas de Entrega
- Permite que a loja atenda diferentes regiões (ex: **Zona Norte** vs. **Zona Sul/Oeste**) com estoques independentes.
- O cliente escolhe sua região logo na entrada e o catálogo exibe **somente os produtos e sabores disponíveis para a sua localização**.
- Evita o maior pesadelo do lojista: vender um sabor ou produto que só tem no estoque da outra ponta da cidade.

### ⚡ 3.2. Dupla Modalidade de Compra (Expresso vs. Promocional)
1. **Modalidade Expresso (Pronta Entrega):**
   - Para quem tem urgência.
   - Envio imediato por motoboy com taxa padrão.
   - Exibe o estoque em tempo real com separação por zona.
2. **Modalidade Promocional (Ofertas Relâmpago com Horário de Corte):**
   - Produtos com super descontos programados.
   - Regra de corte de horário inteligente (ex: peça de segunda a quarta até as 15:25 e receba no lote noturno às 19:00).
   - Temporizador dinâmico que ativa/desativa promoções automaticamente conforme os dias e horários configurados.

### 🖼️ 3.3. Hero Banner Dinâmico & Interativo
- Carrossel no topo do site para anúncios de novidades, lançamentos de marcas famosas (IGNITE, ELF BAR, BLACK SHEEP, WAKA, etc.) e avisos importantes.
- Totalmente editável pelo lojista pelo painel administrativo, com suporte a imagens, títulos, links e cores personalizadas.

### 🔍 3.4. Filtros Avançados e Busca Instantânea
- Filtro por Marcas com logos e badges estilizados.
- Campo de busca em tempo real por nome do pod ou sabor.
- **Ordenação por Puffs:** O cliente pode ordenar os produtos por durabilidade (do menor para o maior ou do gigante de 40.000 puffs para baixo).

### 🍓 3.5. Seleção Visual de Sabores com Controle de Estoque
- Cada produto abre sua lista de sabores disponíveis.
- Sabores esgotados ficam desabilitados com badge visual, impedindo pedidos com itens em falta.
- Visualização nítida de fotos reais hospedadas em nuvem de alta velocidade.

### 🛒 3.6. Carrinho Inteligente & Checkout via WhatsApp Formatado
- Carrinho flutuante translúcido (Glassmorphism) com cálculo automático do total e quantidades.
- Formulário de checkout rápido (Nome, WhatsApp, Indicação/Cupom).
- Geração automática de mensagem pronta e padronizada para o WhatsApp da loja, com numeração de pedido, lista de itens, sabores, valor total e dados do cliente.

### 📖 3.7. Página "Como Funciona" Interativa
- Guia visual passo a passo explicando prazos de entrega, regras da modalidade promocional e garantias.

---

## ⚙️ 4. RECURSOS DO ADMINISTRADOR (PAINEL BACKOFFICE COMPLETO)

O painel administrativo (`/admin`) é uma verdadeira central de comando protegida por autenticação segura no Supabase. Ele contém:

### 📦 4.1. Gestão Completa de Produtos e Estoques
- Cadastro e edição de produtos com nome, marca, preço normal, preço promocional e fotos.
- **Upload Direto de Imagens:** Armazenamento em nuvem (Supabase Storage) com compressão e preview instantâneo.
- **Estoque Multidimensional:** Controle de quantidade global, estoque por sabor e estoque separado por zona geográfica.
- Ativação/Desativação de produtos em um clique sem precisar excluí-los.

### 📋 4.2. Central de Pedidos em Tempo Real
- Listagem completa de pedidos recebidos com número, cliente, WhatsApp, itens, sabores, valor e data.
- Filtros avançados: Por status (Pendente / Concluído), por Zona de entrega e por período de datas.
- Botão de ação rápida para chamar o cliente no WhatsApp diretamente do painel.

### 👥 4.3. CRM de Clientes com Cadastro Único por WhatsApp
- **Identificação Unificada:** Sistema normaliza o número do WhatsApp (ex: DDD + 9 dígitos) para que o mesmo cliente nunca fique duplicado.
- **Métricas de LTV (Lifetime Value):** Calcula automaticamente total gasto pelo cliente, número de pedidos realizados e zona mais frequente.
- **Linha do Tempo de Interações:** Histórico completo de cada cliente (compras, trocas de garantia, dúvidas e atendimentos).
- Exportação de relatórios e segmentação de clientes recorrentes para remarketing.

### 🔄 4.4. Módulo Profissional de Trocas & Garantia de Defeitos
- Registro de trocas de pods com defeito (gosto de queimado, bateria morta, vazamento, sensor travado, etc.).
- Opção de dar baixa automática no estoque do produto substituído.
- Relatório de perdas e histórico de trocas por cliente (evita fraudes e golpes de clientes de má fé).
- Gráficos de motivos mais frequentes para cobrar fornecedores sobre lotes defeituosos.

### 🎯 4.5. Relógio de Metas & Faturamento Mensal
- Indicador visual e gráfico de metas de vendas para o mês.
- Acompanhamento de progresso percentual, ticket médio e projeção de faturamento.
- Histórico comparativo mês a mês.

### 📊 4.6. Métricas, Tráfego & Analytics Avançado
- Gráficos interativos (Recharts) com visualização em Linha, Área, Barras e Pizza.
- Monitoramento de acessos/visitas diárias e taxa de conversão do catálogo.
- Ranking de marcas mais vendidas e produtos com maior giro.
- Filtros de período personalizáveis (7 dias, 15 dias, 30 dias, 90 dias, ano atual, etc.).

### 🖼️ 4.7. Editor Visual do Hero Banner
- Permite criar, editar, reordenar ou remover banners promocionais do topo do site diretamente pelo painel, sem mexer em código.

### 🩺 4.8. Monitor de Saúde do Sistema
- Verificação em tempo real da conexão com o banco de dados Supabase, autenticação e integridade do armazenamento de imagens.

---

## 💎 5. PRINCIPAIS DORES QUE O SISTEMA RESOLVE (ARGUMENTOS DE VENDA)

| Dor Comum do Dono de Tabacaria | Solução Proporcionada pelo Sistema |
| :--- | :--- |
| **"Perco muito tempo digitando sabores disponíveis no WhatsApp todo dia."** | O cliente escolhe tudo sozinho no catálogo atualizado em tempo real. |
| **"O cliente pede um sabor que já acabou no estoque e fica frustrado."** | O sistema desabilita sabores sem estoque automaticamente. |
| **"Tenho estoque em dois bairros/zonas e sempre me confundo na hora de mandar o motoboy."** | O sistema separa o estoque por zonas geográficas de atendimento. |
| **"Não sei quanto faturei no mês nem quem são meus melhores clientes."** | Dashboard financeiro com metas e CRM com histórico e LTV de cada cliente. |
| **"Perco dinheiro com trocas de pods sem saber se o cliente já trocou antes ou qual marca dá mais defeito."** | Módulo de Trocas & Garantia com controle antifraude e estatísticas de defeitos. |
| **"Minha loja parece amadora comparada aos concorrentes."** | Visual Cyberpunk Dark luxuoso de última geração que encanta o cliente no primeiro segundo. |

---

## 🎬 6. ROTEIROS PRONTOS PARA PROPAGANDA & VÍDEOS (REELS / TIKTOK / SHORTS)

### 🎥 ROTEIRO 1: "Pare de passar vergonha no WhatsApp" (Foco: Profissionalismo & Conversão)
- **Gancho Visual (0 a 3s):** Mostre uma tela cheia de mensagens no WhatsApp com texto enorme de sabores, depois corte rápido para o Catálogo HC Vape com design neon brilhando no celular.
- **Áudio/Locução:** *"Você ainda passa 15 minutos digitando lista de sabores no WhatsApp pra cliente que no final nem compra? Olha como as tabacarias de elite estão trabalhando agora."*
- **Desenvolvimento (4 a 20s):** Mostre a tela do celular navegando pelas marcas (Ignite, Elf Bar), selecionando sabor com estoque em tempo real, escolhendo a zona de entrega e clicando em 'Pedir no WhatsApp'.
- **Áudio/Locução:** *"O cliente entra no seu catálogo exclusivo, escolhe a marca, seleciona o sabor que realmente tem em estoque e o pedido chega pronto no seu WhatsApp formatado, calculado e sem erro."*
- **Fechamento & CTA (21 a 30s):** Mostre o painel administrativo com gráficos de vendas e CRM.
- **Áudio/Locução:** *"E você ainda controla estoque por zona, clientes recorrentes e garantia de trocas num painel profissional. Quer essa estrutura na sua loja hoje? Clica no link ou chama na DM!"*

---

### 🎥 ROTEIRO 2: "O fim do estoque furado" (Foco: Zonas & Sabores)
- **Gancho Visual (0 a 3s):** Texto na tela: *"O maior pesadelo de quem vende pod..."*
- **Áudio/Locução:** *"Quem vende pod já passou por isso: o cliente pede 3 pods de melancia, você confirma, cobra no Pix e quando vai embalar... acabou o sabor!"*
- **Desenvolvimento (4 a 20s):** Gravação de tela mostrando a seleção de sabores com indicação de estoque e a divisão por Zona Norte e Zona Sul.
- **Áudio/Locução:** *"Com essa plataforma completa, seu estoque é gerenciado por sabor e até por zona da cidade. O cliente só consegue pedir o que realmente tá na prateleira."*
- **Fechamento (21 a 30s):** *"Automatize seus pedidos, economize horas do seu dia e aumente suas vendas. Mande uma mensagem para conhecer a plataforma."*

---

### 🎥 ROTEIRO 3: "Gestão de Trocas sem Prejuízo" (Foco: Garantia & Antifraude)
- **Gancho Visual (0 a 3s):** Cliente devolvendo um pod. Texto: *"Quanto dinheiro você perde em trocas sem controle?"*
- **Áudio/Locução:** *"Sabe aquele cliente que vive pedindo troca dizendo que o pod veio queimado? Você sabe quantas vezes ele já trocou com você este mês?"*
- **Desenvolvimento (4 a 20s):** Mostra a aba de Trocas & Garantia do painel administrativo, com histórico do cliente e motivo do defeito.
- **Áudio/Locução:** *"O sistema HC Vape tem um módulo exclusivo de Trocas e Garantia. Você cadastra o defeito, abate o produto substituído do estoque e identifica na hora quais marcas dão mais defeito e quais clientes estão abusando da garantia."*
- **CTA (21 a 30s):** *"Chega de prejuízo invisível. Tenha o controle total da sua tabacaria!"*

---

## 📲 7. SCRIPTS DE ABORDAGEM DIRETA (WHATSAPP / INSTAGRAM DIRECT)

### Opção A — Mensagem para Dono de Tabacaria / Vape Shop:
> *"Fala, [Nome do Dono / Loja]! Tudo bem?*  
> *Estava dando uma olhada no perfil da [Nome da Loja] e vi que vocês trabalham forte com pods descartáveis e essências.*  
>  
> *A gente desenvolveu um sistema que resolve a maior dor dos lojistas desse nicho: um **Catálogo Cyberpunk com separação de estoque por sabor/zona**, checkout pronto pro WhatsApp e um **painel completo com CRM de clientes e controle de trocas/garantia**.*  
>  
> *Gravei uma demonstração rápida de 1 minuto mostrando como a loja fica. Posso te enviar o link pra você dar uma olhada sem compromisso?"*

---

### Opção B — Mensagem Focada em Agilidade e Vendas:
> *"Opa, [Nome]! Você gasta quanto tempo por dia digitando tabela de sabores e preços para clientes no WhatsApp?*  
>  
> *Criamos uma plataforma onde o cliente vê as fotos em alta definição, escolhe a região de entrega e os sabores disponíveis sozinhos, e o pedido já cai no seu WhatsApp prontinho.*  
>  
> *Dá uma olhada no catálogo funcionando aqui: [Link de Demonstração]. O que achou do visual?"*

---

## 🤖 8. MEGA-PROMPTS PARA USAR COM INTELIGÊNCIA ARTIFICIAL (COPIE E COLE)

Aqui estão prompts prontos para você alimentar qualquer IA (ChatGPT, Claude, Gemini) para criar novos materiais publicitários sob demanda:

### 💬 PROMPT 1: Criador de Anúncios para Instagram Ads / Meta Ads (Tráfego Pago)
```text
Atue como um Especialista em Copywriting de Resposta Direta e Tráfego Pago para o nicho de Tabacarias e Vape Shops.
Com base no dossiê completo do software "HC Vape" abaixo, crie 3 variações de anúncios de alta conversão para o Meta Ads (Instagram Feed e Stories):

Variação 1: Focada em resolver o problema de perder tempo e desorganização com pedidos no WhatsApp.
Variação 2: Focada no visual cyberpunk e aumento da percepção de valor e autoridade da loja.
Variação 3: Focada no controle financeiro, CRM de clientes e gestão de trocas/garantias.

Para cada variação forneça:
- Título do Anúncio (Headline chamativa)
- Texto Principal (Copy envolvente com problema, solução, benefícios e CTA)
- Descrição da Imagem/Vídeo sugerida para o criativo
- Texto do Botão (ex: Saiba Mais, Falar no WhatsApp)

[INCLUIR CONTEÚDO DO GUIA_PROPAGANDA_SISTEMA_COMPLETO.md COMO CONTEXTO]
```

---

### 💬 PROMPT 2: Criador de Carrosséis Educativos para o Instagram
```text
Atue como um estrategista de conteúdo para Instagram.
Crie o roteiro completo de um Carrossel de 7 lâminas com o tema: "5 erros que estão fazendo sua tabacaria perder clientes no WhatsApp todo santo dia (e como resolver)".

Instruções:
- Slide 1: Capa com gancho irresistível e design dark/neon.
- Slides 2 a 6: Apresentação de 1 erro por slide relacionado à falta de catálogo, estoque furado de sabores, confusão de bairros, descontrole de trocas e falta de acompanhamento de clientes recorrentes — apresentando a funcionalidade do sistema HC Vape que resolve cada um.
- Slide 7: Chamada para ação clara convidando para testar o sistema.
- Inclua também a legenda completa do post com hashtags estratégicas.
```

---

### 💬 PROMPT 3: Criador de Página de Vendas (Landing Page Copy)
```text
Atue como um Copywriter sênior especializado em Software as a Service (SaaS).
Escreva o texto completo de uma Landing Page de vendas para vender o sistema de catálogo e gestão para tabacarias.

Estrutura necessária:
1. Hero Section: Headline forte + Subheadline + Botão de Demonstração.
2. Seção de Identificação de Dores: Os 4 maiores problemas da rotina de quem vende pod pelo WhatsApp.
3. Apresentação da Solução: O que é o sistema e o visual Cyberpunk Dark.
4. Tour pelos Módulos: Catálogo Público, Seletor de Zonas, Gestão de Sabores, CRM WhatsApp, Módulo de Trocas, Dashboard de Metas.
5. Comparativo: Vender sem o sistema vs. Vender com o sistema.
6. Seção de Perguntas Frequentes (FAQ): Tirando dúvidas sobre personalização, hospedagem, suporte e facilidade de uso.
7. CTA Final com garantia e chamada para contato.
```

---

### 💬 PROMPT 4: Criador de Roteiros de Vídeo Narrado (Vanguard/UGC/Loom)
```text
Atue como um criador de roteiros para vídeos de demonstração de software no formato "Gravação de Tela com Locução Empolgante".
Escreva um roteiro detalhado de 90 segundos onde o apresentador mostra a tela do celular do cliente e depois o painel administrativo no computador.
Divida o roteiro em duas colunas:
- Coluna 1: O que aparece na tela (Ações e cliques)
- Coluna 2: Locução / O que falar (Tom enérgico, direto e comercial)
```

---

## 🏆 9. LISTA DE TAGS E PALAVRAS-CHAVE DO NICHO

Use essas palavras-chave nos seus posts, anúncios e descrições:
`#tabacaria #vapeshop #catalogointerativo #sistemaparatabacaria #gestaodetabacaria #ignite #elfbar #blacksheep #waka #poddescartavel #vapebrasil #empreendedorismo #softwaretabacaria #automaçãowhatsapp #ecommercevape`
