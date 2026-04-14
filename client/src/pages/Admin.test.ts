import { describe, it, expect } from 'vitest';

// Simulação da lógica de filtragem que está dentro do useMemo em Admin.tsx
const filtrarPedidos = (pedidos: any[], filtroData: string) => {
  if (!filtroData) return pedidos;
  
  return pedidos.filter(p => {
    if (!p.created_at) return false;
    // Compara apenas a parte da data (YYYY-MM-DD)
    const dataPedido = new Date(p.created_at).toISOString().split('T')[0];
    return dataPedido === filtroData;
  });
};

describe('Lógica de Filtro de Pedidos por Data', () => {
  const mockPedidos = [
    { id: '1', numero_pedido: 101, created_at: '2026-04-13T10:00:00Z' },
    { id: '2', numero_pedido: 102, created_at: '2026-04-13T15:30:00Z' },
    { id: '3', numero_pedido: 103, created_at: '2026-04-14T08:00:00Z' },
    { id: '4', numero_pedido: 104, created_at: '2026-04-12T23:59:59Z' },
  ];

  it('deve retornar todos os pedidos quando o filtro está vazio', () => {
    const resultado = filtrarPedidos(mockPedidos, '');
    expect(resultado).toHaveLength(4);
  });

  it('deve filtrar pedidos corretamente para o dia 13/04/2026', () => {
    const resultado = filtrarPedidos(mockPedidos, '2026-04-13');
    expect(resultado).toHaveLength(2);
    expect(resultado[0].numero_pedido).toBe(101);
    expect(resultado[1].numero_pedido).toBe(102);
  });

  it('deve filtrar pedidos corretamente para o dia 14/04/2026', () => {
    const resultado = filtrarPedidos(mockPedidos, '2026-04-14');
    expect(resultado).toHaveLength(1);
    expect(resultado[0].numero_pedido).toBe(103);
  });

  it('deve retornar lista vazia para um dia sem pedidos', () => {
    const resultado = filtrarPedidos(mockPedidos, '2026-04-15');
    expect(resultado).toHaveLength(0);
  });

  it('deve lidar com formatos de data inconsistentes (se existirem)', () => {
    const pedidosComErro = [
      { id: '5', created_at: null },
      { id: '6', created_at: undefined },
      { id: '7', created_at: '2026-04-13T10:00:00Z' }
    ];
    const resultado = filtrarPedidos(pedidosComErro, '2026-04-13');
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('7');
  });
});
