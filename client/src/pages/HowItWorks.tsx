import { useState, useEffect } from 'react';
import { Zap, Truck, Clock, CheckCircle2, AlertCircle, DollarSign, ArrowLeft, ArrowRight, ShieldCheck, Flame, Sparkles } from 'lucide-react';
import { configService, utils, PromoSchedule } from '@/lib/supabase';

/**
 * Página: Como Funciona
 * Explica os dois modelos de venda: PROMOCIONAL e EXPRESSO
 * Design: Luxury Dark Cyber
 */

export default function HowItWorks() {
  const [modeloSelecionado, setModeloSelecionado] = useState<'promocional' | 'estoque'>('promocional');
  const [promoConfig, setPromoConfig] = useState<PromoSchedule>({
    dias_semana: [1, 2, 3],
    hora_inicio: "09:00",
    hora_fim: "15:25"
  });

  useEffect(() => {
    configService.obterPromoSchedule().then(setPromoConfig).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen dark-atmosphere selection:bg-[#00F59B] selection:text-[#04140b]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#080b11]/85 backdrop-blur-xl border-b border-white/10">
        <div className="container flex items-center justify-between py-3.5">
          <a href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00F59B] to-[#00A86B] flex items-center justify-center font-extrabold text-[#04140b] text-base font-['Outfit'] shadow-lg">
              HC
            </div>
            <div>
              <span className="text-base font-bold text-slate-100 tracking-tight font-['Outfit']">HC VAPE</span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">Guia de Compras</span>
            </div>
          </a>

          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Catálogo</span>
          </a>
        </div>
      </header>

      <main className="container py-10 sm:py-14 space-y-12 max-w-4xl">
        {/* Intro Section */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-[#00F59B]" />
            <span>Transparência e Rapidez</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 font-['Outfit'] tracking-tight">
            Nossas Formas de Atendimento
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Oferecemos duas modalidades pensadas para cada necessidade: <strong className="text-white">Promocional</strong> (com máximo desconto) e <strong className="text-white">Expresso</strong> (pronta entrega imediata).
          </p>
        </section>

        {/* Interactive Mode Switcher */}
        <section className="space-y-8">
          <div className="flex p-1.5 bg-[#0e1320] border border-white/10 rounded-2xl max-w-md mx-auto">
            <button
              onClick={() => setModeloSelecionado('promocional')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
                modeloSelecionado === 'promocional'
                  ? 'bg-gradient-to-r from-[#FF3366] to-[#E60045] text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Modalidade Promocional</span>
            </button>

            <button
              onClick={() => setModeloSelecionado('estoque')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
                modeloSelecionado === 'estoque'
                  ? 'bg-gradient-to-r from-[#00F59B] to-[#00D084] text-[#04140b] shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Modalidade Expresso</span>
            </button>
          </div>

          {/* Promocional Detail Card */}
          {modeloSelecionado === 'promocional' && (
            <div className="glass-card rounded-3xl p-6 sm:p-8 border-[#FF3366]/30 shadow-2xl space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-[#FF3366]/15 rounded-2xl text-[#FF5E85] border border-[#FF3366]/30">
                    <DollarSign className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-100 font-['Outfit']">
                      Modalidade Promocional
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Máxima economia com pedidos antecipados por horário
                    </p>
                  </div>
                </div>

                <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-[#FF3366]/15 text-[#FF5E85] border border-[#FF3366]/30">
                  Mais Econômico
                </span>
              </div>

              {/* Step by step */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Passo a Passo:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-[#FF3366]/20 text-[#FF5E85] text-xs font-bold flex items-center justify-center">1</span>
                    <h4 className="text-sm font-bold text-slate-100">Escolha o Pod</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Navegue pelas Ofertas Relâmpago e selecione o sabor desejado.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-[#FF3366]/20 text-[#FF5E85] text-xs font-bold flex items-center justify-center">2</span>
                    <h4 className="text-sm font-bold text-slate-100">Peça até as {promoConfig.hora_fim}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Confirme e realize o pagamento dentro do horário promocional ativo.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-[#FF3366]/20 text-[#FF5E85] text-xs font-bold flex items-center justify-center">3</span>
                    <h4 className="text-sm font-bold text-slate-100">Receba às 19h</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Seu pedido sai para entrega no mesmo dia a partir das 19:00.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs sm:text-sm text-amber-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                <p>
                  <strong>Dica:</strong> Se programe com antecedência durante os dias de semana ({utils.formatarDiasSemana(promoConfig.dias_semana)}) para garantir preços imperdíveis.
                </p>
              </div>
            </div>
          )}

          {/* Expresso Detail Card */}
          {modeloSelecionado === 'estoque' && (
            <div className="glass-card rounded-3xl p-6 sm:p-8 border-[#00F59B]/30 shadow-2xl space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-[#00F59B]/15 rounded-2xl text-[#00F59B] border border-[#00F59B]/30">
                    <Truck className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-100 font-['Outfit']">
                      Modalidade Pronta Entrega Express
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Entrega imediata para quem não quer esperar
                    </p>
                  </div>
                </div>

                <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-[#00F59B]/15 text-[#00F59B] border border-[#00F59B]/30">
                  Pronta Entrega
                </span>
              </div>

              {/* Step by step */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Passo a Passo:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-[#00F59B]/20 text-[#00F59B] text-xs font-bold flex items-center justify-center">1</span>
                    <h4 className="text-sm font-bold text-slate-100">Escolha no Catálogo</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Produtos com estoque real atualizado prontos para envio imediato.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-[#00F59B]/20 text-[#00F59B] text-xs font-bold flex items-center justify-center">2</span>
                    <h4 className="text-sm font-bold text-slate-100">Finalize no WhatsApp</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Atendimento das 10h às 22h com confirmação instantânea de Pix.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-[#00F59B]/20 text-[#00F59B] text-xs font-bold flex items-center justify-center">3</span>
                    <h4 className="text-sm font-bold text-slate-100">Envio ou Retirada</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Retirada no local ou envio por motoboy / Uber Moto no mesmo instante.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-xs sm:text-sm text-emerald-300">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
                <p>
                  <strong>Ideal para urgências:</strong> Acabou seu pod e você quer receber em minutos? Escolha os itens expressos!
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Side-by-Side Comparison Table */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-100 font-['Outfit'] text-center">
            Comparativo entre as Modalidades
          </h2>

          <div className="glass-card rounded-3xl overflow-hidden border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="py-4 px-5 font-bold text-slate-300">Característica</th>
                    <th className="py-4 px-5 font-bold text-[#FF5E85]">🔥 Promocional</th>
                    <th className="py-4 px-5 font-bold text-[#00F59B]">⚡ Expresso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  <tr className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-400">Horário de Pedido</td>
                    <td className="py-3.5 px-5 text-white font-semibold">{promoConfig.hora_inicio} às {promoConfig.hora_fim}</td>
                    <td className="py-3.5 px-5 text-white font-semibold">10:00 às 22:00</td>
                  </tr>
                  <tr className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-400">Prazo de Entrega</td>
                    <td className="py-3.5 px-5">A partir das 19:00 do mesmo dia</td>
                    <td className="py-3.5 px-5">Imediata (Retirada / Moto)</td>
                  </tr>
                  <tr className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-400">Faixa de Preço</td>
                    <td className="py-3.5 px-5 text-[#FF5E85] font-bold">Desconto Máximo 💸</td>
                    <td className="py-3.5 px-5 text-slate-200">Tabela Padrão</td>
                  </tr>
                  <tr className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-400">Dias de Funcionamento</td>
                    <td className="py-3.5 px-5">{utils.formatarDiasSemanaAbreviado(promoConfig.dias_semana)}</td>
                    <td className="py-3.5 px-5">Segunda a Sábado</td>
                  </tr>
                  <tr className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-400">Melhor Para</td>
                    <td className="py-3.5 px-5">Quem se programa e quer pagar menos</td>
                    <td className="py-3.5 px-5">Quem quer vape na mão agora</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center pt-6">
          <a
            href="/"
            className="inline-flex items-center gap-2.5 px-8 py-4 btn-emerald rounded-2xl text-base shadow-xl"
          >
            <span>Explorar Produtos do Catálogo</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </section>
      </main>
    </div>
  );
}
