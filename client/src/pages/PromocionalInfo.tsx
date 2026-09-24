import { useLocation } from "wouter";
import { ArrowLeft, Clock, Calendar, CheckCircle2, Flame, Sparkles, ShieldAlert, ArrowRight } from "lucide-react";
import { utils, configService, PromoSchedule } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function PromocionalInfo() {
  const [, setLocation] = useLocation();
  const [horaAtual, setHoraAtual] = useState(utils.obterHoraBrasilia());
  const [promoConfig, setPromoConfig] = useState<PromoSchedule>({
    dias_semana: [1, 2, 3],
    hora_inicio: "09:00",
    hora_fim: "15:25"
  });

  useEffect(() => {
    configService.obterPromoSchedule().then(setPromoConfig).catch(console.error);

    const timer = setInterval(() => {
      setHoraAtual(utils.obterHoraBrasilia());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAtivo = utils.estaEmHorarioPromo(promoConfig);

  return (
    <div className="min-h-screen dark-atmosphere selection:bg-[#76FF03] selection:text-[#041202] flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in duration-500">
        
        {/* Header with Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-3">
            <img
              src="/logo.png"
              alt="HC Vape Logo"
              className="w-16 h-16 rounded-full object-cover shadow-[0_0_20px_rgba(118,255,3,0.35)] border border-white/20"
            />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-100 font-['Outfit'] tracking-tight">
            Ofertas Relâmpago
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
            Regras, horários e condições especiais para garantir o menor preço nos seus pods.
          </p>
        </div>

        {/* Live Status Pill & Clock */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 text-center space-y-3 border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF3366]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isAtivo ? 'bg-[#00F59B] animate-ping' : 'bg-amber-400'}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${isAtivo ? 'text-[#00F59B]' : 'text-amber-300'}`}>
              {isAtivo ? 'Promoção Aberta Agora' : 'Promoção Encerrada no Momento'}
            </span>
          </div>

          <div className="text-5xl sm:text-6xl font-extrabold text-slate-100 font-['Outfit'] tracking-tight tabular-nums py-2">
            {horaAtual}
          </div>

          <p className="text-xs text-slate-400 font-medium">
            Horário Oficial de Brasília
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-card p-6 rounded-3xl space-y-3 border-white/10">
            <div className="flex items-center gap-2.5 text-[#FF5E85]">
              <Calendar className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-100 font-['Outfit']">Dias Ativos</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Disponível em dias programados: <span className="text-[#00F59B] font-bold">{utils.formatarDiasSemana(promoConfig.dias_semana)}</span>.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl space-y-3 border-white/10">
            <div className="flex items-center gap-2.5 text-[#00F59B]">
              <Clock className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-100 font-['Outfit']">Janela de Pedidos</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Faça seu pedido das <span className="text-[#00F59B] font-bold">{promoConfig.hora_inicio} às {promoConfig.hora_fim}</span> para entrega às 19:00.
            </p>
          </div>
        </div>

        {/* Benefits Pills */}
        <div className="space-y-3">
          <h4 className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            Vantagens da Modalidade
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              "Valores com Super Desconto",
              "Entrega no Mesmo Dia às 19h",
              "Originalidade Garantida"
            ].map((benefit, i) => (
              <div key={i} className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/[0.03] border border-white/5 text-slate-200 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#76FF03] flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Action */}
        <div className="flex justify-center pt-2">
          <button 
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2.5 px-8 py-4 btn-emerald rounded-2xl text-sm font-bold shadow-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Catálogo</span>
          </button>
        </div>

      </div>
    </div>
  );
}
