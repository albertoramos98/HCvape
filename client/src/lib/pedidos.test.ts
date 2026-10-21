import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase, pedidosService } from './supabase';

describe('Resiliência e Compatibilidade de Parâmetros de pedidosService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve executar baixarEstoque diretamente quando a RPC encontra a assinatura padrão', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: { success: true, pedido_id: 'ped-1', status_checklist: true },
      error: null
    } as any);

    const resultado = await pedidosService.baixarEstoque('ped-1');

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('baixar_estoque_pedido', {
      p_pedido_id: 'ped-1'
    });
    expect(resultado.success).toBe(true);
  });

  it('deve se recuperar com retry caso o PostgREST retorne erro de schema cache ou parâmetro p_usuario', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc')
      // 1ª tentativa falha simulando erro de cache do PostgREST
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Could not find the function public.baixar_estoque_pedido(p_pedido_id) in the schema cache',
          details: null,
          hint: null,
          code: 'PGRST202'
        }
      } as any)
      // 2ª tentativa (fallback com p_usuario: null) é bem-sucedida
      .mockResolvedValueOnce({
        data: { success: true, pedido_id: 'ped-2', status_checklist: true },
        error: null
      } as any);

    const resultado = await pedidosService.baixarEstoque('ped-2');

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'baixar_estoque_pedido', {
      p_pedido_id: 'ped-2'
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'baixar_estoque_pedido', {
      p_pedido_id: 'ped-2',
      p_usuario: null
    });
    expect(resultado.success).toBe(true);
  });

  it('deve tentar fallback caso chamada com usuário explícito falhe por schema cache desatualizado', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc')
      // 1ª tentativa com p_usuario falha simulando cache sem p_usuario
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Could not find the function public.baixar_estoque_pedido(p_pedido_id, p_usuario) in the schema cache',
          details: null,
          hint: null,
          code: 'PGRST202'
        }
      } as any)
      // 2ª tentativa sem p_usuario é bem-sucedida
      .mockResolvedValueOnce({
        data: { success: true, pedido_id: 'ped-3', status_checklist: true },
        error: null
      } as any);

    const resultado = await pedidosService.baixarEstoque('ped-3', 'admin@hcvape.com');

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'baixar_estoque_pedido', {
      p_pedido_id: 'ped-3',
      p_usuario: 'admin@hcvape.com'
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'baixar_estoque_pedido', {
      p_pedido_id: 'ped-3'
    });
    expect(resultado.success).toBe(true);
  });

  it('deve recuperar estornarEstoque com retry quando houver divergência no schema cache', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc')
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Could not find the function public.estornar_estoque_pedido(p_pedido_id, p_usuario) in the schema cache',
          details: null,
          hint: null,
          code: 'PGRST202'
        }
      } as any)
      .mockResolvedValueOnce({
        data: { success: true, pedido_id: 'ped-4', status_checklist: false },
        error: null
      } as any);

    const resultado = await pedidosService.estornarEstoque('ped-4', 'admin@hcvape.com');

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(resultado.success).toBe(true);
  });

  it('deve repassar o erro real caso o problema não seja de cache/assinatura (ex.: estoque insuficiente ou pedido inexistente)', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Estoque insuficiente para o produto "IGNITE V150" (Sabor: "Menta Ice")',
        details: null,
        hint: null,
        code: 'P0001'
      }
    } as any);

    await expect(pedidosService.baixarEstoque('ped-inexistente')).rejects.toThrow(
      'Estoque insuficiente'
    );
  });
});
