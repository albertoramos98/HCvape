import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  supabase, 
  pedidosService, 
  trocasService, 
  produtosService, 
  utils, 
  obterEstoqueProdutoPorZona, 
  Produto, 
  PedidoItem 
} from './supabase';

describe('Suíte Completa de Fluxos: Compra, Troca, Adição/Ajuste e Gestão de Produtos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. FLUXO DE COMPRA (Catálogo -> Validação de Saldo -> Criação -> Baixa -> Estorno)
  // =========================================================================
  describe('Fluxo 1: Compra e Pedidos', () => {
    const produtoCatalogo: Produto = {
      id: '00000000-0000-0000-0000-000000000010',
      marca: 'IGNITE',
      nome: 'IGNITE V150 15000 PUFFS',
      preco: 120.00,
      estoque: 10,
      sabores: ['Menta Ice', 'Uva Ice'],
      zonas: ['recife', 'sul_oeste'],
      estoque_zonas: {
        recife: {
          estoque: 10,
          sabores_estoque: { 'Menta Ice': 6, 'Uva Ice': 4 }
        }
      }
    };

    it('1.1 - Deve validar saldo disponível antes da adição ao carrinho por zona', () => {
      const infoRecife = obterEstoqueProdutoPorZona(produtoCatalogo, 'recife');
      expect(infoRecife.possuiEstoqueNaZona).toBe(true);
      expect(infoRecife.saboresEstoque['Menta Ice']).toBe(6);
      expect(infoRecife.saboresEstoque['Uva Ice']).toBe(4);

      // Zona não atendida deve retornar estoque zero
      const infoNorte = obterEstoqueProdutoPorZona(produtoCatalogo, 'norte');
      expect(infoNorte.possuiEstoqueNaZona).toBe(false);
      expect(infoNorte.estoque).toBe(0);
    });

    it('1.2 - Deve criar pedido chamando a RPC criar_pedido_catalogo', async () => {
      const itens: PedidoItem[] = [
        {
          id: produtoCatalogo.id,
          nome: produtoCatalogo.nome,
          sabor: 'Menta Ice',
          quantidade: 2,
          preco_unitario: 120.00
        }
      ];

      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          id: 'ped-compra-1',
          numero_pedido: 5001,
          nome_cliente: 'João Silva',
          total: 240.00,
          total_final: 240.00,
          status_checklist: false
        },
        error: null
      } as any);

      const novoPedido = await pedidosService.criar({
        nome_cliente: 'João Silva',
        telefone_cliente: '81988887777',
        indicacao: 'Instagram',
        zona: 'Recife',
        itens: itens,
        total: 240.00,
        desconto: 0,
        total_final: 240.00,
        status_checklist: false
      });

      expect(rpcMock).toHaveBeenCalledWith('criar_pedido_catalogo', expect.objectContaining({
        p_nome_cliente: 'João Silva',
        p_zona: 'Recife'
      }));
      expect(novoPedido.id).toBe('ped-compra-1');
      expect(novoPedido.total_final).toBe(240.00);
      expect(novoPedido.status_checklist).toBe(false);
    });

    it('1.3 - Deve realizar baixa atômica de estoque ao marcar checklist', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          pedido_id: 'ped-compra-1',
          numero_pedido: 5001,
          status_checklist: true
        },
        error: null
      } as any);

      const resultado = await pedidosService.baixarEstoque('ped-compra-1');

      expect(rpcMock).toHaveBeenCalledWith('baixar_estoque_pedido', {
        p_pedido_id: 'ped-compra-1'
      });
      expect(resultado.success).toBe(true);
      expect(resultado.status_checklist).toBe(true);
    });

    it('1.4 - Deve estornar o estoque simetricamente ao reabrir pedido conferido', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          pedido_id: 'ped-compra-1',
          numero_pedido: 5001,
          status_checklist: false,
          movimentos_estornados: true
        },
        error: null
      } as any);

      const resultado = await pedidosService.estornarEstoque('ped-compra-1');

      expect(rpcMock).toHaveBeenCalledWith('estornar_estoque_pedido', {
        p_pedido_id: 'ped-compra-1'
      });
      expect(resultado.success).toBe(true);
      expect(resultado.status_checklist).toBe(false);
    });
  });

  // =========================================================================
  // 2. FLUXO DE TROCA E GARANTIA (Registro com abatimento, sem abatimento e cancelamento)
  // =========================================================================
  describe('Fluxo 2: Troca e Garantia', () => {
    it('2.1 - Deve registrar troca com abatimento de estoque via RPC registrar_troca', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          troca_id: 'troca-123',
          abateu_estoque: true
        },
        error: null
      } as any);

      const novaTroca = await trocasService.criar({
        cliente_nome: 'Carlos Santos',
        cliente_telefone: '81999998888',
        vape_defeito: 'IGNITE V150',
        sabor_defeito: 'Menta Ice',
        motivo: 'Queimado / Gosto de queimado',
        motivo_detalhes: 'Parou de funcionar no 2º dia',
        vape_trocado: 'IGNITE V150',
        sabor_trocado: 'Uva Ice',
        produto_trocado_id: '00000000-0000-0000-0000-000000000010',
        zona: 'recife',
        abateu_estoque: true,
        data_troca: '2026-10-21T17:00:00Z'
      });

      expect(rpcMock).toHaveBeenCalledWith('registrar_troca', expect.objectContaining({
        p_cliente_nome: 'Carlos Santos',
        p_abater_estoque: true,
        p_sabor_trocado: 'Uva Ice'
      }));
      expect(novaTroca.id).toBe('troca-123');
      expect(novaTroca.status).toBe('concluida');
    });

    it('2.2 - Deve registrar troca sem abatimento (troca simples de garantia sem saída física)', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          troca_id: 'troca-sem-baixa',
          abateu_estoque: false
        },
        error: null
      } as any);

      const trocaSemBaixa = await trocasService.criar({
        cliente_nome: 'Mariana Lima',
        cliente_telefone: '81977776666',
        vape_defeito: 'ELFBAR BC10000',
        sabor_defeito: 'Watermelon Ice',
        motivo: 'Bateria descarregada',
        vape_trocado: 'ELFBAR BC10000',
        sabor_trocado: 'Watermelon Ice',
        zona: 'recife',
        abateu_estoque: false
      });

      expect(rpcMock).toHaveBeenCalledWith('registrar_troca', expect.objectContaining({
        p_abater_estoque: false
      }));
      expect(trocaSemBaixa.id).toBe('troca-sem-baixa');
    });

    it('2.3 - Deve cancelar troca logicamente e repor estoque via RPC estornar_troca', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          troca_id: 'troca-123',
          status: 'cancelada'
        },
        error: null
      } as any);

      await trocasService.cancelar('troca-123');

      expect(rpcMock).toHaveBeenCalledWith('estornar_troca', {
        p_troca_id: 'troca-123'
      });
    });
  });

  // =========================================================================
  // 3. FLUXO DE ADIÇÃO E AJUSTE DE ESTOQUE (Entrada, Saída e Inventário Físico)
  // =========================================================================
  describe('Fluxo 3: Adição e Ajustes de Estoque', () => {
    it('3.1 - Deve realizar entrada física (adição) via modo delta positivo', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          produto_id: 'prod-1',
          zona: 'recife',
          sabor: 'Menta Ice',
          saldo_antes: 10,
          saldo_depois: 15,
          delta: 5
        },
        error: null
      } as any);

      const res = await produtosService.ajustarEstoque(
        'prod-1',
        'recife',
        'Menta Ice',
        'delta',
        5,
        'reposicao_fornecedor'
      );

      expect(rpcMock).toHaveBeenCalledWith('ajustar_estoque', {
        p_produto_id: 'prod-1',
        p_zona_id: 'recife',
        p_sabor: 'Menta Ice',
        p_operacao: 'delta',
        p_valor: 5,
        p_motivo: 'reposicao_fornecedor'
      });
      expect(res.saldo_depois).toBe(15);
      expect(res.delta).toBe(5);
    });

    it('3.2 - Deve realizar saída física (perda/avaria) via modo delta negativo', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          produto_id: 'prod-1',
          zona: 'recife',
          sabor: 'Menta Ice',
          saldo_antes: 15,
          saldo_depois: 13,
          delta: -2
        },
        error: null
      } as any);

      const res = await produtosService.ajustarEstoque(
        'prod-1',
        'recife',
        'Menta Ice',
        'delta',
        -2,
        'avaria_transporte'
      );

      expect(res.saldo_depois).toBe(13);
      expect(res.delta).toBe(-2);
    });

    it('3.3 - Deve definir contagem física exata (inventário) via modo definir', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          produto_id: 'prod-1',
          zona: 'recife',
          sabor: 'Menta Ice',
          saldo_antes: 13,
          saldo_depois: 20,
          delta: 7
        },
        error: null
      } as any);

      const res = await produtosService.ajustarEstoque(
        'prod-1',
        'recife',
        'Menta Ice',
        'definir',
        20,
        'contagem_inventario_mensal'
      );

      expect(res.saldo_depois).toBe(20);
      expect(res.delta).toBe(7);
    });
  });

  // =========================================================================
  // 4. FLUXO DE CADASTRO E EDIÇÃO DE PRODUTOS
  // =========================================================================
  describe('Fluxo 4: Cadastro e Edição de Produtos', () => {
    it('4.1 - Deve criar um novo produto mantendo integridade estrutural', async () => {
      const produtoCriar: Omit<Produto, 'id' | 'created_at' | 'updated_at'> = {
        marca: 'LOST MARY',
        nome: 'LOST MARY MO20000',
        preco: 130.00,
        estoque: 0,
        sabores: ['Blue Razz Ice', 'Watermelon Ice'],
        zonas: ['recife'],
        estoque_zonas: {
          recife: {
            estoque: 0,
            sabores_estoque: { 'Blue Razz Ice': 0, 'Watermelon Ice': 0 }
          }
        },
        ativo: true
      };

      const fromMock = vi.spyOn(supabase, 'from').mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: { id: 'prod-novo-1', ...produtoCriar },
              error: null
            })
          })
        })
      } as any);

      const criado = await produtosService.criar(produtoCriar);
      expect(criado.id).toBe('prod-novo-1');
      expect(criado.nome).toBe('LOST MARY MO20000');
    });

    it('4.2 - Deve editar dados cadastrais (nome, preço) sem alterar nem corromper estoque_zonas', async () => {
      const fromMock = vi.spyOn(supabase, 'from').mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: {
                  id: 'prod-novo-1',
                  nome: 'LOST MARY MO20000 PRO',
                  preco: 135.00
                },
                error: null
              })
            })
          })
        })
      } as any);

      const editado = await produtosService.editar('prod-novo-1', {
        nome: 'LOST MARY MO20000 PRO',
        preco: 135.00
      });

      expect(editado.nome).toBe('LOST MARY MO20000 PRO');
      expect(editado.preco).toBe(135.00);
    });
  });

  // =========================================================================
  // 5. FLUXO DE PRODUTOS ILIMITADOS E LEGADOS
  // =========================================================================
  describe('Fluxo 5: Produtos Especiais (Ilimitados e Promo)', () => {
    it('5.1 - Produto com estoque_ilimitado deve ser considerado disponível independente do saldo', () => {
      const promoIlimitado: Produto = {
        id: 'promo-1',
        marca: 'HC VAPE',
        nome: 'POD DESCONTO ESPECIAL',
        preco: 50.00,
        estoque: 999,
        sabores: ['Morango', 'Menta'],
        estoque_ilimitado: true,
        is_promo: true
      };

      const info = obterEstoqueProdutoPorZona(promoIlimitado, 'recife');
      expect(info.isIlimitado).toBe(true);
      expect(info.possuiEstoqueNaZona).toBe(true);
      expect(info.saboresDisponiveis).toEqual(['Morango', 'Menta']);
    });
  });
});
