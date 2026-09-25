import { useState, useEffect, useRef, useMemo } from 'react';
import { LogOut, Save, AlertCircle, Loader2, Plus, Trash2, Edit2, X, Zap, ImagePlus, ImageOff, ShoppingBag, Box, CheckCircle2, Circle, Download, Calendar, Filter, Github, Mail, BarChart3, TrendingUp, Users, Settings, DollarSign, Percent, RefreshCw, Search, LayoutTemplate, ArrowUp, ArrowDown, Sparkles, MapPin, Compass, Clock, Target, Flame, Eye, EyeOff, Gauge, Award, ChevronRight, ChevronLeft, Check, Layers, Phone, ArrowRight, ShieldCheck, ShieldAlert, AlertTriangle, MessageSquare, Repeat, UserCheck, UserPlus, CalendarRange, History } from 'lucide-react';
import { authService, produtosService, pedidosService, imagemService, visitasService, trocasService, clientesService, Produto, Pedido, Troca, Cliente, InteracaoCliente, ClienteRelatorio, utils, configService, PromoSchedule, HeroBannerConfig, HeroSlideConfig, DEFAULT_HERO_BANNER_CONFIG, ZonaId, ZONAS_DISPONIVEIS, normalizarTelefoneWhatsApp, formatarTelefoneExibicao } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { HeroBanner } from '@/components/HeroBanner';

/**
 * Página Admin - Gerenciamento Completo de Estoque + Promoções + Imagens + Pedidos + Trocas & Garantia + Relógio de Metas
 * Design: Cyberpunk Dark Mode com Neon Verde
 * Acesso: Protegido por autenticação Supabase
 */

interface EstoqueEditado {
  [key: string]: number | undefined;
}

interface FormProduto {
  marca: string;
  nome: string;
  preco: string;
  estoque: string;
  sabores: string;
  zonas: string[];
  is_promo: boolean;
  preco_promo: string;
}

export interface FormTroca {
  cliente_nome: string;
  cliente_telefone: string;
  data_troca: string;
  vape_defeito_selecionado: string;
  vape_defeito_custom: string;
  sabor_defeito: string;
  motivo: string;
  motivo_custom: string;
  motivo_detalhes: string;
  vape_trocado_selecionado: string;
  vape_trocado_custom: string;
  sabor_trocado: string;
  zona: string;
  abater_estoque: boolean;
  status: 'concluida' | 'pendente' | 'cancelada';
  observacoes: string;
}

export const MOTIVOS_TROCA_PADRAO = [
  'Gosto de queimado / Queimando na garganta',
  'Não liga / Bateria morta',
  'Vazamento de líquido',
  'Disparo contínuo / Sensor travado',
  'Não carrega / Entrada Tipo-C com defeito',
  'Sem puxada / Sem fluxo de vapor',
  'Sabor alterado / Gosto químico',
  'Veio sem lacre / Caixa danificada',
  'Outro motivo'
];

export const FORM_TROCA_PADRAO: FormTroca = {
  cliente_nome: '',
  cliente_telefone: '',
  data_troca: '',
  vape_defeito_selecionado: '',
  vape_defeito_custom: '',
  sabor_defeito: '',
  motivo: 'Gosto de queimado / Queimando na garganta',
  motivo_custom: '',
  motivo_detalhes: '',
  vape_trocado_selecionado: '',
  vape_trocado_custom: '',
  sabor_trocado: '',
  zona: 'norte',
  abater_estoque: true,
  status: 'concluida',
  observacoes: ''
};

