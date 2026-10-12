import { describe, it, expect } from 'vitest';
import { utils } from '../lib/supabase';

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

  it('deve ordenar a lista oficial de IGNITES exatamente na ordem decrescente de puffs usando utils', () => {
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

    expect(utils.extrairPuffs('IGNITE V500')).toBe(50000);
    expect(utils.extrairPuffs('IGNITE V400 ICE')).toBe(40000);
    expect(utils.extrairPuffs('IGNITE V300 ULTRA SLIM')).toBe(30000);
    expect(utils.extrairPuffs('IGNITE V250')).toBe(25000);
    expect(utils.extrairPuffs('IGNITE V200')).toBe(20000);
    expect(utils.extrairPuffs('IGNITE V155')).toBe(15500);
    expect(utils.extrairPuffs('IGNITE V80 NE BLUE')).toBe(8000);
    expect(utils.extrairPuffs('IGNITE V80 NEW EDTION')).toBe(8000);
    expect(utils.extrairPuffs('IGNITE V80 ULTRA SLIM')).toBe(8000);
    expect(utils.extrairPuffs('IGNITE V80')).toBe(8000);
    expect(utils.extrairPuffs('IGNITE V55')).toBe(5500);
    expect(utils.extrairPuffs('IGNITE V55 ORANGE')).toBe(5500);
    expect(utils.extrairPuffs('IGNITE VNANO 1K')).toBe(1000);

    // Formatos com ponto, k, sem V
    expect(utils.extrairPuffs('IGNITE 8.000')).toBe(8000);
    expect(utils.extrairPuffs('IGNITE 40.000 MIX')).toBe(40000);
    expect(utils.extrairPuffs('IGNITE 50.000')).toBe(50000);
    expect(utils.extrairPuffs('IGNITE 15.500')).toBe(15500);
    expect(utils.extrairPuffs('IGNITE 5.500')).toBe(5500);
    expect(utils.extrairPuffs('BLACK SHEEP 30K')).toBe(30000);
    expect(utils.extrairPuffs('ELFBAR BC10000')).toBe(10000);

    // Teste com objetos Produto ordenados decrescente
    const produtosMock = listaOriginal.map((nome, index) => ({
      id: `p-${index}`,
      marca: 'IGNITE',
      nome,
      preco: 100,
      estoque: 10,
      sabores: ['Ice'],
      zonas: ['todas']
    }));

    // Embaralha
    const embaralhada = [...produtosMock].reverse();
    const ordenadaDesc = utils.ordenarProdutosPorMarcaEPuffs(embaralhada, 'desc');

    // O primeiro DEVE ser o V500 (50.000 puffs) e o último o VNANO (1.000 puffs)
    expect(ordenadaDesc[0].nome).toBe('IGNITE V500');
    expect(ordenadaDesc[ordenadaDesc.length - 1].nome).toBe('IGNITE VNANO 1K');

    // V80 ULTRA SLIM deve ficar no bloco de 8.000 puffs (após V155 de 15.5k e antes de V55 de 5.5k)
    const idxV155 = ordenadaDesc.findIndex(p => p.nome.includes('V155'));
    const idxV80Slim = ordenadaDesc.findIndex(p => p.nome.includes('V80 ULTRA SLIM'));
    const idxV55 = ordenadaDesc.findIndex(p => p.nome.includes('V55'));

    expect(idxV155).toBeLessThan(idxV80Slim);
    expect(idxV80Slim).toBeLessThan(idxV55);
  });

  it('deve ordenar perfeitamente o conjunto real com marcas contendo modelos (ex: IGNITE V155, ELF BAR 10K)', () => {
    const produtosReais = [
      { marca: 'IGNITE V155', nome: 'IGNITE V155' },
      { marca: 'IGNITE V200', nome: 'IGNITE V200' },
      { marca: 'IGNITE V250', nome: 'IGNITE V250' },
      { marca: 'IGNITE V300 BLACK', nome: 'IGNITE V300 BLACK' },
      { marca: 'IGNITE V300 ULTRA SLIM', nome: 'IGNITE V300 ULTRA SLIM' },
      { marca: 'IGNITE V400 ICE', nome: 'IGNITE V400 ICE' },
      { marca: 'IGNITE V400 MIX', nome: 'IGNITE V400 MIX' },
      { marca: 'IGNITE V400 SWEET', nome: 'IGNITE V400 SWEET' },
      { marca: 'IGNITE V500', nome: 'IGNITE V500' },
      { marca: 'IGNITE V55', nome: 'IGNITE V55' },
      { marca: 'IGNITE V55 ORANGE', nome: 'IGNITE V55 ORANGE' },
      { marca: 'IGNITE V80', nome: 'Ignite 8.000 - Maçã e menta' },
      { marca: 'IGNITE V80 NE BLUE', nome: 'IGNITE V80 NE BLUE' },
      { marca: 'IGNITE V80 NEW EDTION', nome: 'IGNITE V80 NEW EDTION' },
      { marca: 'IGNITE V80 ULTRA SLIM', nome: 'IGNITE V80 ULTRA SLIM' },
      { marca: 'IGNITE VNANO 1K', nome: 'IGNITE VNANO 1K' },
      { marca: 'ELF BAR 10K', nome: 'Elf bar 10.000 - Abacaxi morango e banana' },
      { marca: 'ELF BAR 15K', nome: 'ELF BAR 15K' },
      { marca: 'ELF BAR 23K', nome: 'ELF BAR 23K' },
      { marca: 'ELF BAR 30K', nome: 'ELF BAR 30K' },
      { marca: 'ELF BAR 40K BC PRO', nome: 'ELF BAR 40K BC PRO' },
      { marca: 'ELF BAR 40K ICE KING', nome: 'ELF BAR 40K ICE KING' },
      { marca: 'ELF BAR 45K', nome: 'ELF BAR 45K' },
      { marca: 'ELF BAR DUNK 35K', nome: 'ELF BAR DUNK 35K' },
      { marca: 'BLACK SHEEP 20K', nome: 'BLACK SHEEP 20K' },
      { marca: 'BLACK SHEEP 30K', nome: 'BLACK SHEEP 30K' },
      { marca: 'BLACK SHEEP 40K', nome: 'BLACK SHEEP 40K' },
      { marca: 'BLACK SHEEP 55K', nome: 'BLACK SHEEP 55K' },
      { marca: 'WAKA 25K', nome: 'WAKA 25K' },
      { marca: 'WAKA 33K', nome: 'Waka 33.000 - Bomba de cereja' },
      { marca: 'WAKA 46K', nome: 'WAKA 46K' },
      { marca: 'WAKA 50K', nome: 'WAKA 50K' },
      { marca: 'WAKA 70K', nome: 'WAKA 70K' },
      { marca: 'EXTRE BAR TURBO 30K', nome: 'EXTRE BAR TURBO 30K' },
      { marca: 'LOST VAPE 10k', nome: 'Lost vaper 10.000 - blue raz ice' },
      { marca: 'MASKKING 100K', nome: 'MASKKING 100K' },
      { marca: 'SEX ADDICIT 28K', nome: 'SEX ADDICIT 28K' },
      { marca: 'V400 SLIM ICE', nome: 'V400 SLIM ICE' }
    ].map((p, i) => ({
      id: `p-${i}`,
      marca: p.marca,
      nome: p.nome,
      preco: 100,
      estoque: 5,
      sabores: ['Ice'],
      zonas: ['todas']
    }));

    const ordenados = utils.ordenarProdutosPorMarcaEPuffs(produtosReais, 'desc');

    // Ignites devem ser os primeiros
    expect(ordenados[0].nome).toBe('IGNITE V500'); // 50.000 puffs
    
    // Pega todos os Ignites
    const ignites = ordenados.filter(p => utils.extrairFamiliaMarca(p.marca, p.nome).familia === 'ignite');
    const nomesIgnite = ignites.map(p => p.nome);

    expect(nomesIgnite[0]).toBe('IGNITE V500'); // 50k
    expect(nomesIgnite[nomesIgnite.length - 1]).toBe('IGNITE VNANO 1K'); // 1k

    // V80 deve estar entre V155 e V55
    const idxV155 = nomesIgnite.findIndex(n => n.includes('V155'));
    const idxV80 = nomesIgnite.findIndex(n => n.includes('V80') || n.includes('8.000'));
    const idxV55 = nomesIgnite.findIndex(n => n.includes('V55'));

    expect(idxV155).toBeLessThan(idxV80);
    expect(idxV80).toBeLessThan(idxV55);

    // Elf Bar deve vir logo após Ignite e ter 45K no topo e 10K no fim
    const elfBars = ordenados.filter(p => utils.extrairFamiliaMarca(p.marca, p.nome).familia === 'elf bar');
    expect(elfBars[0].nome).toBe('ELF BAR 45K');
    expect(elfBars[elfBars.length - 1].nome).toBe('Elf bar 10.000 - Abacaxi morango e banana');

    // Black Sheep deve ter 55K no topo e 20K no fim
    const blackSheeps = ordenados.filter(p => utils.extrairFamiliaMarca(p.marca, p.nome).familia === 'black sheep');
    expect(blackSheeps[0].nome).toBe('BLACK SHEEP 55K');
    expect(blackSheeps[blackSheeps.length - 1].nome).toBe('BLACK SHEEP 20K');

    // Waka deve ter 70K no topo e 25K no fim
    const wakas = ordenados.filter(p => utils.extrairFamiliaMarca(p.marca, p.nome).familia === 'waka');
    expect(wakas[0].nome).toBe('WAKA 70K');
    expect(wakas[wakas.length - 1].nome).toBe('WAKA 25K');
  });
});

