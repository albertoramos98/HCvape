-- =========================================================================
-- HC VAPE - SUÍTE COMPLETA DE TESTES SQL EM TRANSAÇÃO REVERSÍVEL
-- Execução: Pode ser colada inteira no SQL Editor do Supabase.
-- NENHUM dado é salvo (termina com ROLLBACK).
-- =========================================================================

BEGIN;

-- 1. Simular JWT de usuário autenticado
SELECT set_config(
  'request.jwt.claims', 
  '{"sub": "00000000-0000-0000-0000-000000000001", "email": "auditor@hcvape.com", "role": "authenticated"}', 
  true
);

DO $$
DECLARE
  v_prod_id UUID := gen_random_uuid();
  v_prod_legado_id UUID := gen_random_uuid();
  v_prod_ilim_id UUID := gen_random_uuid();
  v_pedido_res JSONB;
  v_pedido_id UUID;
  v_pedido_insuficiente_id UUID;
  v_troca_res JSONB;
  v_troca_id UUID;
  v_res JSONB;
  v_estoque_final INT;
  v_deu_erro BOOLEAN := false;
  v_saldo_menta INT;
  v_saldo_uva INT;
BEGIN
  RAISE NOTICE '=== INICIANDO SUÍTE DE TESTES DE ESTOQUE BLINDADO ===';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 1: Recálculo em produto legado com estoque_zonas vazio DEVE ABORTAR
  -- -----------------------------------------------------------------------
  INSERT INTO public.produtos (
    id, marca, nome, preco, estoque, sabores, sabores_estoque, zonas, estoque_zonas, ativo
  ) VALUES (
    v_prod_legado_id, 'TESTE_LEGADO', 'PROD SEM ZONAS', 100, 10,
    ARRAY['Menta Ice'], '{"Menta Ice": 10}'::jsonb,
    ARRAY['recife'], '{}'::jsonb, true
  );

  BEGIN
    PERFORM recalcular_estoque_produto(v_prod_legado_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 1 [PASSOU]: recalcular_estoque_produto abortou com sucesso em produto legado vazio: %', SQLERRM;
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 1: recalcular_estoque_produto deveria ter abortado para estoque_zonas vazio!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 2: Criação de produto de teste com 2 sabores e ajustes atômicos
  -- -----------------------------------------------------------------------
  INSERT INTO public.produtos (
    id, marca, nome, preco, estoque, sabores, sabores_estoque, zonas, estoque_zonas, ativo
  ) VALUES (
    v_prod_id, 'TESTE', 'POD MULTI SABORES', 100.00, 20,
    ARRAY['Menta Ice', 'Uva Ice'],
    '{"Menta Ice": 10, "Uva Ice": 10}'::jsonb,
    ARRAY['recife', 'norte'],
    jsonb_build_object(
      'recife', jsonb_build_object(
        'estoque', 20,
        'sabores_estoque', jsonb_build_object('Menta Ice', 10, 'Uva Ice', 10)
      )
    ),
    true
  );

  -- Teste de ajustar_estoque modo 'definir'
  PERFORM ajustar_estoque(v_prod_id, 'recife', 'Menta Ice', 'definir', 15, 'ajuste_teste');
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta 
  FROM public.produtos WHERE id = v_prod_id;
  ASSERT v_saldo_menta = 15, 'FALHA: saldo Menta Ice deveria ser 15';

  -- Teste de ajustar_estoque modo 'delta'
  PERFORM ajustar_estoque(v_prod_id, 'recife', 'Uva Ice', 'delta', -2, 'ajuste_teste_delta');
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int INTO v_saldo_uva 
  FROM public.produtos WHERE id = v_prod_id;
  ASSERT v_saldo_uva = 8, 'FALHA: saldo Uva Ice deveria ser 8';
  RAISE NOTICE 'CENÁRIO 2 [PASSOU]: ajustar_estoque definir e delta funcionando perfeitamente.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 3: Pedido com 2 sabores do mesmo produto e recálculo financeiro no servidor
  -- O cliente envia total = 10, mas o banco DEVE recalcular (100 * 2 + 100 * 1 = 300)
  -- -----------------------------------------------------------------------
  v_pedido_res := criar_pedido_catalogo(
    'Cliente Teste',
    '81999999999',
    'Amigo',
    'recife',
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD MULTI SABORES', 'sabor', 'Menta Ice', 'quantidade', 2),
      jsonb_build_object('id', v_prod_id, 'nome', 'POD MULTI SABORES', 'sabor', 'Uva Ice', 'quantidade', 1)
    ),
    10.00, -- valor adulterado pelo front
    0.00,
    10.00
  );

  v_pedido_id := (v_pedido_res->>'id')::UUID;
  ASSERT (v_pedido_res->>'total')::numeric = 300.00, 'FALHA: banco não recalculou total do pedido com base nos preços reais!';
  RAISE NOTICE 'CENÁRIO 3 [PASSOU]: criar_pedido_catalogo validou itens e recalculou total financeiro no servidor (R$ 300,00).';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 4: Baixa atômica nos 2 sabores do produto
  -- -----------------------------------------------------------------------
  v_res := baixar_estoque_pedido(v_pedido_id);
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: baixa_estoque_pedido falhou';

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta FROM public.produtos WHERE id = v_prod_id;
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int INTO v_saldo_uva FROM public.produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 13, 'FALHA: saldo Menta Ice após baixa deveria ser 13';
  ASSERT v_saldo_uva = 7, 'FALHA: saldo Uva Ice após baixa deveria ser 7';
  RAISE NOTICE 'CENÁRIO 4 [PASSOU]: Baixa atômica em múltiplos sabores do mesmo produto executada com sucesso.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 5: Idempotência da baixa (segunda baixa deve falhar)
  -- -----------------------------------------------------------------------
  BEGIN
    PERFORM baixar_estoque_pedido(v_pedido_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 5 [PASSOU]: Segunda baixa rejeitada com sucesso (Idempotência).';
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 5: Segunda baixa deveria ter sido recusada!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 6: Estorno atômico por Saldo Líquido (-SUM(delta))
  -- -----------------------------------------------------------------------
  v_res := estornar_estoque_pedido(v_pedido_id);
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: estorno falhou';

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta FROM public.produtos WHERE id = v_prod_id;
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int INTO v_saldo_uva FROM public.produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 15, 'FALHA: saldo Menta Ice após estorno deveria voltar a ser 15';
  ASSERT v_saldo_uva = 8, 'FALHA: saldo Uva Ice após estorno deveria voltar a ser 8';
  RAISE NOTICE 'CENÁRIO 6 [PASSOU]: Estorno por saldo líquido restaurou exatamente as quantidades debitadas.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 7: Idempotência do estorno (segundo estorno deve falhar)
  -- -----------------------------------------------------------------------
  BEGIN
    PERFORM estornar_estoque_pedido(v_pedido_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 7 [PASSOU]: Segundo estorno rejeitado com sucesso (Idempotência).';
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 7: Segundo estorno deveria ter sido recusado!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 8: Teste de quantidade inválida (quantidade <= 0)
  -- -----------------------------------------------------------------------
  BEGIN
    PERFORM criar_pedido_catalogo(
      'Cliente Invalido',
      '81999999999',
      '',
      'recife',
      jsonb_build_array(
        jsonb_build_object('id', v_prod_id, 'nome', 'POD', 'sabor', 'Menta Ice', 'quantidade', 0)
      )
    );
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 8 [PASSOU]: Pedido com quantidade zero rejeitado pelo banco.';
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 8: Pedido com quantidade <= 0 deveria ter sido recusado!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 10: Compatibilidade de Parâmetros e Cache PostgREST (1 e 2 parâmetros)
  -- Garante que chamadas legadas com (p_pedido_id, p_usuario) e novas com (p_pedido_id)
  -- funcionem de forma idêntica e sem erro no schema cache do PostgREST.
  -- -----------------------------------------------------------------------
  -- Baixa com 2 parâmetros (simulando frontend em cache ou aba antiga)
  v_res := baixar_estoque_pedido(v_pedido_id, 'sessao_legada@hcvape.com');
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: baixar_estoque_pedido com 2 parâmetros falhou';

  -- Validar que o usuário foi registrado na auditoria
  ASSERT (
    SELECT usuario 
    FROM public.movimentos_estoque 
    WHERE pedido_id = v_pedido_id AND tipo = 'venda' 
    ORDER BY created_at DESC 
    LIMIT 1
  ) = 'sessao_legada@hcvape.com', 'FALHA: usuário da chamada legada não foi gravado na auditoria';

  -- Estorno com 2 parâmetros (simulando frontend em cache)
  v_res := estornar_estoque_pedido(v_pedido_id, 'sessao_legada@hcvape.com');
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: estornar_estoque_pedido com 2 parâmetros falhou';

  RAISE NOTICE 'CENÁRIO 10 [PASSOU]: Compatibilidade total de 1 e 2 parâmetros validada para baixa e estorno.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 11: Troca com Abatimento Atômico de Estoque (registrar_troca)
  -- -----------------------------------------------------------------------
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta 
  FROM public.produtos WHERE id = v_prod_id;

  v_troca_res := registrar_troca(
    p_cliente_nome => 'Cliente Teste Troca',
    p_cliente_telefone => '81999998888',
    p_vape_defeito => 'POD ANTIGO COM DEFEITO',
    p_sabor_defeito => 'Menta Ice',
    p_motivo => 'Gosto de Queimado',
    p_motivo_detalhes => 'Parou de vaporizar',
    p_vape_trocado => 'POD MULTI SABORES',
    p_sabor_trocado => 'Menta Ice',
    p_produto_trocado_id => v_prod_id,
    p_zona => 'recife',
    p_abater_estoque => true
  );

  v_troca_id := (v_troca_res->>'troca_id')::UUID;
  ASSERT (v_troca_res->>'success')::boolean = true, 'FALHA: registrar_troca falhou';

  -- Saldo de Menta Ice deve ter caído exatamente em 1
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_uva 
  FROM public.produtos WHERE id = v_prod_id;
  ASSERT v_saldo_uva = v_saldo_menta - 1, 'FALHA: estoque de Menta Ice não foi abatido pela troca';
  RAISE NOTICE 'CENÁRIO 11 [PASSOU]: Troca com abatimento atômico executada com sucesso.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 12: Cancelamento e Estorno de Troca (estornar_troca)
  -- -----------------------------------------------------------------------
  v_res := estornar_troca(v_troca_id);
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: estornar_troca falhou';
  ASSERT (v_res->>'status') = 'cancelada', 'FALHA: status da troca não ficou cancelada';

  -- Saldo de Menta Ice deve ter sido reposto
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_uva 
  FROM public.produtos WHERE id = v_prod_id;
  ASSERT v_saldo_uva = v_saldo_menta, 'FALHA: estoque não foi restaurado após cancelamento da troca';

  -- Idempotência: segundo cancelamento DEVE falhar
  BEGIN
    PERFORM estornar_troca(v_troca_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 12 [PASSOU]: Cancelamento e estorno de troca e idempotência validados.';
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 12: Segundo estorno de troca deveria ter sido recusado!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 13: Produto com Estoque Ilimitado (estoque_ilimitado = true)
  -- -----------------------------------------------------------------------
  INSERT INTO public.produtos (
    id, marca, nome, preco, estoque, sabores, sabores_estoque, zonas, estoque_zonas, estoque_ilimitado, ativo
  ) VALUES (
    v_prod_ilim_id, 'TESTE_ILIMITADO', 'POD PROMOCIONAL LIVRE', 80.00, 999,
    ARRAY['Sabor Livre'], '{"Sabor Livre": 999}'::jsonb,
    ARRAY['recife'],
    '{"recife": {"estoque": 999, "sabores_estoque": {"Sabor Livre": 999}}}'::jsonb,
    true, true
  );

  v_pedido_res := criar_pedido_catalogo(
    'Cliente Ilimitado',
    '81999990000',
    '',
    'recife',
    jsonb_build_array(
      jsonb_build_object('id', v_prod_ilim_id, 'nome', 'POD PROMOCIONAL LIVRE', 'sabor', 'Sabor Livre', 'quantidade', 5)
    )
  );

  v_res := baixar_estoque_pedido((v_pedido_res->>'id')::UUID);
  ASSERT (v_res->>'success')::boolean = true, 'FALHA: baixa em produto ilimitado falhou';

  -- Saldo NÃO deve ter sido reduzido
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Sabor Livre')::int INTO v_saldo_uva 
  FROM public.produtos WHERE id = v_prod_ilim_id;
  ASSERT v_saldo_uva = 999, 'FALHA: produto com estoque ilimitado não deveria ter saldo debitado';
  RAISE NOTICE 'CENÁRIO 13 [PASSOU]: Pedido com estoque ilimitado validado sem restrição.';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 14: Tentativa de Compra com Saldo Insuficiente
  -- -----------------------------------------------------------------------
  v_pedido_res := criar_pedido_catalogo(
    'Cliente Sem Saldo',
    '81999991111',
    '',
    'recife',
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD MULTI SABORES', 'sabor', 'Uva Ice', 'quantidade', 500)
    )
  );
  v_pedido_insuficiente_id := (v_pedido_res->>'id')::UUID;

  BEGIN
    PERFORM baixar_estoque_pedido(v_pedido_insuficiente_id);
    v_deu_erro := false;
  EXCEPTION WHEN OTHERS THEN
    v_deu_erro := true;
    RAISE NOTICE 'CENÁRIO 14 [PASSOU]: Baixa com saldo insuficiente rejeitada pelo banco: %', SQLERRM;
  END;

  IF NOT v_deu_erro THEN
    RAISE EXCEPTION 'FALHA NO CENÁRIO 14: Baixa com saldo insuficiente deveria ter sido recusada!';
  END IF;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 15: Edição de Produto e Não-Interferência no Estoque
  -- -----------------------------------------------------------------------
  UPDATE public.produtos 
  SET nome = 'POD MULTI SABORES RENOMEADO', preco = 150.00
  WHERE id = v_prod_id;

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int INTO v_saldo_menta 
  FROM public.produtos WHERE id = v_prod_id;
  SELECT estoque INTO v_estoque_final FROM public.produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 15, 'FALHA: estoque_zonas corrompido após edição cadastral do produto';
  ASSERT v_estoque_final = 23, 'FALHA: estoque total corrompido após edição cadastral do produto';
  RAISE NOTICE 'CENÁRIO 15 [PASSOU]: Edição cadastral preservou integralmente o estoque e sabores_estoque.';

  RAISE NOTICE '=== TODOS OS 15 CENÁRIOS SQL PASSARAM COM 100%% DE SUCESSO! ===';
END;
$$;

-- -----------------------------------------------------------------------
-- CENÁRIO 9: Validação de Segurança de Permissão para Usuário Anônimo (anon)
-- Tentativa do papel anon de executar baixar_estoque_pedido DEVE falhar
-- -----------------------------------------------------------------------
DO $$
BEGIN
  -- Verificar se as permissões de authenticated foram concedidas e PUBLIC foi revogado
  ASSERT has_function_privilege('authenticated', 'baixar_estoque_pedido(uuid, text)', 'EXECUTE') = true, 
    'FALHA: authenticated deve ter permissão de EXECUTE em baixar_estoque_pedido';
    
  ASSERT has_function_privilege('anon', 'baixar_estoque_pedido(uuid, text)', 'EXECUTE') = false, 
    'FALHA: anon NÃO pode ter permissão em baixar_estoque_pedido';

  ASSERT has_function_privilege('authenticated', 'estornar_estoque_pedido(uuid, text)', 'EXECUTE') = true, 
    'FALHA: authenticated deve ter permissão de EXECUTE em estornar_estoque_pedido';

  ASSERT has_function_privilege('anon', 'estornar_estoque_pedido(uuid, text)', 'EXECUTE') = false, 
    'FALHA: anon NÃO pode ter permissão em estornar_estoque_pedido';

  ASSERT has_function_privilege('anon', 'criar_pedido_catalogo(text,text,text,text,jsonb,numeric,numeric,numeric,text)', 'EXECUTE') = true, 
    'FALHA: anon deve poder criar pedidos no catálogo';

  RAISE NOTICE 'CENÁRIO 9 [PASSOU]: Permissões estritas validadas: anon bloqueado e authenticated liberado.';
END;
$$;

-- Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- NADA É GRAVADO NO BANCO DE DADOS
ROLLBACK;