export default function Admin() {
  const [autenticado, setAutenticado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosExcluidos, setPedidosExcluidos] = useState<Pedido[]>([]);
  const [metricasVisitas, setMetricasVisitas] = useState<{ data: string; acessos: number }[]>([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'7d' | '15d' | '30d' | '90d' | '180d' | 'tudo' | 'custom'>('7d');
  const [dataInicioMetricas, setDataInicioMetricas] = useState<string>('');
  const [dataFimMetricas, setDataFimMetricas] = useState<string>('');
  const [agrupamentoMetricas, setAgrupamentoMetricas] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [statusPedidoFiltro, setStatusPedidoFiltro] = useState<'todos' | 'concluidos'>('todos');
  const [abaAtiva, setAbaAtiva] = useState<'produtos' | 'relogio_mensal' | 'pedidos' | 'clientes' | 'trocas' | 'metricas' | 'saude' | 'configuracoes' | 'herobanner'>('produtos');
  const [subAbaEstoque, setSubAbaEstoque] = useState<'expressos' | 'promocional' | 'todos'>('expressos');
  const [filtroZonaEstoqueExpresso, setFiltroZonaEstoqueExpresso] = useState<'todas' | 'norte' | 'sul_oeste'>('todas');
  const [direcaoPuffs, setDirecaoPuffs] = useState<'asc' | 'desc'>('asc');
  const [pesquisa, setPesquisa] = useState('');
  const [filtroZonaProduto, setFiltroZonaProduto] = useState<string>('todas');
  const [filtroZonaPedido, setFiltroZonaPedido] = useState<string>('todas');

  // Estados para Gestão Única de Clientes & Relatórios WhatsApp
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [interacoesCliente, setInteracoesCliente] = useState<InteracaoCliente[]>([]);
  const [usandoFallbackClientes, setUsandoFallbackClientes] = useState(false);
  const [pesquisaCliente, setPesquisaCliente] = useState('');
  const [filtroPeriodoCliente, setFiltroPeriodoCliente] = useState<'tudo' | 'hoje' | '7d' | '30d' | 'mes_atual' | 'ano_atual' | '2026_2027' | 'custom'>('tudo');
  const [dataInicioCliente, setDataInicioCliente] = useState<string>('2026-09-01');
  const [dataFimCliente, setDataFimCliente] = useState<string>('2027-09-30');
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<'todos' | 'com_compras' | 'com_trocas' | 'recorrentes'>('todos');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modalClienteDetalhesAberto, setModalClienteDetalhesAberto] = useState(false);
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
  const [modalNovaInteracaoAberto, setModalNovaInteracaoAberto] = useState(false);
  const [formNovoCliente, setFormNovoCliente] = useState({
    nome: '',
    telefone: '',
    zona: 'norte',
    observacoes: ''
  });
  const [formNovaInteracao, setFormNovaInteracao] = useState<{
    tipo: 'contato_whatsapp' | 'pedido' | 'troca' | 'duvida' | 'outro';
    descricao: string;
    valor: string;
  }>({
    tipo: 'contato_whatsapp',
    descricao: '',
    valor: ''
  });
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [salvandoInteracao, setSalvandoInteracao] = useState(false);
  const [sincronizandoClientes, setSincronizandoClientes] = useState(false);

  // Estados para Trocas & Garantia
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [usandoFallbackTrocas, setUsandoFallbackTrocas] = useState(false);
  const [modalTrocaAberto, setModalTrocaAberto] = useState(false);
  const [editandoTrocaId, setEditandoTrocaId] = useState<string | null>(null);
  const [formTroca, setFormTroca] = useState<FormTroca>(FORM_TROCA_PADRAO);
  const [salvandoTroca, setSalvandoTroca] = useState(false);
  const [pesquisaTroca, setPesquisaTroca] = useState('');
  const [filtroMotivoTroca, setFiltroMotivoTroca] = useState('todos');
  const [filtroStatusTroca, setFiltroStatusTroca] = useState('todos');
  const [filtroPeriodoTroca, setFiltroPeriodoTroca] = useState<'todos' | 'hoje' | '7d' | '30d' | 'mes_atual'>('todos');

  // Estados para o Relógio Mensal / Metas
  const [mesRelogio, setMesRelogio] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [metaMensalValor, setMetaMensalValor] = useState<number>(() => {
    return Number(localStorage.getItem('hcvape_meta_mensal_valor') || '15000');
  });
  const [metaMensalQtd, setMetaMensalQtd] = useState<number>(() => {
    return Number(localStorage.getItem('hcvape_meta_mensal_qtd') || '200');
  });
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [tempMetaValor, setTempMetaValor] = useState('');
  const [tempMetaQtd, setTempMetaQtd] = useState('');

  // Estados para configuração do horário promocional
  const [promoConfig, setPromoConfig] = useState<PromoSchedule>({
    dias_semana: [1, 2, 3],
    hora_inicio: "09:00",
    hora_fim: "15:25"
  });
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [tabelaConfigNaoExiste, setTabelaConfigNaoExiste] = useState(false);

  // Estados para configuração do Hero Banner
  const [heroConfig, setHeroConfig] = useState<HeroBannerConfig>(DEFAULT_HERO_BANNER_CONFIG);
  const [salvandoHero, setSalvandoHero] = useState(false);

  // Separar e ordenar produtos: Marca (A-Z) e Puffs/modelo (crescente ou decrescente)
  const { produtosExpressosOrdenados, produtosPromocionaisOrdenados, produtosTodosOrdenados } = useMemo(() => {
    const expressos = produtos.filter(p => !p.is_promo);
    const promocionais = produtos.filter(p => p.is_promo);

    return {
      produtosExpressosOrdenados: utils.ordenarProdutosPorMarcaEPuffs(expressos, direcaoPuffs),
      produtosPromocionaisOrdenados: utils.ordenarProdutosPorMarcaEPuffs(promocionais, direcaoPuffs),
      produtosTodosOrdenados: utils.ordenarProdutosPorMarcaEPuffs(produtos, direcaoPuffs)
    };
  }, [produtos, direcaoPuffs]);

  // Lista de produtos Expressos filtrados por pesquisa e zona em tempo real
  const produtosExpressosFiltrados = useMemo(() => {
    let lista = produtosExpressosOrdenados;
    if (pesquisa.trim()) {
      const termo = utils.normalizarTexto(pesquisa);
      lista = lista.filter(p => {
        const nomeMatch = utils.normalizarTexto(p.nome).includes(termo);
        const marcaMatch = utils.normalizarTexto(p.marca).includes(termo);
        const saborMatch = p.sabores.some(s => utils.normalizarTexto(s).includes(termo));
        return nomeMatch || marcaMatch || saborMatch;
      });
    }
    if (filtroZonaEstoqueExpresso !== 'todas') {
      lista = lista.filter(p => {
        const info = utils.obterEstoqueProdutoPorZona(p, filtroZonaEstoqueExpresso as ZonaId);
        return info.possuiEstoqueNaZona;
      });
    }
    return lista;
  }, [produtosExpressosOrdenados, pesquisa, filtroZonaEstoqueExpresso]);

  // Lista de produtos Promocionais filtrados por pesquisa
  const produtosPromocionaisFiltrados = useMemo(() => {
    let lista = produtosPromocionaisOrdenados;
    if (pesquisa.trim()) {
      const termo = utils.normalizarTexto(pesquisa);
      lista = lista.filter(p => {
        const nomeMatch = utils.normalizarTexto(p.nome).includes(termo);
        const marcaMatch = utils.normalizarTexto(p.marca).includes(termo);
        const saborMatch = p.sabores.some(s => utils.normalizarTexto(s).includes(termo));
        return nomeMatch || marcaMatch || saborMatch;
      });
    }
    return lista;
  }, [produtosPromocionaisOrdenados, pesquisa]);

  // Filtrar produtos por termo de pesquisa e por zona (Visão Geral)
  const produtosFiltrados = useMemo(() => {
    let lista = produtosTodosOrdenados;
    if (pesquisa.trim()) {
      const termo = utils.normalizarTexto(pesquisa);
      lista = lista.filter(p => {
        const nomeMatch = utils.normalizarTexto(p.nome).includes(termo);
        const marcaMatch = utils.normalizarTexto(p.marca).includes(termo);
        const saborMatch = p.sabores.some(s => utils.normalizarTexto(s).includes(termo));
        return nomeMatch || marcaMatch || saborMatch;
      });
    }
    if (filtroZonaProduto !== 'todas') {
      lista = lista.filter(p => {
        const info = utils.obterEstoqueProdutoPorZona(p, filtroZonaProduto as ZonaId);
        return info.possuiEstoqueNaZona;
      });
    }
    return lista;
  }, [produtosTodosOrdenados, pesquisa, filtroZonaProduto]);

  // Alternar status ativo/inativo (visível/oculto) de um produto (especialmente promocional)
  const handleToggleAtivoProduto = async (produto: Produto) => {
    const novoStatus = produto.ativo === false ? true : false;
    try {
      // Optimistic UI update
      setProdutos(prev => prev.map(p => p.id === produto.id ? { ...p, ativo: novoStatus } : p));
      await produtosService.editar(produto.id, { ativo: novoStatus });
      setSucesso(`"${produto.nome}" agora está ${novoStatus ? 'ATIVO (visível para clientes)' : 'INATIVO (oculto no catálogo)'}!`);
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao alterar status de ativação do produto:', err);
      // Revert on error
      setProdutos(prev => prev.map(p => p.id === produto.id ? { ...p, ativo: !novoStatus } : p));
      setErro('Erro ao atualizar status de ativação no banco.');
    }
  };

  // Salvar metas personalizadas no localStorage
  const handleSalvarMetas = () => {
    const v = parseFloat(tempMetaValor);
    const q = parseInt(tempMetaQtd, 10);
    if (!isNaN(v) && v > 0) {
      setMetaMensalValor(v);
      localStorage.setItem('hcvape_meta_mensal_valor', String(v));
    }
    if (!isNaN(q) && q > 0) {
      setMetaMensalQtd(q);
      localStorage.setItem('hcvape_meta_mensal_qtd', String(q));
    }
    setEditandoMeta(false);
    setSucesso('Metas do mês atualizadas!');
    setTimeout(() => setSucesso(null), 3000);
  };

  // Cálculos completos do Relógio Mensal (1º ao último dia do mês)
  const relogioMensalData = useMemo(() => {
    const [anoStr, mesStr] = mesRelogio.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10) - 1; // 0-indexed

    const inicioMes = new Date(ano, mes, 1, 0, 0, 0, 0);
    const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();

    const hoje = new Date();
    const isMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mes;
    const diaAtual = isMesAtual ? hoje.getDate() : (hoje > fimMes ? diasNoMes : 1);
    const diasRestantes = isMesAtual ? Math.max(0, diasNoMes - diaAtual) : (hoje > fimMes ? 0 : diasNoMes);

    // Filtrar pedidos deste mês (excluídos ignorados)
    const pedidosDoMes = pedidos.filter(p => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);
      return d >= inicioMes && d <= fimMes;
    });

    let faturamentoTotal = 0;
    let quantidadeTotal = 0;
    let faturamentoExpresso = 0;
    let quantidadeExpresso = 0;
    let faturamentoPromo = 0;
    let quantidadePromo = 0;

    // Timeline de cada dia do mês (1 a diasNoMes)
    const diasTimeline: { dia: number; dataStr: string; faturamento: number; quantidade: number; expresso: number; promo: number; acumulado: number }[] = [];
    for (let d = 1; d <= diasNoMes; d++) {
      diasTimeline.push({
        dia: d,
        dataStr: `${String(d).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}`,
        faturamento: 0,
        quantidade: 0,
        expresso: 0,
        promo: 0,
        acumulado: 0
      });
    }

    const rankingProdutos: { [key: string]: { id: string; nome: string; marca: string; is_promo: boolean; quantidade: number; receita: number } } = {};

    pedidosDoMes.forEach(p => {
      const valorPedido = p.total_final;
      faturamentoTotal += valorPedido;

      const d = new Date(p.created_at!).getDate();
      const diaObj = diasTimeline[d - 1];

      if (p.itens && Array.isArray(p.itens)) {
        p.itens.forEach(item => {
          const qtd = item.quantidade || 1;
          const precoUnit = item.preco_unitario || 0;
          const itemTotal = precoUnit * qtd;
          quantidadeTotal += qtd;

          // Identificar se é promo ou expresso
          const isPromo = item.is_promo ?? produtos.find(prod => prod.id === item.id || prod.nome === item.nome)?.is_promo ?? false;

          if (isPromo) {
            faturamentoPromo += itemTotal;
            quantidadePromo += qtd;
            if (diaObj) diaObj.promo += itemTotal;
          } else {
            faturamentoExpresso += itemTotal;
            quantidadeExpresso += qtd;
            if (diaObj) diaObj.expresso += itemTotal;
          }

          if (diaObj) {
            diaObj.faturamento += itemTotal;
            diaObj.quantidade += qtd;
          }

          const chave = item.nome;
          if (!rankingProdutos[chave]) {
            rankingProdutos[chave] = {
              id: item.id,
              nome: item.nome,
              marca: item.marca || 'HC Vape',
              is_promo: isPromo,
              quantidade: 0,
              receita: 0
            };
          }
          rankingProdutos[chave].quantidade += qtd;
          rankingProdutos[chave].receita += itemTotal;
        });
      }
    });

    let acumuladoValor = 0;
    diasTimeline.forEach(d => {
      acumuladoValor += d.faturamento;
      d.acumulado = acumuladoValor;
    });

    const percentualValor = metaMensalValor > 0 ? (faturamentoTotal / metaMensalValor) * 100 : 0;
    const percentualQtd = metaMensalQtd > 0 ? (quantidadeTotal / metaMensalQtd) * 100 : 0;
    const valorFaltante = Math.max(0, metaMensalValor - faturamentoTotal);
    const qtdFaltante = Math.max(0, metaMensalQtd - quantidadeTotal);

    const ritmoDiarioAtual = diaAtual > 0 ? faturamentoTotal / diaAtual : 0;
    const metaDiariaNecessaria = diasRestantes > 0 ? valorFaltante / diasRestantes : 0;
    const projecaoFimMes = ritmoDiarioAtual * diasNoMes;

    const rankingOrdenado = Object.values(rankingProdutos).sort((a, b) => b.quantidade - a.quantidade);
    const ticketMedio = pedidosDoMes.length > 0 ? faturamentoTotal / pedidosDoMes.length : 0;

    const mesFormatado = inicioMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const mesFormatadoCapitalizado = mesFormatado.charAt(0).toUpperCase() + mesFormatado.slice(1);

    return {
      mesLabel: mesFormatadoCapitalizado,
      diasNoMes,
      diaAtual,
      diasRestantes,
      isMesAtual,
      totalPedidos: pedidosDoMes.length,
      faturamentoTotal,
      quantidadeTotal,
      faturamentoExpresso,
      quantidadeExpresso,
      faturamentoPromo,
      quantidadePromo,
      ticketMedio,
      percentualValor,
      percentualQtd,
      valorFaltante,
      qtdFaltante,
      ritmoDiarioAtual,
      metaDiariaNecessaria,
      projecaoFimMes,
      diasTimeline,
      rankingOrdenado,
      pedidosDoMes
    };
  }, [mesRelogio, pedidos, produtos, metaMensalValor, metaMensalQtd]);

  // Lógica de processamento de métricas ricas com preenchimento de gaps
  const { diasArray, dataAgrupada, resumoMetricas, topProdutosEmarcas } = useMemo(() => {
    let start: Date;
    let end: Date = new Date();
    end.setHours(23, 59, 59, 999);

    if (filtroPeriodo === '7d') {
      start = new Date();
      start.setDate(start.getDate() - 6);
    } else if (filtroPeriodo === '15d') {
      start = new Date();
      start.setDate(start.getDate() - 14);
    } else if (filtroPeriodo === '30d') {
      start = new Date();
      start.setDate(start.getDate() - 29);
    } else if (filtroPeriodo === '90d') {
      start = new Date();
      start.setDate(start.getDate() - 89);
    } else if (filtroPeriodo === '180d') {
      start = new Date();
      start.setDate(start.getDate() - 179);
    } else if (filtroPeriodo === 'tudo') {
      start = new Date('2024-01-01T00:00:00');
    } else {
      // custom
      start = dataInicioMetricas ? new Date(dataInicioMetricas + 'T00:00:00') : new Date();
      if (dataFimMetricas) {
        end = new Date(dataFimMetricas + 'T23:59:59');
      }
    }
    start.setHours(0, 0, 0, 0);

    // Evitar loops infinitos ou ranges absurdos
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const rangeLimite = Math.min(diffDays, 366); // limite de 1 ano

    const timeline: { key: string; dateObj: Date; visitas: number; vendas: number; faturamento: number; ticketMedio: number; conversao: number }[] = [];
    
    // Ajustar a data inicial no loop
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

    // 1. Mapear visitas
    const visitasMap: { [key: string]: number } = {};
    metricasVisitas.forEach(v => {
      visitasMap[v.data] = v.acessos;
    });

    // 2. Mapear pedidos
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

    // 3. Preencher a timeline
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

    // 4. Calcular Top Produtos, Marcas e Indicações
    const produtoQuantidades: { [key: string]: { nome: string; marca: string; quantidade: number; receita: number } } = {};
    const marcaQuantidades: { [key: string]: { marca: string; quantidade: number; receita: number } } = {};
    const indicacaoQuantidades: { [key: string]: { indicacao: string; pedidos: number; faturamento: number } } = {};

    const datasValidas = new Set(timeline.map(d => d.key));

    const pedidosNoPeriodo = pedidos.filter(p => {
      if (!p.created_at) return false;
      const dataStr = new Date(p.created_at).toLocaleDateString('pt-BR');
      const noPeriodo = datasValidas.has(dataStr);
      const statusOk = statusPedidoFiltro === 'concluidos' ? p.status_checklist : true;
      return noPeriodo && statusOk;
    });

    pedidosNoPeriodo.forEach(p => {
      const canal = (p.indicacao || 'Direto / Nenhuma').trim();
      if (!indicacaoQuantidades[canal]) {
        indicacaoQuantidades[canal] = { indicacao: canal, pedidos: 0, faturamento: 0 };
      }
      indicacaoQuantidades[canal].pedidos += 1;
      indicacaoQuantidades[canal].faturamento += p.total_final;

      p.itens.forEach(item => {
        const prodId = item.id;
        const produtoOriginal = produtos.find(prod => prod.id === prodId);
        const marca = (item.marca || produtoOriginal?.marca || 'Desconhecida').toUpperCase().trim();
        const nome = (item.nome || produtoOriginal?.nome || 'Produto').toUpperCase().trim();
        const chaveProduto = `${marca} - ${nome}`;

        if (!produtoQuantidades[chaveProduto]) {
          produtoQuantidades[chaveProduto] = { nome, marca, quantidade: 0, receita: 0 };
        }
        produtoQuantidades[chaveProduto].quantidade += item.quantidade;
        produtoQuantidades[chaveProduto].receita += item.preco_unitario * item.quantidade;

        if (!marcaQuantidades[marca]) {
          marcaQuantidades[marca] = { marca, quantidade: 0, receita: 0 };
        }
        marcaQuantidades[marca].quantidade += item.quantidade;
        marcaQuantidades[marca].receita += item.preco_unitario * item.quantidade;
      });
    });

    const topProdutos = Object.values(produtoQuantidades)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    const topMarcas = Object.values(marcaQuantidades)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    const topIndicacoes = Object.values(indicacaoQuantidades)
      .sort((a, b) => b.pedidos - a.pedidos);

    // 5. Agrupar dados do gráfico por semana/mês se necessário
    let graficoData = [];
    if (agrupamentoMetricas === 'semana') {
      const semanasMap: { [key: string]: { label: string; visitas: number; vendas: number; faturamento: number; dateRef: Date } } = {};
      timeline.forEach(d => {
        const sunday = new Date(d.dateObj);
        sunday.setDate(sunday.getDate() - sunday.getDay());
        const label = `Sem ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
        
        if (!semanasMap[label]) {
          semanasMap[label] = { label, visitas: 0, vendas: 0, faturamento: 0, dateRef: sunday };
        }
        semanasMap[label].visitas += d.visitas;
        semanasMap[label].vendas += d.vendas;
        semanasMap[label].faturamento += d.faturamento;
      });
      graficoData = Object.values(semanasMap)
        .sort((a, b) => a.dateRef.getTime() - b.dateRef.getTime())
        .map(w => ({
          data: w.label,
          visitas: w.visitas,
          vendas: w.vendas,
          faturamento: w.faturamento,
          ticketMedio: w.vendas > 0 ? w.faturamento / w.vendas : 0,
          conversao: w.visitas > 0 ? (w.vendas / w.visitas) * 100 : 0
        }));
    } else if (agrupamentoMetricas === 'mes') {
      const mesesMap: { [key: string]: { label: string; visitas: number; vendas: number; faturamento: number; dateRef: Date } } = {};
      timeline.forEach(d => {
        const keyMes = `${d.dateObj.getFullYear()}-${String(d.dateObj.getMonth() + 1).padStart(2, '0')}`;
        const label = d.dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
        
        if (!mesesMap[keyMes]) {
          mesesMap[keyMes] = { label, visitas: 0, vendas: 0, faturamento: 0, dateRef: new Date(d.dateObj.getFullYear(), d.dateObj.getMonth(), 1) };
        }
        mesesMap[keyMes].visitas += d.visitas;
        mesesMap[keyMes].vendas += d.vendas;
        mesesMap[keyMes].faturamento += d.faturamento;
      });
      graficoData = Object.values(mesesMap)
        .sort((a, b) => a.dateRef.getTime() - b.dateRef.getTime())
        .map(m => ({
          data: m.label,
          visitas: m.visitas,
          vendas: m.vendas,
          faturamento: m.faturamento,
          ticketMedio: m.vendas > 0 ? m.faturamento / m.vendas : 0,
          conversao: m.visitas > 0 ? (m.vendas / m.visitas) * 100 : 0
        }));
    } else {
      // dia
      graficoData = timeline.map(d => ({
        data: d.key,
        visitas: d.visitas,
        vendas: d.vendas,
        faturamento: d.faturamento,
        ticketMedio: d.ticketMedio,
        conversao: d.conversao
      }));
    }

    // 6. Resumo geral do período
    let totalVisitas = 0;
    let totalVendas = 0;
    let totalFaturamento = 0;
    timeline.forEach(d => {
      totalVisitas += d.visitas;
      totalVendas += d.vendas;
      totalFaturamento += d.faturamento;
    });
    const conversaoGeral = totalVisitas > 0 ? (totalVendas / totalVisitas) * 100 : 0;
    const ticketMedioGeral = totalVendas > 0 ? totalFaturamento / totalVendas : 0;

    return {
      diasArray: timeline,
      dataAgrupada: graficoData,
      resumoMetricas: {
        totalVisitas,
        totalVendas,
        totalFaturamento,
        conversaoGeral,
        ticketMedioGeral
      },
      topProdutosEmarcas: {
        topProdutos,
        topMarcas,
        topIndicacoes
      }
    };
  }, [metricasVisitas, pedidos, produtos, filtroPeriodo, dataInicioMetricas, dataFimMetricas, agrupamentoMetricas, statusPedidoFiltro]);

  const [subAbaPedidos, setSubAbaPedidos] = useState<'ativos' | 'excluidos'>('ativos');
  const [filtroData, setFiltroData] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [marcas, setMarcas] = useState<string[]>([]);
  const [estoqueEditado, setEstoqueEditado] = useState<EstoqueEditado>({});
  const [salvando, setSalvando] = useState(false);
  const [usuarioEmail, setUsuarioEmail] = useState<string>('');

  // Estados para financeiro (desconto)
  const [editandoFinanceiro, setEditandoFinanceiro] = useState<{ id: string; desconto: string } | null>(null);

  // Memo para pedidos filtrados por data e por zona
  const pedidosFiltrados = useMemo(() => {
    let lista = subAbaPedidos === 'ativos' ? pedidos : pedidosExcluidos;
    if (filtroData) {
      lista = lista.filter(p => {
        if (!p.created_at) return false;
        // Compara apenas a parte da data (YYYY-MM-DD) usando o horário local
        const dataPedido = new Date(p.created_at).toLocaleDateString('en-CA');
        return dataPedido === filtroData;
      });
    }
    if (filtroZonaPedido !== 'todas') {
      lista = lista.filter(p => (p.zona || '').toLowerCase().includes(filtroZonaPedido.toLowerCase()));
    }
    return lista;
  }, [pedidos, pedidosExcluidos, subAbaPedidos, filtroData, filtroZonaPedido]);

  // Estados para modal de criar/editar
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [marcaCustomizada, setMarcaCustomizada] = useState('');
  const [formProduto, setFormProduto] = useState<FormProduto>({
    marca: '',
    nome: '',
    preco: '',
    estoque: '',
    sabores: '',
    zonas: ['norte', 'sul_oeste'],
    is_promo: false,
    preco_promo: '',
  });
  const [formSaboresEstoque, setFormSaboresEstoque] = useState<{ sabor: string; estoque: number }[]>([]);

  // Estados para imagem
  const [imagemArquivo, setImagemArquivo] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemUrlAtual, setImagemUrlAtual] = useState<string | null>(null);
  const [removerImagem, setRemoverImagem] = useState(false);
  const [uploadandoImagem, setUploadandoImagem] = useState(false);
  const inputImagemRef = useRef<HTMLInputElement>(null);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const verificarAuth = async () => {
      try {
        const user = await authService.obterUsuarioAtual();
        if (user) {
          setAutenticado(true);
          setUsuarioEmail(user.email || '');
          await carregarTudo();
        }
      } catch (err) {
        console.error('Erro ao verificar autenticação:', err);
      } finally {
        setCarregando(false);
      }
    };

    verificarAuth();
  }, []);

  // Carregar todos os dados
  const carregarTudo = async () => {
    try {
      setErro(null);
      const [produtosData, pedidosData, pedidosExcluidosData, marcasData, metricasData, configData, heroData, trocasData, clientesData, interacoesData] = await Promise.all([
        produtosService.obterTodos(),
        pedidosService.obterTodos(),
        pedidosService.obterExcluidos(),
        utils.obterMarcas(),
        visitasService.obterMetricas(365),
        configService.obterPromoSchedule().catch(err => {
          console.warn('Erro ao obter promo schedule no carregarTudo (tabela configuracoes pode não existir):', err);
          setTabelaConfigNaoExiste(true);
          return {
            dias_semana: [1, 2, 3],
            hora_inicio: "09:00",
            hora_fim: "15:25"
          };
        }),
        configService.obterHeroBannerConfig().catch(err => {
          console.warn('Erro ao obter hero banner config:', err);
          return DEFAULT_HERO_BANNER_CONFIG;
        }),
        trocasService.obterTodas().catch(err => {
          console.warn('Erro ao obter trocas no carregarTudo:', err);
          return { trocas: [], usandoFallback: true };
        }),
        clientesService.obterTodos().catch(err => {
          console.warn('Erro ao obter clientes no carregarTudo:', err);
          return { clientes: [], usandoFallback: true };
        }),
        clientesService.obterInteracoes().catch(err => {
          console.warn('Erro ao obter interações no carregarTudo:', err);
          return { interacoes: [], usandoFallback: true };
        })
      ]);
      setProdutos(produtosData);
      setPedidos(pedidosData);
      setPedidosExcluidos(pedidosExcluidosData);
      setMarcas(marcasData);
      setMetricasVisitas(metricasData);
      setPromoConfig(configData);
      setHeroConfig(heroData);
      setTrocas(trocasData.trocas);
      setUsandoFallbackTrocas(trocasData.usandoFallback);
      setClientes(clientesData.clientes);
      setUsandoFallbackClientes(clientesData.usandoFallback);
      setInteracoesCliente(interacoesData.interacoes);
      setEstoqueEditado({});
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setErro('Erro ao carregar dados do sistema');
    }
  };

  // Carregar produtos
  const carregarProdutos = async () => {
    try {
      const dados = await produtosService.obterTodos();
      setProdutos(dados);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  };

  // Carregar marcas
  const carregarMarcas = async () => {
    try {
      const marcasData = await utils.obterMarcas();
      setMarcas(marcasData);
    } catch (err) {
      console.error('Erro ao carregar marcas:', err);
    }
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!email || !senha) {
      setErro('Preencha email e senha');
      return;
    }

    try {
      setSalvando(true);
      await authService.login(email, senha);
      setAutenticado(true);
      setUsuarioEmail(email);
      setEmail('');
      setSenha('');
      await carregarTudo();
      setSucesso('Login realizado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      setErro(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setSalvando(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await authService.logout();
      setAutenticado(false);
      setUsuarioEmail('');
      setProdutos([]);
      setPedidos([]);
      setPedidosExcluidos([]);
      setMarcas([]);
      setClientes([]);
      setInteracoesCliente([]);
      setClienteSelecionado(null);
      setEstoqueEditado({});
      setErro(null);
      setSucesso(null);
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
      setErro('Erro ao fazer logout');
    }
  };

  // Abrir modal para novo produto
  const abrirModalNovo = () => {
    setEditandoId(null);
    setMarcaCustomizada('');
    setFormProduto({
      marca: '',
      nome: '',
      preco: '',
      estoque: '',
      sabores: '',
      zonas: ['norte', 'sul_oeste'],
      is_promo: subAbaEstoque === 'promocional',
      preco_promo: '',
    });
    setFormSaboresEstoque([{ sabor: '', estoque: 10 }]);
    setImagemArquivo(null);
    setImagemPreview(null);
    setImagemUrlAtual(null);
    setRemoverImagem(false);
    setModalAberto(true);
  };

  // Abrir modal para editar produto
  const abrirModalEditar = (produto: Produto) => {
    setEditandoId(produto.id);
    setMarcaCustomizada('');
    setFormProduto({
      marca: produto.marca,
      nome: produto.nome,
      preco: produto.preco.toString(),
      estoque: produto.estoque.toString(),
      sabores: produto.sabores.join(', '),
      zonas: produto.zonas && produto.zonas.length > 0 ? produto.zonas : ['norte', 'sul_oeste'],
      is_promo: produto.is_promo || false,
      preco_promo: produto.preco_promo?.toString() || '',
    });
    
    if (produto.sabores_estoque) {
      const items = Object.entries(produto.sabores_estoque).map(([sabor, est]) => ({
        sabor,
        estoque: est || 0
      }));
      setFormSaboresEstoque(items.length > 0 ? items : [{ sabor: '', estoque: 0 }]);
    } else {
      const items = produto.sabores.map((sabor, index) => ({
        sabor,
        estoque: index === 0 ? produto.estoque : 0
      }));
      setFormSaboresEstoque(items.length > 0 ? items : [{ sabor: '', estoque: 0 }]);
    }

    setImagemArquivo(null);
    setImagemPreview(null);
    setImagemUrlAtual(produto.imagem_url || null);
    setRemoverImagem(false);
    setModalAberto(true);
  };

  // Fechar modal
  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
    setMarcaCustomizada('');
    setFormProduto({
      marca: '',
      nome: '',
      preco: '',
      estoque: '',
      sabores: '',
      zonas: ['norte', 'sul_oeste'],
      is_promo: false,
      preco_promo: '',
    });
    setFormSaboresEstoque([]);
    setImagemArquivo(null);
    setImagemPreview(null);
    setImagemUrlAtual(null);
    setRemoverImagem(false);
  };

  // Selecionar imagem
  const handleSelecionarImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem válido (JPG, PNG, WebP, etc.)');
      return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
      setErro('A imagem deve ter no máximo 5MB');
      return;
    }

    setImagemArquivo(arquivo);
    setRemoverImagem(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagemPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(arquivo);
  };

  // Remover imagem selecionada/atual
  const handleRemoverImagem = () => {
    setImagemArquivo(null);
    setImagemPreview(null);
    setRemoverImagem(true);
    if (inputImagemRef.current) {
      inputImagemRef.current.value = '';
    }
  };

  // Salvar produto (criar ou editar)
  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const marcaFinal = marcaCustomizada || formProduto.marca;

    if (!marcaFinal || !formProduto.nome || !formProduto.preco) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }

    const preco = parseFloat(formProduto.preco);
    if (isNaN(preco) || preco <= 0) {
      setErro('Preço deve ser um número positivo');
      return;
    }

    const saboresFiltrados = formSaboresEstoque.filter(item => item.sabor.trim() !== '');
    if (saboresFiltrados.length === 0) {
      setErro('Adicione pelo menos um sabor com estoque');
      return;
    }

    const saboresUnicos = new Set(saboresFiltrados.map(item => item.sabor.toLowerCase().trim()));
    if (saboresUnicos.size !== saboresFiltrados.length) {
      setErro('Existem sabores duplicados');
      return;
    }

    const saboresEstoqueObj: { [sabor: string]: number } = {};
    saboresFiltrados.forEach(item => {
      saboresEstoqueObj[item.sabor.trim()] = formProduto.is_promo ? 999 : Math.max(0, item.estoque);
    });

    const estoque = formProduto.is_promo
      ? 999
      : Object.values(saboresEstoqueObj).reduce((a, b) => a + b, 0);
    const sabores = Object.keys(saboresEstoqueObj);

    let precoPromo: number | null = null;
    if (formProduto.is_promo) {
      if (!formProduto.preco_promo) {
        setErro('Defina o preço promocional');
        return;
      }
      precoPromo = parseFloat(formProduto.preco_promo);
      if (isNaN(precoPromo) || precoPromo <= 0) {
        setErro('Preço promocional deve ser um número positivo');
        return;
      }
      if (precoPromo >= preco) {
        setErro('Preço promocional deve ser menor que o preço original');
        return;
      }
    }

    const zonasSelecionadas = formProduto.zonas && formProduto.zonas.length > 0
      ? formProduto.zonas
      : ['norte', 'sul', 'oeste'];

    try {
      setSalvando(true);

      let imagemUrl: string | null | undefined = undefined;

      if (editandoId) {
        // --- EDITAR ---
        if (imagemArquivo) {
          setUploadandoImagem(true);
          imagemUrl = await imagemService.substituir(imagemArquivo, editandoId, imagemUrlAtual);
          setUploadandoImagem(false);
        } else if (removerImagem && imagemUrlAtual) {
          const caminho = imagemService.extrairCaminhoDoUrl(imagemUrlAtual);
          if (caminho) {
            try {
              await imagemService.deletar(caminho);
            } catch {
              console.warn('Não foi possível deletar imagem');
            }
          }
          imagemUrl = null;
        }

        const updates: any = {
          marca: marcaFinal,
          nome: formProduto.nome,
          preco,
          estoque,
          sabores,
          sabores_estoque: saboresEstoqueObj,
          zonas: zonasSelecionadas,
          is_promo: formProduto.is_promo,
          preco_promo: precoPromo || null,
        };

        if (imagemUrl !== undefined) {
          updates.imagem_url = imagemUrl;
        }

        await produtosService.editar(editandoId, updates);
        setSucesso('Produto atualizado com sucesso!');
      } else {
        // --- CRIAR ---
        const novoProduto = await produtosService.criar({
          marca: marcaFinal,
          nome: formProduto.nome,
          preco,
          estoque,
          sabores,
          sabores_estoque: saboresEstoqueObj,
          zonas: zonasSelecionadas,
          is_promo: formProduto.is_promo,
          preco_promo: precoPromo || undefined,
          imagem_url: null,
        });

        if (imagemArquivo) {
          setUploadandoImagem(true);
          try {
            const url = await imagemService.upload(imagemArquivo, novoProduto.id);
            await produtosService.editar(novoProduto.id, { imagem_url: url });
          } catch (imgErr) {
            console.error('Erro ao fazer upload da imagem:', imgErr);
            setErro('Produto criado, mas houve erro ao enviar a imagem. Edite o produto para adicionar a imagem.');
          } finally {
            setUploadandoImagem(false);
          }
        }

        setSucesso('Produto criado com sucesso!');
      }

      await carregarProdutos();
      await carregarMarcas();
      fecharModal();
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar produto:', err);
      setErro(err.message || 'Erro ao salvar produto');
      setUploadandoImagem(false);
    } finally {
      setSalvando(false);
    }
  };

  // Salvar configurações da promoção
  const handleSalvarConfiguracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setSalvandoConfig(true);
    try {
      await configService.salvarPromoSchedule(promoConfig);
      setSucesso('Configurações da promoção atualizadas com sucesso!');
      setTabelaConfigNaoExiste(false);
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      if (err.code === '42P01' || err.message?.includes('relation "configuracoes" does not exist')) {
        setTabelaConfigNaoExiste(true);
        setErro('A tabela "configuracoes" não existe no banco de dados. Veja as instruções na aba de Configurações.');
      } else {
        setErro(err.message || 'Erro ao salvar configurações da promoção.');
      }
    } finally {
      setSalvandoConfig(false);
    }
  };

  // Salvar configurações do Hero Banner
  const handleSalvarHeroConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setSalvandoHero(true);
    try {
      await configService.salvarHeroBannerConfig(heroConfig);
      setSucesso('Hero Banner atualizado com sucesso!');
      setTabelaConfigNaoExiste(false);
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar Hero Banner:', err);
      if (err.code === '42P01' || err.message?.includes('relation "configuracoes" does not exist')) {
        setTabelaConfigNaoExiste(true);
        setErro('A tabela "configuracoes" não existe no banco de dados. Crie a tabela primeiro.');
      } else {
        setErro(err.message || 'Erro ao salvar Hero Banner.');
      }
    } finally {
      setSalvandoHero(false);
    }
  };

  const handleAtualizarSlide = (index: number, updates: Partial<HeroSlideConfig>) => {
    const novosSlides = [...heroConfig.slides];
    novosSlides[index] = { ...novosSlides[index], ...updates };
    setHeroConfig({ ...heroConfig, slides: novosSlides });
  };

  const handleAdicionarSlide = () => {
    const novoSlide: HeroSlideConfig = {
      id: `slide_${Date.now()}`,
      ativo: true,
      badge: {
        texto: "NOVO DESTAQUE",
        cor: "green",
        aoVivoBadge: false,
      },
      titulo: "Novo Título",
      tituloDestaque: "Subtítulo Neon",
      descricao: "Descrição do novo slide do Hero Banner.",
      tipoDestaque: "produto_especifico",
      botaoTexto: "Ver Ofertas",
      botaoAcao: "expressos"
    };
    setHeroConfig({ ...heroConfig, slides: [...heroConfig.slides, novoSlide] });
  };

  const handleRemoverSlide = (index: number) => {
    if (heroConfig.slides.length <= 1) {
      alert("Você precisa ter pelo menos um slide no Hero Banner.");
      return;
    }
    const novosSlides = heroConfig.slides.filter((_, i) => i !== index);
    setHeroConfig({ ...heroConfig, slides: novosSlides });
  };

  const handleMoverSlide = (index: number, direcao: 'up' | 'down') => {
    const novosSlides = [...heroConfig.slides];
    const targetIndex = direcao === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= novosSlides.length) return;
    const temp = novosSlides[index];
    novosSlides[index] = novosSlides[targetIndex];
    novosSlides[targetIndex] = temp;
    setHeroConfig({ ...heroConfig, slides: novosSlides });
  };

  // Deletar produto
  const handleDeletarProduto = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja deletar "${nome}"?`)) {
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await produtosService.deletar(id);
      setSucesso('Produto deletado com sucesso!');
      await carregarProdutos();
      await carregarMarcas();
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao deletar produto:', err);
      setErro('Erro ao deletar produto');
    } finally {
      setSalvando(false);
    }
  };

  // Atualizar estoque
  const handleAtualizarEstoque = async (id: string) => {
    const novoEstoque = estoqueEditado[id];

    if (novoEstoque === undefined || novoEstoque === null) {
      setErro('Valor de estoque inválido');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);

      const produto = produtos.find(p => p.id === id);
      if (!produto) return;

      // Se o produto tiver apenas um sabor ou nenhum, podemos atualizar inline
      if (produto.sabores.length <= 1) {
        const saborUnico = produto.sabores[0] || 'Original';
        const novosSaboresEstoque = { [saborUnico]: novoEstoque };
        
        await produtosService.atualizarEstoqueSabores(id, novosSaboresEstoque, novoEstoque);

        setProdutos(produtos.map(p =>
          p.id === id ? { ...p, estoque: novoEstoque, sabores_estoque: novosSaboresEstoque } : p
        ));
      } else {
        // Se tiver múltiplos sabores, atualiza o total geral (embora a UI bloqueie isso)
        await produtosService.atualizarEstoque(id, novoEstoque);
        setProdutos(produtos.map(p =>
          p.id === id ? { ...p, estoque: novoEstoque } : p
        ));
      }

      setEstoqueEditado({ ...estoqueEditado, [id]: undefined });
      setSucesso('Estoque atualizado com sucesso!');

      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar estoque:', err);
      setErro('Erro ao atualizar estoque');
    } finally {
      setSalvando(false);
    }
  };

  // --- LÓGICA DE PEDIDOS ---

  const handleAtualizarStatusPedido = async (id: string, status: boolean) => {
    try {
      setSalvando(true);
      
      const pedido = pedidos.find(p => p.id === id);
      if (!pedido) return;

      // Se o status não mudou, não faz nada (evita cliques duplos)
      if (pedido.status_checklist === status) return;

      // 1. Atualizar o status do pedido no banco
      await pedidosService.atualizarStatus(id, status);

      // 2. Lógica de Estoque: Baixa ou Reposição
      // Buscamos os produtos atuais para garantir valores reais
      const produtosAtuais = await produtosService.obterTodos();
      
      const promessasEstoque = pedido.itens.map(async (item) => {
        const produto = produtosAtuais.find(p => p.id === item.id);
        
        if (produto) {
          const fator = status ? -1 : 1;
          const saboresEstoque = produto.sabores_estoque ? { ...produto.sabores_estoque } : {};
          
          // Se o sabor comprado não existe mapeado no JSON, inicializamos
          if (saboresEstoque[item.sabor] === undefined) {
            produto.sabores.forEach(s => {
              saboresEstoque[s] = s.toLowerCase() === item.sabor.toLowerCase() ? produto.estoque : 0;
            });
          }
          
          const estoqueAtualSabor = saboresEstoque[item.sabor] || 0;
          saboresEstoque[item.sabor] = Math.max(0, estoqueAtualSabor + (item.quantidade * fator));
          
          const novoEstoqueTotal = Object.values(saboresEstoque).reduce((a, b) => a + b, 0);
          
          await produtosService.atualizarEstoqueSabores(item.id, saboresEstoque, novoEstoqueTotal);
          return { id: item.id, estoque: novoEstoqueTotal, sabores_estoque: saboresEstoque };
        }
        return null;
      });

      const resultadosEstoque = await Promise.all(promessasEstoque);
      
      // 3. Atualizar estados locais para refletir a mudança imediatamente
      const novosProdutos = [...produtos];
      resultadosEstoque.forEach(res => {
        if (res) {
          const index = novosProdutos.findIndex(p => p.id === res.id);
          if (index !== -1) {
            novosProdutos[index].estoque = res.estoque;
            novosProdutos[index].sabores_estoque = res.sabores_estoque;
          }
        }
      });
      setProdutos(novosProdutos);

      setPedidos(pedidos.map(p => p.id === id ? { ...p, status_checklist: status } : p));
      setSucesso(status ? 'Checklist concluído e estoque baixado!' : 'Pedido reaberto e estoque reposto!');
      
      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err);
      setErro('Erro ao atualizar status do pedido e estoque');
    } finally {
      setSalvando(false);
    }
  };

  const handleAtualizarFinanceiroPedido = async (id: string) => {
    const editando = editandoFinanceiro;
    if (!editando || editando.id !== id) return;

    const desconto = parseFloat(editando.desconto) || 0;
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) return;

    const totalFinal = pedido.total - desconto;

    try {
      setSalvando(true);
      await pedidosService.atualizarFinanceiro(id, desconto, totalFinal);
      setPedidos(pedidos.map(p => p.id === id ? { ...p, desconto, total_final: totalFinal } : p));
      setEditandoFinanceiro(null);
      setSucesso('Financeiro do pedido atualizado!');
      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar financeiro do pedido:', err);
      setErro('Erro ao atualizar financeiro');
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletarPedido = async (id: string, numero: number) => {
    if (!window.confirm(`Tem certeza que deseja deletar o pedido #${numero}?`)) {
      return;
    }

    try {
      setSalvando(true);
      await pedidosService.deletar(id);
      setPedidos(pedidos.filter(p => p.id !== id));
      setSucesso('Pedido deletado com sucesso!');
      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao deletar pedido:', err);
      setErro('Erro ao deletar pedido');
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurarPedido = async (id: string, numero: number) => {
    try {
      setSalvando(true);
      await pedidosService.restaurar(id);
      
      // Mover o pedido da lista de excluídos para a lista de ativos
      const pedidoRestaurado = pedidosExcluidos.find(p => p.id === id);
      if (pedidoRestaurado) {
        setPedidos([...pedidos, { ...pedidoRestaurado, excluido: false }]);
        setPedidosExcluidos(pedidosExcluidos.filter(p => p.id !== id));
      }
      
      setSucesso(`Pedido #${numero} restaurado com sucesso!`);
      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao restaurar pedido:', err);
      setErro('Erro ao restaurar pedido');
    } finally {
      setSalvando(false);
    }
  };

  const handleExportarProdutos = () => {
    if (produtos.length === 0) {
      alert('Nenhum produto para exportar');
      return;
    }

    // CABEÇALHOS RIGOROSOS PARA IMPORTAÇÃO SQL
    const headers = ['MARCA', 'PUXADAS', 'SABOR', 'QUANTIDADE', 'VL. PRODUTO', 'DESCONTO', 'VL. FINAL', 'VL. TOT. VENDA'];
    
    const rows: any[] = [];
    let totalGeralEstoque = 0;

    produtos.forEach(p => {
      const marcaLimpa = p.marca.toUpperCase().trim();
      // Limpeza agressiva do nome para remover termos de marketing
      const nomeOriginal = p.nome
        .replace(/⚡/g, '')
        .replace(/PROMOÇÃO/gi, '')
        .replace(/PROMO/gi, '')
        .trim();
      
      // Preparar nome para processamento (remover a marca do início para não confundir)
      let nomeBase = nomeOriginal.toUpperCase().replace(marcaLimpa, '').trim();
      
      // 1. EXTRAÇÃO DE PUXADAS (Número bruto)
      const nomeSemPontos = nomeBase.replace(/\./g, '');
      const matchNumeros = nomeSemPontos.match(/(\d+)/g);
      let puxadasBrutas = 0;
      
      if (matchNumeros) {
        // Pega o maior número (puxadas)
        puxadasBrutas = Math.max(...matchNumeros.map(n => parseInt(n)));
        // Se tiver "K" e for número baixo (ex: 30K), converte para milhar
        if (nomeSemPontos.includes('K') && puxadasBrutas < 1000) {
          puxadasBrutas *= 1000;
        }
      }

      // 2. CÁLCULOS FINANCEIROS
      const vlProduto = p.preco || 0;
      const desconto = 0;
      const vlFinal = vlProduto - desconto;
      const quantidade = p.estoque > 0 ? p.estoque : 20;
      const vlTotVenda = quantidade * vlProduto;

      // 3. EXTRAÇÃO DE SABOR (Pós hífen ou lista)
      let saboresParaExportar = p.sabores.length > 0 ? [...p.sabores] : [];
      
      // Se o nome tem hífen, o que vem depois é sabor
      if (nomeOriginal.includes('-')) {
        const saborExtraido = nomeOriginal.split('-')[1].trim();
        if (saborExtraido && !saboresParaExportar.some(s => s.toUpperCase() === saborExtraido.toUpperCase())) {
          saboresParaExportar = [saborExtraido]; // Prioriza o sabor específico do nome
        }
      }
      
      if (saboresParaExportar.length === 0) saboresParaExportar = ['ORIGINAL'];

      saboresParaExportar.forEach(sabor => {
        totalGeralEstoque += quantidade;
        rows.push([
          marcaLimpa,
          puxadasBrutas,
          sabor.trim().toUpperCase(),
          quantidade,
          vlProduto.toFixed(2).replace('.', ','),
          desconto.toFixed(2).replace('.', ','),
          vlFinal.toFixed(2).replace('.', ','),
          vlTotVenda.toFixed(2).replace('.', ',')
        ]);
      });
    });

    // Adicionar linha de Total Geral ao fim
    rows.push(['', '', '', '', '', '', '', '']); // Linha em branco para separar
    rows.push(['TOTAL GERAL', '', '', totalGeralEstoque, '', '', '', '']);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `estoque_hc_sql_import_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportarPedidos = () => {
    const pedidosParaExportar = subAbaPedidos === 'ativos' ? pedidos : pedidosExcluidos;
    
    if (pedidosParaExportar.length === 0) {
      alert('Nenhum pedido para exportar nesta aba');
      return;
    }

    // Simplificando relatório de vendas: removendo modelos e puxadas
    const headers = ['DATA', 'PEDIDO #', 'CLIENTE', 'WHATSAPP', 'INDICAÇÃO', 'ITENS', 'QTD TOTAL', 'DESCONTO', 'VALOR TOTAL', 'STATUS'];
    
    const rows: any[] = [];
    pedidosParaExportar.forEach(p => {
      const data = p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-';
      
      const itensFormatados = p.itens.map(item => {
        const produtoOriginal = produtos.find(prod => prod.id === item.id);
        const marca = item.marca || (produtoOriginal ? produtoOriginal.marca : 'N/A');
        const nome = item.nome || (produtoOriginal ? produtoOriginal.nome : 'PRODUTO');
        return `${item.quantidade}x ${marca.toUpperCase()} ${nome.toUpperCase()} (${item.sabor.toUpperCase()})`;
      }).join(' | ');

      const qtdTotal = p.itens.reduce((acc, item) => acc + item.quantidade, 0);

      rows.push([
        data,
        p.numero_pedido,
        p.nome_cliente.toUpperCase(),
        p.telefone_cliente,
        (p.indicacao || 'NENHUMA').toUpperCase(),
        itensFormatados,
        qtdTotal,
        p.desconto.toFixed(2).replace('.', ','),
        p.total_final.toFixed(2).replace('.', ','),
        p.status_checklist ? 'CONCLUIDO' : 'PENDENTE'
      ]);
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const prefixo = subAbaPedidos === 'ativos' ? 'vendas' : 'lixeira';
    link.setAttribute('download', `${prefixo}_hc_sql_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Lista de trocas filtradas por pesquisa, motivo, status e período
  const trocasFiltradas = useMemo(() => {
    return trocas.filter(t => {
      // 1. Pesquisa por texto
      if (pesquisaTroca.trim()) {
        const termo = utils.normalizarTexto(pesquisaTroca);
        const clienteMatch = utils.normalizarTexto(t.cliente_nome).includes(termo);
        const telMatch = (t.cliente_telefone || '').includes(termo);
        const defeitoMatch = utils.normalizarTexto(t.vape_defeito).includes(termo);
        const trocadoMatch = utils.normalizarTexto(t.vape_trocado).includes(termo);
        const saborDefeitoMatch = utils.normalizarTexto(t.sabor_defeito || '').includes(termo);
        const saborTrocadoMatch = utils.normalizarTexto(t.sabor_trocado || '').includes(termo);
        const motivoMatch = utils.normalizarTexto(t.motivo).includes(termo);
        const obsMatch = utils.normalizarTexto(t.observacoes || '').includes(termo);
        if (!clienteMatch && !telMatch && !defeitoMatch && !trocadoMatch && !saborDefeitoMatch && !saborTrocadoMatch && !motivoMatch && !obsMatch) {
          return false;
        }
      }

      // 2. Filtro por motivo
      if (filtroMotivoTroca !== 'todos') {
        if (filtroMotivoTroca === 'outros') {
          const ePadrao = MOTIVOS_TROCA_PADRAO.slice(0, -1).some(m => t.motivo.toLowerCase().includes(m.toLowerCase()));
          if (ePadrao) return false;
        } else {
          if (!t.motivo.toLowerCase().includes(filtroMotivoTroca.toLowerCase())) {
            return false;
          }
        }
      }

      // 3. Filtro por status
      if (filtroStatusTroca !== 'todos') {
        if ((t.status || 'concluida') !== filtroStatusTroca) {
          return false;
        }
      }

      // 4. Filtro por período
      if (filtroPeriodoTroca !== 'todos') {
        const dTroca = new Date(t.data_troca);
        const agora = new Date();
        if (filtroPeriodoTroca === 'hoje') {
          if (dTroca.toDateString() !== agora.toDateString()) return false;
        } else if (filtroPeriodoTroca === '7d') {
          const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (dTroca < seteDiasAtras) return false;
        } else if (filtroPeriodoTroca === '30d') {
          const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (dTroca < trintaDiasAtras) return false;
        } else if (filtroPeriodoTroca === 'mes_atual') {
          if (dTroca.getMonth() !== agora.getMonth() || dTroca.getFullYear() !== agora.getFullYear()) return false;
        }
      }

      return true;
    });
  }, [trocas, pesquisaTroca, filtroMotivoTroca, filtroStatusTroca, filtroPeriodoTroca]);

  // Estatísticas e métricas do módulo de trocas
  const estatisticasTrocas = useMemo(() => {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    let trocasNoMes = 0;
    const contagemVapesDefeito: { [vape: string]: number } = {};
    const contagemMotivos: { [motivo: string]: number } = {};

    trocas.forEach(t => {
      const d = new Date(t.data_troca);
      if (d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
        trocasNoMes++;
      }

      const vapeLimpo = (t.vape_defeito || '').trim();
      if (vapeLimpo) {
        contagemVapesDefeito[vapeLimpo] = (contagemVapesDefeito[vapeLimpo] || 0) + 1;
      }

      const mot = (t.motivo || '').trim();
      if (mot) {
        contagemMotivos[mot] = (contagemMotivos[mot] || 0) + 1;
      }
    });

    let topVape = 'Nenhum';
    let topVapeQtd = 0;
    Object.entries(contagemVapesDefeito).forEach(([vape, qtd]) => {
      if (qtd > topVapeQtd) {
        topVape = vape;
        topVapeQtd = qtd;
      }
    });

    let topMotivo = 'Nenhum';
    let topMotivoQtd = 0;
    Object.entries(contagemMotivos).forEach(([motivo, qtd]) => {
      if (qtd > topMotivoQtd) {
        topMotivo = motivo;
        topMotivoQtd = qtd;
      }
    });

    return {
      total: trocas.length,
      noMes: trocasNoMes,
      topVape,
      topVapeQtd,
      topMotivo,
      topMotivoQtd
    };
  }, [trocas]);

  // Abrir modal para nova troca
  const abrirModalNovaTroca = () => {
    setEditandoTrocaId(null);
    setFormTroca({
      ...FORM_TROCA_PADRAO,
      data_troca: new Date().toISOString().slice(0, 16)
    });
    setModalTrocaAberto(true);
  };

  // Abrir modal para editar troca existente
  const abrirModalEditarTroca = (troca: Troca) => {
    setEditandoTrocaId(troca.id);
    
    // Identificar correspondência no catálogo
    const matchDefeito = produtos.find(p => 
      `${p.marca} ${p.nome}`.toLowerCase() === troca.vape_defeito.toLowerCase() || 
      p.nome.toLowerCase() === troca.vape_defeito.toLowerCase()
    );
    const matchTrocado = produtos.find(p => 
      p.id === troca.produto_trocado_id || 
      `${p.marca} ${p.nome}`.toLowerCase() === troca.vape_trocado.toLowerCase() || 
      p.nome.toLowerCase() === troca.vape_trocado.toLowerCase()
    );

    let dataFormatada = troca.data_troca;
    try {
      dataFormatada = new Date(troca.data_troca).toISOString().slice(0, 16);
    } catch {}

    const ehMotivoPadrao = MOTIVOS_TROCA_PADRAO.includes(troca.motivo);

    setFormTroca({
      cliente_nome: troca.cliente_nome,
      cliente_telefone: troca.cliente_telefone || '',
      data_troca: dataFormatada,
      vape_defeito_selecionado: matchDefeito ? matchDefeito.id : (troca.vape_defeito ? 'custom' : ''),
      vape_defeito_custom: matchDefeito ? '' : troca.vape_defeito,
      sabor_defeito: troca.sabor_defeito || '',
      motivo: ehMotivoPadrao ? troca.motivo : 'Outro motivo',
      motivo_custom: ehMotivoPadrao ? '' : troca.motivo,
      motivo_detalhes: troca.motivo_detalhes || '',
      vape_trocado_selecionado: matchTrocado ? matchTrocado.id : (troca.vape_trocado ? 'custom' : ''),
      vape_trocado_custom: matchTrocado ? '' : troca.vape_trocado,
      sabor_trocado: troca.sabor_trocado || '',
      zona: troca.zona || 'norte',
      abater_estoque: false, // Ao editar, default false
      status: troca.status || 'concluida',
      observacoes: troca.observacoes || ''
    });
    setModalTrocaAberto(true);
  };

  // Fechar modal de troca
  const fecharModalTroca = () => {
    setModalTrocaAberto(false);
    setEditandoTrocaId(null);
  };

  // Salvar registro de troca (criar ou editar)
  const handleSalvarTroca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTroca.cliente_nome.trim()) {
      setErro('Informe o nome do cliente');
      return;
    }

    // Vape com defeito
    let nomeVapeDefeito = '';
    if (formTroca.vape_defeito_selecionado === 'custom') {
      nomeVapeDefeito = formTroca.vape_defeito_custom.trim();
    } else if (formTroca.vape_defeito_selecionado) {
      const p = produtos.find(prod => prod.id === formTroca.vape_defeito_selecionado);
      nomeVapeDefeito = p ? `${p.marca} ${p.nome}` : formTroca.vape_defeito_custom.trim();
    }
    if (!nomeVapeDefeito) {
      setErro('Informe qual era o vape com defeito');
      return;
    }

    // Vape trocado / substituição
    let nomeVapeTrocado = '';
    let produtoTrocadoId: string | undefined = undefined;
    let produtoTrocadoObj: Produto | undefined = undefined;

    if (formTroca.vape_trocado_selecionado === 'custom') {
      nomeVapeTrocado = formTroca.vape_trocado_custom.trim();
    } else if (formTroca.vape_trocado_selecionado) {
      produtoTrocadoObj = produtos.find(prod => prod.id === formTroca.vape_trocado_selecionado);
      if (produtoTrocadoObj) {
        nomeVapeTrocado = `${produtoTrocadoObj.marca} ${produtoTrocadoObj.nome}`;
        produtoTrocadoId = produtoTrocadoObj.id;
      } else {
        nomeVapeTrocado = formTroca.vape_trocado_custom.trim();
      }
    }
    if (!nomeVapeTrocado) {
      setErro('Informe por qual vape foi trocado');
      return;
    }

    // Motivo da troca
    let motivoFinal = formTroca.motivo;
    if (formTroca.motivo === 'Outro motivo' && formTroca.motivo_custom.trim()) {
      motivoFinal = formTroca.motivo_custom.trim();
    }

    try {
      setSalvandoTroca(true);
      setErro(null);

      // Se marcou para abater estoque do novo vape
      if (formTroca.abater_estoque && produtoTrocadoObj && produtoTrocadoId) {
        try {
          const estoqueAtual = produtoTrocadoObj.estoque || 0;
          const novoEstoqueGeral = Math.max(0, estoqueAtual - 1);

          let novosSaboresEstoque = produtoTrocadoObj.sabores_estoque ? { ...produtoTrocadoObj.sabores_estoque } : undefined;
          if (novosSaboresEstoque && formTroca.sabor_trocado && novosSaboresEstoque[formTroca.sabor_trocado] !== undefined) {
            novosSaboresEstoque[formTroca.sabor_trocado] = Math.max(0, (novosSaboresEstoque[formTroca.sabor_trocado] || 0) - 1);
          }

          let novoEstoqueZonas = produtoTrocadoObj.estoque_zonas ? { ...produtoTrocadoObj.estoque_zonas } : undefined;
          if (novoEstoqueZonas && formTroca.zona && novoEstoqueZonas[formTroca.zona]) {
            const zonaAtual = novoEstoqueZonas[formTroca.zona]!;
            const novoQtdZona = Math.max(0, (zonaAtual.estoque || 0) - 1);
            let saboresZona = zonaAtual.sabores_estoque ? { ...zonaAtual.sabores_estoque } : undefined;
            if (saboresZona && formTroca.sabor_trocado && saboresZona[formTroca.sabor_trocado] !== undefined) {
              saboresZona[formTroca.sabor_trocado] = Math.max(0, (saboresZona[formTroca.sabor_trocado] || 0) - 1);
            }
            novoEstoqueZonas[formTroca.zona] = {
              ...zonaAtual,
              estoque: novoQtdZona,
              sabores_estoque: saboresZona
            };
          }

          const updates: any = {
            estoque: novoEstoqueGeral
          };
          if (novosSaboresEstoque) updates.sabores_estoque = novosSaboresEstoque;
          if (novoEstoqueZonas) updates.estoque_zonas = novoEstoqueZonas;

          await produtosService.editar(produtoTrocadoId, updates);
          setProdutos(prev => prev.map(p => p.id === produtoTrocadoId ? { ...p, ...updates } : p));
        } catch (errEstoque) {
          console.warn('Erro ao atualizar estoque do produto trocado:', errEstoque);
        }
      }

      const dadosTroca = {
        cliente_nome: formTroca.cliente_nome.trim(),
        cliente_telefone: formTroca.cliente_telefone.trim() || undefined,
        data_troca: formTroca.data_troca ? new Date(formTroca.data_troca).toISOString() : new Date().toISOString(),
        vape_defeito: nomeVapeDefeito,
        sabor_defeito: formTroca.sabor_defeito.trim() || undefined,
        motivo: motivoFinal,
        motivo_detalhes: formTroca.motivo_detalhes.trim() || undefined,
        vape_trocado: nomeVapeTrocado,
        sabor_trocado: formTroca.sabor_trocado.trim() || undefined,
        produto_trocado_id: produtoTrocadoId,
        zona: formTroca.zona || undefined,
        abateu_estoque: formTroca.abater_estoque,
        status: formTroca.status,
        observacoes: formTroca.observacoes.trim() || undefined
      };

      if (editandoTrocaId) {
        const atualizada = await trocasService.atualizar(editandoTrocaId, dadosTroca);
        setTrocas(prev => prev.map(t => t.id === editandoTrocaId ? atualizada : t));
        setSucesso('Registro de troca atualizado com sucesso!');
      } else {
        const nova = await trocasService.criar(dadosTroca);
        setTrocas(prev => [nova, ...prev]);
        setSucesso('Troca registrada com sucesso!');
      }

      fecharModalTroca();
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar troca:', err);
      setErro('Erro ao salvar registro de troca');
    } finally {
      setSalvandoTroca(false);
    }
  };

  // Excluir registro de troca
  const handleDeletarTroca = async (id: string, cliente: string) => {
    if (!window.confirm(`Deseja realmente remover o registro de troca de ${cliente}?`)) {
      return;
    }
    try {
      await trocasService.deletar(id);
      setTrocas(prev => prev.filter(t => t.id !== id));
      setSucesso('Registro de troca excluído!');
      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao deletar troca:', err);
      setErro('Erro ao excluir registro de troca');
    }
  };

  // Exportar trocas para CSV
  const handleExportarTrocas = () => {
    if (trocas.length === 0) {
      alert('Nenhuma troca para exportar');
      return;
    }

    const headers = [
      'DATA DA TROCA',
      'CLIENTE',
      'TELEFONE',
      'VAPE COM DEFEITO',
      'SABOR DEFEITO',
      'MOTIVO DO DEFEITO',
      'DETALHES DO DEFEITO',
      'VAPE SUBSTITUTO (ENTREGUE)',
      'SABOR ENTREGUE',
      'ZONA / REGIAO',
      'ABATEU ESTOQUE',
      'STATUS',
      'OBSERVACOES'
    ];

    const rows = trocas.map(t => [
      new Date(t.data_troca).toLocaleString('pt-BR'),
      t.cliente_nome,
      t.cliente_telefone || '',
      t.vape_defeito,
      t.sabor_defeito || '',
      t.motivo,
      (t.motivo_detalhes || '').replace(/"/g, '""'),
      t.vape_trocado,
      t.sabor_trocado || '',
      t.zona || '',
      t.abateu_estoque ? 'SIM' : 'NAO',
      t.status || 'concluida',
      (t.observacoes || '').replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(c => `"${String(c)}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hcvape_trocas_garantia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // =========================================================================
  // --- LÓGICA DE CLIENTES & RELATÓRIOS WHATSAPP (CADASTRO ÚNICO) ---
  // =========================================================================

  // Aplicar atalhos rápidos de período
  const handleAplicarAtalhoPeriodoCliente = (tipo: string) => {
    setFiltroPeriodoCliente(tipo as any);
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth();

    if (tipo === 'hoje') {
      const hojeStr = agora.toISOString().split('T')[0];
      setDataInicioCliente(hojeStr);
      setDataFimCliente(hojeStr);
    } else if (tipo === '7d') {
      const d7 = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDataInicioCliente(d7.toISOString().split('T')[0]);
      setDataFimCliente(agora.toISOString().split('T')[0]);
    } else if (tipo === '30d') {
      const d30 = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDataInicioCliente(d30.toISOString().split('T')[0]);
      setDataFimCliente(agora.toISOString().split('T')[0]);
    } else if (tipo === 'mes_atual') {
      const primeiroDia = new Date(anoAtual, mesAtual, 1);
      const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
      setDataInicioCliente(primeiroDia.toISOString().split('T')[0]);
      setDataFimCliente(ultimoDia.toISOString().split('T')[0]);
    } else if (tipo === 'ano_atual') {
      setDataInicioCliente(`${anoAtual}-01-01`);
      setDataFimCliente(`${anoAtual}-12-31`);
    } else if (tipo === '2026_2027') {
      setDataInicioCliente('2026-09-01');
      setDataFimCliente('2027-09-30');
    } else if (tipo === 'tudo') {
      setDataInicioCliente('2020-01-01');
      setDataFimCliente('2030-12-31');
    }
  };

  // Relatório consolidado por período (REGRA FUNDAMENTAL: 1 CLIENTE = 1 LINHA NO RELATÓRIO)
  const relatorioClientesConsolidado = useMemo(() => {
    const dInicio = new Date(`${dataInicioCliente}T00:00:00`);
    const dFim = new Date(`${dataFimCliente}T23:59:59`);

    // Mapear interações no período por telefone_normalizado
    const mapaInteracoes: Record<string, InteracaoCliente[]> = {};

    interacoesCliente.forEach(int => {
      const d = new Date(int.data_interacao || int.created_at || '');
      if (isNaN(d.getTime())) return;
      if (d >= dInicio && d <= dFim) {
        const norm = int.cliente_telefone_normalizado;
        if (!mapaInteracoes[norm]) {
          mapaInteracoes[norm] = [];
        }
        mapaInteracoes[norm].push(int);
      }
    });

    // Mapear clientes elegíveis (sem duplicidade!)
    const mapaClientesConsolidados = new Map<string, ClienteRelatorio>();

    clientes.forEach(cli => {
      const norm = cli.telefone_normalizado;
      const ints = (mapaInteracoes[norm] || []).sort(
        (a, b) => new Date(b.data_interacao).getTime() - new Date(a.data_interacao).getTime()
      );

      const dPrimeiro = new Date(cli.data_primeiro_contato);
      const dUltimo = new Date(cli.data_ultimo_contato);
      const primeiroNoPeriodo = !isNaN(dPrimeiro.getTime()) && dPrimeiro >= dInicio && dPrimeiro <= dFim;
      const ultimoNoPeriodo = !isNaN(dUltimo.getTime()) && dUltimo >= dInicio && dUltimo <= dFim;
      const temInteracao = ints.length > 0;

      // Se o cliente teve qualquer contato/interação/compra no período
      if (temInteracao || primeiroNoPeriodo || ultimoNoPeriodo) {
        const qtdInteracoes = temInteracao ? ints.length : 1;
        const pedidos = ints.filter(i => i.tipo === 'pedido');
        const qtdPedidos = pedidos.length;
        const valorTotal = pedidos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

        const ultimoContato = ints.length > 0 ? ints[0].data_interacao : cli.data_ultimo_contato;
        const primeiroContato = ints.length > 0 ? ints[ints.length - 1].data_interacao : cli.data_primeiro_contato;

        mapaClientesConsolidados.set(norm, {
          cliente: cli,
          interacoes_no_periodo: qtdInteracoes,
          pedidos_no_periodo: qtdPedidos,
          valor_total_no_periodo: valorTotal > 0 ? valorTotal : (qtdPedidos > 0 ? cli.valor_total_gasto : 0),
          primeiro_contato_periodo: primeiroContato,
          ultimo_contato_periodo: ultimoContato,
          interacoes: ints
        });
      }
    });

    let lista = Array.from(mapaClientesConsolidados.values());

    // Filtro de pesquisa textual (Nome ou WhatsApp)
    if (pesquisaCliente.trim()) {
      const termo = utils.normalizarTexto(pesquisaCliente);
      const termoNumerico = pesquisaCliente.replace(/\D/g, '');
      lista = lista.filter(item => {
        const nomeMatch = utils.normalizarTexto(item.cliente.nome).includes(termo);
        const telMatch = item.cliente.telefone.replace(/\D/g, '').includes(termoNumerico) ||
          item.cliente.telefone_normalizado.includes(termoNumerico);
        return nomeMatch || telMatch;
      });
    }

    // Filtro de tipo de cliente
    if (filtroTipoCliente === 'com_compras') {
      lista = lista.filter(item => item.pedidos_no_periodo > 0 || (item.cliente.total_pedidos || 0) > 0);
    } else if (filtroTipoCliente === 'com_trocas') {
      lista = lista.filter(item => item.interacoes.some(i => i.tipo === 'troca'));
    } else if (filtroTipoCliente === 'recorrentes') {
      lista = lista.filter(item => item.interacoes_no_periodo > 1 || (item.cliente.total_interacoes || 0) > 1);
    }

    // Ordenar pelo último contato mais recente
    return lista.sort((a, b) => new Date(b.ultimo_contato_periodo).getTime() - new Date(a.ultimo_contato_periodo).getTime());
  }, [clientes, interacoesCliente, dataInicioCliente, dataFimCliente, pesquisaCliente, filtroTipoCliente]);

  // Métricas do período selecionado
  const metricasClientes = useMemo(() => {
    const totalClientesUnicos = relatorioClientesConsolidado.length;
    const dInicio = new Date(`${dataInicioCliente}T00:00:00`);
    const dFim = new Date(`${dataFimCliente}T23:59:59`);

    let novosClientes = 0;
    let clientesRecorrentes = 0;
    let totalInteracoes = 0;
    let totalPedidos = 0;
    let faturamentoPeriodo = 0;

    relatorioClientesConsolidado.forEach(item => {
      const dPri = new Date(item.cliente.data_primeiro_contato);
      if (!isNaN(dPri.getTime()) && dPri >= dInicio && dPri <= dFim) {
        novosClientes++;
      }
      if (item.interacoes_no_periodo > 1 || (item.cliente.total_interacoes || 0) > 1) {
        clientesRecorrentes++;
      }
      totalInteracoes += item.interacoes_no_periodo;
      totalPedidos += item.pedidos_no_periodo;
      faturamentoPeriodo += item.valor_total_no_periodo;
    });

    return {
      totalClientesUnicos,
      novosClientes,
      clientesRecorrentes,
      totalInteracoes,
      totalPedidos,
      faturamentoPeriodo,
      totalCadastradosGeral: clientes.length
    };
  }, [relatorioClientesConsolidado, dataInicioCliente, dataFimCliente, clientes]);

  // Sincronizar pedidos e trocas existentes com a base única
  const handleSincronizarClientes = async () => {
    try {
      setSincronizandoClientes(true);
      setErro(null);
      const res = await clientesService.sincronizarHistoricoExistente(pedidos, trocas);
      const [novosClientesData, novasInteracoesData] = await Promise.all([
        clientesService.obterTodos(),
        clientesService.obterInteracoes()
      ]);
      setClientes(novosClientesData.clientes);
      setUsandoFallbackClientes(novosClientesData.usandoFallback);
      setInteracoesCliente(novasInteracoesData.interacoes);
      setSucesso(`Sincronização concluída! ${novosClientesData.clientes.length} clientes únicos consolidados com base em pedidos e trocas.`);
      setTimeout(() => setSucesso(null), 4000);
    } catch (err: any) {
      console.error('Erro ao sincronizar clientes:', err);
      setErro('Erro ao sincronizar histórico de clientes');
    } finally {
      setSincronizandoClientes(false);
    }
  };

  // Exportar Relatório de Clientes Consolidado para CSV
  const handleExportarRelatorioClientesCSV = () => {
    if (relatorioClientesConsolidado.length === 0) {
      alert('Nenhum dado de cliente para o período selecionado.');
      return;
    }

    const headers = [
      'NOME DO CLIENTE',
      'WHATSAPP FORMATADO',
      'WHATSAPP NORMALIZADO',
      'PRIMEIRO CONTATO',
      'ULTIMO CONTATO',
      'QTD INTERACOES NO PERIODO',
      'QTD COMPRAS / PEDIDOS NO PERIODO',
      'VALOR TOTAL GASTO NO PERIODO (R$)',
      'ZONA / REGIAO PREFERIDA'
    ];

    const rows = relatorioClientesConsolidado.map(item => [
      item.cliente.nome,
      formatarTelefoneExibicao(item.cliente.telefone),
      item.cliente.telefone_normalizado,
      new Date(item.primeiro_contato_periodo).toLocaleString('pt-BR'),
      new Date(item.ultimo_contato_periodo).toLocaleString('pt-BR'),
      item.interacoes_no_periodo,
      item.pedidos_no_periodo,
      item.valor_total_no_periodo.toFixed(2).replace('.', ','),
      item.cliente.zona_frequente || 'Geral'
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(c => `"${String(c)}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_clientes_hcvape_${dataInicioCliente}_a_${dataFimCliente}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Abrir modal de detalhes / linha do tempo do cliente
  const handleAbrirDetalhesCliente = async (cli: Cliente) => {
    setClienteSelecionado(cli);
    setFormNovaInteracao({
      tipo: 'contato_whatsapp',
      descricao: '',
      valor: ''
    });
    setModalClienteDetalhesAberto(true);
  };

  // Salvar novo cliente manual
  const handleSalvarNovoCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNovoCliente.nome.trim() || !formNovoCliente.telefone.trim()) {
      setErro('Nome e WhatsApp são obrigatórios!');
      return;
    }

    try {
      setSalvandoCliente(true);
      setErro(null);
      const clienteSalvo = await clientesService.registrarOuAtualizarCliente({
        nome: formNovoCliente.nome.trim(),
        telefone: formNovoCliente.telefone.trim(),
        tipoInteracao: 'contato_whatsapp',
        descricaoInteracao: formNovoCliente.observacoes.trim() || 'Cadastro manual de cliente',
        zona: formNovoCliente.zona
      });

      const [novosClientes, novasInteracoes] = await Promise.all([
        clientesService.obterTodos(),
        clientesService.obterInteracoes()
      ]);
      setClientes(novosClientes.clientes);
      setInteracoesCliente(novasInteracoes.interacoes);
      setModalNovoClienteAberto(false);
      setFormNovoCliente({ nome: '', telefone: '', zona: 'norte', observacoes: '' });
      setSucesso(`Cliente "${clienteSalvo.nome}" salvo com sucesso no cadastro único!`);
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar cliente:', err);
      setErro(err.message || 'Erro ao cadastrar cliente');
    } finally {
      setSalvandoCliente(false);
    }
  };

  // Salvar nova interação para o cliente selecionado
  const handleSalvarNovaInteracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteSelecionado) return;
    if (!formNovaInteracao.descricao.trim()) {
      setErro('Informe uma descrição da interação!');
      return;
    }

    try {
      setSalvandoInteracao(true);
      setErro(null);
      const valor = parseFloat(formNovaInteracao.valor.replace(',', '.')) || 0;
      await clientesService.registrarOuAtualizarCliente({
        nome: clienteSelecionado.nome,
        telefone: clienteSelecionado.telefone_normalizado,
        tipoInteracao: formNovaInteracao.tipo,
        descricaoInteracao: formNovaInteracao.descricao.trim(),
        valor: valor
      });

      const [novosClientes, novasInteracoes] = await Promise.all([
        clientesService.obterTodos(),
        clientesService.obterInteracoes()
      ]);
      setClientes(novosClientes.clientes);
      setInteracoesCliente(novasInteracoes.interacoes);
      
      const cliAtualizado = novosClientes.clientes.find(c => c.telefone_normalizado === clienteSelecionado.telefone_normalizado);
      if (cliAtualizado) {
        setClienteSelecionado(cliAtualizado);
      }

      setFormNovaInteracao({ tipo: 'contato_whatsapp', descricao: '', valor: '' });
      setSucesso('Nova interação registrada no histórico do cliente!');
      setTimeout(() => setSucesso(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar interação:', err);
      setErro(err.message || 'Erro ao registrar interação');
    } finally {
      setSalvandoInteracao(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 text-center max-w-xs animate-in fade-in duration-300">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-28 h-28 bg-[#76FF03]/25 rounded-full blur-2xl animate-pulse-glow pointer-events-none" />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 animate-spin-3d">
              <img
                src="/logo.png"
                alt="HC Vape"
                className="w-full h-full object-cover rounded-full border-2 border-[#76FF03]/40 shadow-[0_0_30px_rgba(118,255,3,0.5)]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-white font-['Outfit'] tracking-tight">
              PAINEL <span className="text-[#76FF03]">ADMIN</span>
            </h2>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#76FF03]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#76FF03] animate-ping" />
              <span className="font-semibold tracking-wide">Carregando painel...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-morphism p-8 rounded-2xl text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="HC Vape Logo"
              className="w-20 h-20 rounded-full object-cover shadow-[0_0_25px_rgba(118,255,3,0.4)] border border-white/20"
            />
          </div>
          <h1 className="text-3xl font-bold neon-glow font-['Outfit'] font-bold mb-1">ADMIN</h1>
          <p className="text-slate-300 text-xs mb-6">HC Vape • Não fume, vaporize! (Desde 2020)</p>

          {erro && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-400 text-sm">{erro}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 font-semibold">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-3 rounded-lg focus:border-[#76FF03] focus:outline-none transition-all duration-300" placeholder="admin@exemplo.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 font-semibold">Senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-3 rounded-lg focus:border-[#76FF03] focus:outline-none transition-all duration-300" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={salvando} className="cyber-button w-full disabled:opacity-50 disabled:cursor-not-allowed">
              {salvando ? 'Entrando...' : 'Entrar no Painel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-[#76FF03]/30">
        <div className="container flex items-center justify-between py-2.5 sm:py-3 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="HC Vape Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-[0_0_12px_rgba(118,255,3,0.3)] border border-white/20 flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl font-bold font-['Outfit'] leading-none truncate">HC ADMIN</h1>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40 flex-shrink-0">2020</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">{usuarioEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <a href="/" className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#76FF03]/10 border border-[#76FF03]/50 text-[#76FF03] rounded-lg font-bold text-xs hover:bg-[#76FF03]/20 transition-all duration-300">Catálogo</a>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-red-500/20 border border-red-500/60 text-red-400 rounded-lg font-bold text-xs hover:bg-red-500/30 transition-all duration-300">
              <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container py-5 sm:py-8 space-y-6 sm:space-y-8">
        {erro && (
          <div className="p-3.5 sm:p-4 bg-red-500/20 border border-red-500 rounded-xl flex items-center gap-3 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 flex-1">{erro}</p>
            <button onClick={() => setErro(null)} className="ml-auto p-1"><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        {sucesso && (
          <div className="p-3.5 sm:p-4 bg-[#76FF03]/20 border border-[#76FF03] rounded-xl flex items-center gap-3 text-xs sm:text-sm">
            <div className="w-5 h-5 rounded-full bg-[#76FF03] flex items-center justify-center flex-shrink-0">
              <span className="text-black text-xs font-bold">✓</span>
            </div>
            <p className="text-[#76FF03]">{sucesso}</p>
          </div>
        )}

        {/* Abas com scroll horizontal no mobile */}
        <div className="flex gap-2 sm:gap-4 border-b border-[#76FF03]/20 pb-1 overflow-x-auto scrollbar-none">
          <button onClick={() => setAbaAtiva('produtos')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'produtos' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <Box className="w-4 h-4" /> Estoque / Produtos
          </button>
          <button onClick={() => setAbaAtiva('relogio_mensal')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'relogio_mensal' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <Clock className="w-4 h-4 text-[#76FF03]" /> Relógio Mensal
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40">Metas</span>
          </button>
          <button onClick={() => setAbaAtiva('pedidos')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'pedidos' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <ShoppingBag className="w-4 h-4" /> Pedidos
            {pedidos.filter(p => !p.status_checklist).length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                {pedidos.filter(p => !p.status_checklist).length}
              </span>
            )}
          </button>
          <button onClick={() => setAbaAtiva('clientes')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'clientes' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <Users className="w-4 h-4 text-[#76FF03]" /> Clientes & Relatórios
            <span className="bg-[#76FF03]/20 border border-[#76FF03]/40 text-[#76FF03] text-[10px] px-1.5 py-0.2 rounded-full ml-1 font-bold">
              {clientes.length}
            </span>
          </button>
          <button onClick={() => setAbaAtiva('trocas')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'trocas' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <RefreshCw className="w-4 h-4 text-[#76FF03]" /> Trocas / Garantia
            {trocas.length > 0 && (
              <span className="bg-[#76FF03]/20 border border-[#76FF03]/40 text-[#76FF03] text-[10px] px-1.5 py-0.2 rounded-full ml-1 font-bold">
                {trocas.length}
              </span>
            )}
          </button>
          <button onClick={() => setAbaAtiva('metricas')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'metricas' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <BarChart3 className="w-4 h-4" /> Métricas
          </button>
          <button onClick={() => setAbaAtiva('saude')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'saude' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <CheckCircle2 className="w-4 h-4" /> Saúde
          </button>
          <button onClick={() => setAbaAtiva('configuracoes')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'configuracoes' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <Settings className="w-4 h-4" /> Promoção
          </button>
          <button onClick={() => setAbaAtiva('herobanner')} className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border-b-2 ${abaAtiva === 'herobanner' ? 'text-[#76FF03] border-[#76FF03]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}>
            <LayoutTemplate className="w-4 h-4" /> Hero Banner
          </button>
        </div>

        {abaAtiva === 'produtos' ? (
          <>
            <section className="space-y-6">
              {/* Header com botões de ação e exportação */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold neon-glow font-['Outfit']">Gerenciamento de Estoque</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Vapes agrupados por Marca e Puffs ({direcaoPuffs === 'asc' ? 'do menor para o maior — ex: V80 antes de V150/V250/V500' : 'do maior para o menor'})
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => setDirecaoPuffs(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/20 text-slate-200 rounded-lg font-bold text-xs hover:bg-white/10 transition-all"
                    title="Alternar ordenação de Puffs (crescente / decrescente)"
                  >
                    {direcaoPuffs === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#76FF03]" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />}
                    Puffs: {direcaoPuffs === 'asc' ? 'Menor → Maior' : 'Maior → Menor'}
                  </button>
                  <button onClick={handleExportarProdutos} className="flex items-center gap-2 px-3.5 py-2 bg-[#76FF03]/15 border border-[#76FF03]/50 text-[#76FF03] rounded-lg font-bold text-xs hover:bg-[#76FF03]/25 transition-all">
                    <Download className="w-4 h-4" /> Exportar
                  </button>
                  <button onClick={abrirModalNovo} className="flex items-center gap-2 px-4 py-2 bg-[#76FF03] text-black rounded-lg font-bold text-xs hover:shadow-[0_0_15px_rgba(118,255,3,0.5)] transition-all">
                    <Plus className="w-4 h-4" /> Novo Produto
                  </button>
                </div>
              </div>

              {/* Sub-abas de Separação de Estoque: EXPRESSO ///// PROMOCIONAL ///// TODOS */}
              <div className="flex p-1.5 bg-black/60 border border-[#76FF03]/30 rounded-2xl max-w-xl">
                <button
                  onClick={() => setSubAbaEstoque('expressos')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                    subAbaEstoque === 'expressos'
                      ? 'bg-gradient-to-r from-[#76FF03] to-[#52C41A] text-black shadow-[0_0_15px_rgba(118,255,3,0.3)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>Expresso ({produtosExpressosOrdenados.length})</span>
                </button>

                <button
                  onClick={() => setSubAbaEstoque('promocional')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                    subAbaEstoque === 'promocional'
                      ? 'bg-gradient-to-r from-[#FF3366] to-[#E60045] text-white shadow-[0_0_15px_rgba(255,51,102,0.3)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span>Promocional ({produtosPromocionaisOrdenados.length})</span>
                </button>

                <button
                  onClick={() => setSubAbaEstoque('todos')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                    subAbaEstoque === 'todos'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Todos ({produtos.length})</span>
                </button>
              </div>

              {/* ======================= SUB-ABA: EXPRESSOS (TEMPO REAL) ======================= */}
              {subAbaEstoque === 'expressos' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Banner de Demonstração em Tempo Real */}
                  <div className="glass-morphism p-5 rounded-2xl border border-[#76FF03]/40 bg-gradient-to-br from-[#76FF03]/10 to-transparent space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#76FF03] animate-ping" />
                          <h3 className="text-base font-bold text-slate-100 font-['Outfit']">
                            Estoque em Tempo Real dos Expressos
                          </h3>
                        </div>
                        <p className="text-xs text-slate-300">
                          Visualize e gerencie a disponibilidade instantânea por região de atendimento:
                        </p>
                      </div>

                      {/* Filtro em Tempo Real: TODOS ///// APENAS ZN ///// APENAS ZS/ZO */}
                      <div className="flex flex-wrap gap-2 p-1.5 bg-black/80 rounded-xl border border-white/10">
                        <button
                          onClick={() => setFiltroZonaEstoqueExpresso('todas')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filtroZonaEstoqueExpresso === 'todas'
                              ? 'bg-[#76FF03] text-black shadow-[0_0_10px_rgba(118,255,3,0.4)]'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🌐 Todos ({produtosExpressosOrdenados.length})
                        </button>
                        <button
                          onClick={() => setFiltroZonaEstoqueExpresso('norte')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filtroZonaEstoqueExpresso === 'norte'
                              ? 'bg-[#76FF03] text-black shadow-[0_0_10px_rgba(118,255,3,0.4)]'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🟢 Apenas ZN (Zona Norte)
                        </button>
                        <button
                          onClick={() => setFiltroZonaEstoqueExpresso('sul_oeste')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filtroZonaEstoqueExpresso === 'sul_oeste'
                              ? 'bg-[#38bdf8] text-black shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🔵 Apenas ZS/ZO (Zona Oeste/Sul)
                        </button>
                      </div>
                    </div>

                    {/* Resumo Rápido de Números da Zona */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
                      <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total em Estoque</span>
                        <span className="text-xl font-black text-[#76FF03]">
                          {produtosExpressosFiltrados.reduce((sum, p) => {
                            const info = utils.obterEstoqueProdutoPorZona(p, filtroZonaEstoqueExpresso === 'todas' ? null : filtroZonaEstoqueExpresso);
                            return sum + info.estoque;
                          }, 0)} un
                        </span>
                      </div>
                      <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Modelos Disponíveis</span>
                        <span className="text-xl font-black text-slate-100">
                          {produtosExpressosFiltrados.filter(p => {
                            const info = utils.obterEstoqueProdutoPorZona(p, filtroZonaEstoqueExpresso === 'todas' ? null : filtroZonaEstoqueExpresso);
                            return info.possuiEstoqueNaZona;
                          }).length}
                        </span>
                      </div>
                      <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Modelos Esgotados</span>
                        <span className="text-xl font-black text-red-400">
                          {produtosExpressosFiltrados.filter(p => {
                            const info = utils.obterEstoqueProdutoPorZona(p, filtroZonaEstoqueExpresso === 'todas' ? null : filtroZonaEstoqueExpresso);
                            return !info.possuiEstoqueNaZona;
                          }).length}
                        </span>
                      </div>
                      <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor em Estoque</span>
                        <span className="text-xl font-black text-emerald-400">
                          {utils.formatarMoeda(produtosExpressosFiltrados.reduce((sum, p) => {
                            const info = utils.obterEstoqueProdutoPorZona(p, filtroZonaEstoqueExpresso === 'todas' ? null : filtroZonaEstoqueExpresso);
                            return sum + (info.estoque * p.preco);
                          }, 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Barra de Pesquisa e Ordenação */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <input
                        type="text"
                        placeholder="Pesquisar vape expresso, marca ou sabor..."
                        value={pesquisa}
                        onChange={(e) => setPesquisa(e.target.value)}
                        className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 pl-10 pr-10 py-2.5 rounded-lg focus:border-[#76FF03] focus:shadow-[0_0_15px_rgba(118,255,3,0.3)] focus:outline-none transition-all duration-300 text-sm"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-[13px]" />
                      {pesquisa && (
                        <button onClick={() => setPesquisa('')} className="absolute right-3 top-[11px] text-slate-400 hover:text-[#76FF03]">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setDirecaoPuffs(p => p === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-black/60 border border-[#76FF03]/30 hover:border-[#76FF03] rounded-lg text-xs font-bold text-slate-200 transition-all shadow-sm select-none"
                      title="Clique para alternar a ordem dos puffs/modelos"
                    >
                      <span className="text-slate-400">Ordem Puffs:</span>
                      {direcaoPuffs === 'desc' ? (
                        <span className="text-[#76FF03] flex items-center gap-1 font-extrabold">
                          Decrescente (Maior ➔ Menor) <ArrowDown className="w-3.5 h-3.5 text-[#76FF03]" />
                        </span>
                      ) : (
                        <span className="text-sky-400 flex items-center gap-1 font-extrabold">
                          Crescente (Menor ➔ Maior) <ArrowUp className="w-3.5 h-3.5 text-sky-400" />
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Tabela de Expressos */}
                  {produtosExpressosFiltrados.length === 0 ? (
                    <div className="glass-morphism p-12 rounded-xl text-center border border-white/10 bg-black/40">
                      <p className="text-slate-400">Nenhum vape expresso encontrado com os filtros aplicados</p>
                    </div>
                  ) : (
                    <div className="glass-morphism rounded-xl overflow-hidden overflow-x-auto border border-[#76FF03]/20">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#76FF03]/30 text-left text-xs font-bold text-[#76FF03] uppercase">
                            <th className="py-3 px-4">Img</th>
                            <th className="py-3 px-4">Marca</th>
                            <th className="py-3 px-4">Vape / Puffs</th>
                            <th className="py-3 px-4">Preço</th>
                            <th className="py-3 px-4">Zonas</th>
                            <th className="py-3 px-4">Estoque Tempo Real</th>
                            <th className="py-3 px-4">Novo Est.</th>
                            <th className="py-3 px-4">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {produtosExpressosFiltrados.map((produto) => {
                            const puffs = utils.extrairPuffs(produto.nome);
                            const estoqueInfo = utils.obterEstoqueProdutoPorZona(produto, filtroZonaEstoqueExpresso === 'todas' ? null : filtroZonaEstoqueExpresso);
                            return (
                              <tr key={produto.id} className="border-b border-[#76FF03]/10 hover:bg-[#76FF03]/5 transition-colors duration-200 text-sm">
                                <td className="py-3 px-4">
                                  {produto.imagem_url ? (
                                    <img src={produto.imagem_url} alt={produto.nome} className="w-10 h-10 object-cover rounded border border-[#76FF03]/30" />
                                  ) : (
                                    <ImageOff className="w-6 h-6 text-slate-600" />
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-300 font-bold">{produto.marca}</td>
                                <td className="py-3 px-4 text-slate-100">
                                  <div className="font-bold flex items-center gap-2">
                                    <span>{produto.nome}</span>
                                    {puffs > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40">
                                        {puffs.toLocaleString('pt-BR')} Puffs
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-[#76FF03] font-bold">{utils.formatarMoeda(produto.preco)}</td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-wrap gap-1">
                                    {(produto.zonas && produto.zonas.length > 0 ? produto.zonas : ['norte', 'sul_oeste']).map(z => {
                                      const isNorte = z.toLowerCase().includes('norte');
                                      const label = isNorte ? 'ZN' : 'ZS/ZO';
                                      const colorClass = isNorte ? 'bg-[#76FF03]/15 text-[#76FF03] border-[#76FF03]/40' : 'bg-sky-500/15 text-sky-400 border-sky-500/40';
                                      return (
                                        <span key={z} className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${colorClass}`}>
                                          {label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {produto.sabores_estoque && Object.keys(produto.sabores_estoque).length > 0 ? (
                                    <div className="flex flex-col gap-1 text-xs">
                                      {Object.entries(produto.sabores_estoque).map(([sabor, est]) => (
                                        <div key={sabor} className="flex justify-between gap-3">
                                          <span className="text-slate-400">{sabor}:</span>
                                          <span className={est > 0 ? 'text-[#76FF03] font-bold' : 'text-red-400 font-bold'}>{est}</span>
                                        </div>
                                      ))}
                                      <div className="border-t border-[#76FF03]/20 mt-1 pt-1 flex justify-between font-bold text-[10px]">
                                        <span className="text-slate-300">TOTAL:</span>
                                        <span className={estoqueInfo.estoque > 0 ? 'text-[#76FF03]' : 'text-red-400'}>{estoqueInfo.estoque} un</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${estoqueInfo.estoque > 0 ? 'bg-[#76FF03]/20 text-[#76FF03]' : 'bg-red-500/20 text-red-400'}`}>
                                      {estoqueInfo.estoque} un
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {produto.sabores.length <= 1 ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={estoqueEditado[produto.id] ?? produto.estoque}
                                      onChange={(e) => setEstoqueEditado({ ...estoqueEditado, [produto.id]: parseInt(e.target.value) || 0 })}
                                      className="w-16 bg-black/60 border border-[#76FF03]/50 text-slate-100 px-1 py-0.5 rounded focus:border-[#76FF03] outline-none"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Editar sabores</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => handleAtualizarEstoque(produto.id)}
                                      disabled={salvando || estoqueEditado[produto.id] === undefined || produto.sabores.length > 1}
                                      className="p-1.5 bg-[#76FF03] text-black rounded disabled:opacity-50"
                                      title="Salvar estoque"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => abrirModalEditar(produto)}
                                      className="p-1.5 bg-blue-500/20 border border-blue-500 text-blue-400 rounded hover:bg-blue-500/30"
                                      title="Editar completo"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeletarProduto(produto.id, produto.nome)}
                                      className="p-1.5 bg-red-500/20 border border-red-500 text-red-400 rounded hover:bg-red-500/30"
                                      title="Deletar"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ======================= SUB-ABA: PROMOCIONAL ======================= */}
              {subAbaEstoque === 'promocional' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Banner Explicativo Promocional */}
                  <div className="glass-morphism p-5 rounded-2xl border border-[#FF3366]/40 bg-gradient-to-br from-[#FF3366]/10 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-[#FF3366]" />
                        <h3 className="text-base font-bold text-slate-100 font-['Outfit']">
                          Catálogo Promocional & Controle de Ativação
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        Defina quais vapes promocionais aparecem ativos ou inativos (ocultos) para os clientes no catálogo:
                      </p>
                    </div>

                    <div className="flex items-center gap-3 bg-black/60 px-4 py-2 rounded-xl border border-white/10 text-xs">
                      <span className="text-slate-400 font-bold">Total Promo:</span>
                      <span className="text-[#FF3366] font-extrabold">{produtosPromocionaisOrdenados.length} modelos</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-[#76FF03] font-bold">
                        {produtosPromocionaisOrdenados.filter(p => p.ativo !== false).length} Ativos
                      </span>
                    </div>
                  </div>

                  {/* Barra de Pesquisa e Ordenação */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <input
                        type="text"
                        placeholder="Pesquisar vape promocional..."
                        value={pesquisa}
                        onChange={(e) => setPesquisa(e.target.value)}
                        className="w-full bg-black/60 border border-[#FF3366]/50 text-slate-100 pl-10 pr-10 py-2.5 rounded-lg focus:border-[#FF3366] focus:shadow-[0_0_15px_rgba(255,51,102,0.3)] focus:outline-none transition-all duration-300 text-sm"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-[13px]" />
                      {pesquisa && (
                        <button onClick={() => setPesquisa('')} className="absolute right-3 top-[11px] text-slate-400 hover:text-[#FF3366]">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setDirecaoPuffs(p => p === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-black/60 border border-[#FF3366]/30 hover:border-[#FF3366] rounded-lg text-xs font-bold text-slate-200 transition-all shadow-sm select-none"
                      title="Clique para alternar a ordem dos puffs/modelos"
                    >
                      <span className="text-slate-400">Ordem Puffs:</span>
                      {direcaoPuffs === 'desc' ? (
                        <span className="text-[#FF3366] flex items-center gap-1 font-extrabold">
                          Decrescente (Maior ➔ Menor) <ArrowDown className="w-3.5 h-3.5 text-[#FF3366]" />
                        </span>
                      ) : (
                        <span className="text-sky-400 flex items-center gap-1 font-extrabold">
                          Crescente (Menor ➔ Maior) <ArrowUp className="w-3.5 h-3.5 text-sky-400" />
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Tabela de Promocionais */}
                  {produtosPromocionaisFiltrados.length === 0 ? (
                    <div className="glass-morphism p-12 rounded-xl text-center border border-white/10 bg-black/40">
                      <p className="text-slate-400">Nenhum vape promocional cadastrado ou encontrado</p>
                    </div>
                  ) : (
                    <div className="glass-morphism rounded-xl overflow-hidden overflow-x-auto border border-[#FF3366]/20">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#FF3366]/30 text-left text-xs font-bold text-[#FF3366] uppercase">
                            <th className="py-3 px-4">Status / Ativação</th>
                            <th className="py-3 px-4">Img</th>
                            <th className="py-3 px-4">Marca</th>
                            <th className="py-3 px-4">Vape / Puffs</th>
                            <th className="py-3 px-4">Preço Original</th>
                            <th className="py-3 px-4">Preço Promo</th>
                            <th className="py-3 px-4">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {produtosPromocionaisFiltrados.map((produto) => {
                            const isAtivo = produto.ativo !== false;
                            const puffs = utils.extrairPuffs(produto.nome);
                            const descontoPct = produto.preco_promo && produto.preco > 0
                              ? Math.round(((produto.preco - produto.preco_promo) / produto.preco) * 100)
                              : 0;

                            return (
                              <tr key={produto.id} className={`border-b border-white/5 transition-colors duration-200 text-sm ${isAtivo ? 'hover:bg-[#FF3366]/5' : 'opacity-60 bg-black/40'}`}>
                                <td className="py-3 px-4">
                                  {/* Botão de Ativo / Inativo */}
                                  <button
                                    onClick={() => handleToggleAtivoProduto(produto)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${
                                      isAtivo
                                        ? 'bg-[#76FF03]/20 border border-[#76FF03] text-[#76FF03] hover:bg-[#76FF03]/30 shadow-[0_0_10px_rgba(118,255,3,0.2)]'
                                        : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                    }`}
                                  >
                                    <span className={`w-2 h-2 rounded-full ${isAtivo ? 'bg-[#76FF03] animate-pulse' : 'bg-zinc-500'}`} />
                                    <span>{isAtivo ? '🟢 Ativo no Catálogo' : '⚪ Inativo (Oculto)'}</span>
                                  </button>
                                </td>
                                <td className="py-3 px-4">
                                  {produto.imagem_url ? (
                                    <img src={produto.imagem_url} alt={produto.nome} className="w-10 h-10 object-cover rounded border border-[#FF3366]/30" />
                                  ) : (
                                    <ImageOff className="w-6 h-6 text-slate-600" />
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-300 font-bold">{produto.marca}</td>
                                <td className="py-3 px-4 text-slate-100">
                                  <div className="font-bold flex items-center gap-2">
                                    <span>{produto.nome}</span>
                                    {puffs > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF3366]/20 text-[#FF5E85] border border-[#FF3366]/40">
                                        {puffs.toLocaleString('pt-BR')} Puffs
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-400 line-through text-xs">
                                  {utils.formatarMoeda(produto.preco)}
                                </td>
                                <td className="py-3 px-4 text-[#FF3366] font-bold">
                                  <div className="flex items-center gap-1.5">
                                    <span>{utils.formatarMoeda(produto.preco_promo || produto.preco)}</span>
                                    {descontoPct > 0 && (
                                      <span className="text-[10px] px-1 py-0.2 rounded bg-red-500/20 text-red-400 font-bold">
                                        -{descontoPct}%
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => abrirModalEditar(produto)}
                                      className="p-1.5 bg-blue-500/20 border border-blue-500 text-blue-400 rounded hover:bg-blue-500/30"
                                      title="Editar completo"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeletarProduto(produto.id, produto.nome)}
                                      className="p-1.5 bg-red-500/20 border border-red-500 text-red-400 rounded hover:bg-red-500/30"
                                      title="Deletar"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ======================= SUB-ABA: TODOS OS PRODUTOS (UNIFICADO) ======================= */}
              {subAbaEstoque === 'todos' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* RESUMO DE ESTOQUE POR MODELO E SABOR */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-morphism p-5 rounded-xl border border-[#76FF03]/20 bg-black/40">
                      <h3 className="text-sm font-bold text-[#76FF03] uppercase font-['Outfit'] mb-4 flex items-center gap-2">
                        <Box className="w-4 h-4" /> Estoque por Modelo - Expressos (100K ➔ 1K Puffs)
                      </h3>
                      <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                        {(() => {
                          const resumoModelo: { [chave: string]: { total: number; produto: Produto } } = {};
                          produtosFiltrados.filter(p => !p.is_promo).forEach(p => {
                            const chave = `${p.marca} ${p.nome}`;
                            if (!resumoModelo[chave]) {
                              resumoModelo[chave] = { total: 0, produto: p };
                            }
                            resumoModelo[chave].total += p.estoque;
                          });
                          const modelosOrdenados = Object.values(resumoModelo).sort((a, b) => {
                            const puffsA = utils.extrairPuffs(a.produto.nome);
                            const puffsB = utils.extrairPuffs(b.produto.nome);
                            if (puffsA !== puffsB) return puffsB - puffsA;
                            return `${a.produto.marca} ${a.produto.nome}`.localeCompare(`${b.produto.marca} ${b.produto.nome}`, 'pt-BR');
                          });
                          if (modelosOrdenados.length === 0) return <p className="text-xs text-slate-400">Nenhum estoque expresso cadastrado</p>;
                          return modelosOrdenados.map(({ produto, total }) => {
                            const puffs = utils.extrairPuffs(produto.nome);
                            return (
                              <div key={`${produto.marca} ${produto.nome}`} className="flex justify-between items-center text-xs border-b border-[#76FF03]/5 pb-1">
                                <div className="flex items-center gap-1.5 truncate pr-2">
                                  <span className="text-slate-300 font-medium truncate">{produto.marca} {produto.nome}</span>
                                  {puffs > 0 && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#76FF03]/10 text-[#76FF03] border border-[#76FF03]/20 flex-shrink-0">
                                      {puffs.toLocaleString('pt-BR')} Puffs
                                    </span>
                                  )}
                                </div>
                                <span className={`font-bold flex-shrink-0 ${total > 0 ? 'text-[#76FF03]' : 'text-red-500'}`}>{total} un</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    <div className="glass-morphism p-5 rounded-xl border border-blue-500/20 bg-black/40">
                      <h3 className="text-sm font-bold text-blue-400 uppercase font-['Outfit'] mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Estoque por Sabor - Expressos
                      </h3>
                      <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                        {(() => {
                          const resumoSabor: { [key: string]: number } = {};
                          produtosFiltrados.filter(p => !p.is_promo).forEach(p => {
                            if (p.sabores_estoque && Object.keys(p.sabores_estoque).length > 0) {
                              Object.entries(p.sabores_estoque).forEach(([sabor, qtd]) => {
                                const s = sabor.trim();
                                if (s) {
                                  resumoSabor[sabor] = (resumoSabor[sabor] || 0) + (qtd as number);
                                }
                              });
                            } else {
                              p.sabores.forEach(s => {
                                const sabor = s.trim();
                                if (sabor) {
                                  resumoSabor[sabor] = (resumoSabor[sabor] || 0) + p.estoque;
                                }
                              });
                            }
                          });
                          const saboresOrdenados = Object.entries(resumoSabor).sort((a, b) => b[1] - a[1]);
                          if (saboresOrdenados.length === 0) return <p className="text-xs text-slate-400">Nenhum estoque expresso cadastrado</p>;
                          return saboresOrdenados.map(([sabor, total]) => (
                            <div key={sabor} className="flex justify-between items-center text-xs border-b border-blue-500/5 pb-1">
                              <span className="text-slate-300 truncate pr-4">{sabor}</span>
                              <span className={`font-bold ${total > 0 ? 'text-blue-400' : 'text-red-500'}`}>{total} un</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Barra de Pesquisa e Filtro de Zonas */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <input
                        type="text"
                        placeholder="Pesquisar produto, marca ou sabor..."
                        value={pesquisa}
                        onChange={(e) => setPesquisa(e.target.value)}
                        className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 pl-10 pr-10 py-2.5 rounded-lg focus:border-[#76FF03] focus:shadow-[0_0_15px_rgba(118,255,3,0.3)] focus:outline-none transition-all duration-300 text-sm"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-[13px]" />
                      {pesquisa && (
                        <button onClick={() => setPesquisa('')} className="absolute right-3 top-[11px] text-slate-400 hover:text-[#76FF03]">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setDirecaoPuffs(p => p === 'desc' ? 'asc' : 'desc')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-black/60 border border-white/10 hover:border-[#76FF03] rounded-lg text-xs font-bold text-slate-200 transition-all select-none"
                        title="Alternar ordem dos modelos"
                      >
                        <span className="text-slate-400">Ordem:</span>
                        {direcaoPuffs === 'desc' ? (
                          <span className="text-[#76FF03] flex items-center gap-1">Decrescente ⬇️</span>
                        ) : (
                          <span className="text-sky-400 flex items-center gap-1">Crescente ⬆️</span>
                        )}
                      </button>

                      <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-[#76FF03]/30">
                        <MapPin className="w-4 h-4 text-[#76FF03] ml-1" />
                        <select
                          value={filtroZonaProduto}
                          onChange={(e) => setFiltroZonaProduto(e.target.value)}
                          className="bg-black/80 text-slate-100 text-xs font-bold rounded px-2.5 py-1.5 outline-none border border-transparent focus:border-[#76FF03]"
                        >
                          <option value="todas">Todas as Regiões</option>
                          <option value="norte">Zona Norte (ZN)</option>
                          <option value="sul_oeste">Zona Oeste/Sul (ZS/ZO)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Todos os Produtos */}
                  {produtosFiltrados.length === 0 ? (
                    <div className="glass-morphism p-12 rounded-xl text-center border border-[#76FF03]/20 bg-black/40">
                      <p className="text-slate-400">Nenhum produto encontrado com os filtros aplicados</p>
                    </div>
                  ) : (
                    <div className="glass-morphism rounded-xl overflow-hidden overflow-x-auto border border-white/10">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#76FF03]/30 text-left text-xs font-bold text-[#76FF03] uppercase">
                            <th className="py-3 px-4">Img</th>
                            <th className="py-3 px-4">Tipo</th>
                            <th className="py-3 px-4">Marca</th>
                            <th className="py-3 px-4">Nome / Puffs</th>
                            <th className="py-3 px-4">Preço</th>
                            <th className="py-3 px-4">Estoque</th>
                            <th className="py-3 px-4">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {produtosFiltrados.map((produto) => {
                            const puffs = utils.extrairPuffs(produto.nome);
                            return (
                              <tr key={produto.id} className="border-b border-[#76FF03]/10 hover:bg-[#76FF03]/5 transition-colors duration-200 text-sm">
                                <td className="py-3 px-4">
                                  {produto.imagem_url ? (
                                    <img src={produto.imagem_url} alt={produto.nome} className="w-10 h-10 object-cover rounded border border-[#76FF03]/30" />
                                  ) : (
                                    <ImageOff className="w-6 h-6 text-[#606060]" />
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {produto.is_promo ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/40">
                                      Promocional
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40">
                                      Expresso
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-300 font-bold">{produto.marca}</td>
                                <td className="py-3 px-4 text-slate-100">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <span>{produto.nome}</span>
                                    {puffs > 0 && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/10 text-slate-300">
                                        {puffs.toLocaleString('pt-BR')} Puffs
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-[#76FF03] font-bold">
                                  {produto.is_promo && produto.preco_promo ? (
                                    <div>
                                      <span>{utils.formatarMoeda(produto.preco_promo)}</span>
                                      <span className="block text-[10px] text-slate-400 line-through">{utils.formatarMoeda(produto.preco)}</span>
                                    </div>
                                  ) : (
                                    <span>{utils.formatarMoeda(produto.preco)}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {produto.is_promo ? (
                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/30">
                                      Livre (Ativo)
                                    </span>
                                  ) : (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${produto.estoque > 0 ? 'bg-[#76FF03]/20 text-[#76FF03]' : 'bg-red-500/20 text-red-400'}`}>
                                      {produto.estoque} un
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex gap-1">
                                    <button onClick={() => abrirModalEditar(produto)} className="p-1.5 bg-blue-500/20 border border-blue-500 text-blue-400 rounded">
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleDeletarProduto(produto.id, produto.nome)} className="p-1.5 bg-red-500/20 border border-red-500 text-red-400 rounded">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        ) : abaAtiva === 'relogio_mensal' ? (
          /* =========================================================================
             NOVA ABA: RELÓGIO MENSAL DE METAS & DESEMPENHO (1º AO ÚLTIMO DIA DO MÊS)
             ========================================================================= */
          <section className="space-y-8 animate-in fade-in duration-300">
            {/* Header com Navegação do Mês & Botão de Metas */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-morphism p-6 rounded-3xl border border-[#76FF03]/30 bg-black/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black neon-glow font-['Outfit']">Relógio Mensal de Metas</h2>
                    <p className="text-xs text-slate-400">
                      Acompanhamento de <strong>1º a {relogioMensalData.diasNoMes} de {relogioMensalData.mesLabel}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Seletor de Mês */}
                <div className="flex items-center bg-black/80 rounded-xl border border-white/10 p-1">
                  <button
                    onClick={() => {
                      const [ano, mes] = mesRelogio.split('-').map(Number);
                      const d = new Date(ano, mes - 2, 1);
                      setMesRelogio(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                    }}
                    className="p-2 hover:text-[#76FF03] text-slate-400 transition-colors"
                    title="Mês anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="month"
                    value={mesRelogio}
                    onChange={(e) => setMesRelogio(e.target.value)}
                    className="bg-transparent text-slate-100 font-bold text-xs px-2 py-1 outline-none cursor-pointer"
                  />
                  <button
                    onClick={() => {
                      const [ano, mes] = mesRelogio.split('-').map(Number);
                      const d = new Date(ano, mes, 1);
                      setMesRelogio(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                    }}
                    className="p-2 hover:text-[#76FF03] text-slate-400 transition-colors"
                    title="Próximo mês"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setTempMetaValor(String(metaMensalValor));
                    setTempMetaQtd(String(metaMensalQtd));
                    setEditandoMeta(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#76FF03]/20 border border-[#76FF03]/60 text-[#76FF03] rounded-xl font-bold text-xs hover:bg-[#76FF03]/30 transition-all shadow-md"
                >
                  <Target className="w-4 h-4" /> Configurar Metas
                </button>
              </div>
            </div>

            {/* Modal para Editar Metas */}
            {editandoMeta && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#0e120f] border border-[#76FF03]/50 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-[0_0_30px_rgba(118,255,3,0.2)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white font-['Outfit'] flex items-center gap-2">
                      <Target className="w-5 h-5 text-[#76FF03]" /> Ajustar Metas Mensais
                    </h3>
                    <button onClick={() => setEditandoMeta(false)} className="text-slate-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Meta de Faturamento (R$)
                      </label>
                      <input
                        type="number"
                        value={tempMetaValor}
                        onChange={(e) => setTempMetaValor(e.target.value)}
                        className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-3 py-2 rounded-lg outline-none text-sm"
                        placeholder="15000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Meta de Quantidade (Unidades de Vapes)
                      </label>
                      <input
                        type="number"
                        value={tempMetaQtd}
                        onChange={(e) => setTempMetaQtd(e.target.value)}
                        className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-3 py-2 rounded-lg outline-none text-sm"
                        placeholder="200"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditandoMeta(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-slate-300 font-bold text-xs">
                      Cancelar
                    </button>
                    <button onClick={handleSalvarMetas} className="flex-1 py-2 rounded-lg bg-[#76FF03] text-black font-bold text-xs shadow-[0_0_15px_rgba(118,255,3,0.4)]">
                      Salvar Metas
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SEÇÃO PRINCIPAL: O RELÓGIO DE METAS (GAUGE NEON) + CARDS DE STATUS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* O Relógio / Speedometer Visual de Metas */}
              <div className="glass-morphism p-6 rounded-3xl border border-[#76FF03]/30 bg-black/50 flex flex-col items-center justify-between text-center relative overflow-hidden">
                <div className="w-full flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
                  <span className="font-bold flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-[#76FF03]" /> Relógio de Meta (Faturamento)
                  </span>
                  <span className="text-[#76FF03] font-extrabold">{relogioMensalData.percentualValor.toFixed(1)}%</span>
                </div>

                {/* Mostrador Circular Neon (Speedometer Dial) */}
                <div className="relative my-6 flex items-center justify-center">
                  <svg className="w-56 h-56 -rotate-90 transform">
                    {/* Fundo do circulo */}
                    <circle
                      cx="112"
                      cy="112"
                      r="90"
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeWidth="14"
                      fill="transparent"
                    />
                    {/* Barra de Progresso Neon */}
                    <circle
                      cx="112"
                      cy="112"
                      r="90"
                      stroke="#76FF03"
                      strokeWidth="14"
                      fill="transparent"
                      strokeDasharray={565.48}
                      strokeDashoffset={565.48 - (565.48 * Math.min(100, relogioMensalData.percentualValor)) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out drop-shadow-[0_0_12px_rgba(118,255,3,0.8)]"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight">
                      {relogioMensalData.percentualValor.toFixed(0)}%
                    </span>
                    <span className="text-[11px] font-extrabold text-[#76FF03] uppercase tracking-wider mt-1">
                      {relogioMensalData.percentualValor >= 100
                        ? '🏆 Meta Batida!'
                        : relogioMensalData.percentualValor >= 80
                        ? '🔥 Quase Lá!'
                        : '⚡ Em Andamento'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {utils.formatarMoeda(relogioMensalData.faturamentoTotal)} de {utils.formatarMoeda(metaMensalValor)}
                    </span>
                  </div>
                </div>

                {/* Rodapé do Relógio */}
                <div className="w-full pt-3 border-t border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Falta para a Meta:</span>
                    <span className="font-bold text-red-400">
                      {utils.formatarMoeda(relogioMensalData.valorFaltante)}
                    </span>
                  </div>
                  {relogioMensalData.isMesAtual && relogioMensalData.diasRestantes > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Meta Diária Necessária:</span>
                      <span className="font-bold text-amber-400">
                        {utils.formatarMoeda(relogioMensalData.metaDiariaNecessaria)}/dia
                      </span>
                    </div>
                  )}
                  {relogioMensalData.isMesAtual && (
                    <div className="flex justify-between text-slate-300">
                      <span>Projeção Final do Mês:</span>
                      <span className="font-bold text-[#76FF03]">
                        {utils.formatarMoeda(relogioMensalData.projecaoFimMes)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid dos 4 Cards Principais de Separação (EXPRESSO ///// PROMOCIONAL) */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. FATURAMENTO TOTAL DO MÊS */}
                <div className="glass-morphism p-5 rounded-2xl border border-[#76FF03]/30 bg-gradient-to-br from-[#76FF03]/10 to-transparent flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#76FF03] uppercase tracking-wider">Faturamento Total do Mês</span>
                      <DollarSign className="w-5 h-5 text-[#76FF03]" />
                    </div>
                    <h3 className="text-3xl font-black text-white font-['Outfit']">
                      {utils.formatarMoeda(relogioMensalData.faturamentoTotal)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {relogioMensalData.totalPedidos} pedidos finalizados no mês
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs text-slate-300">
                    <span>Ticket Médio:</span>
                    <span className="font-bold text-[#76FF03]">{utils.formatarMoeda(relogioMensalData.ticketMedio)}</span>
                  </div>
                </div>

                {/* 2. QUANTIDADE TOTAL VENDIDA */}
                <div className="glass-morphism p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Quantidade Total de Vapes</span>
                      <ShoppingBag className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-3xl font-black text-white font-['Outfit']">
                      {relogioMensalData.quantidadeTotal} <span className="text-sm font-normal text-slate-400">unidades</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Meta: {metaMensalQtd} un ({relogioMensalData.percentualQtd.toFixed(0)}% batida)
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs text-slate-300">
                    <span>Faltam para meta:</span>
                    <span className="font-bold text-blue-400">{relogioMensalData.qtdFaltante} un</span>
                  </div>
                </div>

                {/* 3. SEPARAÇÃO: VENDAS EXPRESSO */}
                <div className="glass-morphism p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-4 h-4" /> Vendas Expresso (Pronta Entrega)
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-white font-['Outfit']">
                      {utils.formatarMoeda(relogioMensalData.faturamentoExpresso)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      <strong>{relogioMensalData.quantidadeExpresso}</strong> vapes expressos vendidos
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs text-slate-300">
                    <span>Participação no Faturamento:</span>
                    <span className="font-bold text-emerald-400">
                      {relogioMensalData.faturamentoTotal > 0
                        ? ((relogioMensalData.faturamentoExpresso / relogioMensalData.faturamentoTotal) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>

                {/* 4. SEPARAÇÃO: VENDAS PROMOCIONAL */}
                <div className="glass-morphism p-5 rounded-2xl border border-[#FF3366]/30 bg-gradient-to-br from-[#FF3366]/10 to-transparent flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#FF3366] uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="w-4 h-4" /> Vendas Promocional
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-white font-['Outfit']">
                      {utils.formatarMoeda(relogioMensalData.faturamentoPromo)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      <strong>{relogioMensalData.quantidadePromo}</strong> vapes promocionais vendidos
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs text-slate-300">
                    <span>Participação no Faturamento:</span>
                    <span className="font-bold text-[#FF3366]">
                      {relogioMensalData.faturamentoTotal > 0
                        ? ((relogioMensalData.faturamentoPromo / relogioMensalData.faturamentoTotal) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* GRÁFICOS DO RELÓGIO MENSAL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico de Evolução Acumulada do Mês (1º ao Último Dia) */}
              <div className="lg:col-span-2 glass-morphism p-5 rounded-2xl border border-white/10 bg-black/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100 font-['Outfit'] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#76FF03]" /> Evolução Diária Acumulada no Mês (R$)
                  </h3>
                  <span className="text-xs text-slate-400">1º a {relogioMensalData.diasNoMes} de {relogioMensalData.mesLabel}</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={relogioMensalData.diasTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradAcumulado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#76FF03" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#76FF03" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="dataStr" stroke="#666" fontSize={10} tickLine={false} />
                      <YAxis stroke="#666" fontSize={10} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#090d0a', borderColor: '#76FF03', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(val: any) => [utils.formatarMoeda(Number(val)), 'Acumulado']}
                      />
                      <Area type="monotone" dataKey="acumulado" stroke="#76FF03" strokeWidth={3} fillOpacity={1} fill="url(#gradAcumulado)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico Comparativo de Faturamento: Expresso vs Promocional */}
              <div className="glass-morphism p-5 rounded-2xl border border-white/10 bg-black/40 space-y-4 flex flex-col justify-between">
                <h3 className="text-sm font-bold text-slate-100 font-['Outfit'] flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#FF3366]" /> Divisão Expresso vs Promo
                </h3>

                <div className="h-48 w-full flex items-center justify-center">
                  {relogioMensalData.faturamentoTotal > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Expresso', value: relogioMensalData.faturamentoExpresso, color: '#76FF03' },
                            { name: 'Promocional', value: relogioMensalData.faturamentoPromo, color: '#FF3366' }
                          ]}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={45}
                          paddingAngle={5}
                        >
                          <Cell fill="#76FF03" />
                          <Cell fill="#FF3366" />
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#090d0a', borderColor: '#444', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(val: any) => [utils.formatarMoeda(Number(val)), '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-500">Sem vendas registradas neste mês</p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#76FF03]" /> Expresso:
                    </span>
                    <span className="font-bold text-[#76FF03]">
                      {utils.formatarMoeda(relogioMensalData.faturamentoExpresso)} ({relogioMensalData.quantidadeExpresso} un)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF3366]" /> Promocional:
                    </span>
                    <span className="font-bold text-[#FF3366]">
                      {utils.formatarMoeda(relogioMensalData.faturamentoPromo)} ({relogioMensalData.quantidadePromo} un)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* TABELA DE RANKING DOS PRODUTOS MAIS VENDIDOS NO MÊS */}
            <div className="glass-morphism p-5 rounded-2xl border border-white/10 bg-black/40 space-y-4">
              <h3 className="text-sm font-bold text-slate-100 font-['Outfit'] flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Ranking dos Vapes Mais Vendidos no Mês ({relogioMensalData.mesLabel})
              </h3>

              {relogioMensalData.rankingOrdenado.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhum vape vendido ainda neste mês.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-slate-400 uppercase">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Modelo</th>
                        <th className="py-2.5 px-3">Modalidade</th>
                        <th className="py-2.5 px-3">Qtd Vendida</th>
                        <th className="py-2.5 px-3">Receita Gerada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relogioMensalData.rankingOrdenado.map((item, idx) => (
                        <tr key={item.nome} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2.5 px-3 font-bold text-slate-400">#{idx + 1}</td>
                          <td className="py-2.5 px-3 text-slate-100 font-bold">{item.nome}</td>
                          <td className="py-2.5 px-3">
                            {item.is_promo ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF3366]/20 text-[#FF3366]">
                                Promocional
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#76FF03]/20 text-[#76FF03]">
                                Expresso
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-100 font-extrabold">{item.quantidade} un</td>
                          <td className="py-2.5 px-3 text-[#76FF03] font-bold">{utils.formatarMoeda(item.receita)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : abaAtiva === 'pedidos' ? (
          /* SEÇÃO DE PEDIDOS COM DASHBOARD */
          <section className="space-y-8">
            {/* Dashboard de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-morphism p-5 rounded-xl border border-[#76FF03]/20 bg-[#76FF03]/5">
                <p className="text-[10px] font-bold text-[#76FF03] uppercase font-semibold mb-1">Faturamento {filtroData ? 'do Dia' : 'Total'}</p>
                <h3 className="text-2xl font-bold text-slate-100">
                  {utils.formatarMoeda(pedidosFiltrados.reduce((acc, p) => acc + p.total_final, 0))}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Líquido (após descontos)</p>
              </div>

              <div className="glass-morphism p-5 rounded-xl border border-blue-500/20 bg-blue-500/5">
                <p className="text-[10px] font-bold text-blue-400 uppercase font-semibold mb-1">Itens Vendidos</p>
                <h3 className="text-2xl font-bold text-slate-100">
                  {pedidosFiltrados.reduce((acc, p) => acc + p.itens.reduce((sum, i) => sum + i.quantidade, 0), 0)} un
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Total de pods em pedidos</p>
              </div>

              <div className="glass-morphism p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                <p className="text-[10px] font-bold text-yellow-500 uppercase font-semibold mb-1">Status Pedidos</p>
                <div className="flex gap-3 items-baseline">
                  <h3 className="text-2xl font-bold text-slate-100">
                    {pedidosFiltrados.filter(p => !p.status_checklist).length}
                  </h3>
                  <span className="text-xs text-yellow-500 font-bold">Pendentes</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{pedidosFiltrados.filter(p => p.status_checklist).length} Concluídos</p>
              </div>

              <div className="glass-morphism p-5 rounded-xl border border-red-500/20 bg-red-500/5">
                <p className="text-[10px] font-bold text-red-400 uppercase font-semibold mb-1">Top Indicação</p>
                <h3 className="text-xl font-bold text-slate-100 truncate">
                  {(() => {
                    const counts: { [key: string]: number } = {};
                    pedidosFiltrados.forEach(p => { if(p.indicacao) counts[p.indicacao] = (counts[p.indicacao] || 0) + 1 });
                    const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
                    return top ? `${top[0]} (${top[1]})` : 'Nenhuma';
                  })()}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Origem com mais vendas</p>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <h2 className="text-2xl font-bold neon-glow font-['Outfit'] font-bold">Lista de Pedidos</h2>
                <div className="flex bg-black/40 p-1 rounded-lg border border-[#76FF03]/20 self-start">
                  <button 
                    onClick={() => setSubAbaPedidos('ativos')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${subAbaPedidos === 'ativos' ? 'bg-[#76FF03] text-black shadow-[0_0_10px_rgba(118,255,3,0.3)]' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    Ativos ({pedidos.length})
                  </button>
                  <button 
                    onClick={() => setSubAbaPedidos('excluidos')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${subAbaPedidos === 'excluidos' ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    <Trash2 className="w-3 h-3" /> Lixeira ({pedidosExcluidos.length})
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-[#76FF03]/30">
                  <MapPin className="w-4 h-4 text-[#76FF03] ml-1" />
                  <select
                    value={filtroZonaPedido}
                    onChange={(e) => setFiltroZonaPedido(e.target.value)}
                    className="bg-black/80 text-slate-100 text-xs font-bold rounded px-2.5 py-1.5 outline-none border border-transparent focus:border-[#76FF03]"
                  >
                    <option value="todas">Todas as Regiões</option>
                    <option value="norte">Zona Norte</option>
                    <option value="sul">Zona Sul</option>
                    <option value="oeste">Zona Oeste</option>
                  </select>
                </div>

                <div className="relative flex items-center">
                  <div className="absolute left-3 text-[#76FF03]/60">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input 
                    type="date" 
                    value={filtroData}
                    onChange={(e) => setFiltroData(e.target.value)}
                    className="bg-black/40 border border-[#76FF03]/30 text-[#76FF03] pl-10 pr-4 py-2 rounded-lg text-sm focus:border-[#76FF03] outline-none transition-all"
                  />
                  {filtroData && (
                    <button 
                      onClick={() => setFiltroData('')}
                      className="absolute right-3 text-red-400 hover:text-red-500 transition-colors"
                      title="Limpar filtro"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button onClick={handleExportarPedidos} className="flex items-center gap-2 px-4 py-2 bg-[#76FF03]/20 border border-[#76FF03] text-[#76FF03] rounded-lg font-bold hover:bg-[#76FF03]/30 transition-all duration-300">
                  <Download className="w-4 h-4" /> Exportar {subAbaPedidos === 'ativos' ? 'Vendas' : 'Lixeira'}
                </button>
              </div>
            </div>

            <div className="grid gap-6">
              {pedidosFiltrados.length === 0 ? (
                <div className="glass-morphism p-12 rounded-xl text-center border border-dashed border-[#76FF03]/20">
                  <p className="text-slate-400">
                    {filtroData 
                      ? `Nenhum pedido encontrado para o dia ${new Date(filtroData + 'T12:00:00').toLocaleDateString('pt-BR')}`
                      : subAbaPedidos === 'ativos' ? 'Nenhum pedido ativo encontrado' : 'A lixeira está vazia'}
                  </p>
                </div>
              ) : (
                pedidosFiltrados.map((pedido) => (
                  <div key={pedido.id} className={`glass-morphism p-6 rounded-xl border transition-all duration-300 ${pedido.status_checklist ? 'border-[#76FF03]/20 opacity-80' : 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]'} ${subAbaPedidos === 'excluidos' ? 'border-red-500/30 grayscale-[0.5]' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${pedido.status_checklist ? 'bg-[#76FF03]/20' : 'bg-yellow-500/20'} ${subAbaPedidos === 'excluidos' ? 'bg-red-500/20' : ''}`}>
                          <ShoppingBag className={`w-6 h-6 ${pedido.status_checklist ? 'text-[#76FF03]' : 'text-yellow-500'} ${subAbaPedidos === 'excluidos' ? 'text-red-400' : ''}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-slate-100 font-['Outfit'] font-bold">Pedido #{pedido.numero_pedido}</h3>
                            {pedido.status_checklist ? (
                              <span className="px-2 py-0.5 bg-[#76FF03]/20 text-[#76FF03] rounded text-[10px] font-bold">CONCLUÍDO</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded text-[10px] font-bold">PENDENTE</span>
                            )}
                            {pedido.zona && (
                              <span className="px-2 py-0.5 bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40 rounded text-[10px] font-bold flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" /> {pedido.zona}
                              </span>
                            )}
                            {subAbaPedidos === 'excluidos' && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold flex items-center gap-1">
                                <Trash2 className="w-2 h-2" /> EXCLUÍDO
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{pedido.created_at ? new Date(pedido.created_at).toLocaleString('pt-BR') : '-'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {subAbaPedidos === 'ativos' ? (
                          <>
                            <button onClick={() => handleAtualizarStatusPedido(pedido.id, !pedido.status_checklist)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 ${pedido.status_checklist ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-[#76FF03] text-black'}`}>
                              {pedido.status_checklist ? 'Reabrir' : 'Checklist'}
                            </button>
                            <button onClick={() => handleDeletarPedido(pedido.id, pedido.numero_pedido)} className="p-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/40 transition-all"><Trash2 className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleRestaurarPedido(pedido.id, pedido.numero_pedido)} 
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-bold text-xs hover:bg-blue-600 transition-all shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                          >
                            Restaurar Pedido
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4 text-sm">
                        <div className={`bg-black/30 p-4 rounded-lg border ${subAbaPedidos === 'excluidos' ? 'border-red-500/10' : 'border-[#76FF03]/10'}`}>
                          <h4 className={`text-[10px] font-bold uppercase mb-2 ${subAbaPedidos === 'excluidos' ? 'text-red-400' : 'text-[#76FF03]'}`}>Itens</h4>
                          {pedido.itens.map((item, idx) => {
                            const produtoOriginal = produtos.find(prod => prod.id === item.id);
                            const marca = item.marca || (produtoOriginal ? produtoOriginal.marca : '');
                            return (
                              <div key={idx} className={`flex justify-between border-b py-1 ${subAbaPedidos === 'excluidos' ? 'border-red-500/5' : 'border-[#76FF03]/5'}`}>
                                <span>{item.quantidade}x {marca ? marca.toUpperCase() + ' ' : ''}{item.nome} ({item.sabor})</span>
                                <span className={subAbaPedidos === 'excluidos' ? 'text-red-400' : 'text-[#76FF03]'}>{utils.formatarMoeda(item.preco_unitario * item.quantidade)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between px-2">
                          <div><h4 className="text-[10px] text-slate-400 uppercase">Cliente</h4><p className="text-slate-100">{pedido.nome_cliente}</p></div>
                          <div className="text-right"><h4 className="text-[10px] text-slate-400 uppercase">WhatsApp</h4><p className={subAbaPedidos === 'excluidos' ? 'text-red-400' : 'text-[#76FF03]'}>{pedido.telefone_cliente}</p></div>
                        </div>
                        <div className="flex justify-between px-2">
                          <div>
                            <h4 className="text-[10px] text-slate-400 uppercase">Região</h4>
                            <p className="text-[#76FF03] font-bold">{pedido.zona || 'Não informada'}</p>
                          </div>
                          <div className="text-right">
                            <h4 className="text-[10px] text-slate-400 uppercase">Indicação</h4>
                            <p className="text-blue-400 font-bold">{pedido.indicacao || 'Nenhuma'}</p>
                          </div>
                        </div>
                      </div>

                      <div className={`bg-black/30 p-4 rounded-lg border flex flex-col justify-center space-y-2 ${subAbaPedidos === 'excluidos' ? 'border-red-500/20' : 'border-[#76FF03]/20'}`}>
                        <div className="flex justify-between text-xs"><span>Subtotal</span><span>{utils.formatarMoeda(pedido.total)}</span></div>
                        <div className="flex justify-between items-center text-xs">
                          <span>Desconto</span>
                          {editandoFinanceiro?.id === pedido.id && subAbaPedidos === 'ativos' ? (
                            <div className="flex gap-1"><input type="number" value={editandoFinanceiro.desconto} onChange={(e) => setEditandoFinanceiro({ ...editandoFinanceiro, desconto: e.target.value })} className="w-16 bg-black border border-[#76FF03]/50 px-1 py-0.5 text-right outline-none" /><button onClick={() => handleAtualizarFinanceiroPedido(pedido.id)} className="p-0.5 bg-[#76FF03] text-black rounded"><Save className="w-3 h-3" /></button></div>
                          ) : (
                            <div className="flex gap-1 text-red-400">
                              <span>- {utils.formatarMoeda(pedido.desconto)}</span>
                              {subAbaPedidos === 'ativos' && <button onClick={() => setEditandoFinanceiro({ id: pedido.id, desconto: pedido.desconto.toString() })}><Edit2 className="w-3 h-3" /></button>}
                            </div>
                          )}
                        </div>
                        <div className={`pt-2 border-t flex justify-between font-bold ${subAbaPedidos === 'excluidos' ? 'border-red-500/20 text-red-400' : 'border-[#76FF03]/20 text-[#76FF03]'}`}>
                          <span className="font-semibold">TOTAL</span>
                          <span className="text-2xl">{utils.formatarMoeda(pedido.total_final)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : abaAtiva === 'clientes' ? (
          /* SEÇÃO DE CLIENTES & RELATÓRIOS WHATSAPP (CADASTRO ÚNICO) */
          <section className="space-y-6 animate-in fade-in duration-300">
            {/* Header da Seção */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold neon-glow font-['Outfit'] flex items-center gap-2">
                    <Users className="w-6 h-6 text-[#76FF03]" /> Base Única de Clientes & Relatórios WhatsApp
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40 font-bold">
                    {clientes.length} {clientes.length === 1 ? 'cliente único' : 'clientes únicos'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  1 Número de WhatsApp = 1 Cadastro permanente com histórico consolidado de conversas, compras e trocas sem duplicidades
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleSincronizarClientes}
                  disabled={sincronizandoClientes}
                  className="flex items-center gap-2 px-3.5 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg font-bold text-xs hover:bg-blue-500/30 transition-all disabled:opacity-50"
                  title="Varre todos os pedidos e trocas existentes para cadastrar e consolidar clientes anteriores"
                >
                  <RefreshCw className={`w-4 h-4 ${sincronizandoClientes ? 'animate-spin' : ''}`} />
                  {sincronizandoClientes ? 'Sincronizando...' : 'Sincronizar Pedidos Anteriores'}
                </button>
                <button
                  onClick={handleExportarRelatorioClientesCSV}
                  disabled={relatorioClientesConsolidado.length === 0}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#76FF03]/15 border border-[#76FF03]/50 text-[#76FF03] rounded-lg font-bold text-xs hover:bg-[#76FF03]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" /> Exportar Relatório ({relatorioClientesConsolidado.length})
                </button>
                <button
                  onClick={() => {
                    setFormNovoCliente({ nome: '', telefone: '', zona: 'norte', observacoes: '' });
                    setModalNovoClienteAberto(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#76FF03] text-black rounded-lg font-bold text-xs hover:shadow-[0_0_15px_rgba(118,255,3,0.5)] transition-all"
                >
                  <Plus className="w-4 h-4" /> Novo Cliente Manual
                </button>
              </div>
            </div>

            {/* Aviso se estiver usando armazenamento de fallback */}
            {usandoFallbackClientes && (
              <div className="p-3.5 bg-yellow-500/10 border border-yellow-500/40 rounded-xl flex items-start gap-3 text-xs text-yellow-300">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-yellow-200">Armazenamento Local / Fallback Ativo</strong>
                  <p className="text-[11px] text-yellow-300/80 mt-0.5">
                    Os clientes e histórico estão sendo salvos normalmente no sistema. Para persistência nativa com índices de alta velocidade e integridade no PostgreSQL, execute o script SQL da seção <strong>Tabelas de Clientes</strong> no editor SQL do Supabase.
                  </p>
                </div>
              </div>
            )}

            {/* BARRA DE FILTRO POR PERÍODO (Flexível para qualquer intervalo e anos diferentes) */}
            <div className="glass-morphism p-4 sm:p-5 rounded-2xl border border-[#76FF03]/20 space-y-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                {/* Atalhos Rápidos */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mr-1">
                    <Calendar className="w-3.5 h-3.5 text-[#76FF03]" /> Período:
                  </span>
                  {[
                    { id: 'tudo', label: 'Todo Histórico' },
                    { id: 'hoje', label: 'Hoje' },
                    { id: '7d', label: '7 Dias' },
                    { id: '30d', label: '30 Dias' },
                    { id: 'mes_atual', label: 'Mês Atual' },
                    { id: 'ano_atual', label: 'Ano Atual' },
                    { id: '2026_2027', label: 'Set/2026 a Set/2027 (Exemplo)' },
                    { id: 'custom', label: 'Personalizado' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => handleAplicarAtalhoPeriodoCliente(btn.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        filtroPeriodoCliente === btn.id
                          ? 'bg-[#76FF03] text-black border-[#76FF03] shadow-[0_0_10px_rgba(118,255,3,0.3)]'
                          : 'bg-black/50 text-slate-300 border-white/10 hover:border-[#76FF03]/40'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Seleção de Datas Personalizadas (De / Até) */}
                <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto bg-black/40 p-2 rounded-xl border border-white/10">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">De:</span>
                    <input
                      type="date"
                      value={dataInicioCliente}
                      onChange={(e) => {
                        setDataInicioCliente(e.target.value);
                        setFiltroPeriodoCliente('custom');
                      }}
                      className="bg-black/80 border border-[#76FF03]/40 text-slate-100 px-2.5 py-1 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Até:</span>
                    <input
                      type="date"
                      value={dataFimCliente}
                      onChange={(e) => {
                        setDataFimCliente(e.target.value);
                        setFiltroPeriodoCliente('custom');
                      }}
                      className="bg-black/80 border border-[#76FF03]/40 text-slate-100 px-2.5 py-1 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                    />
                  </div>
                </div>
              </div>

              {/* Filtros Secundários: Busca & Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-white/10">
                {/* Campo de Busca Instantânea */}
                <div className="md:col-span-8 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nome, telefone ou WhatsApp (ex: 81999999999)..."
                    value={pesquisaCliente}
                    onChange={(e) => setPesquisaCliente(e.target.value)}
                    className="w-full bg-black/60 border border-[#76FF03]/30 text-slate-100 pl-10 pr-4 py-2 rounded-xl outline-none text-xs focus:border-[#76FF03] placeholder:text-slate-500"
                  />
                  {pesquisaCliente && (
                    <button
                      onClick={() => setPesquisaCliente('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtro por Tipo de Cliente */}
                <div className="md:col-span-4">
                  <select
                    value={filtroTipoCliente}
                    onChange={(e) => setFiltroTipoCliente(e.target.value as any)}
                    className="w-full bg-black/60 border border-[#76FF03]/30 text-slate-100 px-3 py-2 rounded-xl outline-none text-xs focus:border-[#76FF03]"
                  >
                    <option value="todos">Todos os Clientes do Período</option>
                    <option value="com_compras">Apenas Clientes com Compras</option>
                    <option value="com_trocas">Apenas Clientes com Trocas/Garantia</option>
                    <option value="recorrentes">Apenas Clientes Recorrentes (2+ interações)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CARDS DE RESUMO E MÉTRICAS CONSOLIDADAS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="glass-morphism p-3.5 sm:p-4 rounded-xl border border-[#76FF03]/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold">Clientes Únicos</span>
                  <Users className="w-4 h-4 text-[#76FF03]" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                  {metricasClientes.totalClientesUnicos}
                </p>
                <p className="text-[10px] text-slate-400">
                  {metricasClientes.totalCadastradosGeral} no total geral
                </p>
              </div>

              <div className="glass-morphism p-3.5 sm:p-4 rounded-xl border border-blue-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold">Novos Clientes</span>
                  <UserPlus className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-blue-400 font-['Outfit']">
                  {metricasClientes.novosClientes}
                </p>
                <p className="text-[10px] text-slate-400">1º contato no período</p>
              </div>

              <div className="glass-morphism p-3.5 sm:p-4 rounded-xl border border-purple-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold">Recorrentes</span>
                  <Repeat className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-purple-400 font-['Outfit']">
                  {metricasClientes.clientesRecorrentes}
                </p>
                <p className="text-[10px] text-slate-400">2 ou mais contatos</p>
              </div>

              <div className="glass-morphism p-3.5 sm:p-4 rounded-xl border border-yellow-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold">Interações</span>
                  <MessageSquare className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-yellow-400 font-['Outfit']">
                  {metricasClientes.totalInteracoes}
                </p>
                <p className="text-[10px] text-slate-400">{metricasClientes.totalPedidos} pedidos gerados</p>
              </div>

              <div className="glass-morphism p-3.5 sm:p-4 rounded-xl border border-[#76FF03]/40 space-y-1 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold">Faturamento</span>
                  <DollarSign className="w-4 h-4 text-[#76FF03]" />
                </div>
                <p className="text-lg sm:text-xl font-black text-[#76FF03] font-['Outfit']">
                  {utils.formatarMoeda(metricasClientes.faturamentoPeriodo)}
                </p>
                <p className="text-[10px] text-slate-400">compras no período</p>
              </div>
            </div>

            {/* TABELA / RELATÓRIO CONSOLIDADO SEM DUPLICIDADES */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  Exibindo <strong>{relatorioClientesConsolidado.length}</strong> clientes consolidados (sem duplicidades)
                </span>
                <span>
                  Período: <strong>{new Date(dataInicioCliente + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> até <strong>{new Date(dataFimCliente + 'T23:59:59').toLocaleDateString('pt-BR')}</strong>
                </span>
              </div>

              {relatorioClientesConsolidado.length === 0 ? (
                <div className="p-12 text-center glass-morphism rounded-2xl border border-dashed border-white/10 space-y-3">
                  <Users className="w-12 h-12 text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-300">Nenhum cliente encontrado para os filtros selecionados</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Tente selecionar um período maior (ex: Todo Histórico) ou clique em "Sincronizar Pedidos Anteriores" para carregar todo o histórico do banco.
                  </p>
                  <button
                    onClick={() => handleAplicarAtalhoPeriodoCliente('tudo')}
                    className="px-4 py-2 bg-[#76FF03]/20 border border-[#76FF03] text-[#76FF03] rounded-lg text-xs font-bold hover:bg-[#76FF03]/30 transition-all"
                  >
                    Ver Todo o Histórico
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {relatorioClientesConsolidado.map((item) => {
                    const telLimpo = normalizarTelefoneWhatsApp(item.cliente.telefone);
                    const linkWhatsApp = `https://wa.me/${telLimpo}`;
                    const temMultiplasInteracoes = item.interacoes_no_periodo > 1 || item.cliente.total_interacoes > 1;

                    return (
                      <div
                        key={item.cliente.telefone_normalizado}
                        className="glass-morphism p-4 sm:p-5 rounded-xl border border-white/10 hover:border-[#76FF03]/50 transition-all duration-300 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                      >
                        {/* Identificação do Cliente */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#76FF03]/20 to-blue-500/20 border border-[#76FF03]/40 flex items-center justify-center font-bold text-white text-sm shadow-[0_0_15px_rgba(118,255,3,0.15)] flex-shrink-0">
                            {item.cliente.nome.charAt(0).toUpperCase() || 'C'}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-white font-['Outfit'] truncate">
                                {item.cliente.nome}
                              </h3>
                              {temMultiplasInteracoes ? (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold flex items-center gap-1">
                                  <Repeat className="w-2.5 h-2.5" /> Recorrente
                                </span>
                              ) : (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                                  Novo Cliente
                                </span>
                              )}
                              {item.cliente.zona_frequente && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                                  {item.cliente.zona_frequente}
                                </span>
                              )}
                            </div>

                            {/* WhatsApp com Link Direto */}
                            <div className="flex items-center gap-2 mt-1">
                              <a
                                href={linkWhatsApp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#76FF03]/10 hover:bg-[#76FF03]/20 border border-[#76FF03]/40 text-[#76FF03] rounded-md text-xs font-mono font-bold transition-all"
                                title="Abrir conversa no WhatsApp"
                              >
                                <Phone className="w-3 h-3 text-[#76FF03]" />
                                {formatarTelefoneExibicao(item.cliente.telefone)}
                              </a>
                              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                                ID: {item.cliente.telefone_normalizado}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Informações Consolidadas do Período */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto text-left py-2 sm:py-0 border-y sm:border-y-0 border-white/5">
                          {/* Primeiro Contato */}
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">1º Contato</span>
                            <span className="text-xs text-slate-200 font-medium">
                              {new Date(item.primeiro_contato_periodo).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {new Date(item.primeiro_contato_periodo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Último Contato */}
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Último Contato</span>
                            <span className="text-xs text-[#76FF03] font-medium">
                              {new Date(item.ultimo_contato_periodo).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {new Date(item.ultimo_contato_periodo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Interações no Período */}
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Interações</span>
                            <span className="text-xs text-yellow-400 font-bold">
                              {item.interacoes_no_periodo} {item.interacoes_no_periodo === 1 ? 'registro' : 'registros'}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {item.cliente.total_interacoes} no histórico
                            </span>
                          </div>

                          {/* Compras no Período */}
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Compras</span>
                            <span className="text-xs text-white font-bold">
                              {item.pedidos_no_periodo} {item.pedidos_no_periodo === 1 ? 'pedido' : 'pedidos'}
                            </span>
                            <span className="text-[10px] text-[#76FF03] font-bold block">
                              {utils.formatarMoeda(item.valor_total_no_periodo)}
                            </span>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                          <button
                            onClick={() => handleAbrirDetalhesCliente(item.cliente)}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 rounded-lg text-xs font-bold transition-all"
                          >
                            <History className="w-3.5 h-3.5 text-[#76FF03]" /> Histórico & Detalhes
                          </button>

                          <a
                            href={linkWhatsApp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#76FF03] hover:bg-[#64dd00] text-black rounded-lg text-xs font-bold shadow-[0_0_12px_rgba(118,255,3,0.3)] transition-all"
                            title="Conversar no WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5" /> Conversar
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : abaAtiva === 'trocas' ? (
          /* SEÇÃO DE TROCAS & GARANTIA */
          <section className="space-y-6 animate-in fade-in duration-300">
            {/* Header da Seção */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold neon-glow font-['Outfit'] flex items-center gap-2">
                    <RefreshCw className="w-6 h-6 text-[#76FF03]" /> Registro de Trocas & Garantia
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40 font-bold">
                    {trocas.length} {trocas.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Controle de vapes com defeito de fábrica, clientes atendidos, motivos e histórico de substituições
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleExportarTrocas}
                  disabled={trocas.length === 0}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#76FF03]/15 border border-[#76FF03]/50 text-[#76FF03] rounded-lg font-bold text-xs hover:bg-[#76FF03]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" /> Exportar CSV
                </button>
                <button
                  onClick={abrirModalNovaTroca}
                  className="flex items-center gap-2 px-4 py-2 bg-[#76FF03] text-black rounded-lg font-bold text-xs hover:shadow-[0_0_15px_rgba(118,255,3,0.5)] transition-all"
                >
                  <Plus className="w-4 h-4" /> Registrar Troca
                </button>
              </div>
            </div>

            {/* Aviso se estiver usando armazenamento de fallback */}
            {usandoFallbackTrocas && (
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/40 rounded-xl flex items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-blue-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>Armazenamento Sincronizado:</strong> Os registros estão ativos e salvos no sistema. Caso queira a tabela dedicada no banco Supabase, execute o script SQL de <code>trocas</code> disponível no <code>SETUP_SUPABASE.md</code>.
                  </span>
                </div>
              </div>
            )}

            {/* 4 Cards de Métricas / Resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="glass-morphism p-4 sm:p-5 rounded-xl border border-[#76FF03]/20 relative overflow-hidden group hover:border-[#76FF03]/40 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Trocas</p>
                    <h3 className="text-xl sm:text-2xl font-black text-white font-['Outfit'] mt-1">{estatisticasTrocas.total}</h3>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-lg bg-[#76FF03]/10 text-[#76FF03] border border-[#76FF03]/30">
                    <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Histórico completo registrado</p>
              </div>

              <div className="glass-morphism p-4 sm:p-5 rounded-xl border border-[#76FF03]/20 relative overflow-hidden group hover:border-[#76FF03]/40 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Trocas no Mês</p>
                    <h3 className="text-xl sm:text-2xl font-black text-[#76FF03] font-['Outfit'] mt-1">{estatisticasTrocas.noMes}</h3>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-lg bg-[#76FF03]/10 text-[#76FF03] border border-[#76FF03]/30">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Neste mês corrente</p>
              </div>

              <div className="glass-morphism p-4 sm:p-5 rounded-xl border border-amber-500/30 relative overflow-hidden group hover:border-amber-500/50 transition-all">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Top Vape c/ Defeito</p>
                    <h3 className="text-sm sm:text-base font-black text-amber-400 font-['Outfit'] mt-1 truncate" title={estatisticasTrocas.topVape}>
                      {estatisticasTrocas.topVape}
                    </h3>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  {estatisticasTrocas.topVapeQtd > 0 ? `${estatisticasTrocas.topVapeQtd} ocorrência(s)` : 'Sem registros'}
                </p>
              </div>

              <div className="glass-morphism p-4 sm:p-5 rounded-xl border border-red-500/30 relative overflow-hidden group hover:border-red-500/50 transition-all">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Principal Motivo</p>
                    <h3 className="text-sm sm:text-base font-black text-red-400 font-['Outfit'] mt-1 truncate" title={estatisticasTrocas.topMotivo}>
                      {estatisticasTrocas.topMotivo}
                    </h3>
                  </div>
                  <div className="p-2 sm:p-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 flex-shrink-0">
                    <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  {estatisticasTrocas.topMotivoQtd > 0 ? `${estatisticasTrocas.topMotivoQtd} ocorrência(s)` : 'Sem registros'}
                </p>
              </div>
            </div>

            {/* Barra de Busca e Filtros */}
            <div className="glass-morphism p-4 rounded-xl border border-[#76FF03]/20 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Input de Pesquisa */}
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pesquisaTroca}
                    onChange={(e) => setPesquisaTroca(e.target.value)}
                    placeholder="Buscar por cliente, vape, sabor ou motivo..."
                    className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 pl-9 pr-4 py-2 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                  />
                  {pesquisaTroca && (
                    <button onClick={() => setPesquisaTroca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtro por Motivo */}
                <div>
                  <select
                    value={filtroMotivoTroca}
                    onChange={(e) => setFiltroMotivoTroca(e.target.value)}
                    className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3 py-2 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                  >
                    <option value="todos">Todos os Motivos</option>
                    <option value="queimado">Gosto de Queimado</option>
                    <option value="bateria">Bateria / Não Liga</option>
                    <option value="vazamento">Vazamento de Líquido</option>
                    <option value="disparo">Disparo Contínuo / Sensor</option>
                    <option value="carrega">Não Carrega / Tipo-C</option>
                    <option value="puxada">Sem Puxada / Sem Fluxo</option>
                    <option value="outros">Outros Motivos</option>
                  </select>
                </div>

                {/* Filtro por Período */}
                <div>
                  <select
                    value={filtroPeriodoTroca}
                    onChange={(e) => setFiltroPeriodoTroca(e.target.value as any)}
                    className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3 py-2 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                  >
                    <option value="todos">Todo o Período</option>
                    <option value="hoje">Hoje</option>
                    <option value="7d">Últimos 7 dias</option>
                    <option value="30d">Últimos 30 dias</option>
                    <option value="mes_atual">Este Mês</option>
                  </select>
                </div>

                {/* Filtro por Status */}
                <div>
                  <select
                    value={filtroStatusTroca}
                    onChange={(e) => setFiltroStatusTroca(e.target.value)}
                    className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3 py-2 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="concluida">Concluída</option>
                    <option value="pendente">Pendente</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              {(pesquisaTroca || filtroMotivoTroca !== 'todos' || filtroPeriodoTroca !== 'todos' || filtroStatusTroca !== 'todos') && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400">
                  <span>Exibindo {trocasFiltradas.length} de {trocas.length} trocas</span>
                  <button
                    onClick={() => {
                      setPesquisaTroca('');
                      setFiltroMotivoTroca('todos');
                      setFiltroPeriodoTroca('todos');
                      setFiltroStatusTroca('todos');
                    }}
                    className="text-[#76FF03] hover:underline"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Listagem de Trocas */}
            {trocasFiltradas.length === 0 ? (
              <div className="glass-morphism p-12 rounded-xl text-center border border-white/10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#76FF03]/10 border border-[#76FF03]/30 flex items-center justify-center mx-auto text-[#76FF03]">
                  <RefreshCw className="w-8 h-8 opacity-70" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white font-['Outfit']">Nenhuma troca encontrada</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {trocas.length === 0
                      ? 'Nenhum registro de troca foi cadastrado até o momento. Clique no botão abaixo para registrar a primeira troca de vape.'
                      : 'Nenhum registro corresponde aos filtros selecionados acima.'}
                  </p>
                </div>
                {trocas.length === 0 && (
                  <button
                    onClick={abrirModalNovaTroca}
                    className="cyber-button inline-flex items-center gap-2 text-xs"
                  >
                    <Plus className="w-4 h-4" /> Registrar Primeira Troca
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {trocasFiltradas.map((troca) => {
                  const dataObj = new Date(troca.data_troca);
                  const dataStr = dataObj.toLocaleDateString('pt-BR');
                  const horaStr = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const telLimpo = (troca.cliente_telefone || '').replace(/\D/g, '');

                  return (
                    <div
                      key={troca.id}
                      className="glass-morphism p-4 sm:p-5 rounded-xl border border-white/10 hover:border-[#76FF03]/40 transition-all duration-300 space-y-4"
                    >
                      {/* Linha Superior: Data, Status e Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-[#76FF03]" />
                          <span className="font-bold text-white">{dataStr}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{horaStr}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {troca.zona && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {troca.zona === 'norte' ? 'Zona Norte' : troca.zona === 'sul_oeste' ? 'Zona Oeste/Sul' : troca.zona}
                            </span>
                          )}

                          {troca.abateu_estoque && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#76FF03]/15 text-[#76FF03] border border-[#76FF03]/30 font-bold" title="Estoque do novo vape foi baixado automaticamente">
                              -1 Estoque
                            </span>
                          )}

                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                            troca.status === 'pendente'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : troca.status === 'cancelada'
                              ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : 'bg-[#76FF03]/20 text-[#76FF03] border-[#76FF03]/40'
                          }`}>
                            {troca.status === 'pendente' ? 'Pendente' : troca.status === 'cancelada' ? 'Cancelada' : 'Concluída'}
                          </span>
                        </div>
                      </div>

                      {/* Informações do Cliente */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Cliente</p>
                          <h4 className="text-base font-bold text-white font-['Outfit']">{troca.cliente_nome}</h4>
                        </div>

                        {troca.cliente_telefone && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Contato</p>
                            {telLimpo ? (
                              <a
                                href={`https://wa.me/55${telLimpo}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-[#76FF03] hover:underline font-bold"
                              >
                                <Phone className="w-3.5 h-3.5" /> {troca.cliente_telefone}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-300">{troca.cliente_telefone}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Comparativo Visual da Troca: Defeito ➔ Trocado */}
                      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-center bg-black/40 p-3.5 sm:p-4 rounded-xl border border-white/5">
                        {/* Vape com Defeito */}
                        <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Vape com Defeito
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-100">{troca.vape_defeito}</p>
                            {troca.sabor_defeito && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                Sabor: <span className="text-red-300 font-semibold">{troca.sabor_defeito}</span>
                              </p>
                            )}
                          </div>
                          <div className="pt-1.5 border-t border-red-500/20">
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Motivo do Defeito:</p>
                            <span className="inline-block mt-0.5 text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                              {troca.motivo}
                            </span>
                            {troca.motivo_detalhes && (
                              <p className="text-[11px] text-slate-300 italic mt-1 bg-black/30 p-1.5 rounded">
                                "{troca.motivo_detalhes}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Seta Central Indicativa */}
                        <div className="flex md:flex-col items-center justify-center p-1 text-[#76FF03]">
                          <div className="hidden md:flex flex-col items-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Substituído</span>
                            <ArrowRight className="w-6 h-6 text-[#76FF03] animate-pulse" />
                          </div>
                          <div className="flex md:hidden items-center gap-2 text-xs font-bold text-[#76FF03]">
                            <span>Trocado por</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Novo Vape Entregue */}
                        <div className="p-3 bg-[#76FF03]/5 border border-[#76FF03]/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#76FF03] uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Novo Vape Entregue
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#76FF03]">{troca.vape_trocado}</p>
                            {troca.sabor_trocado && (
                              <p className="text-xs text-slate-300 mt-0.5">
                                Sabor: <span className="text-[#76FF03] font-semibold">{troca.sabor_trocado}</span>
                              </p>
                            )}
                          </div>
                          <div className="pt-1.5 border-t border-[#76FF03]/20">
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Garantia Atendida</p>
                            <p className="text-[11px] text-slate-300 mt-0.5">
                              Produto substituído e entregue ao cliente.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Observações Gerais (se houver) */}
                      {troca.observacoes && (
                        <div className="text-xs text-slate-300 bg-black/30 p-2.5 rounded-lg border border-white/5">
                          <strong className="text-slate-400 text-[10px] uppercase block mb-0.5">Observações:</strong>
                          {troca.observacoes}
                        </div>
                      )}

                      {/* Ações do Card */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => abrirModalEditarTroca(troca)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#76FF03]/10 border border-[#76FF03]/40 text-[#76FF03] rounded-lg text-xs font-bold hover:bg-[#76FF03]/20 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => handleDeletarTroca(troca.id, troca.cliente_nome)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : abaAtiva === 'metricas' ? (
          /* SEÇÃO DE MÉTRICAS RICAS E INTERATIVAS */
          <section className="space-y-8 animate-in fade-in duration-500">
            {/* Controles de Dashboard */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-black/40 p-6 rounded-xl border border-[#76FF03]/20">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold neon-glow font-['Outfit'] font-bold flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-[#76FF03]" /> MÉTRICAS ANALÍTICAS
                </h2>
                <p className="text-xs text-slate-400">Análise completa de tráfego, conversão e faturamento</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                {/* Filtro de Período */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-semibold">Período</label>
                  <div className="flex bg-black/60 p-1 rounded-lg border border-[#76FF03]/20">
                    {(['7d', '15d', '30d', '90d', '180d', 'tudo', 'custom'] as const).map((per) => (
                      <button
                        key={per}
                        onClick={() => setFiltroPeriodo(per)}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${filtroPeriodo === per ? 'bg-[#76FF03] text-black shadow-[0_0_8px_rgba(118,255,3,0.3)]' : 'text-slate-400 hover:text-slate-300'}`}
                      >
                        {per === 'custom' ? 'Custom' : per === 'tudo' ? 'Tudo' : per.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtro de Agrupamento */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-semibold">Visualização</label>
                  <div className="flex bg-black/60 p-1 rounded-lg border border-[#76FF03]/20">
                    {(['dia', 'semana', 'mes'] as const).map((agrup) => (
                      <button
                        key={agrup}
                        disabled={filtroPeriodo === '7d' && (agrup === 'semana' || agrup === 'mes')}
                        onClick={() => setAgrupamentoMetricas(agrup)}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${agrupamentoMetricas === agrup ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'text-slate-400 hover:text-slate-300'}`}
                      >
                        {agrup === 'dia' ? 'Dia' : agrup === 'semana' ? 'Semana' : 'Mês'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtro de Status do Pedido */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-semibold">Pedidos</label>
                  <div className="flex bg-black/60 p-1 rounded-lg border border-[#76FF03]/20">
                    {(['todos', 'concluidos'] as const).map((stat) => (
                      <button
                        key={stat}
                        onClick={() => setStatusPedidoFiltro(stat)}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${statusPedidoFiltro === stat ? 'bg-purple-500 text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'text-slate-400 hover:text-slate-300'}`}
                      >
                        {stat === 'todos' ? 'Todos' : 'Concluídos'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Refresh Button */}
                <div className="flex flex-col gap-1 self-end">
                  <button onClick={carregarTudo} className="p-2 bg-[#76FF03]/10 border border-[#76FF03]/30 text-[#76FF03] rounded-lg hover:bg-[#76FF03]/20 transition-all" title="Recarregar dados">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inputs de Data Customizados */}
            {filtroPeriodo === 'custom' && (
              <div className="flex flex-wrap items-center gap-4 bg-black/30 p-4 rounded-xl border border-dashed border-[#76FF03]/20 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">De:</span>
                  <input
                    type="date"
                    value={dataInicioMetricas}
                    onChange={(e) => setDataInicioMetricas(e.target.value)}
                    className="bg-black/60 border border-[#76FF03]/30 text-[#76FF03] px-3 py-1.5 rounded-lg text-xs focus:border-[#76FF03] outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">Até:</span>
                  <input
                    type="date"
                    value={dataFimMetricas}
                    onChange={(e) => setDataFimMetricas(e.target.value)}
                    className="bg-black/60 border border-[#76FF03]/30 text-[#76FF03] px-3 py-1.5 rounded-lg text-xs focus:border-[#76FF03] outline-none"
                  />
                </div>
              </div>
            )}

            {/* Cartões de KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card 1: Visitas */}
              <div className="glass-morphism p-5 rounded-xl border border-[#76FF03]/20 bg-[#76FF03]/5 hover:border-[#76FF03]/40 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-[#76FF03] uppercase font-semibold tracking-wider">Visitas</span>
                  <Users className="w-4 h-4 text-[#76FF03]" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100">
                  {resumoMetricas.totalVisitas.toLocaleString('pt-BR')}
                </h3>
                <p className="text-[9px] text-slate-400 mt-1">Acessos únicos</p>
              </div>

              {/* Card 2: Vendas */}
              <div className="glass-morphism p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase font-semibold tracking-wider">Vendas</span>
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100">
                  {resumoMetricas.totalVendas}
                </h3>
                <p className="text-[9px] text-slate-400 mt-1">Pedidos registrados</p>
              </div>

              {/* Card 3: Faturamento */}
              <div className="glass-morphism p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-purple-400 uppercase font-semibold tracking-wider">Faturamento</span>
                  <DollarSign className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100">
                  R$ {resumoMetricas.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-[9px] text-slate-400 mt-1">Faturamento líquido</p>
              </div>

              {/* Card 4: Taxa de Conversão */}
              <div className="glass-morphism p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-yellow-500 uppercase font-semibold tracking-wider">Conversão</span>
                  <Percent className="w-4 h-4 text-yellow-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100">
                  {resumoMetricas.conversaoGeral.toFixed(2)}%
                </h3>
                <p className="text-[9px] text-slate-400 mt-1">Pedidos / Visitas</p>
              </div>

              {/* Card 5: Ticket Médio */}
              <div className="glass-morphism p-5 rounded-xl border border-orange-500/20 bg-orange-500/5 hover:border-orange-500/40 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-orange-400 uppercase font-semibold tracking-wider">Ticket Médio</span>
                  <Zap className="w-4 h-4 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100">
                  R$ {resumoMetricas.ticketMedioGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-[9px] text-slate-400 mt-1">Valor médio por compra</p>
              </div>
            </div>

            {/* Linha do Tempo e Evolução */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico 1: Visitas vs Vendas & Conversão */}
              <div className="lg:col-span-2 glass-morphism p-6 rounded-xl border border-[#76FF03]/10 bg-black/40 min-h-[400px] flex flex-col">
                <h3 className="text-sm font-bold text-slate-300 uppercase font-['Outfit'] font-bold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#76FF03]" /> Evolução de Tráfego, Vendas & Conversão
                </h3>
                
                {dataAgrupada.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-slate-400">Sem dados no período selecionado</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dataAgrupada}>
                        <defs>
                          <linearGradient id="colorVisitas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#76FF03" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#76FF03" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis 
                          dataKey="data" 
                          stroke="#666" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          yAxisId="left"
                          stroke="#666" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#eab308" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `${value.toFixed(0)}%`}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                            border: '1px solid #76FF03',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            color: '#E0E0E0'
                          }}
                          itemStyle={{ padding: '2px 0' }}
                        />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#C0C0C0' }} />
                        <Area 
                          yAxisId="left"
                          name="Visitas"
                          type="monotone" 
                          dataKey="visitas" 
                          stroke="#76FF03" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorVisitas)" 
                          animationDuration={1000}
                        />
                        <Area 
                          yAxisId="left"
                          name="Vendas"
                          type="monotone" 
                          dataKey="vendas" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorVendas)" 
                          animationDuration={1000}
                        />
                        <Line 
                          yAxisId="right"
                          name="Taxa Conversão"
                          type="monotone" 
                          dataKey="conversao" 
                          stroke="#eab308" 
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: '#eab308', stroke: '#000', strokeWidth: 1 }}
                          activeDot={{ r: 5 }}
                          animationDuration={1200}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Gráfico 2: Faturamento & Ticket Médio */}
              <div className="glass-morphism p-6 rounded-xl border border-blue-500/10 bg-black/40 min-h-[400px] flex flex-col">
                <h3 className="text-sm font-bold text-slate-300 uppercase font-['Outfit'] font-bold mb-6 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-400" /> Faturamento vs. Ticket Médio
                </h3>
                
                {dataAgrupada.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-slate-400">Sem dados no período selecionado</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dataAgrupada}>
                        <defs>
                          <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis 
                          dataKey="data" 
                          stroke="#666" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          yAxisId="left"
                          stroke="#666" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `R$${value}`}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#f97316" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `R$${value}`}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                            border: '1px solid #a855f7',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            color: '#E0E0E0'
                          }}
                          itemStyle={{ padding: '2px 0' }}
                        />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#C0C0C0' }} />
                        <Area 
                          yAxisId="left"
                          name="Faturamento"
                          type="monotone" 
                          dataKey="faturamento" 
                          stroke="#a855f7" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorFaturamento)" 
                          animationDuration={1000}
                        />
                        <Line 
                          yAxisId="right"
                          name="Ticket Médio"
                          type="monotone" 
                          dataKey="ticketMedio" 
                          stroke="#f97316" 
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: '#f97316', stroke: '#000', strokeWidth: 1 }}
                          activeDot={{ r: 5 }}
                          animationDuration={1200}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Ranking de Produtos, Marcas e Origem */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top 5 Produtos */}
              <div className="glass-morphism p-6 rounded-xl border border-blue-500/10 bg-black/40 flex flex-col">
                <h3 className="text-sm font-bold text-slate-300 uppercase font-['Outfit'] font-bold mb-6 flex items-center gap-2">
                  <Box className="w-4 h-4 text-blue-400" /> Top 5 Produtos mais Vendidos
                </h3>
                {topProdutosEmarcas.topProdutos.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center min-h-[220px]">
                    <p className="text-slate-400 text-xs">Nenhum produto vendido no período</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProdutosEmarcas.topProdutos} layout="vertical" margin={{ left: 5, right: 5, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                        <XAxis type="number" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis 
                          dataKey="nome" 
                          type="category" 
                          stroke="#C0C0C0" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false} 
                          width={110}
                          tickFormatter={(value) => value.length > 18 ? `${value.substring(0, 16)}...` : value}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                            border: '1px solid #3b82f6',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            color: '#E0E0E0'
                          }}
                        />
                        <Bar dataKey="quantidade" name="Qtd Vendida" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                          {topProdutosEmarcas.topProdutos.map((entry, index) => {
                            const colors = ['#3b82f6', '#1d4ed8', '#2563eb', '#60a5fa', '#93c5fd'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Top 5 Marcas */}
              <div className="glass-morphism p-6 rounded-xl border border-purple-500/10 bg-black/40 flex flex-col">
                <h3 className="text-sm font-bold text-slate-300 uppercase font-['Outfit'] font-bold mb-6 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" /> Top 5 Marcas mais Vendidas
                </h3>
                {topProdutosEmarcas.topMarcas.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center min-h-[220px]">
                    <p className="text-slate-400 text-xs">Nenhuma marca vendida no período</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProdutosEmarcas.topMarcas}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis dataKey="marca" stroke="#C0C0C0" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                            border: '1px solid #a855f7',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            color: '#E0E0E0'
                          }}
                        />
                        <Bar dataKey="quantidade" name="Qtd Vendida" fill="#a855f7" radius={[4, 4, 0, 0]}>
                          {topProdutosEmarcas.topMarcas.map((entry, index) => {
                            const colors = ['#a855f7', '#7e22ce', '#8b5cf6', '#c084fc', '#ddd6fe'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Performance por Indicação (Canais) */}
              <div className="glass-morphism p-6 rounded-xl border border-yellow-500/10 bg-black/40 flex flex-col">
                <h3 className="text-sm font-bold text-slate-300 uppercase font-['Outfit'] font-bold mb-6 flex items-center gap-2">
                  <Users className="w-4 h-4 text-yellow-500" /> Origens de Pedidos (Indicações)
                </h3>
                {topProdutosEmarcas.topIndicacoes.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center min-h-[220px]">
                    <p className="text-slate-400 text-xs">Nenhum pedido registrado no período</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar space-y-2 pr-1">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-white/10 pb-2">
                          <th className="pb-2 font-semibold uppercase text-[9px]">Origem</th>
                          <th className="pb-2 text-right font-semibold uppercase text-[9px]">Pedidos</th>
                          <th className="pb-2 text-right font-semibold uppercase text-[9px]">Faturamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProdutosEmarcas.topIndicacoes.map((ind, i) => (
                          <tr key={i} className="border-b border-white/5 py-2 hover:bg-[#76FF03]/5 transition-colors">
                            <td className="py-2 text-slate-100 truncate max-w-[120px] font-bold">{ind.indicacao}</td>
                            <td className="py-2 text-right text-blue-400 font-bold">{ind.pedidos}</td>
                            <td className="py-2 text-right text-[#76FF03] font-bold">
                              R$ {ind.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : abaAtiva === 'saude' ? (
          /* SEÇÃO DE SAÚDE E EDUCAÇÃO */
          <section className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold neon-glow font-['Outfit'] font-bold">Saúde do Sistema</h2>
              <p className="text-slate-300 text-sm">Cartilha de boas práticas para mitigação de custos e performance.</p>
            </div>

            {/* Resumo de Carga Real */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-morphism p-4 rounded-xl border border-[#76FF03]/20 bg-black/40">
                <p className="text-[10px] font-bold text-[#76FF03] uppercase font-semibold">Peso do Banco (Linhas)</p>
                <h3 className="text-xl font-bold text-slate-100">
                  {produtos.length + pedidos.length + metricasVisitas.length} <span className="text-[10px] text-slate-400 font-normal">registros</span>
                </h3>
              </div>
              <div className="glass-morphism p-4 rounded-xl border border-blue-500/20 bg-black/40">
                <p className="text-[10px] font-bold text-blue-400 uppercase font-semibold">Arquivos de Imagem</p>
                <h3 className="text-xl font-bold text-slate-100">
                  {produtos.filter(p => p.imagem_url).length} <span className="text-[10px] text-slate-400 font-normal">no storage</span>
                </h3>
              </div>
              <div className="glass-morphism p-4 rounded-xl border border-yellow-500/20 bg-black/40">
                <p className="text-[10px] font-bold text-yellow-500 uppercase font-semibold">Pressão de Egress</p>
                <h3 className="text-xl font-bold text-slate-100">
                  {metricasVisitas.reduce((acc, v) => acc + v.acessos, 0)} <span className="text-[10px] text-slate-400 font-normal">visitas totais</span>
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Checklist de Mitigação */}
              <div className="glass-morphism p-8 rounded-xl border border-[#76FF03]/30 space-y-6">
                <h3 className="text-xl font-bold text-[#76FF03] font-['Outfit'] font-bold flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6" /> Checklist de Mitigação
                </h3>
                
                <div className="space-y-4">
                  {[
                    { title: "Compressão de Imagens", desc: "Sempre suba imagens abaixo de 200KB. Use ferramentas como TinyPNG antes do upload.", status: "Importante" },
                    { title: "Cache de Longo Prazo", desc: "O sistema agora força 1 ano de cache no CDN para evitar downloads repetidos.", status: "Ativo" },
                    { title: "Filtro de Métricas", desc: "Consultas de acesso agora são limitadas aos últimos 30 dias para economizar banda.", status: "Ativo" },
                    { title: "Proteção contra Bots", desc: "O registro de visitas agora ignora crawlers conhecidos e evita duplicatas por sessão.", status: "Ativo" },
                    { title: "Limites de Query", desc: "Listagem de pedidos agora possui limite de 500 registros para evitar sobrecarga.", status: "Ativo" }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-black/40 rounded-lg border border-[#76FF03]/10 hover:border-[#76FF03]/30 transition-all">
                      <div className="mt-1">
                        <div className={`w-3 h-3 rounded-full ${item.status === 'Ativo' ? 'bg-[#76FF03]' : 'bg-yellow-500'}`} />
                      </div>
                      <div>
                        <h4 className="text-slate-100 font-bold text-sm font-['Outfit'] font-bold">{item.title}</h4>
                        <p className="text-slate-400 text-xs mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Educação sobre Egress */}
              <div className="space-y-6">
                <div className="glass-morphism p-8 rounded-xl border border-blue-500/30 bg-blue-500/5">
                  <h3 className="text-xl font-bold text-blue-400 font-['Outfit'] font-bold flex items-center gap-3 mb-4">
                    <TrendingUp className="w-6 h-6" /> O que é Cached Egress?
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    É o tráfego de dados que sai do Supabase para o navegador do cliente, mas que passou pelo cache do CDN. 
                    <br /><br />
                    No plano gratuito, o limite é de **5GB/mês**. Ultrapassar esse limite pode causar o bloqueio temporário do projeto.
                  </p>
                </div>

                <div className="glass-morphism p-8 rounded-xl border border-red-500/30 bg-red-500/5">
                  <h3 className="text-xl font-bold text-red-400 font-['Outfit'] font-bold flex items-center gap-3 mb-4">
                    <AlertCircle className="w-6 h-6" /> Alerta Vermelho
                  </h3>
                  <ul className="text-slate-300 text-xs space-y-3 list-disc pl-4">
                    <li>**Nunca** suba vídeos diretamente no Storage (use YouTube/Vimeo).</li>
                    <li>**Evite** abrir o Admin repetidamente sem necessidade (cada abertura consome dados).</li>
                    <li>**Monitore** o dashboard do Supabase semanalmente.</li>
                    <li>Se o Egress subir sem motivo, avise o desenvolvedor imediatamente.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ) : abaAtiva === 'configuracoes' ? (
          /* SEÇÃO DE CONFIGURAÇÕES PROMOCIONAIS */
          <section className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold neon-glow font-['Outfit'] font-bold">Configurações da Promoção</h2>
              <p className="text-slate-300 text-sm">Configure o horário e dias da semana em que as promoções ficam ativas no catálogo.</p>
            </div>

            {tabelaConfigNaoExiste && (
              <div className="p-6 bg-yellow-500/10 border border-yellow-500/50 rounded-xl space-y-4 shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                  <h3 className="text-lg font-bold text-yellow-500 font-['Outfit'] font-bold">Tabela Não Configurada no Supabase</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  A tabela <code>configuracoes</code> não foi encontrada no seu banco de dados Supabase. Execute o script SQL abaixo no **SQL Editor** do seu painel Supabase para habilitar este painel.
                </p>
                <div className="relative">
                  <pre className="bg-black/60 border border-yellow-500/30 p-4 rounded-lg text-xs text-slate-100 overflow-x-auto select-all max-h-60">
{`-- Criar tabela de configuracoes
CREATE TABLE IF NOT EXISTS configuracoes (
  chave VARCHAR(50) PRIMARY KEY,
  valor JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserir valor padrão para horário promocional
INSERT INTO configuracoes (chave, valor)
VALUES ('promo_schedule', '{"dias_semana": [1, 2, 3], "hora_inicio": "09:00", "hora_fim": "15:25"}'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- Habilitar RLS
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Configurações são públicas para leitura" ON configuracoes FOR SELECT USING (true);
CREATE POLICY "Apenas usuários autenticados podem modificar configurações" ON configuracoes FOR ALL USING (auth.role() = 'authenticated');`}
                  </pre>
                </div>
              </div>
            )}

            <form onSubmit={handleSalvarConfiguracoes} className="glass-morphism p-8 rounded-xl border border-[#76FF03]/30 bg-black/40 space-y-6">
              {/* Dias da Semana */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-300 uppercase font-semibold tracking-wider">Dias da Semana</label>
                <p className="text-xs text-slate-400 mb-3">Selecione os dias em que a aba promocional estará disponível.</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((nomeDia, index) => {
                    const selecionado = promoConfig.dias_semana.includes(index);
                    return (
                      <label 
                        key={index} 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none transition-all duration-300  text-xs ${
                          selecionado 
                            ? 'bg-[#76FF03]/20 border-[#76FF03] text-[#76FF03] shadow-[0_0_10px_rgba(118,255,3,0.15)]' 
                            : 'bg-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={selecionado}
                          onChange={(e) => {
                            const novosDias = e.target.checked 
                              ? [...promoConfig.dias_semana, index].sort()
                              : promoConfig.dias_semana.filter(d => d !== index);
                            setPromoConfig({ ...promoConfig, dias_semana: novosDias });
                          }}
                          className="hidden"
                        />
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          selecionado ? 'border-[#76FF03] bg-[#76FF03] text-black' : 'border-zinc-700'
                        }`}>
                          {selecionado && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                        {nomeDia}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Horários */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase font-semibold tracking-wider">Hora de Início</label>
                  <input 
                    type="time" 
                    value={promoConfig.hora_inicio}
                    onChange={(e) => setPromoConfig({ ...promoConfig, hora_inicio: e.target.value })}
                    className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-3 rounded-lg focus:border-[#76FF03] focus:outline-none transition-all duration-300"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase font-semibold tracking-wider">Hora de Término</label>
                  <input 
                    type="time" 
                    value={promoConfig.hora_fim}
                    onChange={(e) => setPromoConfig({ ...promoConfig, hora_fim: e.target.value })}
                    className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-3 rounded-lg focus:border-[#76FF03] focus:outline-none transition-all duration-300"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#76FF03]/10">
                <button 
                  type="submit" 
                  disabled={salvandoConfig} 
                  className="cyber-button w-full flex items-center justify-center gap-2"
                >
                  {salvandoConfig ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Salvar Configurações
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        ) : (
          /* SEÇÃO DE PERSONALIZAÇÃO DO HERO BANNER */
          <section className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold neon-glow font-['Outfit'] font-bold">Personalização do Hero Banner</h2>
                <p className="text-slate-300 text-sm">Gerencie os slides, textos, botões e os produtos em destaque exibidos no topo do catálogo.</p>
              </div>
              <button
                type="button"
                onClick={handleAdicionarSlide}
                className="px-4 py-2.5 bg-[#76FF03]/20 border border-[#76FF03] text-[#76FF03] rounded-lg font-bold text-xs hover:bg-[#76FF03]/30 transition-all flex items-center gap-2 self-start sm:self-auto shadow-[0_0_15px_rgba(118,255,3,0.2)]"
              >
                <Plus className="w-4 h-4" /> Adicionar Slide
              </button>
            </div>

            {/* Pré-visualização em Tempo Real */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#76FF03] uppercase tracking-wider font-['Outfit'] font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} /> Pré-visualização do Hero Banner
              </h3>
              <HeroBanner
                produtos={produtos}
                horarioPromoAtivo={true}
                onSelectAba={() => {}}
                onSelectMarca={() => {}}
                config={heroConfig}
              />
            </div>

            {/* Formulário com Cards de Editar Slides */}
            <form onSubmit={handleSalvarHeroConfig} className="space-y-6">
              <div className="space-y-6">
                {heroConfig.slides.map((slide, index) => (
                  <div key={slide.id || index} className="glass-morphism p-6 rounded-xl border border-[#76FF03]/30 bg-black/50 space-y-6">
                    {/* Header do Card do Slide */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#76FF03]/20 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-[#76FF03]/20 border border-[#76FF03]/50 flex items-center justify-center font-bold text-xs text-[#76FF03]">
                          #{index + 1}
                        </span>
                        <h4 className="font-bold text-slate-100 font-['Outfit'] font-bold text-base truncate max-w-[220px] sm:max-w-sm">
                          {slide.titulo || 'Novo Slide'}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          slide.ativo ? 'bg-[#76FF03]/20 border border-[#76FF03]/50 text-[#76FF03]' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {slide.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer mr-2">
                          <input
                            type="checkbox"
                            checked={slide.ativo}
                            onChange={(e) => handleAtualizarSlide(index, { ativo: e.target.checked })}
                            className="accent-[#76FF03] w-4 h-4"
                          />
                          Exibir Slide
                        </label>

                        <button
                          type="button"
                          onClick={() => handleMoverSlide(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 bg-black/60 border border-zinc-700 text-zinc-300 rounded hover:border-[#76FF03] hover:text-[#76FF03] disabled:opacity-30 transition-colors"
                          title="Mover para cima"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoverSlide(index, 'down')}
                          disabled={index === heroConfig.slides.length - 1}
                          className="p-1.5 bg-black/60 border border-zinc-700 text-zinc-300 rounded hover:border-[#76FF03] hover:text-[#76FF03] disabled:opacity-30 transition-colors"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoverSlide(index)}
                          className="p-1.5 bg-red-500/20 border border-red-500/50 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                          title="Excluir Slide"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo do Slide */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Badge / Tag */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Texto da Tag (Badge)</label>
                        <input
                          type="text"
                          value={slide.badge.texto}
                          onChange={(e) => handleAtualizarSlide(index, { badge: { ...slide.badge, texto: e.target.value } })}
                          className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                          placeholder="ex: OFERTAS RELÂMPAGO"
                        />
                      </div>

                      <div className="flex gap-4 items-end">
                        <div className="space-y-2 flex-1">
                          <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Cor da Tag</label>
                          <select
                            value={slide.badge.cor}
                            onChange={(e) => handleAtualizarSlide(index, { badge: { ...slide.badge, cor: e.target.value as 'red' | 'green' | 'blue' } })}
                            className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                          >
                            <option value="green">Verde (Novidade)</option>
                            <option value="red">Vermelho (Oferta)</option>
                            <option value="blue">Azul (Informação)</option>
                          </select>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pb-2.5">
                          <input
                            type="checkbox"
                            checked={!!slide.badge.aoVivoBadge}
                            onChange={(e) => handleAtualizarSlide(index, { badge: { ...slide.badge, aoVivoBadge: e.target.checked } })}
                            className="accent-red-500 w-4 h-4"
                          />
                          Tag "Ao Vivo"
                        </label>
                      </div>

                      {/* Títulos */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Título Principal</label>
                        <input
                          type="text"
                          value={slide.titulo}
                          onChange={(e) => handleAtualizarSlide(index, { titulo: e.target.value })}
                          className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                          placeholder="ex: Super Preços &"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#76FF03] uppercase font-semibold">Título Destaque (Neon)</label>
                        <input
                          type="text"
                          value={slide.tituloDestaque}
                          onChange={(e) => handleAtualizarSlide(index, { tituloDestaque: e.target.value })}
                          className="w-full bg-black/60 border border-[#76FF03] text-[#76FF03] px-4 py-2 rounded-lg outline-none text-sm font-bold"
                          placeholder="ex: Promoções Especiais"
                        />
                      </div>

                      {/* Descrição */}
                      <div className="md:col-span-2 space-y-2">
                        <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Descrição do Slide</label>
                        <textarea
                          rows={2}
                          value={slide.descricao}
                          onChange={(e) => handleAtualizarSlide(index, { descricao: e.target.value })}
                          className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                          placeholder="Breve descrição em destaque..."
                        />
                      </div>

                      {/* Botão de Ação */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Texto do Botão</label>
                        <input
                          type="text"
                          value={slide.botaoTexto}
                          onChange={(e) => handleAtualizarSlide(index, { botaoTexto: e.target.value })}
                          className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                          placeholder="ex: Ver Ofertas Promocionais"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Ação do Botão</label>
                        <select
                          value={slide.botaoAcao}
                          onChange={(e) => handleAtualizarSlide(index, { botaoAcao: e.target.value as any })}
                          className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                        >
                          <option value="promocionais">Ir para Aba Promocionais</option>
                          <option value="expressos">Ir para Aba Expressos</option>
                          <option value="url">Abrir URL (Página Interna / Externa)</option>
                        </select>
                      </div>

                      {slide.botaoAcao === 'url' && (
                        <div className="md:col-span-2 space-y-2">
                          <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">URL de Destino</label>
                          <input
                            type="text"
                            value={slide.botaoUrl || ''}
                            onChange={(e) => handleAtualizarSlide(index, { botaoUrl: e.target.value })}
                            className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                            placeholder="ex: /como-funciona ou https://..."
                          />
                        </div>
                      )}

                      {/* Destaque Lateral */}
                      <div className="md:col-span-2 space-y-3 pt-3 border-t border-white/10">
                        <label className="block text-xs font-bold text-[#76FF03] uppercase font-semibold">Conteúdo Lateral (Card de Destaque)</label>
                        <select
                          value={slide.tipoDestaque}
                          onChange={(e) => handleAtualizarSlide(index, { tipoDestaque: e.target.value as any })}
                          className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                        >
                          <option value="produto_especifico">Produto Específico do Catálogo (Selecionar)</option>
                          <option value="produto_promo">Automático: Primeiro Produto da Promoção</option>
                          <option value="custom">Caixa de Garantia / Texto Personalizado</option>
                          <option value="nenhum">Nenhum Card (Sem destaque lateral)</option>
                        </select>

                        {slide.tipoDestaque === 'produto_especifico' && (
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-300 uppercase font-semibold">Selecionar Produto em Destaque</label>
                            <select
                              value={slide.produtoDestaqueId || ''}
                              onChange={(e) => handleAtualizarSlide(index, { produtoDestaqueId: e.target.value || null })}
                              className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none text-sm"
                            >
                              <option value="">Nenhum (Exibir 2 novidades aleatórias)</option>
                              {produtos.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.marca} — {p.nome} ({utils.formatarMoeda(p.preco)}) {p.is_promo ? '[PROMO]' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {slide.tipoDestaque === 'custom' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-300 uppercase font-semibold">Destaque Grande (ex: 100%)</label>
                              <input
                                type="text"
                                value={slide.customTitulo || ''}
                                onChange={(e) => handleAtualizarSlide(index, { customTitulo: e.target.value })}
                                className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-3 py-2 rounded-lg outline-none text-sm"
                                placeholder="100%"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-slate-300 uppercase font-semibold">Subtítulo (ex: PRODUTOS SELECIONADOS)</label>
                              <input
                                type="text"
                                value={slide.customSubtitulo || ''}
                                onChange={(e) => handleAtualizarSlide(index, { customSubtitulo: e.target.value })}
                                className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-3 py-2 rounded-lg outline-none text-sm"
                                placeholder="PRODUTOS SELECIONADOS"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 pt-4 border-t border-[#76FF03]/10">
                <button
                  type="submit"
                  disabled={salvandoHero}
                  className="cyber-button w-full flex items-center justify-center gap-2"
                >
                  {salvandoHero ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Salvar Configurações do Hero Banner
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )
      }
      </main>

      {/* Footer Discreto - Portfolio */}
      <footer className="py-8 mt-12 border-t border-[#76FF03]/10">
        <div className="container flex flex-col items-center justify-center gap-4">
          <p className="text-[#606060] text-[10px] tracking-widest uppercase text-center">
            Desenvolvido por <span className="text-slate-400">Alberto Ramos</span>
          </p>
          <div className="flex items-center gap-6">
            <a 
              href="https://github.com/albertoramos98" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-[#606060] hover:text-[#76FF03] transition-all duration-300"
              title="GitHub"
            >
              <Github className="w-4 h-4" />
              <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">GITHUB</span>
            </a>
            <a 
              href="mailto:alpemc.dev@gmail.com" 
              className="group flex items-center gap-2 text-[#606060] hover:text-[#76FF03] transition-all duration-300"
              title="Email para contato"
            >
              <Mail className="w-4 h-4" />
              <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">CONTATO</span>
            </a>
          </div>
          <p className="text-[#404040] text-[8px]">
            &copy; {new Date().getFullYear()} — Fullstack Developer
          </p>
        </div>
      </footer>

      {/* Modal Produto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-morphism p-6 rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold neon-glow font-['Outfit'] font-bold">{editandoId ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button onClick={fecharModal} className="p-2 hover:bg-[#76FF03]/20 rounded-lg"><X className="w-6 h-6 text-[#76FF03]" /></button>
            </div>
            <form onSubmit={handleSalvarProduto} className="space-y-4">
              <div className="border border-[#76FF03]/30 rounded-xl p-4 bg-black/30">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3 font-semibold"><ImagePlus className="w-4 h-4 text-[#76FF03]" /> Imagem</label>
                {(imagemPreview || (imagemUrlAtual && !removerImagem)) ? (
                  <div className="relative mb-3"><img src={imagemPreview || imagemUrlAtual || ''} alt="Preview" className="w-full h-48 object-cover rounded-lg border border-[#76FF03]/50" /><button type="button" onClick={handleRemoverImagem} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full"><X className="w-4 h-4" /></button></div>
                ) : (
                  <div onClick={() => inputImagemRef.current?.click()} className="w-full h-32 border-2 border-dashed border-[#76FF03]/40 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#76FF03] transition-all"><ImagePlus className="w-8 h-8 text-[#76FF03]/50 mb-2" /><p className="text-slate-400 text-xs">Clique para selecionar</p></div>
                )}
                <input ref={inputImagemRef} type="file" accept="image/*" onChange={handleSelecionarImagem} className="hidden" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Marca</label>
                <select value={marcaCustomizada ? '' : formProduto.marca} onChange={(e) => { setFormProduto({ ...formProduto, marca: e.target.value }); setMarcaCustomizada(''); }} className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none">
                  <option value="">Selecione uma marca</option>
                  {marcas.map(marca => <option key={marca} value={marca}>{marca}</option>)}
                  <option value="">─ Outra marca ─</option>
                </select>
                {formProduto.marca === '' && <input type="text" value={marcaCustomizada} onChange={(e) => setMarcaCustomizada(e.target.value)} placeholder="Digite a marca" className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none" />}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Nome</label>
                <input type="text" value={formProduto.nome} onChange={(e) => setFormProduto({ ...formProduto, nome: e.target.value })} className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none" placeholder="ex: IGNITE 8.000" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">Preço (R$)</label>
                <input type="number" step="0.01" value={formProduto.preco} onChange={(e) => setFormProduto({ ...formProduto, preco: e.target.value })} className="w-full bg-black/60 border border-[#76FF03]/50 text-slate-100 px-4 py-2 rounded-lg outline-none" placeholder="115.00" />
              </div>
              
              <div className="border border-[#76FF03]/30 rounded-xl p-4 bg-black/30 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-300 uppercase font-semibold">
                    {formProduto.is_promo ? 'Sabores Disponíveis (Promoção)' : 'Sabores e Estoques (Expresso)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormSaboresEstoque([...formSaboresEstoque, { sabor: '', estoque: formProduto.is_promo ? 999 : 10 }])}
                    className="flex items-center gap-1 text-xs font-bold text-[#76FF03] hover:text-[#76FF03]/80 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Sabor
                  </button>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {formSaboresEstoque.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={item.sabor}
                        onChange={(e) => {
                          const newItems = [...formSaboresEstoque];
                          newItems[index].sabor = e.target.value;
                          setFormSaboresEstoque(newItems);
                        }}
                        className="flex-1 bg-black/60 border border-[#76FF03]/50 text-slate-100 px-3 py-1.5 rounded-lg outline-none text-sm"
                        placeholder="ex: Menta Ice"
                        required
                      />
                      {!formProduto.is_promo && (
                        <input
                          type="number"
                          min="0"
                          value={item.estoque}
                          onChange={(e) => {
                            const newItems = [...formSaboresEstoque];
                            newItems[index].estoque = parseInt(e.target.value) || 0;
                            setFormSaboresEstoque(newItems);
                          }}
                          className="w-24 bg-black/60 border border-[#76FF03]/50 text-slate-100 px-3 py-1.5 rounded-lg outline-none text-sm"
                          placeholder="Estoque"
                          required
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (formSaboresEstoque.length > 1) {
                            setFormSaboresEstoque(formSaboresEstoque.filter((_, idx) => idx !== index));
                          } else {
                            setFormSaboresEstoque([{ sabor: '', estoque: formProduto.is_promo ? 999 : 0 }]);
                          }
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="text-[10px] text-slate-400 flex justify-between border-t border-[#76FF03]/20 pt-2 mt-2 font-bold uppercase">
                  <span>Sabores: {formSaboresEstoque.filter(i => i.sabor.trim() !== '').length}</span>
                  {formProduto.is_promo ? (
                    <span className="text-[#76FF03]">Estoque Livre (Controle por Ativo/Inativo)</span>
                  ) : (
                    <span>Estoque Total: {formSaboresEstoque.reduce((sum, item) => sum + (item.sabor.trim() !== '' ? item.estoque : 0), 0)}</span>
                  )}
                </div>
              </div>

              {/* Seletor de Regiões / Zonas */}
              <div className="border border-[#76FF03]/30 rounded-xl p-4 bg-black/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase font-semibold">
                    <MapPin className="w-4 h-4 text-[#76FF03]" /> Regiões / Zonas de Atendimento
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formProduto.zonas.length >= 2) {
                        setFormProduto({ ...formProduto, zonas: [] });
                      } else {
                        setFormProduto({ ...formProduto, zonas: ['norte', 'sul_oeste'] });
                      }
                    }}
                    className="text-[10px] text-[#76FF03] hover:underline font-bold"
                  >
                    {formProduto.zonas.length >= 2 ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Selecione em quais regiões este vape aparecerá disponível no catálogo:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {ZONAS_DISPONIVEIS.map(z => {
                    const active = formProduto.zonas.some(item => {
                      const norm = utils.normalizarTexto(item);
                      if (z.id === 'sul_oeste') {
                        return norm === 'sul_oeste' || norm.includes('sul') || norm.includes('oeste');
                      }
                      return norm === z.id || norm.includes(z.id);
                    });
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => {
                          let novasZonas = [...formProduto.zonas];
                          if (active) {
                            novasZonas = novasZonas.filter(item => {
                              const norm = utils.normalizarTexto(item);
                              if (z.id === 'sul_oeste') {
                                return norm !== 'sul_oeste' && !norm.includes('sul') && !norm.includes('oeste');
                              }
                              return norm !== z.id && !norm.includes(z.id);
                            });
                          } else {
                            novasZonas.push(z.id);
                          }
                          setFormProduto({ ...formProduto, zonas: novasZonas });
                        }}
                        className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                          active
                            ? 'bg-[#76FF03]/20 border-[#76FF03] text-[#76FF03] shadow-[0_0_10px_rgba(118,255,3,0.2)]'
                            : 'bg-black/50 border-white/10 text-slate-400 hover:border-white/30'
                        }`}
                      >
                        <span>{active ? '✓' : '+'}</span>
                        <span>{z.nome}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formProduto.is_promo} onChange={(e) => setFormProduto({ ...formProduto, is_promo: e.target.checked })} className="accent-[#76FF03]" />
                <label className="text-xs font-bold text-slate-300 uppercase font-semibold">Promoção?</label>
              </div>
              {formProduto.is_promo && (
                <input type="number" step="0.01" value={formProduto.preco_promo} onChange={(e) => setFormProduto({ ...formProduto, preco_promo: e.target.value })} className="w-full bg-black/60 border border-red-500/50 text-slate-100 px-4 py-2 rounded-lg outline-none" placeholder="Preço Promo" />
              )}
              <button type="submit" disabled={salvando || uploadandoImagem} className="cyber-button w-full flex items-center justify-center gap-2">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : editandoId ? 'Atualizar' : 'Criar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar / Editar Troca */}
      {modalTrocaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl glass-morphism p-5 sm:p-6 rounded-2xl max-h-[90vh] overflow-y-auto border border-[#76FF03]/30 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-5 border-b border-[#76FF03]/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#76FF03]/20 border border-[#76FF03]/40 text-[#76FF03]">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold neon-glow font-['Outfit']">
                    {editandoTrocaId ? 'Editar Troca / Garantia' : 'Registrar Nova Troca'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Preencha os dados do cliente e os detalhes da substituição do vape
                  </p>
                </div>
              </div>
              <button
                onClick={fecharModalTroca}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarTroca} className="space-y-5">
              {/* 1. Dados do Cliente e Data */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                <h4 className="text-xs font-bold text-[#76FF03] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> 1. Cliente & Atendimento
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Nome do Cliente <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formTroca.cliente_nome}
                      onChange={(e) => setFormTroca({ ...formTroca, cliente_nome: e.target.value })}
                      placeholder="ex: Carlos Alberto"
                      className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      WhatsApp / Telefone
                    </label>
                    <input
                      type="text"
                      value={formTroca.cliente_telefone}
                      onChange={(e) => setFormTroca({ ...formTroca, cliente_telefone: e.target.value })}
                      placeholder="ex: (11) 98765-4321"
                      className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Data e Hora da Troca <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formTroca.data_troca}
                      onChange={(e) => setFormTroca({ ...formTroca, data_troca: e.target.value })}
                      className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Região / Zona</label>
                      <select
                        value={formTroca.zona}
                        onChange={(e) => setFormTroca({ ...formTroca, zona: e.target.value })}
                        className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-2 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                      >
                        <option value="norte">Zona Norte</option>
                        <option value="sul_oeste">Zona Oeste/Sul</option>
                        <option value="geral">Geral / Balcão</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Status</label>
                      <select
                        value={formTroca.status}
                        onChange={(e) => setFormTroca({ ...formTroca, status: e.target.value as any })}
                        className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-2 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                      >
                        <option value="concluida">Concluída</option>
                        <option value="pendente">Pendente</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Vape com Defeito */}
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-3">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> 2. Vape com Defeito (Devolvido)
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Qual era o vape com defeito? <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={formTroca.vape_defeito_selecionado}
                      onChange={(e) => {
                        const val = e.target.value;
                        const prod = produtos.find(p => p.id === val);
                        setFormTroca({
                          ...formTroca,
                          vape_defeito_selecionado: val,
                          sabor_defeito: prod && prod.sabores.length === 1 ? prod.sabores[0] : formTroca.sabor_defeito
                        });
                      }}
                      className="w-full bg-black/60 border border-red-500/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-red-400 mb-1.5"
                    >
                      <option value="">Selecione um vape do catálogo...</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.marca} — {p.nome}
                        </option>
                      ))}
                      <option value="custom">─ Outro modelo (digitar manualmente) ─</option>
                    </select>

                    {(formTroca.vape_defeito_selecionado === 'custom' || !formTroca.vape_defeito_selecionado) && (
                      <input
                        type="text"
                        value={formTroca.vape_defeito_custom}
                        onChange={(e) => setFormTroca({ ...formTroca, vape_defeito_custom: e.target.value })}
                        placeholder="Digite a marca e modelo do vape defeituoso..."
                        className="w-full bg-black/60 border border-red-500/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-red-400"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Sabor do vape com defeito
                      </label>
                      {formTroca.vape_defeito_selecionado && formTroca.vape_defeito_selecionado !== 'custom' && (
                        produtos.find(p => p.id === formTroca.vape_defeito_selecionado)?.sabores?.length || 0) > 0 ? (
                        <select
                          value={formTroca.sabor_defeito}
                          onChange={(e) => setFormTroca({ ...formTroca, sabor_defeito: e.target.value })}
                          className="w-full bg-black/60 border border-red-500/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-red-400"
                        >
                          <option value="">Selecione o sabor...</option>
                          {produtos.find(p => p.id === formTroca.vape_defeito_selecionado)?.sabores.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={formTroca.sabor_defeito}
                          onChange={(e) => setFormTroca({ ...formTroca, sabor_defeito: e.target.value })}
                          placeholder="ex: Menta Ice"
                          className="w-full bg-black/60 border border-red-500/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-red-400"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Motivo Principal do Defeito <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={formTroca.motivo}
                        onChange={(e) => setFormTroca({ ...formTroca, motivo: e.target.value })}
                        className="w-full bg-black/60 border border-red-500/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-red-400"
                      >
                        {MOTIVOS_TROCA_PADRAO.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {formTroca.motivo === 'Outro motivo' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Especifique o Motivo <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formTroca.motivo_custom}
                        onChange={(e) => setFormTroca({ ...formTroca, motivo_custom: e.target.value })}
                        placeholder="Descreva o motivo do defeito..."
                        className="w-full bg-black/60 border border-red-500/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-red-400"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Detalhes adicionais do problema (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={formTroca.motivo_detalhes}
                      onChange={(e) => setFormTroca({ ...formTroca, motivo_detalhes: e.target.value })}
                      placeholder="ex: Cliente informou que deu gosto de queimado no 2º dia de uso mesmo sem ter acabado o líquido..."
                      className="w-full bg-black/60 border border-red-500/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-red-400 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Novo Vape Entregue (Substituição) */}
              <div className="p-4 rounded-xl bg-[#76FF03]/5 border border-[#76FF03]/30 space-y-3">
                <h4 className="text-xs font-bold text-[#76FF03] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 3. Novo Vape Entregue (Substituição)
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Por qual vape foi trocado? <span className="text-[#76FF03]">*</span>
                    </label>
                    <select
                      value={formTroca.vape_trocado_selecionado}
                      onChange={(e) => {
                        const val = e.target.value;
                        const prod = produtos.find(p => p.id === val);
                        setFormTroca({
                          ...formTroca,
                          vape_trocado_selecionado: val,
                          sabor_trocado: prod && prod.sabores.length === 1 ? prod.sabores[0] : formTroca.sabor_trocado
                        });
                      }}
                      className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03] mb-1.5"
                    >
                      <option value="">Selecione um vape do catálogo...</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.marca} — {p.nome} (Estoque: {p.estoque})
                        </option>
                      ))}
                      <option value="custom">─ Outro modelo (digitar manualmente) ─</option>
                    </select>

                    {(formTroca.vape_trocado_selecionado === 'custom' || !formTroca.vape_trocado_selecionado) && (
                      <input
                        type="text"
                        value={formTroca.vape_trocado_custom}
                        onChange={(e) => setFormTroca({ ...formTroca, vape_trocado_custom: e.target.value })}
                        placeholder="Digite a marca e modelo do novo vape entregue..."
                        className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Sabor do novo vape entregue
                    </label>
                    {formTroca.vape_trocado_selecionado && formTroca.vape_trocado_selecionado !== 'custom' && (
                      produtos.find(p => p.id === formTroca.vape_trocado_selecionado)?.sabores?.length || 0) > 0 ? (
                      <select
                        value={formTroca.sabor_trocado}
                        onChange={(e) => setFormTroca({ ...formTroca, sabor_trocado: e.target.value })}
                        className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                      >
                        <option value="">Selecione o sabor...</option>
                        {produtos.find(p => p.id === formTroca.vape_trocado_selecionado)?.sabores.map(s => {
                          const prodObj = produtos.find(p => p.id === formTroca.vape_trocado_selecionado);
                          const qtdSabor = prodObj?.sabores_estoque?.[s];
                          return (
                            <option key={s} value={s}>
                              {s} {qtdSabor !== undefined ? `(${qtdSabor} unid)` : ''}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formTroca.sabor_trocado}
                        onChange={(e) => setFormTroca({ ...formTroca, sabor_trocado: e.target.value })}
                        placeholder="ex: Uva Ice"
                        className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                      />
                    )}
                  </div>

                  {/* Checkbox Inteligente de Baixa no Estoque */}
                  {!editandoTrocaId && formTroca.vape_trocado_selecionado && formTroca.vape_trocado_selecionado !== 'custom' && (
                    <div className="p-3 bg-black/60 border border-[#76FF03]/30 rounded-lg flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        id="abater_estoque_checkbox"
                        checked={formTroca.abater_estoque}
                        onChange={(e) => setFormTroca({ ...formTroca, abater_estoque: e.target.checked })}
                        className="accent-[#76FF03] w-4 h-4 mt-0.5"
                      />
                      <label htmlFor="abater_estoque_checkbox" className="text-xs text-slate-200 cursor-pointer">
                        <strong className="text-[#76FF03] block">Dar baixa automática de 1 unidade no estoque</strong>
                        <span className="text-[11px] text-slate-400">
                          Reduz 1 unidade do estoque do vape e do sabor selecionado no catálogo automaticamente.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Observações */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Observações Gerais (opcional)
                </label>
                <textarea
                  rows={2}
                  value={formTroca.observacoes}
                  onChange={(e) => setFormTroca({ ...formTroca, observacoes: e.target.value })}
                  placeholder="Anotações internas sobre a troca ou garantia..."
                  className="w-full bg-black/60 border border-white/20 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03] resize-none"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-3 border-t border-[#76FF03]/20">
                <button
                  type="button"
                  onClick={fecharModalTroca}
                  className="w-1/3 py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold transition-all border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoTroca}
                  className="cyber-button flex-1 flex items-center justify-center gap-2 text-xs"
                >
                  {salvandoTroca ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                    </>
                  ) : editandoTrocaId ? (
                    <>
                      <Save className="w-4 h-4" /> Atualizar Registro de Troca
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Confirmar & Registrar Troca
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE DETALHES DO CLIENTE & LINHA DO TEMPO DE INTERAÇÕES */}
      {/* ========================================================================= */}
      {modalClienteDetalhesAberto && clienteSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-morphism p-5 sm:p-6 rounded-2xl max-w-2xl w-full border border-[#76FF03]/40 shadow-[0_0_50px_rgba(118,255,3,0.15)] my-auto max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header do Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#76FF03]/20 to-blue-500/20 border border-[#76FF03]/40 flex items-center justify-center font-bold text-white text-base shadow-[0_0_15px_rgba(118,255,3,0.2)]">
                  {clienteSelecionado.nome.charAt(0).toUpperCase() || 'C'}
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white font-['Outfit'] flex items-center gap-2 flex-wrap">
                    {clienteSelecionado.nome}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40 font-mono">
                      Cadastro Único
                    </span>
                  </h3>
                  <a
                    href={`https://wa.me/${clienteSelecionado.telefone_normalizado}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#76FF03] font-mono hover:underline mt-0.5"
                  >
                    <Phone className="w-3 h-3" />
                    {formatarTelefoneExibicao(clienteSelecionado.telefone)}
                  </a>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalClienteDetalhesAberto(false);
                  setClienteSelecionado(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
              {/* Card de Informações e Métricas do Cliente */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-black/40 rounded-xl border border-white/10">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">1º Contato (Fixo)</span>
                  <span className="text-xs text-slate-200 font-semibold">
                    {new Date(clienteSelecionado.data_primeiro_contato).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {new Date(clienteSelecionado.data_primeiro_contato).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Último Contato</span>
                  <span className="text-xs text-[#76FF03] font-semibold">
                    {new Date(clienteSelecionado.data_ultimo_contato).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {new Date(clienteSelecionado.data_ultimo_contato).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Interações</span>
                  <span className="text-xs text-yellow-400 font-bold">
                    {clienteSelecionado.total_interacoes || 1} registros
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Compras & Gasto</span>
                  <span className="text-xs text-white font-bold block">
                    {clienteSelecionado.total_pedidos || 0} pedidos
                  </span>
                  <span className="text-[10px] text-[#76FF03] font-bold">
                    {utils.formatarMoeda(clienteSelecionado.valor_total_gasto || 0)}
                  </span>
                </div>
              </div>

              {/* Formulário Rápido para Registrar Nova Interação */}
              <form onSubmit={handleSalvarNovaInteracao} className="p-3.5 bg-[#76FF03]/5 border border-[#76FF03]/30 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-[#76FF03] uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Anotar Nova Conversa / Interação
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Tipo</label>
                    <select
                      value={formNovaInteracao.tipo}
                      onChange={(e) => setFormNovaInteracao({ ...formNovaInteracao, tipo: e.target.value as any })}
                      className="w-full bg-black/80 border border-[#76FF03]/40 text-slate-100 px-2.5 py-1.5 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                    >
                      <option value="contato_whatsapp">Contato / Conversa WhatsApp</option>
                      <option value="duvida">Dúvida / Atendimento</option>
                      <option value="pedido">Pedido / Compra</option>
                      <option value="troca">Troca / Garantia</option>
                      <option value="outro">Outro Registro</option>
                    </select>
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Descrição / Notas</label>
                    <input
                      type="text"
                      placeholder="Ex: Cliente pediu catálogo no WhatsApp, interessado em Ignite..."
                      value={formNovaInteracao.descricao}
                      onChange={(e) => setFormNovaInteracao({ ...formNovaInteracao, descricao: e.target.value })}
                      className="w-full bg-black/80 border border-[#76FF03]/40 text-slate-100 px-2.5 py-1.5 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-end gap-1.5">
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Valor (R$)</label>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={formNovaInteracao.valor}
                        onChange={(e) => setFormNovaInteracao({ ...formNovaInteracao, valor: e.target.value })}
                        className="w-full bg-black/80 border border-[#76FF03]/40 text-slate-100 px-2 py-1.5 rounded-lg text-xs outline-none focus:border-[#76FF03]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={salvandoInteracao}
                      className="cyber-button px-3 py-1.5 text-xs whitespace-nowrap h-[31px]"
                    >
                      {salvandoInteracao ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Linha do Tempo Histórica */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#76FF03]" /> Linha do Tempo & Histórico de Interações
                </h4>

                {(() => {
                  const interacoesDoCliente = interacoesCliente
                    .filter(i => i.cliente_telefone_normalizado === clienteSelecionado.telefone_normalizado)
                    .sort((a, b) => new Date(b.data_interacao).getTime() - new Date(a.data_interacao).getTime());

                  if (interacoesDoCliente.length === 0) {
                    return (
                      <div className="p-6 text-center bg-black/30 rounded-xl border border-white/5 space-y-1">
                        <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">Nenhum evento detalhado registrado ainda.</p>
                        <p className="text-[11px] text-slate-500">
                          Clique em "Sincronizar Pedidos Anteriores" no topo para importar todo o histórico de compras.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {interacoesDoCliente.map((int, idx) => {
                        const isPedido = int.tipo === 'pedido';
                        const isTroca = int.tipo === 'troca';

                        return (
                          <div
                            key={int.id || idx}
                            className={`p-3 rounded-xl border transition-all ${
                              isPedido
                                ? 'bg-black/50 border-[#76FF03]/30'
                                : isTroca
                                ? 'bg-red-950/20 border-red-500/30'
                                : 'bg-black/40 border-white/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    isPedido
                                      ? 'bg-[#76FF03]/20 text-[#76FF03]'
                                      : isTroca
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-blue-500/20 text-blue-400'
                                  }`}
                                >
                                  {isPedido ? (
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                  ) : isTroca ? (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  ) : (
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                        isPedido
                                          ? 'bg-[#76FF03]/20 text-[#76FF03]'
                                          : isTroca
                                          ? 'bg-red-500/20 text-red-400'
                                          : 'bg-blue-500/20 text-blue-400'
                                      }`}
                                    >
                                      {int.tipo.replace('_', ' ')}
                                    </span>
                                    {int.referencia_id && (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        Ref: #{int.referencia_id}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-200 mt-1 font-medium">
                                    {int.descricao}
                                  </p>

                                  {/* Detalhes de itens do pedido */}
                                  {int.detalhes?.itens && Array.isArray(int.detalhes.itens) && (
                                    <div className="mt-1.5 p-2 bg-black/60 rounded-lg text-[11px] text-slate-300 space-y-0.5 border border-white/5">
                                      <strong className="text-[10px] text-slate-400 uppercase block">Itens Comprados:</strong>
                                      {int.detalhes.itens.map((it: any, itIdx: number) => (
                                        <div key={itIdx} className="flex justify-between">
                                          <span>• {it.quantidade}x {it.nome} ({it.sabor})</span>
                                          <span className="text-[#76FF03] font-mono">{utils.formatarMoeda(it.preco_unitario * it.quantidade)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="text-[10px] text-slate-400 block">
                                  {new Date(int.data_interacao).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  {new Date(int.data_interacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {Number(int.valor) > 0 && (
                                  <span className="text-xs font-bold text-[#76FF03] block mt-1">
                                    {utils.formatarMoeda(int.valor)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="flex justify-between items-center pt-3 border-t border-white/10 flex-shrink-0">
              <a
                href={`https://wa.me/${clienteSelecionado.telefone_normalizado}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#76FF03] text-black font-bold rounded-lg text-xs hover:shadow-[0_0_15px_rgba(118,255,3,0.4)] transition-all"
              >
                <Phone className="w-3.5 h-3.5" /> Chamar no WhatsApp
              </a>

              <button
                type="button"
                onClick={() => {
                  setModalClienteDetalhesAberto(false);
                  setClienteSelecionado(null);
                }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold transition-all border border-white/10"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE NOVO CLIENTE MANUAL (CADASTRO ÚNICO) */}
      {/* ========================================================================= */}
      {modalNovoClienteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-morphism p-5 sm:p-6 rounded-2xl max-w-md w-full border border-[#76FF03]/40 shadow-[0_0_50px_rgba(118,255,3,0.15)] my-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white font-['Outfit'] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#76FF03]" /> Novo Cliente
              </h3>
              <button
                onClick={() => setModalNovoClienteAberto(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoCliente} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Nome do Cliente <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNovoCliente.nome}
                  onChange={(e) => setFormNovoCliente({ ...formNovoCliente, nome: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2.5 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Número do WhatsApp / Telefone <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNovoCliente.telefone}
                  onChange={(e) => setFormNovoCliente({ ...formNovoCliente, telefone: e.target.value })}
                  placeholder="Ex: 81 99999-9999 ou +55 81 99999-9999"
                  className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2.5 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  O número será normalizado automaticamente para evitar duplicidades no cadastro.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Zona / Região Preferida
                </label>
                <select
                  value={formNovoCliente.zona}
                  onChange={(e) => setFormNovoCliente({ ...formNovoCliente, zona: e.target.value })}
                  className="w-full bg-black/60 border border-[#76FF03]/40 text-slate-100 px-3.5 py-2.5 rounded-lg outline-none text-xs focus:border-[#76FF03]"
                >
                  <option value="Zona Norte">Zona Norte</option>
                  <option value="Zona Oeste/Sul">Zona Oeste/Sul</option>
                  <option value="Geral">Geral / Balcão</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Observações Iniciais (opcional)
                </label>
                <textarea
                  rows={2}
                  value={formNovoCliente.observacoes}
                  onChange={(e) => setFormNovoCliente({ ...formNovoCliente, observacoes: e.target.value })}
                  placeholder="Anotações sobre a primeira conversa, sabor de preferência, etc..."
                  className="w-full bg-black/60 border border-white/20 text-slate-100 px-3.5 py-2 rounded-lg outline-none text-xs focus:border-[#76FF03] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalNovoClienteAberto(false)}
                  className="w-1/3 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoCliente}
                  className="cyber-button flex-1 flex items-center justify-center gap-2 text-xs"
                >
                  {salvandoCliente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
