# RUNBOOK: Implantação do Sistema Definitivo de Estoque Blindado
**Projeto:** HCvape  
**Versão:** 2.0 (Estoque Atômico por Zonas, Append-Only e Sem Clamp)  
**Data:** 2026-10-21  

---

## 1. Princípios da Arquitetura
1. **Fonte Única da Verdade:** `produtos.estoque_zonas` (JSONB estruturado por zona canônica: `recife`, `norte`, `sul_oeste`).
2. **Colunas Derivadas Somente-Leitura:** `produtos.estoque` e `produtos.sabores_estoque` são recalculadas exclusivamente no banco de dados via RPC `recalcular_estoque_produto`.
3. **Auditoria Imutável Append-Only:** Toda e qualquer alteração de saldo gera uma linha em `movimentos_estoque` com `saldo_antes`, `saldo_depois`, `delta`, tipo (`venda`, `estorno`, `ajuste`, `troca`, `troca_estorno`, `contagem_inicial`) e operador via JWT.
4. **Segurança Concorrente:** Bloqueios pessimistas `SELECT ... FOR UPDATE` impedem condições de corrida.
5. **Sem Clamp Silencioso:** Nenhuma operação usa `Math.max(0, ...)`; se o saldo for insuficiente, aborta com erro explícito.

---

## 2. Janela de Manutenção e Pré-Requisitos

> [!IMPORTANT]
> Realize a implantação em horário de baixo movimento. Reserve uma janela de aproximadamente 15 a 30 minutos.

### Checklist Pré-Implantação:
- [ ] **Congelar Operação de Checklist:** Notificar a equipe para pausar temporariamente a conferência de pedidos no painel administrativo.
- [ ] **Concluir ou Reabrir Pedidos Pendentes:** Garantir que não haja pedidos em estado intermediário.
- [ ] **Backup dos Dados:** No painel Supabase (ou Table Editor), exportar CSV/backup das tabelas:
  - `produtos`
  - `pedidos`
  - `trocas`

---

## 3. Ordem Exata de Execução dos Scripts SQL (Supabase SQL Editor)

Acesse o **SQL Editor** do Supabase e execute os arquivos na ordem rigorosa abaixo:

### Passo 1: Migração de Produtos Legados
**Arquivo:** [`supabase/migrations/000_migrar_legados.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/migrations/000_migrar_legados.sql)
- Habilita a extensão `unaccent` no schema `extensions`.
- Monta `estoque_zonas` a partir de `sabores_estoque` para produtos sem zonas estruturadas.
- Unifica zonas legadas `'sul'` e `'oeste'` para `'sul_oeste'`.
- *Resultado esperado:* Mensagem de NOTICE confirmando produtos migrados e unificados sem nenhum produto zerado.

### Passo 2: Tabela de Auditoria e Coluna Ilimitado
**Arquivo:** [`supabase/migrations/001_tabela_movimentos_e_coluna_ilimitado.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/migrations/001_tabela_movimentos_e_coluna_ilimitado.sql)
- Cria a tabela append-only `movimentos_estoque` com chaves `ON DELETE RESTRICT`.
- Cria a coluna `produtos.estoque_ilimitado`.
- Aplica RLS estrita: mutações diretas revogadas; inserts apenas por funções `SECURITY DEFINER`.

### Passo 3: Funções de Normalização, Recálculo Seguro e Ajuste
**Arquivo:** [`supabase/migrations/002_funcoes_recalcular_e_ajuste.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/migrations/002_funcoes_recalcular_e_ajuste.sql)
- Cria `normalizar_sabor` e `encontrar_chave_sabor` via `extensions.unaccent`.
- Cria `recalcular_estoque_produto` com **salvaguarda de aborto seguro** se `estoque_zonas` for vazio.
- Cria `ajustar_estoque` com suporte a `'definir'` (contagem) e `'delta'` (entradas/saídas), extraindo o usuário autenticado do JWT.
- Permissões: `REVOKE FROM PUBLIC, anon; GRANT TO authenticated;`.

### Passo 4: Baixa e Estorno por Saldo Líquido
**Arquivo:** [`supabase/migrations/003_funcoes_pedido_baixa_estorno.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/migrations/003_funcoes_pedido_baixa_estorno.sql)
- Cria `resolver_zona_id` com zonas canônicas (`recife`, `norte`, `sul_oeste`).
- Cria `baixar_estoque_pedido` atômico com lock `FOR UPDATE`.
- Cria `estornar_estoque_pedido` por **saldo líquido** (`-SUM(delta)`), eliminando o fallback que inflava itens legados.
- Permissões: `REVOKE FROM PUBLIC, anon; GRANT TO authenticated;`.

