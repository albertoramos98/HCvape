
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase, pedidosService, trocasService } from './supabase';
import { estoqueZonaNorteService } from './estoque_zona_norte';

describe('Suíte de Testes: Estoque Exclusivo e Isolado da Zona Norte', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Operações Diretas do Serviço de Estoque da Zona Norte', () => {
    it('1.1 - Deve obter todos os itens cadastrados na tabela estoque_zona_norte', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'item-1', produto_id: 'prod-1', sabor: 'Menta Ice', quantidade: 10 },
            { id: 'item-2', produto_id: 'prod-1', sabor: 'Uva Ice', quantidade: 5 }
          ],
          error: null
        })
      });

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect
      } as any);

      const itens = await estoqueZonaNorteService.obterTodos();

      expect(supabase.from).toHaveBeenCalledWith('estoque_zona_norte');
      expect(itens).toHaveLength(2);
      expect(itens[0].quantidade).toBe(10);
      expect(itens[1].quantidade).toBe(5);
    });

    it('1.2 - Deve chamar a RPC ajustar_estoque_zona_norte para contagem física ("definir")', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          produto_id: 'prod-1',
          sabor: 'Menta Ice',
          saldo_antes: 10,
          saldo_depois: 15,
          delta: 5
        },
        error: null
      } as any);

      const res = await estoqueZonaNorteService.ajustarEstoque(
        'prod-1',
        'Menta Ice',
        'definir',
        15,
        'contagem_fisica',
        'admin@hcvape.com'
      );

      expect(rpcMock).toHaveBeenCalledWith('ajustar_estoque_zona_norte', {
        p_produto_id: 'prod-1',
        p_sabor: 'Menta Ice',
        p_operacao: 'definir',
        p_valor: 15,
        p_motivo: 'contagem_fisica',
        p_usuario: 'admin@hcvape.com'
      });
      expect(res.saldo_depois).toBe(15);
    });

    it('1.3 - Deve chamar a RPC ajustar_estoque_zona_norte para operação "delta" (+1 ou -1)', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          produto_id: 'prod-1',
          sabor: 'Menta Ice',
          saldo_antes: 15,
          saldo_depois: 16,
          delta: 1
        },
        error: null
      } as any);

      const res = await estoqueZonaNorteService.ajustarEstoque(
        'prod-1',
        'Menta Ice',
        'delta',
        1
      );

      expect(rpcMock).toHaveBeenCalledWith('ajustar_estoque_zona_norte', {
        p_produto_id: 'prod-1',
        p_sabor: 'Menta Ice',
        p_operacao: 'delta',
        p_valor: 1,
        p_motivo: 'ajuste_manual',
        p_usuario: null
      });
      expect(res.delta).toBe(1);
    });

    it('1.4 - Deve invocar a RPC baixar_estoque_zona_norte ao dar baixa de pedido', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          pedido_id: 'ped-zn-1',
          numero_pedido: 6001,
          zona: 'norte',
          status_checklist: true
        },
        error: null
      } as any);

      const res = await estoqueZonaNorteService.baixarEstoque('ped-zn-1', 'admin@hcvape.com');

      expect(rpcMock).toHaveBeenCalledWith('baixar_estoque_zona_norte', {
        p_pedido_id: 'ped-zn-1',
        p_usuario: 'admin@hcvape.com'
      });
      expect(res.success).toBe(true);
      expect(res.zona).toBe('norte');
    });

    it('1.5 - Deve invocar a RPC estornar_estoque_zona_norte ao reabrir pedido da Zona Norte', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          pedido_id: 'ped-zn-1',
          numero_pedido: 6001,
          status_checklist: false,
          movimentos_estornados: true
        },
        error: null
      } as any);

      const res = await estoqueZonaNorteService.estornarEstoque('ped-zn-1');

      expect(rpcMock).toHaveBeenCalledWith('estornar_estoque_zona_norte', {
        p_pedido_id: 'ped-zn-1',
        p_usuario: null
      });
      expect(res.status_checklist).toBe(false);
    });
  });

  describe('2. Ponto Único de Decisão: pedidosService.baixarEstoque e estornarEstoque', () => {
    it('2.1 - Pedido da Zona Norte DEVE acionar baixar_estoque_zona_norte e NUNCA baixar_estoque_pedido', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, zona: 'norte' },
        error: null
      } as any);

      // Chamada informando zona = 'Zona Norte'
      await pedidosService.baixarEstoque('ped-zn-100', 'operador@hcvape.com', 'Zona Norte');

      // Prova de isolamento:
      expect(rpcMock).toHaveBeenCalledWith('baixar_estoque_zona_norte', {
        p_pedido_id: 'ped-zn-100',
        p_usuario: 'operador@hcvape.com'
      });
      expect(rpcMock).not.toHaveBeenCalledWith('baixar_estoque_pedido', expect.anything());
    });

    it('2.2 - Pedido de Recife DEVE acionar baixar_estoque_pedido e NUNCA baixar_estoque_zona_norte', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, status_checklist: true },
        error: null
      } as any);

      // Chamada informando zona = 'Recife'
      await pedidosService.baixarEstoque('ped-rec-200', 'operador@hcvape.com', 'Recife');

      // Prova de isolamento:
      expect(rpcMock).toHaveBeenCalledWith('baixar_estoque_pedido', {
        p_pedido_id: 'ped-rec-200',
        p_usuario: 'operador@hcvape.com'
      });
      expect(rpcMock).not.toHaveBeenCalledWith('baixar_estoque_zona_norte', expect.anything());
    });

    it('2.3 - Quando a zona não for passada diretamente e o banco recusar na rotina legada, deve redirecionar para a Zona Norte', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc')
        // 1ª chamada para baixar_estoque_pedido retorna a exception da blindagem do banco
        .mockResolvedValueOnce({
          data: null,
          error: {
            message: 'O pedido #300 pertence à Zona Norte e deve ser baixado exclusivamente através da rotina baixar_estoque_zona_norte.'
          }
        } as any)
        // 2ª chamada executa baixar_estoque_zona_norte com sucesso
        .mockResolvedValueOnce({
          data: { success: true, pedido_id: 'ped-300', zona: 'norte' },
          error: null
        } as any);

      const resultado = await pedidosService.baixarEstoque('ped-300');

      expect(rpcMock).toHaveBeenCalledTimes(2);
      expect(rpcMock).toHaveBeenNthCalledWith(1, 'baixar_estoque_pedido', {
        p_pedido_id: 'ped-300'
      });
      expect(rpcMock).toHaveBeenNthCalledWith(2, 'baixar_estoque_zona_norte', {
        p_pedido_id: 'ped-300',
        p_usuario: null
      });
      expect(resultado.success).toBe(true);
    });

    it('2.4 - Estorno de Pedido da Zona Norte DEVE acionar estornar_estoque_zona_norte', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, status_checklist: false },
        error: null
      } as any);

      await pedidosService.estornarEstoque('ped-zn-100', 'admin@hcvape.com', 'norte');

      expect(rpcMock).toHaveBeenCalledWith('estornar_estoque_zona_norte', {
        p_pedido_id: 'ped-zn-100',
        p_usuario: 'admin@hcvape.com'
      });
      expect(rpcMock).not.toHaveBeenCalledWith('estornar_estoque_pedido', expect.anything());
    });

    it('2.5 - Estorno de Pedido de Recife DEVE acionar estornar_estoque_pedido', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, status_checklist: false },
        error: null
      } as any);

      await pedidosService.estornarEstoque('ped-rec-100', 'admin@hcvape.com', 'recife');

      expect(rpcMock).toHaveBeenCalledWith('estornar_estoque_pedido', {
        p_pedido_id: 'ped-rec-100',
        p_usuario: 'admin@hcvape.com'
      });
      expect(rpcMock).not.toHaveBeenCalledWith('estornar_estoque_zona_norte', expect.anything());
    });
  });

  describe('3. Gestão Isolada de Trocas na Zona Norte', () => {
    it('3.1 - Troca na Zona Norte com abatimento DEVE acionar registrar_troca_zona_norte', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, troca_id: 'troca-zn-1', abateu_estoque: true },
        error: null
      } as any);

      const novaTroca = await trocasService.criar({
        cliente_nome: 'Carlos Lima',
        cliente_telefone: '81999990000',
        vape_defeito: 'IGNITE V150',
        sabor_defeito: 'Menta',
        motivo: 'Gosto de queimado',
        vape_trocado: 'IGNITE V150',
        sabor_trocado: 'Menta Ice',
        produto_trocado_id: 'prod-1',
        zona: 'norte',
        abateu_estoque: true
      });

      expect(rpcMock).toHaveBeenCalledWith('registrar_troca_zona_norte', expect.objectContaining({
        p_cliente_nome: 'Carlos Lima',
        p_abater_estoque: true
      }));
      expect(rpcMock).not.toHaveBeenCalledWith('registrar_troca', expect.anything());
      expect(novaTroca.zona).toBe('norte');
    });

    it('3.2 - Troca de Recife com abatimento DEVE acionar registrar_troca (legada)', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, troca_id: 'troca-rec-1', abateu_estoque: true },
        error: null
      } as any);

      await trocasService.criar({
        cliente_nome: 'Mariana Silva',
        vape_defeito: 'ELF BAR 23K',
        motivo: 'Bateria',
        vape_trocado: 'ELF BAR 23K',
        sabor_trocado: 'green apple',
        produto_trocado_id: 'prod-2',
        zona: 'recife',
        abateu_estoque: true
      });

      expect(rpcMock).toHaveBeenCalledWith('registrar_troca', expect.objectContaining({
        p_cliente_nome: 'Mariana Silva',
        p_abater_estoque: true
      }));
      expect(rpcMock).not.toHaveBeenCalledWith('registrar_troca_zona_norte', expect.anything());
    });

    it('3.3 - Cancelamento de troca na Zona Norte DEVE acionar estornar_troca_zona_norte', async () => {
      const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, status: 'cancelada' },
        error: null
      } as any);

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { zona: 'norte', abateu_estoque: true },
              error: null
            })
          })
        })
      } as any);

      await trocasService.cancelar('troca-zn-1', 'norte');

      expect(rpcMock).toHaveBeenCalledWith('estornar_troca_zona_norte', {
        p_troca_id: 'troca-zn-1',
        p_usuario: null
      });
      expect(rpcMock).not.toHaveBeenCalledWith('estornar_troca', expect.anything());
    });
  });
});
