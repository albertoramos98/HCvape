import { useState, useEffect, useRef } from 'react';
import { Flame, Sparkles, Zap, ChevronLeft, ChevronRight, ArrowRight, Tag, ShieldCheck } from 'lucide-react';
import { Produto, HeroBannerConfig, DEFAULT_HERO_BANNER_CONFIG, HeroSlideConfig } from '@/lib/supabase';

interface HeroBannerProps {
  produtos: Produto[];
  horarioPromoAtivo: boolean;
  onSelectAba: (aba: 'expressos' | 'promocionais') => void;
  onSelectMarca: (marca: string | null) => void;
  config?: HeroBannerConfig | null;
}

export function HeroBanner({
  produtos,
  horarioPromoAtivo,
  onSelectAba,
  onSelectMarca,
  config,
}: HeroBannerProps) {
  const [slideAtual, setSlideAtual] = useState(0);
  const [isPausado, setIsPausado] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Slides ativos da configuração (ou fallback padrão se vazios)
  const slidesAtivos: HeroSlideConfig[] = (config?.slides && config.slides.length > 0)
    ? config.slides.filter(s => s.ativo)
    : DEFAULT_HERO_BANNER_CONFIG.slides;

  const slidesParaExibir = slidesAtivos.length > 0 ? slidesAtivos : DEFAULT_HERO_BANNER_CONFIG.slides;
  const totalSlides = slidesParaExibir.length;

  // Garante que slideAtual seja válido
  const slideValido = slideAtual % totalSlides;
  const slide = slidesParaExibir[slideValido] || slidesParaExibir[0];

  // Produtos filtrados por promo e destaque para uso nos cards
  const produtosPromo = produtos.filter(p => p.is_promo && p.estoque > 0);
  const produtosDestaque = produtos.filter(p => !p.is_promo && p.estoque > 0);

  // Next / Prev slide
  const proximoSlide = () => {
    setSlideAtual(prev => (prev + 1) % totalSlides);
  };

  const slideAnterior = () => {
    setSlideAtual(prev => (prev - 1 + totalSlides) % totalSlides);
  };

  // Auto slide a cada 5.5 segundos
  useEffect(() => {
    if (isPausado || totalSlides <= 1) return;
    const interval = setInterval(() => {
      proximoSlide();
    }, 5500);

    return () => clearInterval(interval);
  }, [isPausado, totalSlides, slideAtual]);

  // Gestos touch / swipe para mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || totalSlides <= 1) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) proximoSlide();
      else slideAnterior();
    }
    touchStartX.current = null;
  };

  // Helper para renderizar Badge do Slide
  const renderBadge = (s: HeroSlideConfig) => {
    const cor = s.badge.cor || 'green';
    let bgBorderClass = 'bg-[#39FF14]/20 border-[#39FF14]/50 text-[#39FF14]';
    let IconeComponent = Sparkles;

    if (cor === 'red') {
      bgBorderClass = 'bg-red-500/20 border-red-500/40 text-red-400';
      IconeComponent = Flame;
    } else if (cor === 'blue') {
      bgBorderClass = 'bg-blue-500/20 border-blue-500/40 text-blue-400';
      IconeComponent = ShieldCheck;
    }

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-['Orbitron'] font-bold tracking-wider ${bgBorderClass}`}>
        <IconeComponent className="w-4 h-4 animate-pulse" />
        {s.badge.texto}
        {s.badge.aoVivoBadge && horarioPromoAtivo && (
          <span className="bg-red-500 text-black px-2 py-0.5 rounded text-[10px] font-black uppercase">
            Ao Vivo
          </span>
        )}
      </div>
    );
  };

  // Helper para renderizar o Card de Destaque Lateral
  const renderDestaqueLateral = (s: HeroSlideConfig) => {
    if (s.tipoDestaque === 'nenhum') return null;

    // Se houver um produto especificamente selecionado no Admin
    if (s.produtoDestaqueId) {
      const prodEncontrado = produtos.find(p => p.id === s.produtoDestaqueId);
      if (prodEncontrado) {
        return (
          <div className="relative group w-full max-w-[320px] bg-black/70 border border-[#39FF14]/40 rounded-2xl p-5 flex flex-col items-center shadow-[0_0_20px_rgba(57,255,20,0.25)] hover:border-[#39FF14] transition-all">
            <span className="absolute -top-3 left-4 bg-[#39FF14] text-black font-['Orbitron'] font-extrabold text-xs px-3 py-1 rounded shadow">
              EM DESTAQUE
            </span>
            {prodEncontrado.imagem_url ? (
              <img
                src={prodEncontrado.imagem_url}
                alt={prodEncontrado.nome}
                className="w-40 h-40 md:w-44 md:h-44 object-cover rounded-xl my-2 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-40 h-40 md:w-44 md:h-44 bg-black/40 rounded-xl flex items-center justify-center my-2 border border-[#39FF14]/20">
                <Zap className="w-12 h-12 text-[#39FF14]/40" />
              </div>
            )}
            <span className="text-xs text-[#39FF14] font-['Orbitron'] font-bold uppercase tracking-wider">{prodEncontrado.marca}</span>
            <h3 className="text-base font-bold text-[#E0E0E0] text-center font-['Orbitron'] truncate w-full mt-1">{prodEncontrado.nome}</h3>
            <div className="mt-2 flex items-center gap-3">
              {prodEncontrado.is_promo && prodEncontrado.preco_promo ? (
                <>
                  <span className="text-sm text-[#C0C0C0] line-through font-['Roboto_Mono']">
                    R$ {prodEncontrado.preco.toFixed(2)}
                  </span>
                  <span className="text-lg font-extrabold text-[#39FF14] font-['Orbitron']">
                    R$ {prodEncontrado.preco_promo.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-lg font-extrabold text-[#39FF14] font-['Orbitron']">
                  R$ {prodEncontrado.preco.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        );
      }
    }

    // Se o tipo for produto_promo
    if (s.tipoDestaque === 'produto_promo') {
      const promoDestaque = produtosPromo[0];
      if (promoDestaque) {
        return (
          <div className="relative group w-full max-w-[320px] bg-black/70 border border-[#39FF14]/40 rounded-2xl p-5 flex flex-col items-center shadow-[0_0_20px_rgba(57,255,20,0.25)] hover:border-[#39FF14] transition-all">
            <span className="absolute -top-3 left-4 bg-[#39FF14] text-black font-['Orbitron'] font-extrabold text-xs px-3 py-1 rounded shadow">
              EM DESTAQUE
            </span>
            {promoDestaque.imagem_url ? (
              <img
                src={promoDestaque.imagem_url}
                alt={promoDestaque.nome}
                className="w-40 h-40 md:w-44 md:h-44 object-cover rounded-xl my-2 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-40 h-40 md:w-44 md:h-44 bg-black/40 rounded-xl flex items-center justify-center my-2 border border-[#39FF14]/20">
                <Zap className="w-12 h-12 text-[#39FF14]/40" />
              </div>
            )}
            <span className="text-xs text-[#39FF14] font-['Orbitron'] font-bold uppercase tracking-wider">{promoDestaque.marca}</span>
            <h3 className="text-base font-bold text-[#E0E0E0] text-center font-['Orbitron'] truncate w-full mt-1">{promoDestaque.nome}</h3>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm text-[#C0C0C0] line-through font-['Roboto_Mono']">
                R$ {promoDestaque.preco.toFixed(2)}
              </span>
              <span className="text-lg font-extrabold text-[#39FF14] font-['Orbitron']">
                R$ {(promoDestaque.preco_promo || promoDestaque.preco).toFixed(2)}
              </span>
            </div>
          </div>
        );
      }
    }

    // Se o tipo for produto_especifico sem id selecionado (exibe 2 mini cards de novidades)
    if (s.tipoDestaque === 'produto_especifico') {
      const novidadesDestaque = produtosDestaque.slice(0, 2);
      if (novidadesDestaque.length > 0) {
        return (
          <div className="flex flex-col sm:flex-row md:flex-col gap-4 justify-center">
            {novidadesDestaque.map((prod) => (
              <div
                key={prod.id}
                onClick={() => {
                  onSelectAba('expressos');
                  onSelectMarca(prod.marca);
                }}
                className="cursor-pointer bg-black/70 border border-[#39FF14]/30 rounded-2xl p-4 flex items-center gap-4 hover:border-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.15)] transition-all hover:bg-black/90 hover:scale-[1.02]"
              >
                {prod.imagem_url ? (
                  <img src={prod.imagem_url} alt={prod.nome} className="w-20 h-20 md:w-22 md:h-22 object-cover rounded-xl flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 md:w-22 md:h-22 bg-black/40 rounded-xl flex items-center justify-center border border-[#39FF14]/20 flex-shrink-0">
                    <Sparkles className="w-8 h-8 text-[#39FF14]/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-xs text-[#39FF14] font-['Orbitron'] font-bold block uppercase tracking-wider">{prod.marca}</span>
                  <h4 className="text-sm md:text-base font-bold text-white font-['Orbitron'] truncate">{prod.nome}</h4>
                  <span className="text-sm font-bold text-[#39FF14] font-['Roboto_Mono'] block">R$ {prod.preco.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        );
      }
    }

    // Se o tipo for custom ou fallback
    return (
      <div className="flex justify-center items-center">
        {s.customImagemUrl ? (
          <img src={s.customImagemUrl} alt={s.titulo} className="max-w-[280px] max-h-[260px] object-cover rounded-2xl border border-[#39FF14]/40 shadow-[0_0_20px_rgba(57,255,20,0.25)]" />
        ) : (
          <div className="p-7 rounded-2xl bg-[#39FF14]/10 border border-[#39FF14]/40 text-center space-y-3 max-w-[280px] shadow-[0_0_20px_rgba(57,255,20,0.2)]">
            <div className="text-4xl font-extrabold text-[#39FF14] font-['Orbitron'] neon-glow">
              {s.customTitulo || '100%'}
            </div>
            <div className="text-sm font-bold text-[#E0E0E0] font-['Orbitron']">
              {s.customSubtitulo || 'PRODUTOS SELECIONADOS'}
            </div>
            <div className="text-xs text-[#C0C0C0] font-['Roboto_Mono'] leading-relaxed">
              Originalidade e suporte ao cliente em cada pedido.
            </div>
          </div>
        )}
      </div>
    );
  };

  // Ação do botão principal do slide
  const handleBotaoClique = (s: HeroSlideConfig) => {
    if (s.botaoAcao === 'promocionais') {
      onSelectAba('promocionais');
    } else if (s.botaoAcao === 'expressos') {
      onSelectAba('expressos');
    } else if (s.botaoAcao === 'url' && s.botaoUrl) {
      window.location.href = s.botaoUrl;
    }
  };

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
      <div className="relative min-h-[360px] md:min-h-[420px] flex items-center p-6 md:p-10">
        <div key={slide.id} className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center animate-in fade-in slide-in-from-right duration-500">
          <div className="md:col-span-7 space-y-4">
            {renderBadge(slide)}

            <h2 className="text-2xl md:text-4xl font-bold font-['Orbitron'] text-[#E0E0E0] leading-tight">
              {slide.titulo} <br />
              <span className="text-[#39FF14] neon-glow">{slide.tituloDestaque}</span>
            </h2>

            <p className="text-sm md:text-base text-[#C0C0C0] font-['Roboto_Mono'] max-w-lg leading-relaxed">
              {slide.descricao}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              {slide.botaoAcao === 'url' && slide.botaoUrl ? (
                <a
                  href={slide.botaoUrl}
                  className="px-6 py-3 border border-[#39FF14] text-[#39FF14] font-['Orbitron'] font-bold text-sm md:text-base rounded-xl hover:bg-[#39FF14]/20 hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all duration-300 inline-flex items-center gap-2"
                >
                  {slide.botaoTexto}
                  <ArrowRight className="w-5 h-5" />
                </a>
              ) : (
                <button
                  onClick={() => handleBotaoClique(slide)}
                  className="px-6 py-3 bg-[#39FF14] text-black font-['Orbitron'] font-bold text-sm md:text-base rounded-xl hover:shadow-[0_0_25px_rgba(57,255,20,0.8)] hover:scale-105 transition-all duration-300 flex items-center gap-2"
                >
                  {slide.botaoAcao === 'promocionais' ? (
                    <Zap className="w-5 h-5 fill-black" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                  {slide.botaoTexto}
                </button>
              )}

              {slide.tipoDestaque === 'produto_promo' && (
                <span className="text-xs text-[#C0C0C0] font-['Roboto_Mono'] flex items-center gap-1">
                  <Tag className="w-4 h-4 text-[#39FF14]" /> {produtosPromo.length} itens em oferta
                </span>
              )}
            </div>
          </div>

          {/* Destaque Visual Lateral */}
          <div className="md:col-span-5 flex justify-center">
            {renderDestaqueLateral(slide)}
          </div>
        </div>
      </div>

      {/* Controles de Navegação (Setas) */}
      {totalSlides > 1 && (
        <>
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
        </>
      )}

      {/* Pontinhos Indicadores de Slide */}
      {totalSlides > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setSlideAtual(idx)}
              aria-label={`Ir para slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                slideValido === idx
                  ? 'w-8 bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.8)]'
                  : 'w-2 bg-[#39FF14]/30 hover:bg-[#39FF14]/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
