import { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, X, Plus, Minus, AlertCircle, Zap, Clock, 
  ImageOff, Phone, User, CheckCircle2, Loader2, Github, 
  Mail, MapPin, Truck, ChevronRight, Search, Menu, Package
} from 'lucide-react';
import { produtosService, pedidosService, Produto, utils, PedidoItem } from '@/lib/supabase';
import { useLocation } from "wouter";

/**
 * HC - Desde 2020 | Catálogo Digital
 * Design: Moderno, Minimalista, Cyberpunk
 * Cores: Verde Lima (#39FF14) + Preto Absoluto (#000000)
 */

interface CartItem {
  id: string;
  nome: string;
  preco: number;
  sabor: string;
  quantidade: number;
  is_promo?: boolean;
  preco_promo?: number;
}

const CATEGORIAS = [
  { id: 'vape', label: 'Vapes', icon: Zap },
  { id: 'pod', label: 'Pods', icon: Package },
  { id: 'juice', label: 'Juices', icon: AlertCircle },
  { id: 'acessorio', label: 'Acessórios', icon: Plus },
];

// Componente de imagem do produto com fallback
function ProdutoImagem({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [erro, setErro] = useState(false);

  if (!src || erro) { 
    return (
      <div className={`flex items-center justify-center bg-black/40 border-b border-[#39FF14]/10 ${className}`}>
        <div className="flex flex-col items-center gap-2 text-[#39FF14]/30">
          <ImageOff className="w-10 h-10" />
          <span className="text-xs font-['Roboto_Mono']">Sem imagem</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setErro(true)}
    />
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [saborSelecionado, setSaborSelecionado] = useState<Record<string, string>>({});
  const [horarioPromoAtivo, setHorarioPromoAtivo] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'expressos' | 'promocionais'>('expressos');
  const [popupAviso, setPopupAviso] = useState(true);

  // Estados do Checkout
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [indicacao, setIndicacao] = useState('');
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [pedidoConcluido, setPedidoConcluido] = useState<{ numero: number; total: number } | null>(null);

  // Fechar pop-up de aviso
  const fecharPopupAviso = () => {
    setPopupAviso(false);
  };

  // Carregar produtos do Supabase
  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        setCarregando(true);
        setErro(null);
        const dados = await produtosService.obterTodos();
        setProdutos(dados);

        const ativo = utils.estaEmHorarioPromo();
        setHorarioPromoAtivo(ativo);
      } catch (err) {
        console.error('Erro ao carregar produtos:', err);
        setErro('Erro ao carregar produtos. Tente novamente.');
      } finally {
        setCarregando(false);
      }
    };

    carregarProdutos();

    const intervalo = setInterval(() => {
      const ativo = utils.estaEmHorarioPromo();
      setHorarioPromoAtivo(ativo);
    }, 60000);

    return () => clearInterval(intervalo);
  }, []);

  // Redirecionamento se clicar em promocionais fora do horário
  const alternarAba = (aba: 'expressos' | 'promocionais') => {
    if (aba === 'promocionais' && !horarioPromoAtivo) {
      setLocation("/promocional-info");
      return;
    }
    setAbaAtiva(aba);
    setMarcaSelecionada(null);
    setCategoriaSelecionada(null);
  };

  // Produtos Expressos (não promocionais)
  const produtosExpressos = useMemo(() => {
    return produtos.filter(p => !p.is_promo && p.estoque > 0);
  }, [produtos]);

  // Produtos Promocionais
  const produtosPromo = useMemo(() => {
    return produtos.filter(p => p.is_promo && p.estoque > 0);
  }, [produtos]);

  // Filtrar produtos
  const produtosExibidos = useMemo(() => {
    let filtrados = abaAtiva === 'expressos' ? produtosExpressos : produtosPromo;

    if (categoriaSelecionada) {
      filtrados = filtrados.filter(p => 
        p.nome.toLowerCase().includes(categoriaSelecionada.toLowerCase()) || 
        p.marca.toLowerCase().includes(categoriaSelecionada.toLowerCase())
      );
    }

    if (marcaSelecionada) {
      filtrados = filtrados.filter(p => p.marca === marcaSelecionada);
    }

    return filtrados;
  }, [produtosExpressos, produtosPromo, abaAtiva, categoriaSelecionada, marcaSelecionada]);

  // Marcas apenas de Expressos
  const marcasExpressos = useMemo(() => {
    return Array.from(new Set(produtosExpressos.map(p => p.marca))).sort();
  }, [produtosExpressos]);

  // Calcular total do carrinho
  const total = useMemo(() => {
    return carrinho.reduce((sum, item) => {
      const preco = item.is_promo && item.preco_promo ? item.preco_promo : item.preco;
      return sum + (preco * item.quantidade);
    }, 0);
  }, [carrinho]);

  // Adicionar ao carrinho
  const adicionarAoCarrinho = (produto: Produto) => {
    const sabor = saborSelecionado[produto.id];
    if (!sabor) {
      alert('Por favor, selecione um sabor!');
      return;
    }

    if (produto.estoque <= 0) {
      alert('Produto esgotado!');
      return;
    }

    if (produto.is_promo && !horarioPromoAtivo) {
      setLocation("/promocional-info");
      return;
    }

    const itemExistente = carrinho.find(
      item => item.id === produto.id && item.sabor === sabor
    );

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
          nome: produto.nome,
          preco: produto.preco,
          sabor,
          quantidade: 1,
          is_promo: produto.is_promo,
          preco_promo: produto.preco_promo,
        },
      ]);
    }

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
    setCarrinho(carrinho.map(item =>
      item.id === id && item.sabor === sabor
        ? { ...item, quantidade: novaQuantidade }
        : item
    ));
  };

  // Iniciar checkout
  const iniciarCheckout = () => {
    if (carrinho.length === 0) {
      alert('Carrinho vazio!');
      return;
    }
    setCheckoutAberto(true);
    setCarrinhoAberto(false);
  };

  // Confirmar e salvar pedido
  const confirmarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente || !telefoneCliente) {
      alert('Por favor, preencha seu nome e telefone!');
      return;
    }

    try {
      setEnviandoPedido(true);
      
      const itensPedido: PedidoItem[] = carrinho.map(item => ({
        id: item.id,
        nome: item.nome,
        sabor: item.sabor,
        quantidade: item.quantidade,
        preco_unitario: item.is_promo && item.preco_promo ? item.preco_promo : item.preco,
        is_promo: item.is_promo
      }));

      const novoPedido = await pedidosService.criar({
        nome_cliente: nomeCliente,
        telefone_cliente: telefoneCliente,
        indicacao: indicacao,
        itens: itensPedido,
        total: total,
        desconto: 0,
        total_final: total,
        status_checklist: false,
        notas: ''
      });

      // Gerar link WhatsApp
      const mensagemItens = carrinho
        .map(item => {
          const preco = item.is_promo && item.preco_promo ? item.preco_promo : item.preco;
          return `• ${item.quantidade}x ${item.nome} (${item.sabor}) — R$ ${(preco * item.quantidade).toFixed(2)}`;
        })
        .join('\n');

      const textoFinal = `Olá! Acabei de fazer um pedido pelo site: 🛒✨\n\n🆔 *Pedido:* #${novoPedido.numero_pedido}\n👤 *Cliente:* ${nomeCliente}\n📞 *WhatsApp:* ${telefoneCliente}\n${indicacao ? `💡 *Vim por:* ${indicacao}\n` : ''}\n---\n📦 *MEUS ITENS:*\n\n${mensagemItens}\n\n---\n💰 *TOTAL:* R$ ${novoPedido.total_final.toFixed(2)}\n\nHC Vape agradece a preferência! 🌬️💨`;
      const whatsappUrl = `https://wa.me/558197390944?text=${encodeURIComponent(textoFinal)}`;
      
      setPedidoConcluido({ numero: novoPedido.numero_pedido, total: novoPedido.total_final });
      window.location.href = whatsappUrl;
      setCarrinho([]);

    } catch (err) {
      console.error('Erro ao salvar pedido:', err);
      alert('Erro ao processar pedido. Por favor, verifique sua conexão e tente novamente.');
    } finally {
      setEnviandoPedido(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#39FF14] border-t-transparent rounded-full animate-spin mx-auto mb-4 shadow-[0_0_15px_rgba(57,255,20,0.5)]"></div>
          <p className="text-[#39FF14] font-['Orbitron'] font-bold tracking-widest">LOADING HC...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#39FF14] selection:text-black">
      
      {/* Pop-up de Aviso */}
      {popupAviso && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[#0a0a0a] border-2 border-[#39FF14] p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(57,255,20,0.3)] animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="bg-[#39FF14]/10 p-4 rounded-full">
                <AlertCircle className="w-12 h-12 text-[#39FF14]" />
              </div>
              <h2 className="text-3xl font-bold font-['Orbitron'] text-white">BEM-VINDO À HC</h2>
              
              <div className="space-y-4 text-[#C0C0C0] font-['Roboto_Mono'] text-sm">
                <p>
                  🚀 <strong className="text-[#39FF14]">PEDIDOS EXPRESSOS:</strong><br />
                  Segunda a Sábado — 10:00 às 22:00
                </p>
                <div className="h-px bg-[#39FF14]/20 w-full" />
                <p>
                  🔥 <strong className="text-red-500">PROMOÇÃO:</strong><br />
                  Segunda a Quinta — 09:00 às 15:25
                </p>
              </div>

              <button
                onClick={fecharPopupAviso}
                className="w-full py-4 bg-[#39FF14] text-black rounded-xl font-['Orbitron'] font-bold text-lg hover:shadow-[0_0_30px_rgba(57,255,20,0.6)] hover:scale-[1.02] transition-all duration-300"
              >
                ENTRAR NA LOJA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-[#39FF14]/20">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <div className="bg-[#39FF14] text-black px-2 py-1 rounded-lg font-bold font-['Orbitron'] text-xl">HC</div>
            <div>
              <h1 className="text-lg font-bold font-['Orbitron'] tracking-tighter leading-none">VAPE</h1>
              <span className="text-[10px] text-[#39FF14]/50 font-['Roboto_Mono']">EST. 2020</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setCarrinhoAberto(true)}
              className="relative p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-[#39FF14]/10 hover:border-[#39FF14]/30 transition-all duration-300 group"
            >
              <ShoppingCart className="w-6 h-6 text-white group-hover:text-[#39FF14]" />
              {carrinho.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#39FF14] text-black text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                  {carrinho.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-[#39FF14]/10">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-[#39FF14]/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-[#39FF14]/5 blur-[100px] rounded-full" />
        
        <div className="container mx-auto px-4 relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-full text-[#39FF14] text-xs font-bold font-['Orbitron'] animate-fade-in">
            <MapPin className="w-3 h-3" />
            DELIVERY EM ITAJAÍ, BC E REGIÃO
          </div>
          
          <h2 className="text-5xl md:text-7xl font-bold font-['Orbitron'] tracking-tighter leading-tight">
            QUALIDADE <br /> <span className="text-[#39FF14] neon-glow">INSTANTÂNEA</span>
          </h2>
          
          <p className="max-w-xl mx-auto text-gray-400 font-['Roboto_Mono'] text-sm md:text-base">
            O melhor catálogo de vapes e pods do litoral catarinense. Peça agora e receba no conforto da sua casa.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl group hover:border-[#39FF14]/50 transition-all cursor-default">
              <Truck className="w-8 h-8 text-[#39FF14]" />
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-500 uppercase font-['Orbitron']">Frete Fixo R$ 10</p>
                <p className="text-sm font-bold text-white font-['Roboto_Mono']">Itajaí & Balneário</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-[#39FF14]/5 border border-[#39FF14]/20 px-6 py-4 rounded-2xl group hover:border-[#39FF14] transition-all cursor-default">
              <Zap className="w-8 h-8 text-[#39FF14]" />
              <div className="text-left">
                <p className="text-[10px] font-bold text-[#39FF14]/70 uppercase font-['Orbitron']">Frete Grátis</p>
                <p className="text-sm font-bold text-white font-['Roboto_Mono']">Acima de R$ 300</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        
        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          
          {/* Main Tabs */}
          <div className="flex p-1.5 bg-white/5 border border-white/10 rounded-2xl md:w-fit">
            <button
              onClick={() => alternarAba('expressos')}
              className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-['Orbitron'] font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                abaAtiva === 'expressos'
                  ? 'bg-[#39FF14] text-black shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              EXPRESSOS
            </button>
            <button
              onClick={() => alternarAba('promocionais')}
              className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-['Orbitron'] font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                abaAtiva === 'promocionais'
                  ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              PROMOÇÕES
            </button>
          </div>

          {/* Categories Filter */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaSelecionada(categoriaSelecionada === cat.id ? null : cat.id)}
                className={`px-4 py-3 rounded-2xl font-['Orbitron'] font-bold text-xs border transition-all duration-300 flex items-center gap-2 ${
                  categoriaSelecionada === cat.id
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Brands Scroll (Only for Expressos) */}
        {abaAtiva === 'expressos' && (
          <div className="mb-12 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => setMarcaSelecionada(null)}
                className={`flex-shrink-0 px-6 py-2 rounded-full font-['Roboto_Mono'] text-xs font-bold transition-all ${
                  marcaSelecionada === null
                    ? 'bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14]'
                    : 'bg-white/5 border border-white/10 text-gray-500 hover:border-white/20'
                }`}
              >
                TODAS AS MARCAS
              </button>
              {marcasExpressos.map(marca => (
                <button
                  key={marca}
                  onClick={() => setMarcaSelecionada(marca)}
                  className={`flex-shrink-0 px-6 py-2 rounded-full font-['Roboto_Mono'] text-xs font-bold transition-all ${
                    marcaSelecionada === marca
                      ? 'bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14]'
                      : 'bg-white/5 border border-white/10 text-gray-500 hover:border-white/20'
                  }`}
                >
                  {marca.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold font-['Orbitron'] flex items-center gap-3">
              {abaAtiva === 'expressos' ? 'PRODUTOS DISPONÍVEIS' : 'OFERTAS ATIVAS'}
              <span className="text-[#39FF14]/30 text-sm font-['Roboto_Mono']">({produtosExibidos.length})</span>
            </h3>
            
            <div className="hidden md:flex items-center gap-2 text-xs font-['Roboto_Mono'] text-gray-500">
              <Search className="w-4 h-4" />
              USE OS FILTROS PARA BUSCAR
            </div>
          </div>

          {produtosExibidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
              <Package className="w-16 h-16 text-white/10 mb-4" />
              <p className="text-gray-500 font-['Orbitron'] font-bold">NENHUM PRODUTO ENCONTRADO</p>
              <button 
                onClick={() => { setMarcaSelecionada(null); setCategoriaSelecionada(null); }}
                className="mt-4 text-[#39FF14] text-xs font-bold underline font-['Roboto_Mono']"
              >
                LIMPAR FILTROS
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {produtosExibidos.map(produto => (
                <div
                  key={produto.id}
                  className="group bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:border-[#39FF14]/50 hover:shadow-[0_0_30px_rgba(57,255,20,0.1)] flex flex-col h-full"
                >
                  {/* Image Container */}
                  <div className="relative aspect-square overflow-hidden bg-black/40">
                    <ProdutoImagem
                      src={produto.imagem_url}
                      alt={produto.nome}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    
                    {produto.is_promo && (
                      <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black font-['Orbitron'] animate-pulse">
                        OFERTA
                      </div>
                    )}
                    
                    {produto.estoque < 5 && produto.estoque > 0 && (
                      <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-[10px] font-black font-['Orbitron']">
                        ÚLTIMAS UNIDADES
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex-1">
                      <p className="text-[10px] text-[#39FF14] font-bold font-['Orbitron'] tracking-widest uppercase mb-1">
                        {produto.marca}
                      </p>
                      <h4 className="text-lg font-bold font-['Orbitron'] leading-tight mb-4 group-hover:text-[#39FF14] transition-colors">
                        {produto.nome}
                      </h4>

                      {/* Prices */}
                      <div className="mb-6">
                        {produto.is_promo && produto.preco_promo ? (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500 line-through font-['Roboto_Mono']">
                              R$ {produto.preco.toFixed(2)}
                            </p>
                            <div className="flex items-center gap-3">
                              <p className="text-2xl font-black text-red-500 font-['Roboto_Mono']">
                                R$ {produto.preco_promo.toFixed(2)}
                              </p>
                              <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold">
                                -{Math.round((1 - produto.preco_promo/produto.preco) * 100)}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-2xl font-black text-white group-hover:text-[#39FF14] transition-colors font-['Roboto_Mono']">
                            R$ {produto.preco.toFixed(2)}
                          </p>
                        )}
                      </div>

                      {/* Sabor Selector */}
                      <div className="space-y-2 mb-6">
                        <label className="text-[10px] font-bold text-gray-500 uppercase font-['Orbitron']">Sabor:</label>
                        <select
                          value={saborSelecionado[produto.id] || ''}
                          onChange={(e) =>
                            setSaborSelecionado({ ...saborSelecionado, [produto.id]: e.target.value })
                          }
                          className="w-full bg-white/5 border border-white/10 text-sm font-['Roboto_Mono'] px-4 py-3 rounded-xl focus:border-[#39FF14] focus:outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-black">ESCOLHER SABOR...</option>
                          {produto.sabores.map(sabor => (
                            <option key={sabor} value={sabor} className="bg-black">
                              {sabor}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={() => adicionarAoCarrinho(produto)}
                      disabled={produto.estoque <= 0}
                      className={`w-full py-4 rounded-2xl font-['Orbitron'] font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        produto.estoque <= 0
                          ? 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                          : produto.is_promo
                          ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
                          : 'bg-[#39FF14] text-black hover:shadow-[0_0_20px_rgba(57,255,20,0.4)]'
                      }`}
                    >
                      {produto.estoque <= 0 ? (
                        <>ESGOTADO</>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          ADICIONAR
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Cart Drawer Overlay */}
      {carrinhoAberto && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-end">
          <div 
            className="w-full md:w-[450px] bg-black border-l border-[#39FF14]/20 flex flex-col h-full animate-in slide-in-from-right duration-500"
          >
            {/* Cart Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold font-['Orbitron']">CARRINHO</h2>
                <p className="text-xs text-gray-500 font-['Roboto_Mono']">{carrinho.length} ITENS NO PEDIDO</p>
              </div>
              <button 
                onClick={() => setCarrinhoAberto(false)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Cart Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {carrinho.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <ShoppingCart className="w-20 h-20" />
                  <p className="font-['Orbitron'] font-bold">CARRINHO VAZIO</p>
                </div>
              ) : (
                carrinho.map(item => (
                  <div key={`${item.id}-${item.sabor}`} className="flex gap-4 p-4 bg-white/5 rounded-3xl border border-white/5">
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-[#39FF14] font-bold font-['Orbitron'] tracking-widest uppercase">
                        {item.is_promo && "⚡ "} ITEM
                      </p>
                      <h5 className="font-bold font-['Orbitron'] text-sm">{item.nome}</h5>
                      <p className="text-xs text-gray-400 font-['Roboto_Mono']">{item.sabor}</p>
                      <p className="text-[#39FF14] font-black font-['Roboto_Mono'] mt-2">
                        R$ {((item.is_promo && item.preco_promo ? item.preco_promo : item.preco) * item.quantidade).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-between bg-black/40 rounded-2xl p-2 border border-white/5">
                      <button 
                        onClick={() => alterarQuantidade(item.id, item.sabor, item.quantidade + 1)}
                        className="p-1.5 hover:text-[#39FF14] transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black font-['Roboto_Mono']">{item.quantidade}</span>
                      <button 
                        onClick={() => alterarQuantidade(item.id, item.sabor, item.quantidade - 1)}
                        className="p-1.5 hover:text-red-500 transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            {carrinho.length > 0 && (
              <div className="p-8 border-t border-white/5 space-y-6 bg-white/[0.02]">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500 font-['Orbitron']">
                    <span>SUBTOTAL</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold font-['Orbitron']">TOTAL</span>
                    <span className="text-3xl font-black text-[#39FF14] font-['Roboto_Mono']">R$ {total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={iniciarCheckout}
                  className="w-full py-5 bg-[#39FF14] text-black rounded-2xl font-['Orbitron'] font-black text-lg flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(57,255,20,0.4)] transition-all active:scale-95"
                >
                  FINALIZAR PEDIDO
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutAberto && (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#39FF14]/30 rounded-[40px] p-8 md:p-12 shadow-[0_0_80px_rgba(57,255,20,0.15)] animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold font-['Orbitron']">FINALIZAR</h2>
                <p className="text-xs text-[#39FF14] font-['Roboto_Mono']">QUASE LÁ! PREENCHA SEUS DADOS.</p>
              </div>
              <button 
                onClick={() => setCheckoutAberto(false)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={confirmarPedido} className="space-y-8">
              <div className="space-y-6">
                <div className="group space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 font-['Orbitron'] group-focus-within:text-[#39FF14] transition-colors">SEU NOME COMPLETO</label>
                  <input
                    type="text"
                    required
                    placeholder="DIGITE SEU NOME..."
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 px-6 py-4 rounded-2xl font-['Roboto_Mono'] text-white focus:border-[#39FF14] focus:outline-none transition-all"
                  />
                </div>

                <div className="group space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 font-['Orbitron'] group-focus-within:text-[#39FF14] transition-colors">WHATSAPP (DDD)</label>
                  <input
                    type="tel"
                    required
                    placeholder="(00) 00000-0000"
                    value={telefoneCliente}
                    onChange={(e) => setTelefoneCliente(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 px-6 py-4 rounded-2xl font-['Roboto_Mono'] text-white focus:border-[#39FF14] focus:outline-none transition-all"
                  />
                </div>

                <div className="group space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 font-['Orbitron'] group-focus-within:text-[#39FF14] transition-colors">COMO NOS CONHECEU? (OPCIONAL)</label>
                  <input
                    type="text"
                    placeholder="EX: INSTAGRAM, AMIGO..."
                    value={indicacao}
                    onChange={(e) => setIndicacao(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 px-6 py-4 rounded-2xl font-['Roboto_Mono'] text-white focus:border-[#39FF14] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="p-6 bg-[#39FF14]/5 rounded-3xl border border-[#39FF14]/10 flex justify-between items-center">
                <span className="font-['Orbitron'] font-bold text-gray-400">TOTAL</span>
                <span className="text-2xl font-black text-[#39FF14] font-['Roboto_Mono']">R$ {total.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={enviandoPedido}
                className="w-full py-6 bg-[#39FF14] text-black rounded-[24px] font-['Orbitron'] font-black text-xl flex items-center justify-center gap-4 hover:shadow-[0_0_40px_rgba(57,255,20,0.5)] transition-all disabled:opacity-50"
              >
                {enviandoPedido ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <>
                    PEDIR NO WHATSAPP
                    <Phone className="w-6 h-6" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-20 bg-[#050505] border-t border-white/5">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="bg-[#39FF14] text-black px-2 py-1 rounded-lg font-bold font-['Orbitron'] text-xl">HC</div>
              <h1 className="text-lg font-bold font-['Orbitron'] tracking-tighter">VAPE</h1>
            </div>
            <p className="text-gray-500 font-['Roboto_Mono'] text-sm leading-relaxed">
              Referência em delivery de vapes e pods no litoral de Santa Catarina desde 2020. Qualidade e rapidez garantida.
            </p>
          </div>

          <div className="space-y-6">
            <h5 className="font-['Orbitron'] font-black text-[#39FF14] tracking-widest text-xs">CATEGORIAS</h5>
            <ul className="space-y-4 font-['Roboto_Mono'] text-sm text-gray-400">
              <li className="hover:text-white cursor-pointer transition-colors" onClick={() => setCategoriaSelecionada('vape')}>Vapes Convencionais</li>
              <li className="hover:text-white cursor-pointer transition-colors" onClick={() => setCategoriaSelecionada('pod')}>Pods Descartáveis</li>
              <li className="hover:text-white cursor-pointer transition-colors" onClick={() => setCategoriaSelecionada('juice')}>Juices & Líquidos</li>
              <li className="hover:text-white cursor-pointer transition-colors" onClick={() => setCategoriaSelecionada('acessorio')}>Resistências & Acessórios</li>
            </ul>
          </div>

          <div className="space-y-6">
            <h5 className="font-['Orbitron'] font-black text-[#39FF14] tracking-widest text-xs">INFORMAÇÕES</h5>
            <ul className="space-y-4 font-['Roboto_Mono'] text-sm text-gray-400">
              <li className="hover:text-white transition-colors"><a href="/como-funciona">Como funciona o delivery?</a></li>
              <li className="hover:text-white transition-colors"><a href="/promocional-info">Regras das Promoções</a></li>
              <li className="hover:text-white transition-colors">Dúvidas Frequentes</li>
            </ul>
          </div>

          <div className="space-y-6">
            <h5 className="font-['Orbitron'] font-black text-[#39FF14] tracking-widest text-xs">DESENVOLVEDOR</h5>
            <div className="flex items-center gap-4">
              <a href="https://github.com/albertoramos98" target="_blank" className="p-3 bg-white/5 hover:bg-[#39FF14]/20 rounded-2xl transition-all">
                <Github className="w-5 h-5" />
              </a>
              <a href="mailto:alpemc.dev@gmail.com" className="p-3 bg-white/5 hover:bg-[#39FF14]/20 rounded-2xl transition-all">
                <Mail className="w-5 h-5" />
              </a>
            </div>
            <p className="text-[10px] text-gray-600 font-['Roboto_Mono']">
              &copy; {new Date().getFullYear()} HC VAPE. TODOS OS DIREITOS RESERVADOS. <br />
              BUILT BY ALBERTO RAMOS.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
