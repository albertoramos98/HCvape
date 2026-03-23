import { useState } from 'react';
import { Zap, Truck, Clock, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react';

/**
 * Página: Como Funciona
 * Explica os dois modelos de venda: PROMOCIONAL e ESTOQUE
 * Design: Cyberpunk Dark Mode
 */

export default function HowItWorks() {
  const [modeloSelecionado, setModeloSelecionado] = useState<'promocional' | 'estoque'>('promocional');

  return (
    <div className="min-h-screen bg-black asphalt-texture">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-[#39FF14]/30">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold neon-glow font-['Orbitron']">HC</h1>
            <p className="text-xs text-[#C0C0C0] font-['Roboto_Mono']">Como Funciona</p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] rounded-lg font-['Orbitron'] font-bold hover:bg-[#39FF14]/30 transition-all duration-300"
          >
            ← Voltar ao Catálogo
          </a>
        </div>
      </header>

      <main className="container py-12">
        {/* Título */}
        <section className="mb-12 text-center">
          <h2 className="text-4xl font-bold neon-glow mb-4 font-['Orbitron']">
            📦 NOSSAS FORMAS DE VENDA
          </h2>
          <p className="text-[#C0C0C0] max-w-2xl mx-auto font-['Roboto_Mono'] text-lg">
            Trabalhamos com 2 modalidades de venda: <strong>PROMOCIONAL</strong> e <strong>EXPRESSO</strong>.
          </p>
          <p className="text-[#39FF14] max-w-2xl mx-auto font-['Orbitron'] font-bold mt-3">
            Veja qual combina mais com você 👇
          </p>
        </section>

        {/* Seletor de Modelo */}
        <section className="mb-12">
          <div className="flex gap-4 justify-center mb-8 flex-wrap">
            <button
              onClick={() => setModeloSelecionado('promocional')}
              className={`px-8 py-4 rounded-lg font-['Orbitron'] font-bold transition-all duration-300 text-lg ${
                modeloSelecionado === 'promocional'
                  ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(255,0,0,0.5)]'
                  : 'bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30'
              }`}
            >
              💸 🔥 PROMOCIONAL
            </button>
            <button
              onClick={() => setModeloSelecionado('estoque')}
              className={`px-8 py-4 rounded-lg font-['Orbitron'] font-bold transition-all duration-300 text-lg ${
                modeloSelecionado === 'estoque'
                  ? 'bg-[#39FF14] text-black shadow-[0_0_20px_rgba(57,255,20,0.5)]'
                  : 'bg-[#39FF14]/20 border border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14]/30'
              }`}
            >
              ⚡ 🚀 EXPRESSO
            </button>
          </div>
        </section>

        {/* Conteúdo Promocional */}
        {modeloSelecionado === 'promocional' && (
          <section className="max-w-4xl mx-auto">
            <div className="glass-morphism p-8 rounded-xl border border-red-500/30 mb-8 shadow-[0_0_20px_rgba(255,0,0,0.2)]">
              {/* Título */}
              <div className="flex items-start gap-4 mb-8">
                <div className="p-3 bg-red-500/20 rounded-lg animate-pulse">
                  <DollarSign className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-[#E0E0E0] mb-2 font-['Orbitron']">
                    💸 🔥 PROMOCIONAL (Mais Barato)
                  </h3>
                  <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                    Quer pagar menos? Essa é a melhor opção!
                  </p>
                </div>
              </div>

              {/* Descrição */}
              <div className="bg-black/40 p-6 rounded-lg border border-red-500/20 mb-8">
                <p className="text-[#E0E0E0] font-['Roboto_Mono'] leading-relaxed text-lg">
                  A venda <strong>Promocional</strong> é ideal para quem <strong>não tem pressa</strong> e quer <strong>economizar</strong>.
                </p>
              </div>

              {/* Checklist */}
              <div className="space-y-4 mb-8">
                <h4 className="text-xl font-bold text-red-400 mb-4 font-['Orbitron']">
                  ✅ Como Funciona:
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-4 items-start">
                    <CheckCircle2 className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                    <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                      <strong>Você escolhe modelo e sabor</strong>
                    </p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <CheckCircle2 className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                    <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                      <strong>Faz o pagamento até às 15h</strong>
                    </p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <CheckCircle2 className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                    <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                      <strong>Recebe seu pedido a partir das 19h do mesmo dia</strong>
                    </p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <CheckCircle2 className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                    <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                      <strong>Funciona de segunda a quinta</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Dica */}
              <div className="bg-yellow-500/10 p-6 rounded-lg border border-yellow-500/30">
                <div className="flex gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <h5 className="text-yellow-400 font-bold mb-2 font-['Orbitron'] text-lg">
                      💡 Dica Importante
                    </h5>
                    <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                      Se programe e peça com antecedência para aproveitar o <strong>melhor preço!</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Conteúdo Estoque */}
        {modeloSelecionado === 'estoque' && (
          <section className="max-w-4xl mx-auto">
            <div className="glass-morphism p-8 rounded-xl border border-[#39FF14]/30 mb-8 shadow-[0_0_20px_rgba(57,255,20,0.2)]">
              {/* Título */}
              <div className="flex items-start gap-4 mb-8">
                <div className="p-3 bg-[#39FF14]/20 rounded-lg animate-pulse">
                  <Truck className="w-8 h-8 text-[#39FF14]" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-[#E0E0E0] mb-2 font-['Orbitron']">
                    ⚡ 🚀 EXPRESSO (Entrega Imediata)
                  </h3>
                  <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                    Precisa para agora? Então escolha a modalidade Expresso.
                  </p>
                </div>
              </div>

              {/* Processo */}
              <div className="space-y-4 mb-8">
                <h4 className="text-xl font-bold text-[#39FF14] mb-4 font-['Orbitron']">
                  📋 Como Funciona:
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 bg-[#39FF14] text-black rounded-full font-bold text-sm flex-shrink-0">
                      1
                    </div>
                    <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                      <strong>📲 Enviamos a lista com os produtos disponíveis no momento</strong>
                    </p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 bg-[#39FF14] text-black rounded-full font-bold text-sm flex-shrink-0">
                      2
                    </div>
                    <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                      <strong>💳 Você realiza o pagamento</strong>
                    </p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 bg-[#39FF14] text-black rounded-full font-bold text-sm flex-shrink-0">
                      3
                    </div>
                    <p className="text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                      <strong>🛵 Já pode solicitar retirada via Uber Moto</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Benefícios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/30">
                  <h5 className="text-green-400 font-bold mb-3 font-['Orbitron'] text-lg">✔ Vantagens:</h5>
                  <ul className="space-y-2 text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                    <li>• Venda imediata</li>
                    <li>• Ideal para quem tem urgência</li>
                    <li>• Sem esperar até a noite</li>
                  </ul>
                </div>
                <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
                  <h5 className="text-blue-400 font-bold mb-3 font-['Orbitron'] text-lg">📍 Entrega:</h5>
                  <ul className="space-y-2 text-[#C0C0C0] font-['Roboto_Mono'] text-lg">
                    <li>• Retirada pessoal</li>
                    <li>• Uber Moto</li>
                    <li>• Entrega rápida</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Comparativo */}
        <section className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-[#E0E0E0] mb-8 text-center font-['Orbitron']">
            Comparativo Rápido
          </h3>
          <div className="glass-morphism p-8 rounded-xl border border-[#39FF14]/30 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#39FF14]/30">
                  <th className="text-left py-4 px-4 text-[#39FF14] font-['Orbitron'] font-bold text-lg">
                    Característica
                  </th>
                  <th className="text-left py-4 px-4 text-red-400 font-['Orbitron'] font-bold text-lg">
                    PROMOCIONAL
                  </th>
                  <th className="text-left py-4 px-4 text-[#39FF14] font-['Orbitron'] font-bold text-lg">
                    EXPRESSO
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#39FF14]/20 hover:bg-[#39FF14]/5 transition-all">
                  <td className="py-4 px-4 text-[#C0C0C0] font-['Roboto_Mono'] text-lg font-bold">Horário de Pedido</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">Até 15h</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">24h</td>
                </tr>
                <tr className="border-b border-[#39FF14]/20 hover:bg-[#39FF14]/5 transition-all">
                  <td className="py-4 px-4 text-[#C0C0C0] font-['Roboto_Mono'] text-lg font-bold">Entrega</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">A partir das 19h</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">Imediata</td>
                </tr>
                <tr className="border-b border-[#39FF14]/20 hover:bg-[#39FF14]/5 transition-all">
                  <td className="py-4 px-4 text-[#C0C0C0] font-['Roboto_Mono'] text-lg font-bold">Preço</td>
                  <td className="py-4 px-4 text-red-400 font-['Roboto_Mono'] text-lg font-bold">Mais Barato 💸</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">Normal</td>
                </tr>
                <tr className="border-b border-[#39FF14]/20 hover:bg-[#39FF14]/5 transition-all">
                  <td className="py-4 px-4 text-[#C0C0C0] font-['Roboto_Mono'] text-lg font-bold">Dias de Funcionamento</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">Seg a Sex</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">Todos os dias</td>
                </tr>
                <tr className="border-b border-[#39FF14]/20 hover:bg-[#39FF14]/5 transition-all">
                  <td className="py-4 px-4 text-[#C0C0C0] font-['Roboto_Mono'] text-lg font-bold">Ideal Para</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">Quem não tem pressa</td>
                  <td className="py-4 px-4 text-[#E0E0E0] font-['Roboto_Mono'] text-lg">Quem tem urgência</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <a
            href="/"
            className="inline-block px-8 py-4 bg-[#39FF14] text-black rounded-lg font-['Orbitron'] font-bold text-lg hover:shadow-[0_0_20px_rgba(57,255,20,0.6)] transition-all duration-300"
          >
            🛒 Ir para o Catálogo
          </a>
        </section>
      </main>
    </div>
  );
}
