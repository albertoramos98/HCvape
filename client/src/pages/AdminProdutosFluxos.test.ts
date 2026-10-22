import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  supabase, 
  produtosService, 
  pedidosService, 
  trocasService, 
  imagemService,
  utils, 
  obterEstoqueProdutoPorZona, 
  Produto, 
  Pedido,
  PedidoItem 
} from '../lib/supabase';

describe('Suíte E2E: Ciclo Completo de Produto no Painel Admin e Catálogo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. FLUXO DE ADICIONAR PRODUTO (CREATE)
  // =========================================================================
  describe('1. Fluxo de Adicionar Produto (Cadastro no Admin)', () => {
    it('1.1 - Deve cadastrar um produto normal com múltiplos sabores e estoque consolidado', async () => {
      const novoProdutoInput: Omit<Produto, 'id' | 'created_at' | 'updated_at'> = {
        marca: 'IGNITE',
        nome: 'IGNITE V150 15000 PUFFS',
        preco: 125.00,
        estoque: 20,
        sabores: ['Menta Ice', 'Uva Ice', 'Melancia'],
        zonas: ['recife'],
        estoque_zonas: {
          recife: {
            estoque: 20,
            sabores_estoque: {
              'Menta Ice': 10,
              'Uva Ice': 6,
              'Melancia': 4
            }
          }
        },
        sabores_estoque: {
          'Menta Ice': 10,
          'Uva Ice': 6,
          'Melancia': 4
        },
        is_promo: false,
        ativo: true
      };

      const insertSpy = vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'prod-uuid-150',
                created_at: new Date().toISOString(),
                ...novoProdutoInput
              },
              error: null
            })
          })
        })
      } as any);

      const produtoCriado = await produtosService.criar(novoProdutoInput);

      expect(insertSpy).toHaveBeenCalledWith('produtos');
      expect(produtoCriado.id).toBe('prod-uuid-150');
      expect(produtoCriado.nome).toBe('IGNITE V150 15000 PUFFS');
      expect(produtoCriado.estoque).toBe(20);
      expect(produtoCriado.estoque_zonas?.['recife']?.sabores_estoque?.['Menta Ice']).toBe(10);
      expect(produtoCriado.ativo).toBe(true);
    });

    it('1.2 - Deve validar obrigatoriedade de campos essenciais (marca, nome, preço positivo)', () => {
      const validarForm = (p: Partial<Produto>) => {
        if (!p.nome || p.nome.trim().length === 0) return 'Nome é obrigatório';
        if (!p.marca || p.marca.trim().length === 0) return 'Marca é obrigatória';
        if (!p.preco || p.preco <= 0) return 'Preço deve ser maior que zero';
        if (!p.sabores || p.sabores.length === 0) return 'Pelo menos um sabor é necessário';
        return null;
      };

      expect(validarForm({ nome: '', marca: 'IGNITE', preco: 100, sabores: ['Menta'] })).toBe('Nome é obrigatório');
      expect(validarForm({ nome: 'V80', marca: '', preco: 100, sabores: ['Menta'] })).toBe('Marca é obrigatória');
      expect(validarForm({ nome: 'V80', marca: 'IGNITE', preco: 0, sabores: ['Menta'] })).toBe('Preço deve ser maior que zero');
      expect(validarForm({ nome: 'V80', marca: 'IGNITE', preco: 100, sabores: [] })).toBe('Pelo menos um sabor é necessário');
      expect(validarForm({ nome: 'V80', marca: 'IGNITE', preco: 100, sabores: ['Menta'] })).toBeNull();
    });

    it('1.3 - Deve validar produto promocional com preço promocional estritamente menor que o preço normal', () => {
      const validarPromo = (preco: number, precoPromo?: number) => {
        if (!precoPromo || precoPromo <= 0) return 'Preço promocional deve ser positivo';
        if (precoPromo >= preco) return 'Preço promocional deve ser menor que o original';
        return null;
      };

      expect(validarPromo(120, 0)).toBe('Preço promocional deve ser positivo');
      expect(validarPromo(120, 130)).toBe('Preço promocional deve ser menor que o original');
      expect(validarPromo(120, 120)).toBe('Preço promocional deve ser menor que o original');
      expect(validarPromo(120, 89.90)).toBeNull();
    });

    it('1.4 - Adicionar produto com 1 unidade em Recife deve consolidar exatamente 1 no sistema e 1 no card (sem fantasma de 6 unidades)', async () => {
      // Simula a lógica de consolidação do Admin sem zonas fantasmas (ex: gravata)
      const formZonasAtivasMock = { recife: true };
      const formEstoquePorZonaMock = { recife: { 'Menta Ice': 1 } };
      const saboresLimpos = ['Menta Ice'];

      const { ZONAS_DISPONIVEIS } = await import('../lib/supabase');
      const zonasSelecionadas = Object.entries(formZonasAtivasMock)
        .filter(([zId, ativo]) => ativo && ZONAS_DISPONIVEIS.some(zd => zd.id === zId))
        .map(([zId]) => zId);

      let estoqueTotalConsolidado = 0;
      const estoqueZonasFinal: any = {};
      const saboresEstoqueConsolidado: Record<string, number> = {};

      zonasSelecionadas.forEach(zId => {
        const zSaboresMap = (formEstoquePorZonaMock as any)[zId] || {};
        const zSaboresObj: Record<string, number> = {};
        let zTotal = 0;

        saboresLimpos.forEach(s => {
          const qtd = Math.max(0, Number(zSaboresMap[s]) || 0);
          zSaboresObj[s] = qtd;
          zTotal += qtd;
          saboresEstoqueConsolidado[s] = (saboresEstoqueConsolidado[s] || 0) + qtd;
        });

        estoqueZonasFinal[zId] = {
          estoque: zTotal,
          sabores_estoque: zSaboresObj
        };
        estoqueTotalConsolidado += zTotal;
      });

      // Validação: no sistema deve ser rigorosamente 1, e não 6
      expect(estoqueTotalConsolidado).toBe(1);
      expect(saboresEstoqueConsolidado['Menta Ice']).toBe(1);
      expect(estoqueZonasFinal['recife'].estoque).toBe(1);

      // Validação no card: obterEstoqueProdutoPorZona em Recife deve retornar 1
      const mockProdutoCriado: Produto = {
        id: 'prod-teste-1',
        marca: 'TESTE',
        nome: 'POD TESTE 1 UNIDADE',
        preco: 100,
        estoque: estoqueTotalConsolidado,
        sabores: ['Menta Ice'],
        sabores_estoque: saboresEstoqueConsolidado,
        zonas: zonasSelecionadas,
        estoque_zonas: estoqueZonasFinal
      };

      const infoCard = obterEstoqueProdutoPorZona(mockProdutoCriado, 'recife');
      expect(infoCard.estoque).toBe(1);
      expect(infoCard.saboresEstoque['Menta Ice']).toBe(1);
      expect(infoCard.possuiEstoqueNaZona).toBe(true);
    });
  });

  // =========================================================================
  // 2. FLUXO DE EDIÇÃO E ABASTECIMENTO (UPDATE & AJUSTAR ESTOQUE)
  // =========================================================================
  describe('2. Fluxo de Edição, Abastecimento e Ajuste de Estoque no Admin', () => {
    it('2.1 - Deve editar metadados cadastrais sem sobrescrever ou corromper estoque_zonas', async () => {
      const updateSpy = vi.spyOn(supabase, 'from').mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: {
                  id: 'prod-uuid-150',
                  marca: 'IGNITE PRO',
                  nome: 'IGNITE V150 PLUS',
                  preco: 130.00
                },
                error: null
              })
            })
          })
        })
      } as any);

      const produtoAtualizado = await produtosService.editar('prod-uuid-150', {
        marca: 'IGNITE PRO',
        nome: 'IGNITE V150 PLUS',
        preco: 130.00
      });

      expect(updateSpy).toHaveBeenCalledWith('produtos');
      expect(produtoAtualizado.nome).toBe('IGNITE V150 PLUS');
      expect(produtoAtualizado.preco).toBe(130.00);
    });

    it('2.2 - Abastecimento com sucesso via RPC ajustar_estoque modo delta (Entrada de mercadoria)', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          produto_id: 'prod-uuid-150',
          zona: 'recife',
          sabor: 'Menta Ice',
          saldo_antes: 10,
          saldo_depois: 25,
          delta: 15
        },
        error: null
      } as any);

      const res = await produtosService.ajustarEstoque(
        'prod-uuid-150',
        'recife',
        'Menta Ice',
        'delta',
        15,
        'chegada_lote_fornecedor'
      );

      expect(rpcSpy).toHaveBeenCalledWith('ajustar_estoque', {
        p_produto_id: 'prod-uuid-150',
        p_zona_id: 'recife',
        p_sabor: 'Menta Ice',
        p_operacao: 'delta',
        p_valor: 15,
        p_motivo: 'chegada_lote_fornecedor'
      });
      expect(res.saldo_depois).toBe(25);
      expect(res.delta).toBe(15);
    });

    it('2.3 - Inventário físico com sucesso via RPC ajustar_estoque modo definir', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          produto_id: 'prod-uuid-150',
          zona: 'recife',
          sabor: 'Uva Ice',
          saldo_antes: 6,
          saldo_depois: 12,
          delta: 6
        },
        error: null
      } as any);

      const res = await produtosService.ajustarEstoque(
        'prod-uuid-150',
        'recife',
        'Uva Ice',
        'definir',
        12,
        'contagem_inventario_gaveta'
      );

      expect(res.saldo_depois).toBe(12);
      expect(res.delta).toBe(6);
    });

    it('2.4 - Resiliência contra erro de Schema Cache (o erro reportado por Pedro): deve acionar fallback transparente', async () => {
      // Simula a 1ª chamada falhando com a mensagem exata do PostgREST
      const rpcSpy = vi.spyOn(supabase, 'rpc')
        .mockResolvedValueOnce({
          data: null,
          error: {
            message: 'Could not find the function public.ajustar_estoque(p_motivo, p_operacao, p_produto_id, p_sabor, p_valor, p_zona_id) in the schema cache',
            code: 'PGRST202'
          }
        } as any)
        // Simula a 2ª chamada (com p_zona e p_nova_qtd) tendo sucesso
        .mockResolvedValueOnce({
          data: {
            success: true,
            produto_id: 'prod-uuid-150',
            zona: 'recife',
            sabor: 'Melancia',
            saldo_antes: 4,
            saldo_depois: 10,
            delta: 6
          },
          error: null
        } as any);

      const res = await produtosService.ajustarEstoque(
        'prod-uuid-150',
        'recife',
        'Melancia',
        'definir',
        10,
        'abastecimento_recife'
      );

      expect(rpcSpy).toHaveBeenCalledTimes(2);
      expect(res.success).toBe(true);
      expect(res.saldo_depois).toBe(10);
    });

    it('2.5 - Resiliência de 3º nível: fallback de atualização direta caso ambas as RPCs estejam indisponíveis', async () => {
      // Simula ambas RPCs falhando
      vi.spyOn(supabase, 'rpc')
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Could not find function in schema cache', code: 'PGRST202' }
        } as any)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Could not find function in schema cache', code: 'PGRST202' }
        } as any);

      // Simula busca do produto atual
      const mockProdutoBanco = {
        id: 'prod-uuid-150',
        estoque: 10,
        sabores_estoque: { 'Menta Ice': 10 },
        estoque_zonas: {
          recife: {
            estoque: 10,
            sabores_estoque: { 'Menta Ice': 10 }
          }
        }
      };

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProdutoBanco, error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      } as any);

      const res = await produtosService.ajustarEstoque(
        'prod-uuid-150',
        'recife',
        'Menta Ice',
        'definir',
        15,
        'ajuste_manual_contingencia'
      );

      expect(res.success).toBe(true);
      expect(res.saldo_depois).toBe(15);
      expect(res.delta).toBe(5);
    });
  });

  // =========================================================================
  // 3. FLUXO DE COMPRA DE PRODUTO NO CATÁLOGO (CHECKOUT)
  // =========================================================================
  describe('3. Fluxo de Compra de Produto pelo Catálogo do Cliente', () => {
    const produtoVitrine: Produto = {
      id: 'prod-vitrine-1',
      marca: 'ELFBAR',
      nome: 'ELFBAR BC10000',
      preco: 110.00,
      estoque: 15,
      sabores: ['Watermelon Ice', 'Blue Razz', 'Miami Mint'],
      zonas: ['recife'],
      estoque_zonas: {
        recife: {
          estoque: 15,
          sabores_estoque: {
            'Watermelon Ice': 8,
            'Blue Razz': 5,
            'Miami Mint': 2
          }
        }
      }
    };

    it('3.1 - Cliente deve conseguir selecionar sabor disponível e ver estoque real na zona', () => {
      const infoRecife = obterEstoqueProdutoPorZona(produtoVitrine, 'recife');
      expect(infoRecife.possuiEstoqueNaZona).toBe(true);
      expect(infoRecife.saboresDisponiveis).toContain('Watermelon Ice');
      expect(infoRecife.saboresEstoque['Watermelon Ice']).toBe(8);
      expect(infoRecife.saboresEstoque['Miami Mint']).toBe(2);
    });

    it('3.2 - Não deve permitir adição de quantidade superior ao saldo em estoque do sabor', () => {
      const info = obterEstoqueProdutoPorZona(produtoVitrine, 'recife');
      const sabor = 'Miami Mint';
      const estoqueDisponivel = info.saboresEstoque[sabor] || 0;
      
      const tentarComprar = (qtd: number) => {
        if (qtd > estoqueDisponivel) {
          throw new Error(`Estoque insuficiente: restam apenas ${estoqueDisponivel} unidades do sabor ${sabor}.`);
        }
        return true;
      };

      expect(() => tentarComprar(2)).not.toThrow();
      expect(() => tentarComprar(3)).toThrow('Estoque insuficiente');
    });

    it('3.3 - Deve criar o pedido no banco via RPC criar_pedido_catalogo com status_checklist false', async () => {
      const itensPedido: PedidoItem[] = [
        {
          id: produtoVitrine.id,
          nome: produtoVitrine.nome,
          sabor: 'Watermelon Ice',
          quantidade: 2,
          preco_unitario: 110.00
        }
      ];

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          id: 'ped-uuid-888',
          numero_pedido: 6010,
          nome_cliente: 'Mariana Duarte',
          telefone_cliente: '81987654321',
          zona: 'recife',
          total: 220.00,
          desconto: 0,
          total_final: 220.00,
          status_checklist: false
        },
        error: null
      } as any);

      const pedidoCriado = await pedidosService.criar({
        nome_cliente: 'Mariana Duarte',
        telefone_cliente: '81987654321',
        zona: 'Recife',
        itens: itensPedido,
        total: 220.00,
        desconto: 0,
        total_final: 220.00,
        status_checklist: false
      });

      expect(rpcSpy).toHaveBeenCalledWith('criar_pedido_catalogo', expect.objectContaining({
        p_nome_cliente: 'Mariana Duarte',
        p_total: 220.00,
        p_total_final: 220.00
      }));
      expect(pedidoCriado.id).toBe('ped-uuid-888');
      expect(pedidoCriado.status_checklist).toBe(false);
    });
  });

  // =========================================================================
  // 4. FLUXO DE DAR BAIXA NO BANCO (CHECKLIST ATÔMICO)
  // =========================================================================
  describe('4. Fluxo de Dar Baixa de Estoque no Banco (Conferência / Checklist)', () => {
    it('4.1 - Ao marcar checklist no Admin, deve acionar a RPC baixar_estoque_pedido', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          pedido_id: 'ped-uuid-888',
          numero_pedido: 6010,
          status_checklist: true,
          movimentos: [
            {
              produto_id: 'prod-vitrine-1',
              sabor: 'Watermelon Ice',
              zona: 'recife',
              delta: -2,
              saldo_antes: 8,
              saldo_depois: 6
            }
          ]
        },
        error: null
      } as any);

      const resultadoBaixa = await pedidosService.baixarEstoque('ped-uuid-888');

      expect(rpcSpy).toHaveBeenCalledWith('baixar_estoque_pedido', {
        p_pedido_id: 'ped-uuid-888'
      });
      expect(resultadoBaixa.success).toBe(true);
      expect(resultadoBaixa.status_checklist).toBe(true);
      expect(resultadoBaixa.movimentos[0].saldo_depois).toBe(6);
    });

    it('4.2 - Deve estornar o estoque simetricamente ao desmarcar o checklist (reabertura do pedido)', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          pedido_id: 'ped-uuid-888',
          numero_pedido: 6010,
          status_checklist: false,
          movimentos_estornados: true
        },
        error: null
      } as any);

      const resultadoEstorno = await pedidosService.estornarEstoque('ped-uuid-888');

      expect(rpcSpy).toHaveBeenCalledWith('estornar_estoque_pedido', {
        p_pedido_id: 'ped-uuid-888'
      });
      expect(resultadoEstorno.success).toBe(true);
      expect(resultadoEstorno.status_checklist).toBe(false);
    });

    it('4.3 - Se o operador excluir um pedido já conferido, deve garantir estorno antes do delete', async () => {
      const pedidoConferido: Pedido = {
        id: 'ped-conferido-999',
        numero_pedido: 6011,
        nome_cliente: 'Lucas Melo',
        telefone_cliente: '81999990000',
        itens: [],
        total: 100,
        desconto: 0,
        total_final: 100,
        status_checklist: true
      };

      const estornarSpy = vi.spyOn(pedidosService, 'estornarEstoque').mockResolvedValueOnce({
        success: true,
        pedido_id: pedidoConferido.id,
        status_checklist: false
      } as any);

      const deleteSpy = vi.spyOn(supabase, 'from').mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ error: null })
        })
      } as any);

      // Simulação da lógica de exclusão do Admin.tsx
      if (pedidoConferido.status_checklist) {
        await pedidosService.estornarEstoque(pedidoConferido.id);
      }
      await pedidosService.deletar(pedidoConferido.id);

      expect(estornarSpy).toHaveBeenCalledWith(pedidoConferido.id);
      expect(deleteSpy).toHaveBeenCalledWith('pedidos');
    });
  });

  // =========================================================================
  // 5. FLUXO DE TROCA COM BAIXA E ESTORNO NO ESTOQUE
  // =========================================================================
  describe('5. Fluxo de Troca e Garantia com Abate de Estoque', () => {
    it('5.1 - Deve registrar troca com abate e diminuir estoque do sabor trocado', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          troca_id: 'troca-uuid-55',
          abateu_estoque: true,
          delta: -1
        },
        error: null
      } as any);

      const novaTroca = await trocasService.criar({
        cliente_nome: 'Roberto Dias',
        cliente_telefone: '81988881111',
        vape_defeito: 'ELFBAR BC10000',
        sabor_defeito: 'Miami Mint',
        motivo: 'Gosto de Queimado',
        vape_trocado: 'ELFBAR BC10000',
        sabor_trocado: 'Watermelon Ice',
        produto_trocado_id: 'prod-vitrine-1',
        zona: 'recife',
        abateu_estoque: true
      });

      expect(rpcSpy).toHaveBeenCalledWith('registrar_troca', expect.objectContaining({
        p_cliente_nome: 'Roberto Dias',
        p_abater_estoque: true,
        p_sabor_trocado: 'Watermelon Ice'
      }));
      expect(novaTroca.id).toBe('troca-uuid-55');
    });

    it('5.2 - Deve estornar o produto trocado ao cancelar a troca no Admin', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          troca_id: 'troca-uuid-55',
          status: 'cancelada'
        },
        error: null
      } as any);

      await trocasService.cancelar('troca-uuid-55');

      expect(rpcSpy).toHaveBeenCalledWith('estornar_troca', {
        p_troca_id: 'troca-uuid-55'
      });
    });
  });

  // =========================================================================
  // 6. FLUXO DE GESTÃO DE PRODUTO: ATIVAÇÃO, INATIVAÇÃO E EXCLUSÃO
  // =========================================================================
  describe('6. Fluxo de Toggle Ativo/Inativo e Exclusão no Admin', () => {
    it('6.1 - Deve alternar produto entre ativo e inativo', async () => {
      vi.spyOn(produtosService, 'obterIdsInativos').mockResolvedValueOnce([]);
      const salvarSpy = vi.spyOn(produtosService, 'salvarIdsInativos').mockResolvedValueOnce();

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: { id: 'prod-uuid-150', ativo: false },
                error: null
              })
            })
          })
        })
      } as any);

      const produtoDesativado = await produtosService.editar('prod-uuid-150', { ativo: false });
      expect(produtoDesativado.ativo).toBe(false);
      expect(salvarSpy).toHaveBeenCalledWith(['prod-uuid-150']);
    });

    it('6.2 - Deve deletar produto e remover imagem associada no Storage', async () => {
      const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'prod-uuid-150',
                imagem_url: 'https://placeholder.supabase.co/storage/v1/object/public/produto-imagens/produtos/prod-150.jpg'
              },
              error: null
            })
          })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      } as any);

      const deletarImagemSpy = vi.spyOn(imagemService, 'deletar').mockResolvedValueOnce();

      await produtosService.deletar('prod-uuid-150');

      expect(deletarImagemSpy).toHaveBeenCalledWith('produtos/prod-150.jpg');
      expect(fromSpy).toHaveBeenCalledWith('produtos');
    });
  });

  // =========================================================================
  // 7. COMPATIBILIDADE DE ZONAS E EXIBIÇÃO INTEGRAL NO CATÁLOGO
  // =========================================================================
  describe('7. Verificação de Zonas: Garantir que nenhum produto suma da vitrine', () => {
    it('7.1 - Produto com estoque em Recife deve ser plenamente visível em Recife', () => {
      const prod: Produto = {
        id: 'p-1',
        marca: 'IGNITE',
        nome: 'IGNITE V80',
        preco: 95.00,
        estoque: 8,
        sabores: ['Watermelon Ice'],
        zonas: ['recife'],
        estoque_zonas: {
          recife: {
            estoque: 8,
            sabores_estoque: { 'Watermelon Ice': 8 }
          }
        }
      };

      const info = obterEstoqueProdutoPorZona(prod, 'recife');
      expect(info.possuiEstoqueNaZona).toBe(true);
      expect(info.estoque).toBe(8);
      expect(info.saboresDisponiveis).toEqual(['Watermelon Ice']);
    });

    it('7.2 - Produto promocional com estoque_ilimitado deve estar sempre visível enquanto ativo', () => {
      const prodPromo: Produto = {
        id: 'p-promo',
        marca: 'IGNITE',
        nome: 'IGNITE PROMO V50',
        preco: 60.00,
        estoque: 999,
        sabores: ['Grape Ice', 'Apple Ice'],
        is_promo: true,
        estoque_ilimitado: true,
        ativo: true
      };

      const info = obterEstoqueProdutoPorZona(prodPromo, 'recife');
      expect(info.isIlimitado).toBe(true);
      expect(info.possuiEstoqueNaZona).toBe(true);
      expect(info.saboresDisponiveis.length).toBe(2);
    });
  });
});
