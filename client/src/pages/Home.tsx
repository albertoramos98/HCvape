import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, X, Plus, Minus, AlertCircle, Zap, Clock, ImageOff, Phone, User, CheckCircle2, Loader2 } from 'lucide-react';
import { produtosService, pedidosService, Produto, utils, PedidoItem } from '@/lib/supabase';

/**
 * HC - Desde 2020 | Catálogo Digital
 * Design: Cyberpunk Futurista Minimalista
 * Cores: Neon Verde (#39FF14) + Prata Cromada (#C0C0C0) + Preto Absoluto (#000000)
 * Tipografia: Orbitron (display) + Roboto Mono (body)
 * Dados: Supabase (tabela produtos)
 * Promoções: Seção "Ofertas Relâmpago" com trava de horário (16h)
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

// Componente de imagem do produto com fallback
function ProdutoImagem({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [erro, setErro] = useState(false);

  if (!src || erro) { 
    return (
      <div className={`flex items-center justify-center bg-black/40 border-b border-[#39FF14]/20 ${className}`}>
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
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
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

  // Produtos Expressos (não promocionais)
  const produtosExpressos = useMemo(() => {
    return produtos.filter(p => !p.is_promo && p.estoque > 0);
  }, [produtos]);

  // Produtos Promocionais
  const produtosPromo = useMemo(() => {
    return produtos.filter(p => p.is_promo && p.estoque > 0);
  }, [produtos]);

  // Filtrar produtos Expressos por marca
  const produtosFiltrados = useMemo(() => {
    if (!marcaSelecionada) {
      return produtosExpressos;
    }
    return produtosExpressos.filter(p => p.marca === marcaSelecionada);
  }, [produtosExpressos, marcaSelecionada]);

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
      alert('⏰ Promoção Encerrada! A promoção está disponível apenas das 09:00 às 15:25.');
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

      // Gerar link WhatsApp com formato amigável e preços
      const mensagemItens = carrinho
        .map(item => {
          const preco = item.is_promo && item.preco_promo ? item.preco_promo : item.preco;
          return `• ${item.quantidade}x ${item.nome} (${item.sabor}) — R$ ${(preco * item.quantidade).toFixed(2)}`;
        })
        .join('\n');

      const textoFinal = `Olá! Acabei de fazer um pedido pelo site: 🛒✨\n\n🆔 *Pedido:* #${novoPedido.numero_pedido}\n👤 *Cliente:* ${nomeCliente}\n📞 *WhatsApp:* ${telefoneCliente}\n${indicacao ? `💡 *Vim por:* ${indicacao}\n` : ''}\n---\n📦 *MEUS ITENS:*\n\n${mensagemItens}\n\n---\n💰 *TOTAL:* R$ ${novoPedido.total_final.toFixed(2)}\n\nHC Vape agradece a preferência! 🌬️💨`;
      const whatsappUrl = `https://wa.me/558197390944?text=${encodeURIComponent(textoFinal)}`;
      
      // Redirecionamento instantâneo
      window.open(whatsappUrl, '_blank');
      
      // Limpar estados imediatamente após abrir o WPP
      setCarrinho([]);
      setCheckoutAberto(false);
      setNomeCliente('');
      setTelefoneCliente('');
      setIndicacao('');

    } catch (err) {
      console.error('Erro ao salvar pedido:', err);
      alert('Erro ao processar pedido. Tente novamente.');
    } finally {
      setEnviandoPedido(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-black asphalt-texture flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#39FF14] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#39FF14] font-['Orbitron'] font-bold">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black asphalt-texture">
      {/* Pop-up de Aviso */}
      {popupAviso && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-morphism p-8 rounded-xl border border-red-500/50 max-w-md mx-4 shadow-[0_0_30px_rgba(255,0,0,0.3)]">
            <div className="flex items-start gap-4 mb-6">
              <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-[#E0E0E0] font-['Orbitron']">
                  ATENCAO!
                </h2>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg leading-relaxed">
                <strong>PROMOÇÃO 🚀🔥✨</strong> só pode ser pedida das <strong className="text-red-400">09:00 até as 15:25</strong>.
              </p>
              <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg leading-relaxed">
                <strong>Pedidos Expressos</strong> Das 10:00 às 22:00. Fora desse horário, os pedidos serão processados no dia seguinte a partir das 10:00.
              </p>
              <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                <p className="text-red-400 font-['Roboto_Mono'] font-bold">
                  Horário atual: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <button
              onClick={fecharPopupAviso}
              className="w-full px-6 py-3 bg-[#39FF14] text-black rounded-lg font-['Orbitron'] font-bold text-lg hover:shadow-[0_0_20px_rgba(57,255,20,0.6)] transition-all duration-300"
            >
              Tenho Ciencia Disso
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-[#39FF14]/30">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold neon-glow font-['Orbitron']">HC</h1>
            <p className="text-xs text-[#C0C0C0] font-['Roboto_Mono']">Desde 2020</p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/como-funciona"
              className="px-4 py-2 bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] rounded-lg font-['Orbitron'] font-bold text-sm hover:bg-[#39FF14]/30 transition-all duration-300"
            >
               Como Funciona?
            </a>

            <button
              onClick={() => setCarrinhoAberto(!carrinhoAberto)}
              className="relative p-3 bg-[#39FF14]/20 border border-[#39FF14] rounded-lg hover:bg-[#39FF14]/30 transition-all duration-300"
            >
              <ShoppingCart className="w-6 h-6 text-[#39FF14]" />
              {carrinho.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {carrinho.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {erro && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-400">{erro}</p>
          </div>
        )}

        {/* Aviso de Horário */}
        {!horarioPromoAtivo && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500 rounded-lg flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-500" />
            <p className="text-yellow-400 font-['Roboto_Mono']">
              ⏰ Promoção encerrada! Disponível novamente das 09:00 às 15:25.
            </p>
          </div>
        )}

        {/* Abas de Seleção */}
        <section className="mb-8">
          <div className="flex gap-4 mb-8 border-b border-[#39FF14]/30 pb-4">
            <button
              onClick={() => {
                setAbaAtiva('expressos');
                setMarcaSelecionada(null);
              }}
              className={`px-6 py-3 font-['Orbitron'] font-bold transition-all duration-300 ${
                abaAtiva === 'expressos'
                  ? 'text-[#39FF14] border-b-2 border-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.3)]'
                  : 'text-[#C0C0C0] hover:text-[#39FF14]'
              }`}
            >
              🚀 Pedidos Expressos
            </button>
            <button
              onClick={() => {
                setAbaAtiva('promocionais');
                setMarcaSelecionada(null);
              }}
              className={`px-6 py-3 font-['Orbitron'] font-bold transition-all duration-300 ${
                abaAtiva === 'promocionais'
                  ? 'text-red-500 border-b-2 border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.3)]'
                  : 'text-[#C0C0C0] hover:text-red-500'
              }`}
            >
              🔥 PROMOÇÃO 🚀🔥
            </button>
          </div>
        </section>

        {/* Filtros de Marca - Apenas para Expressos */}
        {abaAtiva === 'expressos' && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#E0E0E0] mb-4 font-['Orbitron']">
              Filtrar por Marca
            </h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setMarcaSelecionada(null)}
                className={`px-4 py-2 rounded-lg font-['Orbitron'] font-bold transition-all duration-300 ${
                  marcaSelecionada === null
                    ? 'bg-[#39FF14] text-black shadow-[0_0_15px_rgba(57,255,20,0.5)]'
                    : 'bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14]/30'
                }`}
              >
                Todas
              </button>
              {marcasExpressos.map((marca: string) => (
                <button
                  key={marca}
                  onClick={() => setMarcaSelecionada(marca)}
                  className={`px-4 py-2 rounded-lg font-['Orbitron'] font-bold transition-all duration-300 ${
                    marcaSelecionada === marca
                      ? 'bg-[#39FF14] text-black shadow-[0_0_15px_rgba(57,255,20,0.5)]'
                      : 'bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14]/30'
                  }`}
                >
                  {marca}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Aviso específico da aba de promoções */}
        {abaAtiva === 'promocionais' && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-3 shadow-[0_0_15px_rgba(255,0,0,0.3)]">
            <Clock className="w-5 h-5 text-red-500" />
            <p className="text-red-400 font-['Roboto_Mono']">
              ⚠️ PROMOÇÃO 🚀 só pode ser pedida das <strong>09:00 às 15:25</strong>. Entrega às <strong>19:00</strong> de Segunda a Quinta.
            </p>
          </div>
        )}

        {/* Grid de Produtos */}
        <section>
          <h2 className="text-2xl font-bold text-[#E0E0E0] mb-6 font-['Orbitron']">
            {abaAtiva === 'expressos'
              ? marcaSelecionada ? `${marcaSelecionada}` : 'Pedidos Expressos'
              : '🔥 PROMOÇÃO 🚀🔥✨'}
          </h2>

          {(abaAtiva === 'expressos' ? produtosFiltrados : produtosPromo).length === 0 ? (
            <p className="text-center text-[#808080] py-12">Nenhum produto encontrado</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(abaAtiva === 'expressos' ? produtosFiltrados : produtosPromo).map(produto => (
                <div
                  key={produto.id}
                  className={`glass-morphism rounded-xl border transition-all duration-300 overflow-hidden ${
                    produto.is_promo 
                      ? 'border-red-500 shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:shadow-[0_0_30px_rgba(255,0,0,0.5)]' 
                      : 'border-[#39FF14]/30 hover:border-[#39FF14] hover:shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                  }`}
                >
                  {/* Imagem do produto */}
                  <div className="relative h-48 bg-black/40 border-b border-inherit">
                    <ProdutoImagem
                      src={produto.imagem_url}
                      alt={produto.nome}
                      className="w-full h-full object-cover"
                    />

                    {/* Badge Promoção sobre a imagem */}
                    {produto.is_promo && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-['Orbitron'] font-bold shadow-[0_0_10px_rgba(255,0,0,0.5)] animate-pulse">
                        🔥 PROMOÇÃO 🚀
                      </div>
                    )}
                  </div>

                  {/* Conteúdo do card */}
                  <div className="p-5 relative z-10 bg-black/20">
                    <h3 className="text-lg font-bold text-[#E0E0E0] mb-1 font-['Orbitron']">
                      {produto.is_promo && '⚡ '} {produto.nome}
                    </h3>

                    <p className="text-xs text-[#C0C0C0] mb-4 font-['Roboto_Mono']">
                      {produto.marca}
                    </p>

                    {/* Preço */}
                    <div className="mb-4">
                      {produto.is_promo && produto.preco_promo ? (
                        <div className="flex flex-col">
                          <p className="text-sm text-[#808080] line-through font-['Roboto_Mono']">
                            R$ {produto.preco.toFixed(2)}
                          </p>
                          <p className="text-2xl font-bold text-red-500 font-['Roboto_Mono'] flex items-center gap-2">
                            R$ {produto.preco_promo.toFixed(2)} <span className="text-sm bg-red-500/20 px-2 py-0.5 rounded text-red-400">-{Math.round((1 - produto.preco_promo/produto.preco) * 100)}%</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold neon-glow font-['Roboto_Mono']">
                          R$ {produto.preco.toFixed(2)}
                        </p>
                      )}
                    </div>

                    {/* Sabor */}
                    <div className="space-y-2 mb-4">
                      <label className="text-[10px] text-[#808080] uppercase font-bold font-['Roboto_Mono']">Selecione o Sabor:</label>
                      <select
                        value={saborSelecionado[produto.id] || ''}
                        onChange={(e) =>
                          setSaborSelecionado({ ...saborSelecionado, [produto.id]: e.target.value })
                        }
                        className={`w-full bg-black/60 border text-[#E0E0E0] px-3 py-2 rounded-lg focus:outline-none transition-all duration-300 font-['Roboto_Mono'] text-sm ${
                          produto.is_promo ? 'border-red-500/50 focus:border-red-500' : 'border-[#39FF14]/50 focus:border-[#39FF14]'
                        }`}
                      >
                        <option value="">Escolha uma opção...</option>
                        {produto.sabores.map(sabor => (
                          <option key={sabor} value={sabor}>
                            {sabor}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Botão */}
                    <button
                      onClick={() => adicionarAoCarrinho(produto)}
                      disabled={produto.estoque <= 0 || (produto.is_promo && !horarioPromoAtivo)}
                      className={`w-full py-3 rounded-lg font-['Orbitron'] font-bold transition-all duration-300 ${
                        produto.estoque <= 0
                          ? 'bg-gray-500 text-gray-400 cursor-not-allowed'
                          : produto.is_promo && !horarioPromoAtivo
                          ? 'bg-gray-500/50 text-gray-500 cursor-not-allowed border border-gray-500/30'
                          : produto.is_promo 
                          ? 'bg-red-500 text-white hover:bg-red-600 hover:shadow-[0_0_20px_rgba(255,0,0,0.5)]'
                          : 'bg-[#39FF14] text-black hover:shadow-[0_0_20px_rgba(57,255,20,0.5)]'
                      }`}
                    >
                      {produto.estoque <= 0
                        ? '🚫 ESGOTADO'
                        : produto.is_promo && !horarioPromoAtivo
                        ? '⏰ ENCERRADO'
                        : produto.is_promo ? '🔥 ADICIONAR' : '🚀 ADICIONAR'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Carrinho Flutuante */}
      {carrinhoAberto && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-end p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full md:w-96 glass-morphism p-6 rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold neon-glow font-['Orbitron']">Carrinho</h2>
              <button
                onClick={() => setCarrinhoAberto(false)}
                className="p-2 hover:bg-[#39FF14]/20 rounded-lg transition-all duration-300"
              >
                <X className="w-6 h-6 text-[#39FF14]" />
              </button>
            </div>

            {carrinho.length === 0 ? (
              <p className="text-center text-[#808080] py-8">Carrinho vazio</p>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {carrinho.map(item => (
                    <div
                      key={`${item.id}-${item.sabor}`}
                      className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-[#39FF14]/20"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#E0E0E0] font-['Orbitron'] truncate">
                          {item.is_promo && <span className="text-red-400 mr-1">🔥</span>}
                          {item.nome}
                        </p>
                        <p className="text-xs text-[#C0C0C0] font-['Roboto_Mono'] truncate">
                          {item.sabor}
                        </p>
                        <p className="text-sm font-bold text-[#39FF14] font-['Roboto_Mono']">
                          R$ {((item.is_promo && item.preco_promo ? item.preco_promo : item.preco) * item.quantidade).toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => alterarQuantidade(item.id, item.sabor, item.quantidade - 1)}
                          className="w-7 h-7 bg-[#39FF14]/20 border border-[#39FF14]/50 text-[#39FF14] rounded flex items-center justify-center hover:bg-[#39FF14]/30 transition-all duration-300"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[#E0E0E0] font-['Roboto_Mono'] w-6 text-center">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => alterarQuantidade(item.id, item.sabor, item.quantidade + 1)}
                          className="w-7 h-7 bg-[#39FF14]/20 border border-[#39FF14]/50 text-[#39FF14] rounded flex items-center justify-center hover:bg-[#39FF14]/30 transition-all duration-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removerDoCarrinho(item.id, item.sabor)}
                          className="w-7 h-7 bg-red-500/20 border border-red-500/50 text-red-400 rounded flex items-center justify-center hover:bg-red-500/30 transition-all duration-300 ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#39FF14]/30 pt-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[#C0C0C0] font-['Orbitron'] font-bold">Total:</span>
                    <span className="text-2xl font-bold neon-glow font-['Roboto_Mono']">
                      R$ {total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={iniciarCheckout}
                  className="w-full py-3 bg-green-500 text-white rounded-lg font-['Orbitron'] font-bold hover:bg-green-600 hover:shadow-[0_0_15px_rgba(34,197,94,0.5)] transition-all duration-300"
                >
                  📱 Pedir pelo WhatsApp
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Checkout */}
      {checkoutAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md glass-morphism p-8 rounded-xl border border-[#39FF14]/30 shadow-[0_0_50px_rgba(57,255,20,0.2)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold neon-glow font-['Orbitron']">Finalizar Pedido</h2>
              <button
                onClick={() => setCheckoutAberto(false)}
                disabled={enviandoPedido}
                className="p-2 hover:bg-[#39FF14]/20 rounded-lg transition-all duration-300 disabled:opacity-50"
              >
                <X className="w-6 h-6 text-[#39FF14]" />
              </button>
            </div>

            <form onSubmit={confirmarPedido} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                    <User className="w-4 h-4 text-[#39FF14]" />
                    Seu Nome
                  </label>
                  <input
                    type="text"
                    required
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-3 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                    placeholder="Ex: João Silva"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                    <Phone className="w-4 h-4 text-[#39FF14]" />
                    WhatsApp (com DDD)
                  </label>
                  <input
                    type="tel"
                    required
                    value={telefoneCliente}
                    onChange={(e) => setTelefoneCliente(e.target.value)}
                    className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-3 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                    placeholder="Ex: 81 99999-9999"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#C0C0C0] mb-2 font-['Orbitron']">
                    <Zap className="w-4 h-4 text-[#39FF14]" />
                    Indicação (Opcional)
                  </label>
                  <input
                    type="text"
                    value={indicacao}
                    onChange={(e) => setIndicacao(e.target.value)}
                    className="w-full bg-black/60 border border-[#39FF14]/50 text-[#E0E0E0] px-4 py-3 rounded-lg focus:border-[#39FF14] focus:outline-none transition-all duration-300 font-['Roboto_Mono']"
                    placeholder="Ex: Breno, Instagram, etc."
                  />
                </div>
              </div>

              <div className="p-4 bg-black/40 rounded-lg border border-[#39FF14]/20 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#808080] font-['Roboto_Mono']">Total do Pedido:</span>
                  <span className="text-[#39FF14] font-bold font-['Roboto_Mono']">R$ {total.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={enviandoPedido}
                className="w-full py-4 bg-[#39FF14] text-black rounded-lg font-['Orbitron'] font-bold text-lg hover:shadow-[0_0_25px_rgba(57,255,20,0.6)] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {enviandoPedido ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    ENVIANDO...
                  </>
                ) : (
                  <>
                    <Phone className="w-6 h-6" />
                    CONFIRMAR E IR PARA WHATSAPP
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
