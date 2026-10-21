import { useState, useEffect, useRef } from 'react';
import { Flame, Sparkles, Zap, ChevronLeft, ChevronRight, ArrowRight, Tag, ShieldCheck } from 'lucide-react';
import { Produto, HeroBannerConfig, DEFAULT_HERO_BANNER_CONFIG, HeroSlideConfig, utils } from '@/lib/supabase';

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
  const produtosPromo = produtos.filter(p => p.is_promo && p.ativo !== false);
  const produtosDestaque = produtos.filter(p => !p.is_promo && (p.estoque_ilimitado || p.estoque > 0));

  // Next / Prev slide
  const proximoSlide = () => {
    setSlideAtual(prev => (prev + 1) % totalSlides);
  };

  const slideAnterior = () => {
    setSlideAtual(prev => (prev - 1 + totalSlides) % totalSlides);
  };

  // Auto slide a cada 6 segundos
  useEffect(() => {
    if (isPausado || totalSlides <= 1) return;
    const interval = setInterval(() => {
      proximoSlide();
    }, 6000);

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
    let badgeClasses = 'bg-[#76FF03]/10 border-[#76FF03]/30 text-[#76FF03]';
    let IconeComponent = Sparkles;

    if (cor === 'red') {
      badgeClasses = 'bg-[#FF3366]/15 border-[#FF3366]/40 text-[#FF5E85]';
      IconeComponent = Flame;
    } else if (cor === 'blue') {
      badgeClasses = 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300';
      IconeComponent = ShieldCheck;
    }

    return (
      <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold tracking-wider ${badgeClasses}`}>
        <IconeComponent className="w-3.5 h-3.5" />
        <span className="font-bold tracking-wide uppercase">{s.badge.texto}</span>
        {s.badge.aoVivoBadge && horarioPromoAtivo && (
          <span className="flex items-center gap-1 bg-[#FF3366] text-white px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
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
        const puffs = utils.extrairPuffs(prodEncontrado.nome);
        return (
          <div className="relative group w-full max-w-[320px] bg-[#080808] border border-white/10 rounded-2xl p-5 flex flex-col items-center shadow-2xl hover:border-[#76FF03]/50 transition-all duration-300 backdrop-blur-xl">
            <span className="absolute -top-3 left-4 bg-gradient-to-r from-[#76FF03] to-[#52C41A] text-[#000000] font-extrabold text-[11px] px-3 py-1 rounded-full shadow-lg tracking-wider uppercase">
              Em Destaque
            </span>
            {prodEncontrado.imagem_url ? (
              <img
                src={prodEncontrado.imagem_url}
                alt={prodEncontrado.nome}
                className="w-40 h-40 md:w-44 md:h-44 object-contain rounded-xl my-2 group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-40 h-40 md:w-44 md:h-44 bg-white/5 rounded-xl flex items-center justify-center my-2 border border-white/5">
                <Zap className="w-12 h-12 text-[#76FF03]/40" />
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[#76FF03] font-bold uppercase tracking-wider">{prodEncontrado.marca}</span>
              {puffs > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#76FF03]/15 text-[#76FF03] border border-[#76FF03]/30">
                  {puffs.toLocaleString('pt-BR')} Puffs
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white text-center truncate w-full mt-1 font-['Outfit']">{prodEncontrado.nome}</h3>
            <div className="mt-2 flex items-center gap-2.5">
              {prodEncontrado.is_promo && prodEncontrado.preco_promo ? (
                <>
                  <span className="text-xs text-slate-400 line-through">
                    {utils.formatarMoeda(prodEncontrado.preco)}
                  </span>
                  <span className="text-lg font-extrabold text-[#76FF03]">
                    {utils.formatarMoeda(prodEncontrado.preco_promo)}
                  </span>
                </>
              ) : (
                <span className="text-lg font-extrabold text-[#76FF03]">
                  {utils.formatarMoeda(prodEncontrado.preco)}
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
        const promoPuffs = utils.extrairPuffs(promoDestaque.nome);
        return (
          <div className="relative group w-full max-w-[320px] bg-[#080808] border border-[#FF3366]/30 rounded-2xl p-5 flex flex-col items-center shadow-2xl hover:border-[#FF3366] transition-all duration-300 backdrop-blur-xl">
            <span className="absolute -top-3 left-4 bg-gradient-to-r from-[#FF3366] to-[#E60045] text-white font-bold text-[11px] px-3 py-1 rounded-full shadow-lg tracking-wider uppercase flex items-center gap-1">
              <Flame className="w-3 h-3" /> Oferta Relâmpago
            </span>
            {promoDestaque.imagem_url ? (
              <img
                src={promoDestaque.imagem_url}
                alt={promoDestaque.nome}
                className="w-40 h-40 md:w-44 md:h-44 object-contain rounded-xl my-2 group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-40 h-40 md:w-44 md:h-44 bg-white/5 rounded-xl flex items-center justify-center my-2 border border-white/5">
                <Zap className="w-12 h-12 text-[#FF3366]/40" />
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[#FF5E85] font-bold uppercase tracking-wider">{promoDestaque.marca}</span>
              {promoPuffs > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FF3366]/20 text-[#FF5E85] border border-[#FF3366]/30">
                  {promoPuffs.toLocaleString('pt-BR')} Puffs
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white text-center truncate w-full mt-1 font-['Outfit']">{promoDestaque.nome}</h3>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="text-xs text-slate-400 line-through">
                {utils.formatarMoeda(promoDestaque.preco)}
              </span>
              <span className="text-lg font-extrabold text-[#FF3366]">
                {utils.formatarMoeda(promoDestaque.preco_promo || promoDestaque.preco)}
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
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 justify-center w-full max-w-[340px]">
            {novidadesDestaque.map((prod) => {
              const prodPuffs = utils.extrairPuffs(prod.nome);
              return (
                <div
                  key={prod.id}
                  onClick={() => {
                    onSelectAba('expressos');
                    onSelectMarca(prod.marca);
                  }}
                  className="cursor-pointer bg-[#080808] border border-white/10 rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-[#76FF03]/50 hover:bg-[#111111] transition-all duration-300 hover:scale-[1.02] shadow-lg backdrop-blur-md"
                >
                  {prod.imagem_url ? (
                    <img src={prod.imagem_url} alt={prod.nome} className="w-16 h-16 object-contain rounded-xl flex-shrink-0 bg-white/5 p-1" />
                  ) : (
                    <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 flex-shrink-0">
                      <Sparkles className="w-6 h-6 text-[#76FF03]/40" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-[#76FF03] font-bold block uppercase tracking-wider">{prod.marca}</span>
                      {prodPuffs > 0 && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#76FF03]/15 text-[#76FF03] border border-[#76FF03]/30">
                          {prodPuffs.toLocaleString('pt-BR')} Puffs
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100 truncate">{prod.nome}</h4>
                    <span className="text-sm font-bold text-[#76FF03] block">{utils.formatarMoeda(prod.preco)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    }

    // Se o tipo for custom ou fallback
    return (
      <div className="flex justify-center items-center">
        {s.customImagemUrl ? (
          <img src={s.customImagemUrl} alt={s.titulo} className="max-w-[280px] max-h-[240px] object-cover rounded-2xl border border-white/10 shadow-2xl" />
        ) : (
          <div className="p-6 rounded-2xl bg-[#080808] border border-[#76FF03]/30 text-center space-y-2.5 max-w-[280px] shadow-xl backdrop-blur-md">
            <div className="text-3xl font-extrabold text-[#76FF03] tracking-tight">
              {s.customTitulo || '100%'}
            </div>
            <div className="text-sm font-bold text-white tracking-wide uppercase font-['Outfit']">
              {s.customSubtitulo || 'PRODUTOS SELECIONADOS'}
            </div>
            <div className="text-xs text-slate-400 leading-relaxed">
              Originalidade e atendimento dedicado direto no seu WhatsApp.
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
      className="relative w-full mb-8 overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl transition-all duration-300"
      onMouseEnter={() => setIsPausado(true)}
      onMouseLeave={() => setIsPausado(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dynamic Ambient Backdrops */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#76FF03]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#FF3366]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      {/* Slide Content */}
      <div className="relative min-h-[280px] sm:min-h-[340px] md:min-h-[390px] flex items-center p-4 sm:p-6 md:p-10">
        <div key={slide.id} className="w-full grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-8 items-center animate-in fade-in duration-500">
          <div className="md:col-span-7 space-y-3 sm:space-y-4">
            {renderBadge(slide)}

            <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight font-['Outfit']">
              {slide.titulo}{' '}
              <span className="bg-gradient-to-r from-[#76FF03] via-emerald-300 to-white bg-clip-text text-transparent block mt-1">
                {slide.tituloDestaque}
              </span>
            </h2>

            <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-lg leading-relaxed font-normal">
              {slide.descricao}
            </p>

            <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
              {slide.botaoAcao === 'url' && slide.botaoUrl ? (
                <a
                  href={slide.botaoUrl}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 border border-white/15 text-slate-200 font-semibold text-xs sm:text-sm md:text-base rounded-xl hover:bg-white/10 hover:border-white/30 transition-all duration-300 inline-flex items-center gap-2 backdrop-blur-md shadow-sm"
                >
                  {slide.botaoTexto}
                  <ArrowRight className="w-4 h-4 text-[#76FF03]" />
                </a>
              ) : (
                <button
                  onClick={() => handleBotaoClique(slide)}
                  className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm md:text-base flex items-center gap-2 shadow-lg transition-all duration-300 active:scale-[0.98] ${
                    slide.botaoAcao === 'promocionais' ? 'btn-coral' : 'btn-emerald'
                  }`}
                >
                  {slide.botaoAcao === 'promocionais' ? (
                    <Flame className="w-4 h-4 fill-white" />
                  ) : (
                    <Zap className="w-4 h-4 fill-current" />
                  )}
                  {slide.botaoTexto}
                </button>
              )}

              {slide.tipoDestaque === 'produto_promo' && (
                <span className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 font-medium bg-white/5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/5">
                  <Tag className="w-3.5 h-3.5 text-[#FF3366]" /> {produtosPromo.length} disponíveis
                </span>
              )}
            </div>
          </div>

          {/* Destaque Visual Lateral */}
          <div className="md:col-span-5 flex justify-center mt-2 md:mt-0">
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
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-white/15 text-slate-300 hover:bg-[#76FF03] hover:text-[#000000] hover:border-[#76FF03] transition-all backdrop-blur-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={proximoSlide}
            aria-label="Próximo slide"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-white/15 text-slate-300 hover:bg-[#76FF03] hover:text-[#000000] hover:border-[#76FF03] transition-all backdrop-blur-md"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Indicadores de Slide */}
      {totalSlides > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setSlideAtual(idx)}
              aria-label={`Ir para slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                slideValido === idx
                  ? 'w-6 bg-[#76FF03] shadow-sm'
                  : 'w-1.5 bg-white/20 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
