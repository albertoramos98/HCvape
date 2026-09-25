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
    filtroPeriodo: '7d' | '15d' | '30d' | '90d' | '180d' | 'tudo' | 'custom';
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
    } else if (filtroPeriodo === '180d') {
      start = new Date(refDate);
      start.setDate(start.getDate() - 179);
    } else if (filtroPeriodo === 'tudo') {
      start = new Date('2024-01-01T00:00:00');
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

describe('Sistema de Gestão de Clientes Únicos & WhatsApp', () => {
  // Importar / testar a lógica de normalização
  const normalizar = (telefone: string) => {
    let limpo = telefone.replace(/\D/g, '');
    if (limpo.startsWith('0')) limpo = limpo.substring(1);
    if (limpo.startsWith('55') && (limpo.length === 12 || limpo.length === 13)) {
      const sem55 = limpo.substring(2);
      const ddd = sem55.substring(0, 2);
      let num = sem55.substring(2);
      if (num.length === 8 && ['6', '7', '8', '9'].includes(num[0])) num = '9' + num;
      return `55${ddd}${num}`;
    }
    if (limpo.length === 10 || limpo.length === 11) {
      const ddd = limpo.substring(0, 2);
      let num = limpo.substring(2);
      if (num.length === 8 && ['6', '7', '8', '9'].includes(num[0])) num = '9' + num;
      return `55${ddd}${num}`;
    }
    if (limpo.length === 8 || limpo.length === 9) {
      let num = limpo;
      if (num.length === 8 && ['6', '7', '8', '9'].includes(num[0])) num = '9' + num;
      return `5581${num}`;
    }
    return limpo.startsWith('55') ? limpo : `55${limpo}`;
  };

  it('deve normalizar diferentes formatos para o mesmo identificador único canônico', () => {
    const formatos = [
      '81999999999',
      '+55 81 99999-9999',
      '+5581999999999',
      '55 81 99999-9999',
      '(81) 99999-9999',
      '+55 (81) 9.9999-9999',
      '081999999999'
    ];

    const normalizados = formatos.map(normalizar);
    const setUnicos = new Set(normalizados);

    expect(setUnicos.size).toBe(1);
    expect(normalizados[0]).toBe('5581999999999');
  });

  it('deve consolidar múltiplas interações de um mesmo cliente em 1 único registro no relatório', () => {
    // Simular cliente com 20 interações no período
    const cliente = {
      id: 'cli-1',
      nome: 'João Silva',
      telefone: '+55 81 99999-9999',
      telefone_normalizado: '5581999999999',
      data_primeiro_contato: '2026-09-05T10:00:00Z',
      data_ultimo_contato: '2027-09-15T18:00:00Z',
      total_interacoes: 20,
      total_pedidos: 3,
      valor_total_gasto: 450
    };

    const interacoes = Array.from({ length: 20 }, (_, i) => ({
      id: `int-${i + 1}`,
      cliente_telefone_normalizado: '5581999999999',
      tipo: i < 3 ? 'pedido' : 'contato_whatsapp',
      valor: i < 3 ? 150 : 0,
      data_interacao: `2026-09-${String(10 + i).padStart(2, '0')}T12:00:00Z`
    }));

    // Função de agregação consolidada
    const consolidarRelatorio = (clis: any[], ints: any[], dInicio: Date, dFim: Date) => {
      const mapaInteracoes: Record<string, any[]> = {};
      ints.forEach(int => {
        const d = new Date(int.data_interacao);
        if (d >= dInicio && d <= dFim) {
          if (!mapaInteracoes[int.cliente_telefone_normalizado]) {
            mapaInteracoes[int.cliente_telefone_normalizado] = [];
          }
          mapaInteracoes[int.cliente_telefone_normalizado].push(int);
        }
      });

      const relatorio: any[] = [];
      clis.forEach(c => {
        const historico = mapaInteracoes[c.telefone_normalizado] || [];
        if (historico.length > 0) {
          const pedidos = historico.filter(h => h.tipo === 'pedido');
          relatorio.push({
            nome: c.nome,
            whatsapp: c.telefone_normalizado,
            interacoesNoPeriodo: historico.length,
            pedidosNoPeriodo: pedidos.length,
            totalGastoNoPeriodo: pedidos.reduce((acc, p) => acc + p.valor, 0)
          });
        }
      });
      return relatorio;
    };

    const dInicio = new Date('2026-09-01T00:00:00Z');
    const dFim = new Date('2027-09-30T23:59:59Z');

    const resultado = consolidarRelatorio([cliente], interacoes, dInicio, dFim);

    // O cliente DEVE aparecer UMA ÚNICA VEZ
    expect(resultado).toHaveLength(1);
    expect(resultado[0].nome).toBe('João Silva');
    expect(resultado[0].interacoesNoPeriodo).toBe(20);
    expect(resultado[0].pedidosNoPeriodo).toBe(3);
    expect(resultado[0].totalGastoNoPeriodo).toBe(450);
  });

  it('deve filtrar corretamente períodos entre anos diferentes (ex: 01/09/2026 a 30/09/2027)', () => {
    const clientes = [
      { id: '1', nome: 'Cliente 2026', telefone_normalizado: '5581900000001', data_primeiro_contato: '2026-09-15T10:00:00Z' },
      { id: '2', nome: 'Cliente 2027', telefone_normalizado: '5581900000002', data_primeiro_contato: '2027-04-20T10:00:00Z' },
      { id: '3', nome: 'Cliente Fora do Periodo', telefone_normalizado: '5581900000003', data_primeiro_contato: '2025-01-01T10:00:00Z' },
    ];

    const dInicio = new Date('2026-09-01T00:00:00Z');
    const dFim = new Date('2027-09-30T23:59:59Z');

    const filtrados = clientes.filter(c => {
      const d = new Date(c.data_primeiro_contato);
      return d >= dInicio && d <= dFim;
    });

    expect(filtrados).toHaveLength(2);
    expect(filtrados.map(c => c.nome)).toEqual(['Cliente 2026', 'Cliente 2027']);
  });

  it('deve ordenar a lista oficial de IGNITES exatamente na ordem decrescente de puffs', () => {
    const extrairPuffs = (nome: string): number => {
      if (!nome) return 0;
      const texto = nome.toLowerCase();
      if (texto.includes('nano') || texto.includes('vnano')) return 1000;
      const matchK = texto.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
      if (matchK) return Math.round(parseFloat(matchK[1].replace(',', '.')) * 1000);
      const matchV = texto.match(/(?:^|[^a-z0-9]|ignite)\s*v\s*[-_]?\s*(\d+)/i) || texto.match(/v\s*[-_]?\s*(\d+)/i);
      if (matchV) {
        const vNum = parseInt(matchV[1], 10);
        return vNum < 1000 ? vNum * 100 : vNum;
      }
      const matchPuffs = texto.match(/(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:puffs?|puf)/i);
      if (matchPuffs) return parseInt(matchPuffs[1].replace(/\./g, ''), 10);
      const matchNum = texto.match(/\b(\d{4,6})\b/);
      if (matchNum) return parseInt(matchNum[1], 10);
      const matchEmbedded = texto.match(/[a-z]\s*[-_]?\s*(\d{2,6})/i);
      if (matchEmbedded) {
        const num = parseInt(matchEmbedded[1], 10);
        return num < 1000 ? num * 100 : num;
      }
      const matchDoisDigitos = texto.match(/\b(\d{2,3})\b/);
      if (matchDoisDigitos) return parseInt(matchDoisDigitos[1], 10) * 100;
      return 0;
    };

    const ordenarIgnites = (nomes: string[]) => {
      return [...nomes].sort((a, b) => {
        const puffsA = extrairPuffs(a);
        const puffsB = extrairPuffs(b);
        if (puffsA !== puffsB) {
          return puffsB - puffsA; // Decrescente (do maior para o menor)
        }
        return a.localeCompare(b, 'pt-BR');
      });
    };

    const listaOriginal = [
      'IGNITE V500',
      'IGNITE V400 ICE',
      'IGNITE V400 MIX',
      'IGNITE V400 SWEET',
      'IGNITE V300 BLACK',
      'IGNITE V300 ULTRA SLIM',
      'IGNITE V250',
      'IGNITE V200',
      'IGNITE V155',
      'IGNITE V80 NE BLUE',
      'IGNITE V80 NEW EDTION',
      'IGNITE V80 ULTRA SLIM',
      'IGNITE V80',
      'IGNITE V55',
      'IGNITE V55 ORANGE',
      'IGNITE VNANO 1K'
    ];

    // Embaralha para testar ordenação
    const embaralhada = [...listaOriginal].reverse();
    const ordenada = ordenarIgnites(embaralhada);

    expect(extrairPuffs('IGNITE V500')).toBe(50000);
    expect(extrairPuffs('IGNITE V400 ICE')).toBe(40000);
    expect(extrairPuffs('IGNITE V300 ULTRA SLIM')).toBe(30000);
    expect(extrairPuffs('IGNITE V250')).toBe(25000);
    expect(extrairPuffs('IGNITE V200')).toBe(20000);
    expect(extrairPuffs('IGNITE V155')).toBe(15500);
    expect(extrairPuffs('IGNITE V80 ULTRA SLIM')).toBe(8000);
    expect(extrairPuffs('IGNITE V55')).toBe(5500);
    expect(extrairPuffs('IGNITE VNANO 1K')).toBe(1000);

    // O primeiro DEVE ser o V500 (50.000 puffs) e o último o VNANO (1.000 puffs)
    expect(ordenada[0]).toBe('IGNITE V500');
    expect(ordenada[ordenada.length - 1]).toBe('IGNITE VNANO 1K');

    // V80 ULTRA SLIM deve ficar no bloco de 8.000 puffs (após V155 de 15.5k e antes de V55 de 5.5k)
    const idxV155 = ordenada.findIndex(n => n.includes('V155'));
    const idxV80Slim = ordenada.findIndex(n => n.includes('V80 ULTRA SLIM'));
    const idxV55 = ordenada.findIndex(n => n.includes('V55'));

    expect(idxV155).toBeLessThan(idxV80Slim);
    expect(idxV80Slim).toBeLessThan(idxV55);
  });
});