describe('Gestão de Localidades e Zonas (incluindo Gravatá)', () => {
  it('deve conter Gravatá na lista oficial de ZONAS_DISPONIVEIS com metadados corretos', async () => {
    const { ZONAS_DISPONIVEIS } = await import('../lib/supabase');
    const gravata = ZONAS_DISPONIVEIS.find(z => z.id === 'gravata');
    
    expect(gravata).toBeDefined();
    expect(gravata?.nome).toBe('Gravatá');
    expect(gravata?.sigla).toBe('GV');
    expect(gravata?.cor).toBe('#f59e0b');
    expect(ZONAS_DISPONIVEIS.length).toBeGreaterThanOrEqual(3);
  });

  it('deve calcular corretamente o estoque para a zona Gravatá em produtos com zonas configuradas', () => {
    const produtoGravata: any = {
      id: 'p-gravata-1',
      marca: 'IGNITE',
      nome: 'IGNITE V500',
      preco: 120,
      estoque: 15,
      sabores: ['Watermelon Ice', 'Grape Ice'],
      sabores_estoque: { 'Watermelon Ice': 10, 'Grape Ice': 5 },
      zonas: ['gravata', 'norte'],
      estoque_zonas: {
        gravata: {
          estoque: 8,
          sabores_estoque: { 'Watermelon Ice': 5, 'Grape Ice': 3 }
        },
        norte: {
          estoque: 7,
          sabores_estoque: { 'Watermelon Ice': 5, 'Grape Ice': 2 }
        }
      }
    };

    const estoqueGravata = utils.obterEstoqueProdutoPorZona(produtoGravata, 'gravata');
    expect(estoqueGravata.possuiEstoqueNaZona).toBe(true);
    expect(estoqueGravata.estoque).toBe(8);
    expect(estoqueGravata.saboresEstoque['Watermelon Ice']).toBe(5);
    expect(estoqueGravata.saboresEstoque['Grape Ice']).toBe(3);
    expect(estoqueGravata.saboresDisponiveis).toEqual(['Watermelon Ice', 'Grape Ice']);

    // Se consultar uma zona onde o produto não atende (ex: sul_oeste)
    const estoqueSul = utils.obterEstoqueProdutoPorZona(produtoGravata, 'sul_oeste');
    expect(estoqueSul.possuiEstoqueNaZona).toBe(false);
    expect(estoqueSul.estoque).toBe(0);
  });

  it('deve filtrar produtos por Gravatá quando apenas uma lista de zonas em texto for fornecida', () => {
    const produtoMultiZona: any = {
      id: 'p-multi',
      marca: 'ELF BAR',
      nome: 'ELF BAR 45K',
      preco: 130,
      estoque: 20,
      sabores: ['Mint Ice'],
      sabores_estoque: { 'Mint Ice': 20 },
      zonas: ['Zona Norte', 'Gravatá']
    };

    const resultadoGravata = utils.obterEstoqueProdutoPorZona(produtoMultiZona, 'gravata');
    expect(resultadoGravata.possuiEstoqueNaZona).toBe(true);
    expect(resultadoGravata.estoque).toBe(20);

    const resultadoSul = utils.obterEstoqueProdutoPorZona(produtoMultiZona, 'sul_oeste');
    expect(resultadoSul.possuiEstoqueNaZona).toBe(false);
    expect(resultadoSul.estoque).toBe(0);
  });

  it('deve retornar apenas os sabores específicos com estoque > 0 na cidade selecionada (ex: Gravatá apenas Menta e Uva)', () => {
    const produtoExemploAudio: any = {
      id: 'p-v150',
      marca: 'IGNITE',
      nome: 'IGNITE V150',
      preco: 115,
      estoque: 38,
      sabores: ['Menta Ice', 'Uva Ice', 'Manga Ice', 'Melancia Ice'],
      zonas: ['norte', 'sul_oeste', 'gravata'],
      sabores_estoque: { 'Menta Ice': 15, 'Uva Ice': 13, 'Manga Ice': 5, 'Melancia Ice': 5 },
      estoque_zonas: {
        norte: {
          estoque: 20,
          sabores_estoque: { 'Menta Ice': 10, 'Uva Ice': 10, 'Manga Ice': 0, 'Melancia Ice': 0 }
        },
        sul_oeste: {
          estoque: 10,
          sabores_estoque: { 'Menta Ice': 0, 'Uva Ice': 0, 'Manga Ice': 5, 'Melancia Ice': 5 }
        },
        gravata: {
          estoque: 8,
          sabores_estoque: { 'Menta Ice': 5, 'Uva Ice': 3, 'Manga Ice': 0, 'Melancia Ice': 0 }
        }
      }
    };

    // Consulta para Gravatá: deve retornar APENAS Menta e Uva
    const resultadoGravata = utils.obterEstoqueProdutoPorZona(produtoExemploAudio, 'gravata');
    expect(resultadoGravata.possuiEstoqueNaZona).toBe(true);
    expect(resultadoGravata.estoque).toBe(8);
    expect(resultadoGravata.saboresDisponiveis).toEqual(['Menta Ice', 'Uva Ice']);
    expect(resultadoGravata.saboresDisponiveis).not.toContain('Manga Ice');
    expect(resultadoGravata.saboresDisponiveis).not.toContain('Melancia Ice');

    // Consulta para Zona Oeste/Sul: deve retornar apenas Manga e Melancia
    const resultadoSul = utils.obterEstoqueProdutoPorZona(produtoExemploAudio, 'sul_oeste');
    expect(resultadoSul.possuiEstoqueNaZona).toBe(true);
    expect(resultadoSul.estoque).toBe(10);
    expect(resultadoSul.saboresDisponiveis).toEqual(['Manga Ice', 'Melancia Ice']);
  });
});

