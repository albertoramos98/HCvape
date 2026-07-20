import { useState, useEffect, useRef } from 'react';
import { Flame, Sparkles, Zap, ChevronLeft, ChevronRight, ArrowRight, Tag, ShieldCheck } from 'lucide-react';
import { Produto } from '@/lib/supabase';

interface HeroBannerProps {
  produtos: Produto[];
  horarioPromoAtivo: boolean;
  onSelectAba: (aba: 'expressos' | 'promocionais') => void;
  onSelectMarca: (marca: string | null) => void;
}

export function HeroBanner({
  produtos,
  horarioPromoAtivo,
  onSelectAba,
  onSelectMarca,
}: HeroBannerProps) {
  const [slideAtual, setSlideAtual] = useState(0);
  const [isPausado, setIsPausado] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Produtos para destacar nos slides
  const produtosPromo = produtos.filter(p => p.is_promo && p.estoque > 0);
  const produtosDestaque = produtos.filter(p => !p.is_promo && p.estoque > 0);

  const totalSlides = 3;

  // Next / Prev slide
  const proximoSlide = () => {
    setSlideAtual(prev => (prev + 1) % totalSlides);
  };

  const slideAnterior = () => {
    setSlideAtual(prev => (prev - 1 + totalSlides) % totalSlides);
  };

  // Auto slide a cada 5.5 segundos
  useEffect(() => {
    if (isPausado) return;
    const interval = setInterval(() => {
      proximoSlide();
    }, 5500);

    return () => clearInterval(interval);
  }, [isPausado, slideAtual]);

  // Gestos touch / swipe para mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) proximoSlide();
      else slideAnterior();
    }
    touchStartX.current = null;
  };

  // Primeiro produto promo para o card de destaque do slide 1
  const promoDestaque = produtosPromo[0];
  // Dois produtos expressos para o slide 2
  const novidadesDestaque = produtosDestaque.slice(0, 2);

  return (
    <div
      className="relative w-full mb-8 overflow-hidden rounded-2xl border border-[#39FF14]/30 bg-black/80 backdrop-blur-md shadow-[0_0_25px_rgba(57,255,20,0.15)] transition-all"
      onMouseEnter={() => setIsPausado(true)}
      onMouseLeave={() => setIsPausado(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Neon Grid / Ambient Lighting */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#39FF14]/30 via-transparent to-transparent" />
      <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[#39FF14]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Slide Container */}
      <div className="relative min-h-[320px] md:min-h-[360px] flex items-center p-6 md:p-10">
        
        {/* SLIDE 0: Ofertas Relâmpago */}
        {slideAtual === 0 && (
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center animate-in fade-in slide-in-from-right duration-500">
            <div className="md:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-['Orbitron'] font-bold tracking-wider">
                <Flame className="w-4 h-4 text-red-500 animate-pulse" />
                OFERTAS RELÂMPAGO
                {horarioPromoAtivo && (
                  <span className="bg-red-500 text-black px-2 py-0.5 rounded text-[10px] font-black uppercase">
                    Ao Vivo
                  </span>
                )}
              </div>

              <h2 className="text-2xl md:text-4xl font-bold font-['Orbitron'] text-[#E0E0E0] leading-tight">
                Super Preços & <br />
                <span className="text-[#39FF14] neon-glow">Promoções Especiais</span>
              </h2>

              <p className="text-sm md:text-base text-[#C0C0C0] font-['Roboto_Mono'] max-w-lg leading-relaxed">
                Garanta os pods com os melhores descontos do dia. Quantidades limitadas por horário!
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onSelectAba('promocionais')}
                  className="px-6 py-3 bg-[#39FF14] text-black font-['Orbitron'] font-bold text-sm md:text-base rounded-xl hover:shadow-[0_0_25px_rgba(57,255,20,0.8)] hover:scale-105 transition-all duration-300 flex items-center gap-2"
                >
                  <Zap className="w-5 h-5 fill-black" />
                  Ver Ofertas Promocionais
                </button>
                <span className="text-xs text-[#C0C0C0] font-['Roboto_Mono'] flex items-center gap-1">
                  <Tag className="w-4 h-4 text-[#39FF14]" /> {produtosPromo.length} itens em oferta
                </span>
              </div>
            </div>

            {/* Destaque Visual Lateral */}
            <div className="md:col-span-5 flex justify-center">
              {promoDestaque ? (
                <div className="relative group w-full max-w-[260px] bg-black/60 border border-[#39FF14]/40 rounded-xl p-4 flex flex-col items-center shadow-[0_0_15px_rgba(57,255,20,0.2)] hover:border-[#39FF14] transition-all">
                  <span className="absolute -top-3 left-4 bg-[#39FF14] text-black font-['Orbitron'] font-extrabold text-[10px] px-2 py-0.5 rounded shadow">
                    EM DESTAQUE
                  </span>
                  {promoDestaque.imagem_url ? (
                    <img
                      src={promoDestaque.imagem_url}
                      alt={promoDestaque.nome}
                      className="w-32 h-32 object-cover rounded-lg my-2 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-black/40 rounded-lg flex items-center justify-center my-2 border border-[#39FF14]/20">
                      <Zap className="w-10 h-10 text-[#39FF14]/40" />
                    </div>
                  )}
                  <span className="text-xs text-[#39FF14] font-['Orbitron'] font-bold uppercase">{promoDestaque.marca}</span>
                  <h3 className="text-sm font-bold text-[#E0E0E0] text-center font-['Orbitron'] truncate w-full">{promoDestaque.nome}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-[#C0C0C0] line-through font-['Roboto_Mono']">
                      R$ {promoDestaque.preco.toFixed(2)}
                    </span>
                    <span className="text-base font-extrabold text-[#39FF14] font-['Orbitron']">
                      R$ {(promoDestaque.preco_promo || promoDestaque.preco).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-40 h-40 rounded-full border-2 border-dashed border-[#39FF14]/30 flex items-center justify-center text-center p-4">
                  <span className="text-xs font-['Roboto_Mono'] text-[#C0C0C0]">HC Vape Express</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 1: Novidades & Lançamentos */}
        {slideAtual === 1 && (
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center animate-in fade-in slide-in-from-right duration-500">
            <div className="md:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#39FF14]/20 border border-[#39FF14]/50 text-[#39FF14] text-xs font-['Orbitron'] font-bold tracking-wider">
                <Sparkles className="w-4 h-4 text-[#39FF14] animate-spin" style={{ animationDuration: '4s' }} />
                NOVIDADES DO CATÁLOGO
              </div>

              <h2 className="text-2xl md:text-4xl font-bold font-['Orbitron'] text-[#E0E0E0] leading-tight">
                Os Modelos Mais Vendidos <br />
                <span className="text-[#39FF14] neon-glow">Pronta Entrega Express</span>
              </h2>

              <p className="text-sm md:text-base text-[#C0C0C0] font-['Roboto_Mono'] max-w-lg leading-relaxed">
                Linha completa com os melhores sabores e marcas premium selecionadas especialmente para você.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onSelectAba('expressos')}
                  className="px-6 py-3 bg-[#39FF14] text-black font-['Orbitron'] font-bold text-sm md:text-base rounded-xl hover:shadow-[0_0_25px_rgba(57,255,20,0.8)] hover:scale-105 transition-all duration-300 flex items-center gap-2"
                >
                  Ver Catálogo Expresso
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Destaque Visual Lateral com Mini Cards */}
            <div className="md:col-span-5 flex flex-col sm:flex-row md:flex-col gap-3 justify-center">
              {novidadesDestaque.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    onSelectAba('expressos');
                    onSelectMarca(prod.marca);
                  }}
                  className="cursor-pointer bg-black/60 border border-[#39FF14]/30 rounded-xl p-3 flex items-center gap-3 hover:border-[#39FF14] transition-all hover:bg-black/80"
                >
                  {prod.imagem_url ? (
                    <img src={prod.imagem_url} alt={prod.nome} className="w-14 h-14 object-cover rounded-lg" />
                  ) : (
                    <div className="w-14 h-14 bg-black/40 rounded-lg flex items-center justify-center border border-[#39FF14]/20">
                      <Sparkles className="w-6 h-6 text-[#39FF14]/40" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-[#39FF14] font-['Orbitron'] font-bold block uppercase">{prod.marca}</span>
                    <h4 className="text-xs font-bold text-white font-['Orbitron'] truncate">{prod.nome}</h4>
                    <span className="text-xs font-bold text-[#39FF14] font-['Roboto_Mono']">R$ {prod.preco.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLIDE 2: Qualidade & Atendimento */}
        {slideAtual === 2 && (
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center animate-in fade-in slide-in-from-right duration-500">
            <div className="md:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-['Orbitron'] font-bold tracking-wider">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                HC VAPE • DESDE 2020
              </div>

              <h2 className="text-2xl md:text-4xl font-bold font-['Orbitron'] text-[#E0E0E0] leading-tight">
                Garantia de Qualidade & <br />
                <span className="text-[#39FF14] neon-glow">Atendimento Direto</span>
              </h2>

              <p className="text-sm md:text-base text-[#C0C0C0] font-['Roboto_Mono'] max-w-xl leading-relaxed">
                Faça seu pedido diretamente pelo site e receba a confirmação no seu WhatsApp. Praticidade e rapidez na entrega!
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <a
                  href="/como-funciona"
                  className="px-6 py-3 border border-[#39FF14] text-[#39FF14] font-['Orbitron'] font-bold text-sm md:text-base rounded-xl hover:bg-[#39FF14]/20 hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all duration-300 inline-flex items-center gap-2"
                >
                  Entenda Como Funciona
                  <ArrowRight className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div className="md:col-span-4 flex justify-center items-center">
              <div className="p-6 rounded-2xl bg-[#39FF14]/10 border border-[#39FF14]/40 text-center space-y-2 max-w-[240px]">
                <div className="text-3xl font-extrabold text-[#39FF14] font-['Orbitron'] neon-glow">100%</div>
                <div className="text-xs font-bold text-[#E0E0E0] font-['Orbitron']">PRODUTOS SELECIONADOS</div>
                <div className="text-[11px] text-[#C0C0C0] font-['Roboto_Mono']">Originalidade e suporte ao cliente em cada pedido.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controles de Navegação (Setas) */}
      <button
        onClick={slideAnterior}
        aria-label="Slide anterior"
        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        onClick={proximoSlide}
        aria-label="Próximo slide"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Pontinhos Indicadores de Slide */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {Array.from({ length: totalSlides }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setSlideAtual(idx)}
            aria-label={`Ir para slide ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              slideAtual === idx
                ? 'w-8 bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.8)]'
                : 'w-2 bg-[#39FF14]/30 hover:bg-[#39FF14]/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
