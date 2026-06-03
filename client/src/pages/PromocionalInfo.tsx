import { useLocation } from "wouter";
import { ArrowLeft, Clock, Calendar, CheckCircle2, Zap } from "lucide-react";
import { utils } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function PromocionalInfo() {
  const [, setLocation] = useLocation();
  const [horaAtual, setHoraAtual] = useState(utils.obterHoraBrasilia());

  // Verificar se hoje é o dia do bloqueio manual (03/06/2026)
  const agora = new Date();
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const isBlockedDay = brasilia.toLocaleDateString('pt-BR') === '03/06/2026';

  useEffect(() => {
    const timer = setInterval(() => {
      setHoraAtual(utils.obterHoraBrasilia());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Mensagem de Bloqueio Manual */}
        {isBlockedDay && (
          <div className="bg-red-500/10 border-2 border-red-500 p-6 rounded-2xl text-center space-y-3 shadow-[0_0_30px_rgba(255,0,0,0.2)]">
            <h2 className="text-2xl font-bold font-['Orbitron'] text-red-500">
              AVISO IMPORTANTE
            </h2>
            <p className="text-gray-300 font-['Roboto_Mono']">
              Pedimos desculpas aos nossos clientes, mas devido a problemas internos, <strong>não poderemos realizar a venda de promocionais excepcionalmente no dia de hoje (03/06)</strong>.
            </p>
            <p className="text-sm text-red-400/70 font-['Roboto_Mono']">
              Agradecemos a compreensão. Amanhã retornaremos ao horário normal.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-[#39FF14]/10 rounded-full mb-4">
            <Zap className="w-10 h-10 text-[#39FF14] animate-pulse" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-['Orbitron'] neon-glow">
            OFERTAS RELÂMPAGO
          </h1>
          <p className="text-[#39FF14]/70 font-['Roboto_Mono'] text-lg">
            Entenda como funcionam as nossas promoções exclusivas.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-morphism p-6 rounded-xl space-y-4 border-[#39FF14]/20">
            <div className="flex items-center gap-3 text-[#39FF14]">
              <Calendar className="w-6 h-6" />
              <h3 className="text-xl font-bold font-['Orbitron']">DIAS</h3>
            </div>
            <p className="text-gray-400 font-['Roboto_Mono']">
              As ofertas ficam disponíveis de <span className="text-[#39FF14] font-bold">Segunda a Quinta-feira</span>.
            </p>
          </div>

          <div className="glass-morphism p-6 rounded-xl space-y-4 border-[#39FF14]/20">
            <div className="flex items-center gap-3 text-[#39FF14]">
              <Clock className="w-6 h-6" />
              <h3 className="text-xl font-bold font-['Orbitron']">HORÁRIO</h3>
            </div>
            <p className="text-gray-400 font-['Roboto_Mono']">
              Das <span className="text-[#39FF14] font-bold">09:00 às 15:25</span> (Horário de Brasília).
            </p>
          </div>
        </div>

        {/* Current Time Banner */}
        <div className="bg-[#39FF14]/5 border border-[#39FF14]/30 p-6 rounded-2xl text-center space-y-2">
          <p className="text-sm uppercase tracking-widest text-[#39FF14]/50 font-bold">Agora são</p>
          <p className="text-5xl font-bold font-['Orbitron'] text-[#39FF14] tabular-nums">
            {horaAtual}
          </p>
          <p className="text-xs text-gray-500 uppercase">Horário Oficial de Brasília</p>
        </div>

        {/* Benefits */}
        <div className="space-y-4">
          <h4 className="text-center font-['Orbitron'] text-sm tracking-widest text-gray-500 uppercase">
            Vantagens da aba Promocional
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              "Preços de Custo",
              "Entrega Prioritária",
              "Estoque Limitado"
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 justify-center py-2 px-4 rounded-full bg-white/5 border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-[#39FF14]" />
                <span className="text-xs font-['Roboto_Mono']">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Action */}
        <div className="flex justify-center pt-4">
          <button 
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 px-8 py-3 bg-white text-black font-bold font-['Orbitron'] rounded-full hover:bg-[#39FF14] transition-all duration-300"
          >
            <ArrowLeft className="w-5 h-5" />
            VOLTAR PARA A LOJA
          </button>
        </div>

      </div>
    </div>
  );
}
