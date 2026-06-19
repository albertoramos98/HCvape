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

describe('Lógica de Processamento de Métricas e Preenchimento de Gaps', () => {
  const mockVisitas = [
    { data: '18/06/2026', acessos: 15 },
    { data: '19/06/2026', acessos: 20 },
  ];

  const mockPedidos = [
    { id: '1', total_final: 150, status_checklist: true, created_at: '2026-06-18T10:00:00Z' },
    { id: '2', total_final: 250, status_checklist: false, created_at: '2026-06-19T14:00:00Z' },
  ];

  const processarMetricas = (params: {
    filtroPeriodo: '7d' | '15d' | '30d' | '90d' | 'custom';
    dataInicioMetricas?: string;
    dataFimMetricas?: string;
    agrupamentoMetricas: 'dia' | 'semana' | 'mes';
    statusPedidoFiltro: 'todos' | 'concluidos';
    metricasVisitas: { data: string; acessos: number }[];
    pedidos: any[];
  }) => {
    const {
      filtroPeriodo,
      dataInicioMetricas,
      dataFimMetricas,
      agrupamentoMetricas,
      statusPedidoFiltro,
      metricasVisitas,
      pedidos,
    } = params;

    const refDate = new Date('2026-06-19T12:00:00'); // 19 de Junho de 2026
    let start: Date;
    let end: Date = new Date(refDate);
    end.setHours(23, 59, 59, 999);

    if (filtroPeriodo === '7d') {
      start = new Date(refDate);
      start.setDate(start.getDate() - 6);
    } else if (filtroPeriodo === '15d') {
      start = new Date(refDate);
      start.setDate(start.getDate() - 14);
    } else if (filtroPeriodo === '30d') {
      start = new Date(refDate);
      start.setDate(start.getDate() - 29);
    } else if (filtroPeriodo === '90d') {
      start = new Date(refDate);
      start.setDate(start.getDate() - 89);
    } else {
      start = dataInicioMetricas ? new Date(dataInicioMetricas + 'T00:00:00') : new Date(refDate);
      if (dataFimMetricas) {
        end = new Date(dataFimMetricas + 'T23:59:59');
      }
    }
    start.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const rangeLimite = Math.min(diffDays, 366);

    const timeline: any[] = [];
    let current = new Date(start);
    for (let i = 0; i <= rangeLimite; i++) {
      if (current > end) break;
      const key = current.toLocaleDateString('pt-BR');
      timeline.push({
        key,
        dateObj: new Date(current),
        visitas: 0,
        vendas: 0,
        faturamento: 0,
        ticketMedio: 0,
        conversao: 0
      });
      current.setDate(current.getDate() + 1);
    }

    const visitasMap: { [key: string]: number } = {};
    metricasVisitas.forEach(v => {
      visitasMap[v.data] = v.acessos;
    });

    const pedidosFiltradosPorStatus = pedidos.filter(p => {
      if (statusPedidoFiltro === 'concluidos') {
        return p.status_checklist === true;
      }
      return true;
    });

    const pedidosPorDia: { [key: string]: { count: number; total: number } } = {};
    pedidosFiltradosPorStatus.forEach(p => {
      if (!p.created_at) return;
      const dataStr = new Date(p.created_at).toLocaleDateString('pt-BR');
      if (!pedidosPorDia[dataStr]) {
        pedidosPorDia[dataStr] = { count: 0, total: 0 };
      }
      pedidosPorDia[dataStr].count += 1;
      pedidosPorDia[dataStr].total += p.total_final;
    });

    timeline.forEach(d => {
      d.visitas = visitasMap[d.key] || 0;
      const ped = pedidosPorDia[d.key];
      if (ped) {
        d.vendas = ped.count;
        d.faturamento = ped.total;
        d.ticketMedio = ped.count > 0 ? ped.total / ped.count : 0;
      }
      d.conversao = d.visitas > 0 ? (d.vendas / d.visitas) * 100 : 0;
    });

    return timeline;
  };

  it('deve gerar exatamente 7 dias consecutivos para o filtro de 7d, preenchendo com 0 os dias sem dados', () => {
    const timeline = processarMetricas({
      filtroPeriodo: '7d',
      agrupamentoMetricas: 'dia',
      statusPedidoFiltro: 'todos',
      metricasVisitas: mockVisitas,
      pedidos: mockPedidos,
    });

    expect(timeline).toHaveLength(7);
    
    // Validar se o dia 19/06/2026 (fim) e 18/06/2026 possuem dados corretos
    const dia19 = timeline.find(d => d.key === '19/06/2026');
    expect(dia19).toBeDefined();
    expect(dia19.visitas).toBe(20);
    expect(dia19.vendas).toBe(1);
    expect(dia19.faturamento).toBe(250);

    const dia18 = timeline.find(d => d.key === '18/06/2026');
    expect(dia18).toBeDefined();
    expect(dia18.visitas).toBe(15);
    expect(dia18.vendas).toBe(1);
    expect(dia18.faturamento).toBe(150);

    // Validar se o dia 17/06/2026 (sem dados) foi preenchido com zero
    const dia17 = timeline.find(d => d.key === '17/06/2026');
    expect(dia17).toBeDefined();
    expect(dia17.visitas).toBe(0);
    expect(dia17.vendas).toBe(0);
    expect(dia17.faturamento).toBe(0);
  });

  it('deve filtrar pedidos de acordo com o status quando statusPedidoFiltro é concluidos', () => {
    const timeline = processarMetricas({
      filtroPeriodo: '7d',
      agrupamentoMetricas: 'dia',
      statusPedidoFiltro: 'concluidos', // Apenas concluídos
      metricasVisitas: mockVisitas,
      pedidos: mockPedidos,
    });

    const dia19 = timeline.find(d => d.key === '19/06/2026');
    // Pedido do dia 19/06 não é concluído (status_checklist: false), então deve vir zerado
    expect(dia19.vendas).toBe(0);
    expect(dia19.faturamento).toBe(0);

    const dia18 = timeline.find(d => d.key === '18/06/2026');
    // Pedido do dia 18/06 é concluído (status_checklist: true), então deve ser contabilizado
    expect(dia18.vendas).toBe(1);
    expect(dia18.faturamento).toBe(150);
  });
});