### Passo 5: Gestão Atômica de Trocas com Cancelamento Lógico
**Arquivo:** [`supabase/migrations/004_funcoes_troca.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/migrations/004_funcoes_troca.sql)
- Cria `registrar_troca` com baixa atômica opcional.
- Cria `estornar_troca` que atualiza para `status = 'cancelada'` sem apagar a linha física.
- Permissões: `REVOKE FROM PUBLIC, anon; GRANT TO authenticated;`.

### Passo 6: Criação Segura de Pedidos no Catálogo
**Arquivo:** [`supabase/migrations/005_atualizar_criar_pedido_catalogo.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/migrations/005_atualizar_criar_pedido_catalogo.sql)
- Valida `quantidade > 0` (inteira).
- Recalcula os totais financeiros no servidor a partir dos preços cadastrados (`preco` / `preco_promo`).
- Pré-valida estoque disponível na zona selecionada.
- Permissões: `GRANT TO anon, authenticated;`.

### Passo 7: Validação Automática em Transação Reversível
**Arquivo:** [`supabase/tests/estoque_tests.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/tests/estoque_tests.sql)
- Cole o arquivo inteiro no SQL Editor e execute.
- Executa dentro de `BEGIN ... ROLLBACK` testando 9 cenários (JWT autenticado, recálculo seguro, multi-sabores, recálculo financeiro, idempotência e bloqueio de `anon`).
- *Resultado esperado:* `=== TODOS OS CENÁRIOS SQL PASSARAM COM 100% DE SUCESSO! ===`.

---

## 4. Carga da Contagem Física Inicial (Inventário)

1. Preencha o arquivo [`supabase/scripts/04_template_contagem_inicial.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/scripts/04_template_contagem_inicial.sql) com as quantidades físicas reais apuradas por produto, zona e sabor.
2. Execute o script no SQL Editor. Cada item gerará um movimento do tipo `contagem_inicial` com rastreabilidade completa.
3. Execute o script de diagnóstico [`supabase/scripts/01_diagnostico_divergencias.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/scripts/01_diagnostico_divergencias.sql): o resultado deve retornar **zero divergências**.

---

## 5. Deploy do Frontend e Verificação Operacional

1. Faça o merge da branch `fix/estoque` para a branch `main`:
   ```bash
   git checkout main
   git merge fix/estoque
   git push origin main
   ```
2. Aguarde o build automático na plataforma de hospedagem (ex: Vercel).
3. **Testes de Homologação no Painel Admin:**
   - **Ajuste Inline:** Ajuste o estoque de um produto de sabor único na listagem rápida. Verifique se o saldo atualiza imediatamente e se a linha é criada em `movimentos_estoque`.
   - **Edição Completa:** Abra um produto, altere o nome ou preço e salve. Verifique se o estoque anterior permaneceu intacto.
   - **Checklist de Pedido:** Clique no botão "Checklist" de um pedido ativo. Observe o spinner de carregamento, desabilitação temporária do botão e baixa correta do estoque.
   - **Reabertura (Estorno):** Clique em "Reabrir". Verifique se o saldo foi exatamente reposto.
   - **Registro de Troca:** Registre uma troca marcando abatimento de estoque. Verifique o saldo do novo vape reduzido em 1. Em seguida, cancele a troca e verifique o estorno do estoque e status alterado para `cancelada`.

---

## 6. Resolução de Cache do PostgREST ("function not found in schema cache")

Caso o painel exiba o alerta:
`Could not find the function public.baixar_estoque_pedido(p_pedido_id, p_usuario) in the schema cache`

Execute imediatamente o script [`supabase/scripts/05_corrigir_cache_e_compatibilidade.sql`](file:///c:/Users/alberto/Desktop/HCvape/supabase/scripts/05_corrigir_cache_e_compatibilidade.sql) no SQL Editor do Supabase. Ele:
1. Elimina conflitos de sobrecargas antigas (`DROP FUNCTION IF EXISTS`).
2. Recria as RPCs com parâmetro `p_usuario TEXT DEFAULT NULL`, aceitando chamadas com e sem `p_usuario`.
3. Notifica o PostgREST para recarregar o schema cache imediatamente (`NOTIFY pgrst, 'reload schema';`).

---

## 7. Plano de Rollback

Caso ocorra qualquer inconsistência imprevista antes do término da janela de manutenção:

1. **Reversão do Frontend:**
   ```bash
   git checkout main
   git revert HEAD -m 1
   git push origin main
   ```
2. **Reversão das Funções no Banco (SQL Editor):**
   - Caso seja necessário restaurar a função legada de pedidos:
     ```sql
     -- Reativar versão simples anterior caso necessário
     CREATE OR REPLACE FUNCTION criar_pedido_catalogo(...) ...;
     ```
   - A tabela `movimentos_estoque` e a coluna `estoque_ilimitado` não interferem nas consultas legadas e podem permanecer ativas sem risco de quebra.