describe('Auditoria de Segurança & Whitelist de Administradores', () => {
  const verificarPermissaoAdmin = (email: string | null | undefined, whitelist: string[]): boolean => {
    if (!email) return false;
    const emailLimpo = email.trim().toLowerCase();
    return whitelist.map(e => e.trim().toLowerCase()).includes(emailLimpo);
  };

  const adminWhitelistOficial = [
    'albertinhorss@gmail.com',
    'pedrohenrique12345a@gmail.com'
  ];

  it('deve permitir acesso para os e-mails oficiais de administradores', () => {
    expect(verificarPermissaoAdmin('albertinhorss@gmail.com', adminWhitelistOficial)).toBe(true);
    expect(verificarPermissaoAdmin('  ALBERTINHORSS@GMAIL.COM ', adminWhitelistOficial)).toBe(true);
    expect(verificarPermissaoAdmin('pedrohenrique12345a@gmail.com', adminWhitelistOficial)).toBe(true);
    expect(verificarPermissaoAdmin('  PEDROHENRIQUE12345A@GMAIL.COM ', adminWhitelistOficial)).toBe(true);
  });

  it('deve BLOQUEAR sumariamente qualquer usuário terceiro ou invasor não cadastrado na whitelist', () => {
    expect(verificarPermissaoAdmin('hacker@invasao.com', adminWhitelistOficial)).toBe(false);
    expect(verificarPermissaoAdmin('alberto@outrodominio.com', adminWhitelistOficial)).toBe(false);
    expect(verificarPermissaoAdmin('admin@hcvape.com', adminWhitelistOficial)).toBe(false);
    expect(verificarPermissaoAdmin('', adminWhitelistOficial)).toBe(false);
    expect(verificarPermissaoAdmin(null, adminWhitelistOficial)).toBe(false);
    expect(verificarPermissaoAdmin(undefined, adminWhitelistOficial)).toBe(false);
  });
});

