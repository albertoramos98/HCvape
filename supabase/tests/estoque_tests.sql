-- =========================================================================
-- HC VAPE - BATERIA DE TESTES DE INTEGRIDADE DO ESTOQUE
-- Executado 100% dentro de transação com ROLLBACK no final (nenhum dado persiste)
-- =========================================================================

BEGIN;

DO $$
DECLARE
  v_prod_id UUID;
  v_prod_ilim_id UUID;
  v_ped_1 UUID;
  v_ped_dois_sabores UUID;
  v_ped_sem_saldo UUID;
  v_ped_sabor_espacos UUID;
  v_ped_ilim UUID;
  v_troca_res JSONB;
  v_troca_id UUID;
  v_res JSONB;
  v_erro_capturado BOOLEAN;
  v_saldo_menta INT;
  v_saldo_uva INT;
  v_estoque_total INT;
BEGIN
  RAISE NOTICE '=== INICIANDO BATERIA DE TESTES DE ESTOQUE ===';

  -- -----------------------------------------------------------------------
  -- SETUP: Criar produtos de teste
  -- -----------------------------------------------------------------------
  INSERT INTO produtos (
    marca,
    nome,
    preco,
    estoque,
    sabores,
    zonas,
    estoque_zonas,
    estoque_ilimitado
  ) VALUES (
    'TEST_BRAND',
    'POD DE TESTE CONTROLADO',
    100.00,
    10,
    ARRAY['Menta Ice', 'Uva Ice'],
    ARRAY['recife'],
    '{
      "recife": {
        "estoque": 10,
        "sabores_estoque": {
          "Menta Ice": 6,
          "Uva Ice": 4
        }
      }
    }'::jsonb,
    false
  ) RETURNING id INTO v_prod_id;

  INSERT INTO produtos (
    marca,
    nome,
    preco,
    estoque,
    sabores,
    zonas,
    estoque_zonas,
    estoque_ilimitado
  ) VALUES (
    'TEST_BRAND',
    'POD DE TESTE ILIMITADO',
    80.00,
    999,
    ARRAY['Sabor Livre'],
    ARRAY['recife'],
    '{
      "recife": {
        "estoque": 999,
        "sabores_estoque": {
          "Sabor Livre": 999
        }
      }
    }'::jsonb,
    true
  ) RETURNING id INTO v_prod_ilim_id;

  -- -----------------------------------------------------------------------
  -- CENÁRIO 1: Venda de 1 unidade
  -- -----------------------------------------------------------------------
  INSERT INTO pedidos (
    nome_cliente, telefone_cliente, zona, total, total_final, status_checklist, itens
  ) VALUES (
    'Cliente 1', '81999999991', 'recife', 100.00, 100.00, false,
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD DE TESTE CONTROLADO', 'sabor', 'Menta Ice', 'quantidade', 1)
    )
  ) RETURNING id INTO v_ped_1;

  v_res := baixar_estoque_pedido(v_ped_1, 'teste_runner');
  
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int, estoque 
  INTO v_saldo_menta, v_estoque_total 
  FROM produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 5, format('Falha Cenário 1: Saldo esperado 5, obtido %s', v_saldo_menta);
  ASSERT v_estoque_total = 9, format('Falha Cenário 1: Estoque total esperado 9, obtido %s', v_estoque_total);
  RAISE NOTICE '✓ Cenário 1 (Venda 1 unidade): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 2: Venda de N unidades (3 unidades de Menta Ice)
  -- -----------------------------------------------------------------------
  INSERT INTO pedidos (
    nome_cliente, telefone_cliente, zona, total, total_final, status_checklist, itens
  ) VALUES (
    'Cliente 2', '81999999992', 'recife', 300.00, 300.00, false,
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD DE TESTE CONTROLADO', 'sabor', 'Menta Ice', 'quantidade', 3)
    )
  ) RETURNING id INTO v_ped_1;

  PERFORM baixar_estoque_pedido(v_ped_1, 'teste_runner');
  
  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int 
  INTO v_saldo_menta FROM produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 2, format('Falha Cenário 2: Saldo esperado 2, obtido %s', v_saldo_menta);
  RAISE NOTICE '✓ Cenário 2 (Venda N unidades): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 3: Dois sabores do mesmo produto no mesmo pedido
  -- -----------------------------------------------------------------------
  INSERT INTO pedidos (
    nome_cliente, telefone_cliente, zona, total, total_final, status_checklist, itens
  ) VALUES (
    'Cliente Multi', '81999999993', 'recife', 300.00, 300.00, false,
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD DE TESTE CONTROLADO', 'sabor', 'Menta Ice', 'quantidade', 1),
      jsonb_build_object('id', v_prod_id, 'nome', 'POD DE TESTE CONTROLADO', 'sabor', 'Uva Ice', 'quantidade', 2)
    )
  ) RETURNING id INTO v_ped_dois_sabores;

  PERFORM baixar_estoque_pedido(v_ped_dois_sabores, 'teste_runner');

  SELECT 
    (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int,
    (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int,
    estoque
  INTO v_saldo_menta, v_saldo_uva, v_estoque_total 
  FROM produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 1, format('Falha Cenário 3: Menta esperada 1, obtida %s', v_saldo_menta);
  ASSERT v_saldo_uva = 2, format('Falha Cenário 3: Uva esperada 2, obtida %s', v_saldo_uva);
  ASSERT v_estoque_total = 3, format('Falha Cenário 3: Total esperado 3, obtido %s', v_estoque_total);
  RAISE NOTICE '✓ Cenário 3 (Dois sabores do mesmo produto): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 4: Venda acima do saldo (deve lançar erro e dar rollback)
  -- -----------------------------------------------------------------------
  INSERT INTO pedidos (
    nome_cliente, telefone_cliente, zona, total, total_final, status_checklist, itens
  ) VALUES (
    'Cliente Sem Saldo', '81999999994', 'recife', 500.00, 500.00, false,
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD DE TESTE CONTROLADO', 'sabor', 'Menta Ice', 'quantidade', 10)
    )
  ) RETURNING id INTO v_ped_sem_saldo;

  v_erro_capturado := false;
  BEGIN
    PERFORM baixar_estoque_pedido(v_ped_sem_saldo, 'teste_runner');
  EXCEPTION WHEN OTHERS THEN
    v_erro_capturado := true;
  END;

  ASSERT v_erro_capturado = true, 'Falha Cenário 4: Venda acima do saldo deveria ter gerado exceção!';
  RAISE NOTICE '✓ Cenário 4 (Venda acima do saldo rejeitada com rollback): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 5: Baixa duplicada (Idempotência: deve dar erro)
  -- -----------------------------------------------------------------------
  v_erro_capturado := false;
  BEGIN
    PERFORM baixar_estoque_pedido(v_ped_dois_sabores, 'teste_runner');
  EXCEPTION WHEN OTHERS THEN
    v_erro_capturado := true;
  END;

  ASSERT v_erro_capturado = true, 'Falha Cenário 5: Baixa duplicada deveria ter sido rejeitada!';
  RAISE NOTICE '✓ Cenário 5 (Bloqueio de baixa duplicada): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 6: Estorno devolve exatamente o que baixou (Simetria)
  -- -----------------------------------------------------------------------
  PERFORM estornar_estoque_pedido(v_ped_dois_sabores, 'teste_runner');

  SELECT 
    (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int,
    (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int,
    estoque
  INTO v_saldo_menta, v_saldo_uva, v_estoque_total 
  FROM produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 2, format('Falha Cenário 6: Menta pós-estorno esperada 2, obtida %s', v_saldo_menta);
  ASSERT v_saldo_uva = 4, format('Falha Cenário 6: Uva pós-estorno esperada 4, obtida %s', v_saldo_uva);
  ASSERT v_estoque_total = 6, format('Falha Cenário 6: Total pós-estorno esperado 6, obtido %s', v_estoque_total);
  RAISE NOTICE '✓ Cenário 6 (Estorno simétrico exato): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 7: Estorno duplicado (Idempotência: deve dar erro)
  -- -----------------------------------------------------------------------
  v_erro_capturado := false;
  BEGIN
    PERFORM estornar_estoque_pedido(v_ped_dois_sabores, 'teste_runner');
  EXCEPTION WHEN OTHERS THEN
    v_erro_capturado := true;
  END;

  ASSERT v_erro_capturado = true, 'Falha Cenário 7: Estorno duplicado deveria ter sido rejeitado!';
  RAISE NOTICE '✓ Cenário 7 (Bloqueio de estorno duplicado): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 8: Casamento de sabor com maiúscula e espaços extras
  -- -----------------------------------------------------------------------
  INSERT INTO pedidos (
    nome_cliente, telefone_cliente, zona, total, total_final, status_checklist, itens
  ) VALUES (
    'Cliente Espacos', '81999999995', 'recife', 100.00, 100.00, false,
    jsonb_build_array(
      jsonb_build_object('id', v_prod_id, 'nome', 'POD DE TESTE CONTROLADO', 'sabor', '  menta   ice  ', 'quantidade', 1)
    )
  ) RETURNING id INTO v_ped_sabor_espacos;

  PERFORM baixar_estoque_pedido(v_ped_sabor_espacos, 'teste_runner');

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Menta Ice')::int 
  INTO v_saldo_menta FROM produtos WHERE id = v_prod_id;

  ASSERT v_saldo_menta = 1, format('Falha Cenário 8: Sabor normalizado esperado 1, obtido %s', v_saldo_menta);
  RAISE NOTICE '✓ Cenário 8 (Casamento resiliente de sabor com espaços/maiúsculas): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 9: Trocas (Criar, Abater e Estornar na Exclusão)
  -- -----------------------------------------------------------------------
  v_troca_res := registrar_troca(
    jsonb_build_object(
      'cliente_nome', 'Cliente Troca',
      'vape_defeito', 'Vape Quebrado',
      'motivo', 'Não liga',
      'vape_trocado', 'POD DE TESTE CONTROLADO',
      'sabor_trocado', 'Uva Ice',
      'produto_trocado_id', v_prod_id,
      'zona', 'recife',
      'abateu_estoque', true
    ),
    'teste_runner'
  );

  v_troca_id := (v_troca_res->>'id')::UUID;

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int 
  INTO v_saldo_uva FROM produtos WHERE id = v_prod_id;
  ASSERT v_saldo_uva = 3, format('Falha Cenário 9 (Criação Troca): Saldo Uva esperado 3, obtido %s', v_saldo_uva);

  -- Estornar a troca
  PERFORM estornar_troca(v_troca_id, 'teste_runner');

  SELECT (estoque_zonas->'recife'->'sabores_estoque'->>'Uva Ice')::int 
  INTO v_saldo_uva FROM produtos WHERE id = v_prod_id;
  ASSERT v_saldo_uva = 4, format('Falha Cenário 9 (Estorno Troca): Saldo Uva esperado 4, obtido %s', v_saldo_uva);
  RAISE NOTICE '✓ Cenário 9 (Trocas: registro com baixa e exclusão com estorno): OK';

  -- -----------------------------------------------------------------------
  -- CENÁRIO 10: Produto com Estoque Ilimitado
  -- -----------------------------------------------------------------------
  INSERT INTO pedidos (
    nome_cliente, telefone_cliente, zona, total, total_final, status_checklist, itens
  ) VALUES (
    'Cliente Ilimitado', '81999999996', 'recife', 80.00, 80.00, false,
    jsonb_build_array(
      jsonb_build_object('id', v_prod_ilim_id, 'nome', 'POD DE TESTE ILIMITADO', 'sabor', 'Sabor Livre', 'quantidade', 10)
    )
  ) RETURNING id INTO v_ped_ilim;

  PERFORM baixar_estoque_pedido(v_ped_ilim, 'teste_runner');

  SELECT estoque INTO v_estoque_total FROM produtos WHERE id = v_prod_ilim_id;
  ASSERT v_estoque_total = 999, format('Falha Cenário 10: Ilimitado esperado 999, obtido %s', v_estoque_total);
  RAISE NOTICE '✓ Cenário 10 (Produto com estoque ilimitado não sofre decremento): OK';

  RAISE NOTICE '=== TODOS OS 10 CENÁRIOS PASSARAM COM SUCESSO! ===';
END $$;

ROLLBACK; -- Nenhum dado de teste persiste no banco
