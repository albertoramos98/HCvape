import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, X, Plus, Minus, AlertCircle, Zap, Clock, ImageOff, Phone, User, CheckCircle2, Loader2, Github, Mail, Search, Flame, ArrowRight, Shield, Sparkles, Check, ChevronRight, MapPin, Compass } from 'lucide-react';
import { produtosService, pedidosService, Produto, utils, PedidoItem, configService, PromoSchedule, HeroBannerConfig, ZonaId, ZONAS_DISPONIVEIS } from '@/lib/supabase';
import { useLocation } from "wouter";
import { HeroBanner } from '@/components/HeroBanner';

/**
 * HC - Desde 2020 | Catálogo Digital
 * Design: Luxury Dark Cyber / Glass
 * Cores: Cyber Emerald (#00F59B) + Neon Coral (#FF3366) + Obsidian (#080b11)
 * Tipografia: Outfit (display/headings) + Plus Jakarta Sans (body/UI)
 */

interface CartItem {
  id: string;
  marca: string;
  nome: string;
  preco: number;
  sabor: string;
  quantidade: number;
  is_promo?: boolean;
  preco_promo?: number;
  imagem_url?: string | null;
}

// Componente de imagem do produto com fallback elegante
function ProdutoImagem({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [erro, setErro] = useState(false);

  if (!src || erro) { 
    return (
      <div className={`flex items-center justify-center bg-white/[0.02] border-b border-white/5 ${className}`}>
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <ImageOff className="w-8 h-8 opacity-40" />
          <span className="text-[11px] font-medium tracking-wide">Sem foto</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain transition-transform duration-500 group-hover:scale-105 ${className}`}
      onError={() => setErro(true)}
      loading="lazy"
    />
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [heroBannerConfig, setHeroBannerConfig] = useState<HeroBannerConfig | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [pesquisa, setPesquisa] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [saborSelecionado, setSaborSelecionado] = useState<Record<string, string>>({});
  const [horarioPromoAtivo, setHorarioPromoAtivo] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'expressos' | 'promocionais'>('expressos');
  
  // Estado de Pop-up de Aviso e Modal de Seleção de Zona
  const [popupAviso, setPopupAviso] = useState(true);
  const [zonaSelecionada, setZonaSelecionada] = useState<ZonaId | null>(() => {
    const salva = localStorage.getItem('hcvape_zona_selecionada');
    if (salva === 'norte') return 'norte';
    if (salva === 'sul' || salva === 'oeste' || salva === 'sul_oeste') return 'sul_oeste';
    return null;
  });
  const [modalZonaAberto, setModalZonaAberto] = useState(false);

  const [feedbackAdicionado, setFeedbackAdicionado] = useState<string | null>(null);
  const [promoConfig, setPromoConfig] = useState<PromoSchedule>({
    dias_semana: [1, 2, 3],
    hora_inicio: "09:00",
    hora_fim: "15:25"
  });

  // Estados do Checkout
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [indicacao, setIndicacao] = useState('');
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [pedidoConcluido, setPedidoConcluido] = useState<{ numero: number; total: number; link: string } | null>(null);

  // Fechar pop-up de aviso e engatilhar escolha de zona se ainda não definida
  const fecharPopupAviso = () => {
    setPopupAviso(false);
    if (!zonaSelecionada) {
      setModalZonaAberto(true);
    }
  };

  // Selecionar zona e persistir
  const handleSelecionarZona = (zona: ZonaId) => {
    setZonaSelecionada(zona);
    localStorage.setItem('hcvape_zona_selecionada', zona);
    setModalZonaAberto(false);
    // Limpar sabores selecionados para evitar inconsistência com novo estoque da zona
    setSaborSelecionado({});
  };

  // Carregar dados
  useEffect(() => {
    let configAtiva: PromoSchedule = {
      dias_semana: [1, 2, 3],
      hora_inicio: "09:00",
      hora_fim: "15:25"
    };

    const carregarDados = async () => {
      try {
        setCarregando(true);
        setErro(null);
        
        const [dados, config, heroConfig] = await Promise.all([
          produtosService.obterTodos(),
          configService.obterPromoSchedule(),
          configService.obterHeroBannerConfig()
        ]);
        
        setProdutos(dados);
        setPromoConfig(config);
        setHeroBannerConfig(heroConfig);
        configAtiva = config;

        const ativo = utils.estaEmHorarioPromo(config);
        setHorarioPromoAtivo(ativo);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setErro('Erro ao carregar catálogo. Por favor, tente novamente.');
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();

    const intervalo = setInterval(() => {
      const ativo = utils.estaEmHorarioPromo(configAtiva);
      setHorarioPromoAtivo(ativo);
    }, 60000);

    return () => clearInterval(intervalo);
  }, []);

  // Produtos Expressos (não promocionais) disponíveis na zona selecionada e ativos
  const produtosExpressos = useMemo(() => {
    const expressos = produtos.filter(p => {
      if (p.is_promo) return false;
      if (p.ativo === false) return false;
      const info = utils.obterEstoqueProdutoPorZona(p, zonaSelecionada);
      return info.possuiEstoqueNaZona;
    });
    return utils.ordenarProdutosPorMarcaEPuffs(expressos);
  }, [produtos, zonaSelecionada]);

  // Produtos Promocionais disponíveis na zona selecionada e ativos
  const produtosPromo = useMemo(() => {
    const promos = produtos.filter(p => {
      if (!p.is_promo) return false;
      if (p.ativo === false) return false;
      const info = utils.obterEstoqueProdutoPorZona(p, zonaSelecionada);
      return info.possuiEstoqueNaZona;
    });
    return utils.ordenarProdutosPorMarcaEPuffs(promos);
  }, [produtos, zonaSelecionada]);

  // Filtrar produtos Expressos por marca e pesquisa
  const produtosFiltrados = useMemo(() => {
    let result = produtosExpressos;
    if (marcaSelecionada) {
      result = result.filter(p => p.marca === marcaSelecionada);
    }
    if (pesquisa.trim()) {
      const termo = utils.normalizarTexto(pesquisa);
      result = result.filter(p => {
        const nomeMatch = utils.normalizarTexto(p.nome).includes(termo);
        const marcaMatch = utils.normalizarTexto(p.marca).includes(termo);
        const saborMatch = p.sabores.some(s => utils.normalizarTexto(s).includes(termo));
        return nomeMatch || marcaMatch || saborMatch;
      });
    }
    return result;
  }, [produtosExpressos, marcaSelecionada, pesquisa]);

  // Filtrar produtos Promocionais por pesquisa
  const produtosPromoFiltrados = useMemo(() => {
    let result = produtosPromo;
    if (pesquisa.trim()) {
      const termo = utils.normalizarTexto(pesquisa);
      result = result.filter(p => {
        const nomeMatch = utils.normalizarTexto(p.nome).includes(termo);
        const marcaMatch = utils.normalizarTexto(p.marca).includes(termo);
        const saborMatch = p.sabores.some(s => utils.normalizarTexto(s).includes(termo));
        return nomeMatch || marcaMatch || saborMatch;
      });
    }
    return result;
  }, [produtosPromo, pesquisa]);

  // Marcas apenas de Expressos
  const marcasExpressos = useMemo(() => {
    return Array.from(new Set(produtosExpressos.map(p => p.marca))).sort();
  }, [produtosExpressos]);

  // Total do carrinho
  const total = useMemo(() => {
    return carrinho.reduce((sum, item) => {
      const preco = item.is_promo && item.preco_promo ? item.preco_promo : item.preco;
      return sum + (preco * item.quantidade);
    }, 0);
  }, [carrinho]);

  const totalItensCarrinho = useMemo(() => {
    return carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  }, [carrinho]);

  // Adicionar ao carrinho
  const adicionarAoCarrinho = (produto: Produto) => {
    const sabor = saborSelecionado[produto.id];
    if (!sabor) {
      alert('Por favor, selecione um sabor antes de adicionar.');
      return;
    }

    const estoqueInfo = utils.obterEstoqueProdutoPorZona(produto, zonaSelecionada);
    const saborEstoque = estoqueInfo.saboresEstoque[sabor] ?? (Object.keys(estoqueInfo.saboresEstoque).length > 0 ? 0 : estoqueInfo.estoque);

    if (saborEstoque <= 0) {
      alert('Este sabor está esgotado nesta região.');
      return;
    }

    if (produto.is_promo && !horarioPromoAtivo) {
      setLocation("/promocional-info");
      return;
    }

    const itemExistente = carrinho.find(
      item => item.id === produto.id && item.sabor === sabor
    );

    const quantNoCarrinho = itemExistente ? itemExistente.quantidade : 0;
    if (quantNoCarrinho + 1 > saborEstoque) {
      alert(`Desculpe, só temos ${saborEstoque} unidades deste sabor em estoque para a sua região.`);
      return;
    }

    if (itemExistente) {
      setCarrinho(carrinho.map(item =>
        item.id === produto.id && item.sabor === sabor
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      ));
    } else {
      setCarrinho([
        ...carrinho,
        {
          id: produto.id,
          marca: produto.marca,
          nome: produto.nome,
          preco: produto.preco,
          sabor,
          quantidade: 1,
          is_promo: produto.is_promo,
          preco_promo: produto.preco_promo,
          imagem_url: produto.imagem_url,
        },
      ]);
    }

    // Micro feedback
    setFeedbackAdicionado(produto.id);
    setTimeout(() => setFeedbackAdicionado(null), 1200);

    setSaborSelecionado({ ...saborSelecionado, [produto.id]: '' });
  };

  // Remover do carrinho
  const removerDoCarrinho = (id: string, sabor: string) => {
    setCarrinho(carrinho.filter(item => !(item.id === id && item.sabor === sabor)));
  };

  // Alterar quantidade
  const alterarQuantidade = (id: string, sabor: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerDoCarrinho(id, sabor);
      return;
    }

    const produto = produtos.find(p => p.id === id);
    if (produto) {
      const estoqueInfo = utils.obterEstoqueProdutoPorZona(produto, zonaSelecionada);
      const saborEstoque = estoqueInfo.saboresEstoque[sabor] ?? (Object.keys(estoqueInfo.saboresEstoque).length > 0 ? 0 : estoqueInfo.estoque);
      if (novaQuantidade > saborEstoque) {
        alert(`Desculpe, só temos ${saborEstoque} unidades deste sabor nesta região.`);
        return;
      }
    }

    setCarrinho(carrinho.map(item =>
      item.id === id && item.sabor === sabor
        ? { ...item, quantidade: novaQuantidade }
        : item
    ));
  };

  // Iniciar checkout
  const iniciarCheckout = () => {
    if (carrinho.length === 0) {
      alert('Seu carrinho está vazio!');
      return;
    }
    setCheckoutAberto(true);
    setCarrinhoAberto(false);
  };

  // Confirmar e salvar pedido
  // Confirmar e salvar pedido
  const confirmarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente.trim() || !telefoneCliente.trim()) {
      alert('Por favor, informe seu nome e WhatsApp!');
      return;
    }

    try {
      setEnviandoPedido(true);
      
      const itensPedido: PedidoItem[] = carrinho.map(item => ({
        id: item.id,
        marca: item.marca,
        nome: item.nome,
        sabor: item.sabor,
        quantidade: item.quantidade,
        preco_unitario: item.is_promo && item.preco_promo ? item.preco_promo : item.preco,
        is_promo: item.is_promo
      }));

      const zonaNome = zonaSelecionada
        ? (ZONAS_DISPONIVEIS.find(z => z.id === zonaSelecionada)?.nome || zonaSelecionada)
        : 'Não informada';

      const novoPedido = await pedidosService.criar({
        nome_cliente: nomeCliente,
        telefone_cliente: telefoneCliente,
        indicacao: indicacao,
        zona: zonaNome,
        itens: itensPedido,
        total: total,
        desconto: 0,
        total_final: total,
        status_checklist: false,
        notas: ''
      });

      // Gerar link WhatsApp estilizado com a Zona
      const mensagemItens = carrinho
        .map(item => {
          const preco = item.is_promo && item.preco_promo ? item.preco_promo : item.preco;
          return `• ${item.quantidade}x ${item.nome} (${item.sabor}) — R$ ${(preco * item.quantidade).toFixed(2)}`;
        })
        .join('\n');

      const textoFinal = `Olá! Acabei de fazer um pedido pelo catálogo HC Vape: 🛒✨\n\n🆔 *Pedido:* #${novoPedido.numero_pedido}\n👤 *Cliente:* ${nomeCliente}\n📞 *WhatsApp:* ${telefoneCliente}\n📍 *Região / Zona:* ${zonaNome}\n${indicacao ? `💡 *Indicação:* ${indicacao}\n` : ''}\n---\n📦 *ITENS:* \n${mensagemItens}\n\n---\n💰 *TOTAL:* R$ ${novoPedido.total_final.toFixed(2)}\n\nAguardando instruções de pagamento e entrega! 🚀`;
      const whatsappUrl = `https://wa.me/5581997390944?text=${encodeURIComponent(textoFinal)}`;
      
      setPedidoConcluido({ 
        numero: novoPedido.numero_pedido, 
        total: novoPedido.total_final, 
        link: whatsappUrl 
      });
      
      // Limpar carrinho
      setCarrinho([]);

      // Abrir WhatsApp
      window.location.href = whatsappUrl;

    } catch (err) {
      console.error('Erro ao salvar pedido:', err);
      alert('Erro ao processar pedido. Por favor, tente novamente.');
    } finally {
      setEnviandoPedido(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 selection:bg-[#76FF03] selection:text-black">
        <div className="flex flex-col items-center gap-6 text-center max-w-xs animate-in fade-in duration-300">
          {/* 3D Spinning Logo with Glowing Aura */}
          <div className="relative flex items-center justify-center">
            {/* Background pulsating neon green glow */}
            <div className="absolute w-28 h-28 bg-[#76FF03]/25 rounded-full blur-2xl animate-pulse-glow pointer-events-none" />
            
            {/* Rotating 3D Badge Logo */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 animate-spin-3d">
              <img
                src="/logo.png"
                alt="HC Vape"
                className="w-full h-full object-cover rounded-full border-2 border-[#76FF03]/40 shadow-[0_0_30px_rgba(118,255,3,0.5)]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-2xl font-black text-white font-['Outfit'] tracking-tight">
                HC <span className="text-[#76FF03]">VAPE</span>
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#76FF03]/15 text-[#76FF03] border border-[#76FF03]/30">
                2020
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              Não fume, vaporize!
            </p>
            <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-[#76FF03]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#76FF03] animate-ping" />
              <span className="font-semibold tracking-wide">Carregando catálogo...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const zonaAtualInfo = ZONAS_DISPONIVEIS.find(z => z.id === zonaSelecionada);

  return (
    <div className="min-h-screen dark-atmosphere selection:bg-[#76FF03] selection:text-[#041202]">
      {/* 1. Pop-up de Aviso Informativo Inicial */}
      {popupAviso && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-[#080808] border border-white/15 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="HC Vape Logo"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover shadow-[0_0_20px_rgba(118,255,3,0.35)] border border-white/20 flex-shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-100 font-['Outfit']">HC VAPE</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#76FF03]/15 text-[#76FF03] border border-[#76FF03]/30">Desde 2020</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">Não fume, vaporize! • Informações</p>
                </div>
              </div>
              <button
                onClick={fecharPopupAviso}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"
                aria-label="Fechar aviso"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#FF3366]/10 to-transparent border-l-4 border-[#FF3366] rounded-r-xl">
                <span className="font-bold text-[#FF5E85] block text-[11px] sm:text-xs uppercase tracking-wider mb-1">
                  🔥 OFERTAS PROMOCIONAIS
                </span>
                <p>
                  Pedidos promocionais abertos das <strong className="text-white">{promoConfig.hora_inicio} às {promoConfig.hora_fim}</strong>. Entregas no mesmo dia às 19h ({utils.formatarDiasSemana(promoConfig.dias_semana)}).
                </p>
              </div>

              <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#76FF03]/10 to-transparent border-l-4 border-[#76FF03] rounded-r-xl">
                <span className="font-bold text-[#76FF03] block text-[11px] sm:text-xs uppercase tracking-wider mb-1">
                  ⚡ PEDIDOS EXPRESSOS
                </span>
                <p>
                  Atendimento das <strong className="text-white">10:00 às 22:00</strong>. Pronta entrega ágil direto no seu endereço.
                </p>
              </div>
            </div>

            <button
              onClick={fecharPopupAviso}
              className="w-full py-3.5 btn-emerald rounded-2xl text-sm sm:text-base font-bold shadow-xl flex items-center justify-center gap-2"
            >
              <span>Entendido, Escolher Minha Região</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Pop-up / Modal de Seleção de Zona / Região */}
      {modalZonaAberto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-[#080808] border border-white/15 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="HC Vape"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover shadow-[0_0_16px_rgba(118,255,3,0.3)] border border-white/20 flex-shrink-0"
                />
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-100 font-['Outfit']">Escolha sua Região</h3>
                  <p className="text-xs text-slate-400">Filtre os pods com pronta entrega para você</p>
                </div>
              </div>
              {zonaSelecionada && (
                <button
                  onClick={() => setModalZonaAberto(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"
                  aria-label="Fechar seleção de zona"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-300">
              Selecione a sua zona para visualizarmos o estoque em tempo real e garantirmos agilidade na sua entrega:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ZONAS_DISPONIVEIS.map((zona) => {
                const isSelected = zonaSelecionada === zona.id;
                return (
                  <button
                    key={zona.id}
                    onClick={() => handleSelecionarZona(zona.id)}
                    className={`relative p-4 sm:p-5 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between gap-3 group active:scale-[0.98] ${
                      isSelected
                        ? 'bg-[#76FF03]/15 border-[#76FF03] shadow-[0_0_20px_rgba(118,255,3,0.25)]'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-[#76FF03] text-[#041202]' : 'bg-white/5 text-slate-300 group-hover:text-white'}`}>
                        <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#76FF03] shadow-[0_0_8px_#76FF03] animate-pulse" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 font-['Outfit'] text-sm sm:text-base group-hover:text-[#76FF03] transition-colors">
                        {zona.nome}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                        {zona.descricao}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-bold">
                      <span className={isSelected ? 'text-[#76FF03]' : 'text-slate-400'}>
                        {isSelected ? 'Região Ativa' : 'Selecionar'}
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${isSelected ? 'text-[#76FF03]' : 'text-slate-500'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
              <span>💡 Você pode alterar sua zona a qualquer momento no topo do site.</span>
            </div>
          </div>
        </div>
      )}

      {/* Modern Sticky Glass Navbar */}
      <header className="sticky top-0 z-40 bg-[#070908]/90 backdrop-blur-xl border-b border-white/10 transition-all duration-300">
        <div className="container flex items-center justify-between py-3">
          {/* Logo & Status */}
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-3 group">
              <div className="relative group-hover:scale-105 transition-all duration-300">
                <img
                  src="/logo.png"
                  alt="HC Vape Logo"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover shadow-[0_0_15px_rgba(118,255,3,0.3)] border border-white/20"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight font-['Outfit'] flex items-center gap-1.5">
                    <span>HC</span>
                    <span className="text-[#76FF03]">VAPE</span>
                  </h1>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-300 border border-white/10">
                    Não fume, vaporize!
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#76FF03] shadow-[0_0_8px_#76FF03] animate-pulse" />
                  <span>Desde 2020 • Catálogo Online</span>
                </div>
              </div>
            </a>
          </div>

          {/* Quick Actions & Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão Seletor de Região / Zona */}
            <button
              onClick={() => setModalZonaAberto(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#76FF03]/50 transition-all duration-200"
              title="Trocar região de entrega"
            >
              <MapPin className="w-3.5 h-3.5 text-[#76FF03]" />
              <span>{zonaAtualInfo ? zonaAtualInfo.nome : 'Escolher Zona'}</span>
              <span className="text-[10px] text-slate-400">▾</span>
            </button>

            <button
              onClick={() => setCarrinhoAberto(true)}
              className="relative flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#76FF03]/15 to-[#76FF03]/5 hover:from-[#76FF03]/25 hover:to-[#76FF03]/10 border border-[#76FF03]/40 text-[#76FF03] transition-all duration-200 shadow-sm"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline text-xs font-bold font-['Outfit']">Carrinho</span>
              {totalItensCarrinho > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-extrabold bg-[#76FF03] text-[#041202] rounded-full shadow">
                  {totalItensCarrinho}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="container py-6 sm:py-8 space-y-8">
        {/* Banner de Erro */}
        {erro && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <p>{erro}</p>
          </div>
        )}

        {/* Hero Banner Component */}
        <HeroBanner
          produtos={produtos}
          horarioPromoAtivo={horarioPromoAtivo}
          onSelectAba={(aba) => setAbaAtiva(aba)}
          onSelectMarca={(marca) => setMarcaSelecionada(marca)}
          config={heroBannerConfig}
        />

        {/* Mode Selector Tabs (Expressos vs Promocionais) */}
        <div className="space-y-4">
          <div className="flex p-1.5 bg-[#0e1320] border border-white/10 rounded-2xl max-w-xl mx-auto backdrop-blur-md">
            <button
              onClick={() => {
                setAbaAtiva('expressos');
                setMarcaSelecionada(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm sm:text-base font-bold transition-all duration-200 ${
                abaAtiva === 'expressos'
                  ? 'bg-gradient-to-r from-[#76FF03] to-[#52C41A] text-[#000000] shadow-lg font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className={`w-4 h-4 ${abaAtiva === 'expressos' ? 'fill-current' : ''}`} />
              <span>Pronta Entrega Express</span>
            </button>

            <button
              onClick={() => {
                if (!horarioPromoAtivo) {
                  setLocation("/promocional-info");
                } else {
                  setAbaAtiva('promocionais');
                  setMarcaSelecionada(null);
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm sm:text-base font-bold transition-all duration-200 ${
                abaAtiva === 'promocionais'
                  ? 'bg-gradient-to-r from-[#FF3366] to-[#E60045] text-white shadow-lg font-extrabold'
                  : 'text-slate-400 hover:text-[#FF5E85]'
              }`}
            >
              <Flame className={`w-4 h-4 ${abaAtiva === 'promocionais' ? 'fill-current' : ''}`} />
              <span>Ofertas Relâmpago</span>
              {horarioPromoAtivo && (
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] bg-black/40 text-white font-extrabold uppercase">
                  Ao Vivo
                </span>
              )}
            </button>
          </div>

          {/* Banner de Aviso de Horário de Promoção */}
          {abaAtiva === 'promocionais' && (
            <div className="p-4 bg-gradient-to-r from-[#FF3366]/15 via-[#FF3366]/5 to-transparent border border-[#FF3366]/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#FF5E85] flex-shrink-0" />
                <p className="text-xs sm:text-sm text-slate-200">
                  Ofertas com super desconto disponíveis de <strong className="text-white">{promoConfig.hora_inicio} às {promoConfig.hora_fim}</strong>. Entregas às 19:00!
                </p>
              </div>
              <a
                href="/promocional-info"
                className="text-xs font-bold text-[#FF5E85] hover:underline flex items-center gap-1 flex-shrink-0"
              >
                Regras e Horários <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {!horarioPromoAtivo && abaAtiva === 'expressos' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-300/90">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Ofertas Relâmpago encerradas por hoje. Voltam às {promoConfig.hora_inicio}.</span>
              </div>
              <a href="/promocional-info" className="underline hover:text-amber-200 font-medium">Ver regras</a>
            </div>
          )}
        </div>

        {/* Search & Brand Filters Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por produto, marca ou sabor..."
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 text-white placeholder-slate-500 pl-10 pr-10 py-2.5 rounded-xl focus:border-[#76FF03]/60 focus:ring-1 focus:ring-[#76FF03]/50 focus:outline-none transition-all text-sm"
              />
              {pesquisa && (
                <button
                  onClick={() => setPesquisa('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Total items badge */}
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 px-3 py-2 bg-white/5 rounded-xl border border-white/5 self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5 text-[#76FF03]" />
              <span>
                {(abaAtiva === 'expressos' ? produtosFiltrados : produtosPromoFiltrados).length} produtos listados
              </span>
            </div>
          </div>

          {/* Brand Pills (for Expressos) */}
          {abaAtiva === 'expressos' && marcasExpressos.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setMarcaSelecionada(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                  marcaSelecionada === null
                    ? 'bg-[#76FF03] text-[#000000] shadow-md font-extrabold'
                    : 'bg-[#111111] text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                }`}
              >
                <span>Todas as Marcas</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${marcaSelecionada === null ? 'bg-[#000000]/20 text-[#000000]' : 'bg-white/10 text-slate-400'}`}>
                  {produtosExpressos.length}
                </span>
              </button>

              {marcasExpressos.map((marca) => {
                const count = produtosExpressos.filter(p => p.marca === marca).length;
                const isSelected = marcaSelecionada === marca;
                return (
                  <button
                    key={marca}
                    onClick={() => setMarcaSelecionada(marca)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#76FF03] text-[#000000] shadow-md font-extrabold'
                        : 'bg-[#111111] text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span>{marca}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-[#000000]/20 text-[#000000]' : 'bg-white/10 text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit'] flex items-center gap-2">
              {abaAtiva === 'expressos' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#76FF03] shadow-[0_0_8px_#76FF03]" />
                  <span>{marcaSelecionada ? `Modelos ${marcaSelecionada}` : 'Catálogo Pronta Entrega'}</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF3366] animate-pulse" />
                  <span>Ofertas Relâmpago com Desconto</span>
                </>
              )}
            </h2>
          </div>

          {(abaAtiva === 'expressos' ? produtosFiltrados : produtosPromoFiltrados).length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 font-['Outfit']">Nenhum produto encontrado</h3>
              <p className="text-xs text-slate-400">Tente ajustar sua busca ou selecionar outra marca.</p>
              {pesquisa && (
                <button
                  onClick={() => setPesquisa('')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold rounded-xl transition-colors"
                >
                  Limpar pesquisa
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
              {(abaAtiva === 'expressos' ? produtosFiltrados : produtosPromoFiltrados).map((produto) => {
                const isPromo = produto.is_promo;
                const selecionado = saborSelecionado[produto.id] || '';
                const estoqueInfo = utils.obterEstoqueProdutoPorZona(produto, zonaSelecionada);
                const feedbackOk = feedbackAdicionado === produto.id;
                const puffs = utils.extrairPuffs(produto.nome);

                return (
                  <div
                    key={produto.id}
                    className={`group relative glass-card rounded-3xl overflow-hidden flex flex-col justify-between ${
                      isPromo ? 'glass-card-promo' : ''
                    }`}
                  >
                    {/* Top image section */}
                    <div className="relative h-56 bg-gradient-to-b from-white/[0.03] to-transparent p-4 flex items-center justify-center overflow-hidden">
                      {/* Badges */}
                      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 max-w-[90%]">
                        {isPromo ? (
                          <span className="flex items-center gap-1 bg-gradient-to-r from-[#FF3366] to-[#E60045] text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg uppercase tracking-wider">
                            <Flame className="w-3 h-3" /> Oferta
                          </span>
                        ) : (
                          <span className="bg-white/10 backdrop-blur-md text-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/10 uppercase tracking-wider">
                            {produto.marca}
                          </span>
                        )}
                        {puffs > 0 && (
                          <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-md backdrop-blur-md border ${
                            isPromo
                              ? 'bg-[#FF3366]/20 text-[#FF5E85] border-[#FF3366]/40'
                              : 'bg-black/70 text-[#76FF03] border-[#76FF03]/40'
                          }`}>
                            <Zap className="w-2.5 h-2.5" />
                            {puffs.toLocaleString('pt-BR')} Puffs
                          </span>
                        )}
                      </div>

                      {!estoqueInfo.possuiEstoqueNaZona && (
                        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-20 flex items-center justify-center">
                          <span className="bg-red-500/90 text-white font-bold text-xs uppercase px-4 py-1.5 rounded-full shadow-lg">
                            Esgotado nesta Zona
                          </span>
                        </div>
                      )}

                      <ProdutoImagem
                        src={produto.imagem_url}
                        alt={produto.nome}
                        className="w-full h-full max-h-48"
                      />
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            {produto.marca}
                          </span>
                          {puffs > 0 && (
                            <span className="text-[11px] font-bold text-slate-300">
                              {puffs.toLocaleString('pt-BR')} puffs
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white font-['Outfit'] group-hover:text-[#76FF03] transition-colors line-clamp-1">
                          {produto.nome}
                        </h3>

                        {/* Price Display */}
                        <div className="mt-3 flex items-baseline gap-2">
                          {isPromo && produto.preco_promo ? (
                            <>
                              <span className="text-xl font-extrabold text-[#FF3366] font-['Outfit']">
                                R$ {produto.preco_promo.toFixed(2)}
                              </span>
                              <span className="text-xs text-slate-400 line-through">
                                R$ {produto.preco.toFixed(2)}
                              </span>
                              <span className="text-[10px] font-bold text-[#FF5E85] bg-[#FF3366]/15 px-2 py-0.5 rounded-md border border-[#FF3366]/20">
                                -{Math.round((1 - produto.preco_promo / produto.preco) * 100)}%
                              </span>
                            </>
                          ) : (
                            <span className="text-xl font-extrabold text-[#76FF03] font-['Outfit']">
                              R$ {produto.preco.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Flavor selector and Add Button */}
                      <div className="space-y-3 pt-2 border-t border-white/5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Escolha o Sabor:
                          </label>
                          <select
                            value={selecionado}
                            onChange={(e) =>
                              setSaborSelecionado({ ...saborSelecionado, [produto.id]: e.target.value })
                            }
                            className={`w-full bg-[#111111] border text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all ${
                              isPromo 
                                ? 'border-white/10 focus:border-[#FF3366]' 
                                : 'border-white/10 focus:border-[#76FF03]'
                            }`}
                          >
                            <option value="">Selecione uma opção...</option>
                            {produto.sabores.map((sabor) => {
                              const sEstoque = estoqueInfo.saboresEstoque[sabor] ?? (Object.keys(estoqueInfo.saboresEstoque).length > 0 ? 0 : estoqueInfo.estoque);
                              const esgotado = sEstoque <= 0;
                              return (
                                <option key={sabor} value={sabor} disabled={esgotado} className="bg-black text-slate-200">
                                  {sabor} {esgotado ? '— (Esgotado)' : `(${sEstoque} un)`}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <button
                          onClick={() => adicionarAoCarrinho(produto)}
                          disabled={!estoqueInfo.possuiEstoqueNaZona || (isPromo && !horarioPromoAtivo)}
                          className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
                            feedbackOk
                              ? 'bg-emerald-500 text-white'
                              : !estoqueInfo.possuiEstoqueNaZona
                              ? 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                              : isPromo && !horarioPromoAtivo
                              ? 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                              : isPromo
                              ? 'btn-coral'
                              : 'btn-emerald'
                          }`}
                        >
                          {feedbackOk ? (
                            <>
                              <Check className="w-4 h-4" /> Adicionado!
                            </>
                          ) : !estoqueInfo.possuiEstoqueNaZona ? (
                            'Esgotado nesta Zona'
                          ) : isPromo && !horarioPromoAtivo ? (
                            'Horário Encerrado'
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4" />
                              Adicionar ao Pedido
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modern Slide-over Cart Drawer */}
      {carrinhoAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#080808] border-l border-white/10 h-full flex flex-col justify-between shadow-2xl p-6 overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#76FF03]/15 rounded-xl text-[#76FF03]">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-['Outfit']">Seu Carrinho</h3>
                  <p className="text-xs text-slate-400">{totalItensCarrinho} {totalItensCarrinho === 1 ? 'item' : 'itens'}</p>
                </div>
              </div>
              <button
                onClick={() => setCarrinhoAberto(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Fechar carrinho"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {carrinho.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <ShoppingCart className="w-12 h-12 text-slate-600" />
                  <p className="text-sm text-slate-300 font-semibold">Seu carrinho está vazio</p>
                  <p className="text-xs text-slate-500 max-w-xs">Selecione o sabor desejado nos produtos e clique em adicionar.</p>
                </div>
              ) : (
                carrinho.map((item) => {
                  const unitPrice = item.is_promo && item.preco_promo ? item.preco_promo : item.preco;
                  const itemPuffs = utils.extrairPuffs(item.nome);
                  return (
                    <div
                      key={`${item.id}-${item.sabor}`}
                      className="p-3.5 bg-white/[0.02] border border-white/10 rounded-2xl flex items-center justify-between gap-3 hover:border-white/20 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.is_promo && (
                            <span className="text-[10px] bg-[#FF3366]/20 text-[#FF5E85] font-bold px-1.5 py-0.2 rounded">
                              PROMO
                            </span>
                          )}
                          <h4 className="text-sm font-bold text-slate-100 font-['Outfit'] truncate">
                            {item.nome}
                          </h4>
                          {itemPuffs > 0 && (
                            <span className="text-[10px] font-extrabold text-[#76FF03] bg-[#76FF03]/10 px-1.5 py-0.2 rounded border border-[#76FF03]/20">
                              {itemPuffs.toLocaleString('pt-BR')} Puffs
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#76FF03] truncate mt-0.5">
                          Sabor: {item.sabor}
                        </p>
                        <p className="text-xs font-semibold text-slate-300 mt-1">
                          R$ {(unitPrice * item.quantidade).toFixed(2)}
                        </p>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1.5 bg-[#111111] p-1 rounded-xl border border-white/10">
                        <button
                          onClick={() => alterarQuantidade(item.id, item.sabor, item.quantidade - 1)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 flex items-center justify-center transition-colors"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-100">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => alterarQuantidade(item.id, item.sabor, item.quantidade + 1)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 flex items-center justify-center transition-colors"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removerDoCarrinho(item.id, item.sabor)}
                          className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors ml-1"
                          aria-label="Remover item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Footer */}
            {carrinho.length > 0 && (
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between text-slate-300 text-sm">
                  <span>Subtotal:</span>
                  <span className="text-2xl font-extrabold text-[#76FF03] font-['Outfit']">
                    R$ {total.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={iniciarCheckout}
                  className="w-full py-4 btn-emerald rounded-2xl text-base shadow-xl flex items-center justify-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  <span>Avançar para WhatsApp</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#080808] border border-white/15 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 sm:p-2.5 bg-[#76FF03]/15 text-[#76FF03] rounded-2xl border border-[#76FF03]/30">
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white font-['Outfit']">Finalizar Pedido</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">Enviaremos seu pedido direto no WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setCheckoutAberto(false)}
                disabled={enviandoPedido}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                aria-label="Fechar checkout"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={confirmarPedido} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Seu Nome Completo *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Ex: João da Silva"
                      value={nomeCliente}
                      onChange={(e) => setNomeCliente(e.target.value)}
                      className="w-full bg-[#111111] border border-white/10 text-white text-sm pl-10 pr-4 py-3 rounded-xl focus:border-[#76FF03] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    WhatsApp com DDD *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Ex: (81) 99999-9999"
                      value={telefoneCliente}
                      onChange={(e) => setTelefoneCliente(e.target.value)}
                      className="w-full bg-[#111111] border border-white/10 text-white text-sm pl-10 pr-4 py-3 rounded-xl focus:border-[#76FF03] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Como nos conheceu? (Opcional)
                  </label>
                  <div className="relative">
                    <Zap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ex: Instagram, Indicação de Amigo..."
                      value={indicacao}
                      onChange={(e) => setIndicacao(e.target.value)}
                      className="w-full bg-[#111111] border border-white/10 text-white text-sm pl-10 pr-4 py-3 rounded-xl focus:border-[#76FF03] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Zona de Entrega Indicator */}
                <div className="p-3 bg-[#76FF03]/10 border border-[#76FF03]/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <MapPin className="w-4 h-4 text-[#76FF03] flex-shrink-0" />
                    <span className="text-slate-300">Região:</span>
                    <span className="font-bold text-[#76FF03] font-['Outfit']">
                      {zonaAtualInfo ? zonaAtualInfo.nome : 'Não selecionada'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutAberto(false);
                      setModalZonaAberto(true);
                    }}
                    className="text-[11px] text-[#76FF03] hover:underline font-bold"
                  >
                    Alterar Região
                  </button>
                </div>
              </div>

              {/* Summary box */}
              <div className="p-3.5 bg-white/[0.03] rounded-2xl border border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total a pagar:</span>
                <span className="text-xl font-extrabold text-[#76FF03] font-['Outfit']">
                  R$ {total.toFixed(2)}
                </span>
              </div>

              <button
                type="submit"
                disabled={enviandoPedido}
                className="w-full py-3.5 sm:py-4 btn-emerald rounded-2xl text-sm sm:text-base font-bold shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {enviandoPedido ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processando Pedido...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5" />
                    <span>Enviar Pedido pelo WhatsApp</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pedido Concluído Fallback Modal */}
      {pedidoConcluido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#080808] border border-[#76FF03]/40 rounded-3xl p-5 sm:p-8 text-center space-y-4 sm:space-y-5 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#76FF03]/15 text-[#76FF03] flex items-center justify-center mx-auto border border-[#76FF03]/40 shadow-[0_0_20px_rgba(118,255,3,0.25)]">
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white font-['Outfit']">Pedido #{pedidoConcluido.numero} Gerado!</h3>
              <p className="text-xs text-slate-400 mt-1">Total: R$ {pedidoConcluido.total.toFixed(2)}</p>
            </div>
            <p className="text-xs text-slate-300">
              Se o WhatsApp não abriu automaticamente, clique no botão abaixo para enviar os detalhes da sua compra:
            </p>
            <a
              href={pedidoConcluido.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 btn-emerald rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              <span>Abrir WhatsApp Agora</span>
            </a>
            <button
              onClick={() => setPedidoConcluido(null)}
              className="text-xs text-slate-400 hover:text-slate-200 underline block mx-auto pt-1"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Cart Bar for Mobile */}
      {!carrinhoAberto && !checkoutAberto && totalItensCarrinho > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:hidden z-40 animate-in slide-in-from-bottom-5 duration-300">
          <button
            onClick={() => setCarrinhoAberto(true)}
            className="w-full bg-[#76FF03] text-[#000000] font-['Outfit'] font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-between shadow-[0_10px_30px_rgba(118,255,3,0.45)] border border-[#76FF03] active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-black text-[#76FF03] rounded-full flex items-center justify-center text-xs font-black">
                {totalItensCarrinho}
              </div>
              <span className="text-sm">Ver Carrinho</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-black">
              <span>R$ {total.toFixed(2)}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Modern Luxury Pure Black Footer */}
      <footer className="mt-16 border-t border-white/10 bg-black py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <img
              src="/logo.png"
              alt="HC Vape Logo"
              className="w-14 h-14 rounded-full object-cover shadow-[0_0_18px_rgba(118,255,3,0.3)] border border-white/15"
            />
            <div className="space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="font-black text-white font-['Outfit'] text-lg tracking-tight">HC <span className="text-[#76FF03]">VAPE</span></span>
                <span className="text-[11px] text-[#76FF03] font-bold px-2 py-0.5 rounded-full bg-[#76FF03]/10 border border-[#76FF03]/30">Desde 2020</span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Não fume, vaporize! • Qualidade, atendimento ágil e os melhores pods do mercado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <a
              href="https://github.com/albertoramos98"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 hover:text-[#76FF03] transition-all"
              title="GitHub Alberto Ramos"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="mailto:alpemc.dev@gmail.com"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 hover:text-[#76FF03] transition-all"
              title="Contato Desenvolvedor"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