describe('Pegadinha Anti-Invasor & Bloqueio Estrito de 18 Horas', () => {
  const DEZOITO_HORAS_SEGUNDOS = 18 * 60 * 60; // 64.800 segundos
  const DEZOITO_HORAS_MS = 18 * 60 * 60 * 1000; // 64.800.000 ms

  const formatarTempoBloqueio = (totalSegundos: number): string => {
    if (totalSegundos <= 0) return '0s';
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segs = totalSegundos % 60;
    
    const partes: string[] = [];
    if (horas > 0) partes.push(`${horas}h`);
    if (minutos > 0 || horas > 0) partes.push(`${String(minutos).padStart(2, '0')}m`);
    partes.push(`${String(segs).padStart(2, '0')}s`);
    
    return partes.join(' ');
  };

  const calcularBloqueioAoErrar = (tentativasAtuais: number, agora: number) => {
    const novasTentativas = tentativasAtuais + 1;
    if (novasTentativas >= 2) {
      return {
        acionarPegadinha: true,
        bloqueado: true,
        lockoutUntil: agora + DEZOITO_HORAS_MS,
        segundosRestantes: DEZOITO_HORAS_SEGUNDOS
      };
    }
    return {
      acionarPegadinha: false,
      bloqueado: false,
      lockoutUntil: 0,
      segundosRestantes: 0
    };
  };

  it('deve formatar o tempo de 18 horas perfeitamente (18h 00m 00s)', () => {
    expect(formatarTempoBloqueio(64800)).toBe('18h 00m 00s');
  });

  it('deve formatar tempos parciais corretamente (ex: 17h 59m 45s, 45m 12s, 30s)', () => {
    expect(formatarTempoBloqueio(17 * 3600 + 59 * 60 + 45)).toBe('17h 59m 45s');
    expect(formatarTempoBloqueio(45 * 60 + 12)).toBe('45m 12s');
    expect(formatarTempoBloqueio(30)).toBe('30s');
    expect(formatarTempoBloqueio(0)).toBe('0s');
    expect(formatarTempoBloqueio(-5)).toBe('0s');
  });

  it('não deve acionar bloqueio nem pegadinha na 1ª falha de senha', () => {
    const agora = 1700000000000;
    const resultado = calcularBloqueioAoErrar(0, agora);
    expect(resultado.acionarPegadinha).toBe(false);
    expect(resultado.bloqueado).toBe(false);
  });

  it('deve acionar a pegadinha e aplicar bloqueio ESTRITO de EXATAMENTE 18 horas ao atingir 2 falhas de senha', () => {
    const agora = 1700000000000;
    const resultado = calcularBloqueioAoErrar(1, agora);
    expect(resultado.acionarPegadinha).toBe(true);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.segundosRestantes).toBe(64800); // 18 * 3600
    expect(resultado.lockoutUntil).toBe(agora + 18 * 60 * 60 * 1000);
  });

  it('mecanismo de emergência do proprietário deve validar email da whitelist', () => {
    const whitelist = ['albertinhorss@gmail.com'];
    const validarDesbloqueioEmergencia = (emailDigitado: string | null) => {
      if (!emailDigitado) return false;
      return whitelist.includes(emailDigitado.trim().toLowerCase());
    };

    expect(validarDesbloqueioEmergencia('albertinhorss@gmail.com')).toBe(true);
    expect(validarDesbloqueioEmergencia(' ALBERTINHORSS@GMAIL.COM ')).toBe(true);
    expect(validarDesbloqueioEmergencia('invasor@qualquer.com')).toBe(false);
    expect(validarDesbloqueioEmergencia(null)).toBe(false);
  });
});



