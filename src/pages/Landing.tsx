import { ArrowRight, CheckCircle2, MessageCircleWarning, Sparkles, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui';
import { LegalFooter } from './Legal';
import { actions } from '../lib/store';

export function Landing() {
  const navigate = useNavigate();
  function demo() {
    actions.startDemo();
    navigate('/app');
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link to="/planos" className="btn-ghost hidden sm:inline-flex">Planos</Link>
          <Link to="/cadastro" className="btn-secondary">Criar conta</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-200">
            <Sparkles className="size-3.5" /> Para quem vende pelo WhatsApp
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Recupere clientes que demonstraram interesse, mas{' '}
            <span className="bg-gradient-to-r from-brand-600 to-teal-500 bg-clip-text text-transparent">não finalizaram a compra.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            O RecuperaAI encontra quem perguntou o preço e sumiu, explica por que a venda está escapando e escreve o
            follow-up certo — natural, sem spam. Você vê quanto dinheiro voltou pro caixa.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={demo} className="btn-primary px-6 py-3.5 text-base">
              Ver demonstração agora <ArrowRight className="size-5" />
            </button>
            <Link to="/cadastro" className="btn-secondary px-6 py-3.5 text-base">
              Criar conta grátis
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-500">Sem integração, sem cartão. A demo já vem com clientes de exemplo.</p>
        </div>

        {/* Prova visual do fluxo */}
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-100 via-emerald-50 to-amber-50" />
          <div className="card space-y-3 p-4 sm:p-5">
            <div className="chat-wallpaper space-y-2 rounded-xl p-3">
              <p className="w-fit max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-sm shadow-sm">Oi, quanto custa o sofá retrátil?</p>
              <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm shadow-sm">Olá! O sofá retrátil custa R$ 2.490.</p>
              <p className="w-fit max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-sm shadow-sm">Vou conversar com minha esposa e depois te falo.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-orange-50 px-3 py-2.5 ring-1 ring-orange-200">
              <MessageCircleWarning className="size-5 shrink-0 text-orange-600" />
              <div className="flex-1 text-sm">
                <p className="font-bold text-ink">Venda potencialmente perdida</p>
                <p className="text-slate-600">Lead quente · R$ 2.490 · Follow-up em até 24h</p>
              </div>
            </div>
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5 text-sm">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-700">
                <Sparkles className="size-3" /> Follow-up sugerido
              </p>
              Oi, João! Tudo bem? Você tinha falado com a gente sobre o sofá retrátil. Conseguiu conversar com sua esposa?
            </div>
            <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-white">
              <span className="flex items-center gap-2 text-sm"><TrendingUp className="size-4 text-brand-400" /> Receita recuperada</span>
              <span className="num text-lg font-extrabold text-brand-300">+ R$ 2.490,00</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-canvas py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
          {[
            ['Encontra as vendas escapando', 'Identifica quem pediu preço, disse “vou pensar” ou parou de responder — e classifica como quente, morno ou frio.'],
            ['Escreve o follow-up certo', 'Mensagem curta e natural, usando só seus preços e informações. Nunca inventa desconto nem promete estoque.'],
            ['Mostra o dinheiro recuperado', 'Cada venda recuperada entra no painel. Você sabe exatamente quanto o follow-up trouxe de volta.'],
          ].map(([t, d]) => (
            <div key={t} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <div>
                <h3 className="font-bold text-ink">{t}</h3>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-12 max-w-6xl px-4 text-sm text-slate-500 sm:px-6">
          Ideal para lojas de móveis e roupas, salões de beleza, clínicas odontológicas, oficinas e prestadores de serviço.
        </p>
      </section>
      <footer className="border-t border-slate-100 bg-canvas pb-10">
        <LegalFooter className="mt-0 pt-6" />
      </footer>
    </div>
  );
}
