import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, Modal } from '../components/ui';
import { useAppState } from '../lib/store';

const PLANS = [
  {
    name: 'Plano Inicial',
    price: 79,
    tagline: 'Para começar a recuperar vendas hoje',
    features: ['Até 300 leads', 'Follow-ups com IA', 'Dashboard', 'Recuperação de clientes'],
  },
  {
    name: 'Plano Profissional',
    price: 149,
    tagline: 'Para quem quer escalar o atendimento',
    features: ['Até 1.000 leads', 'IA avançada', 'Automação', 'CRM', 'Relatórios'],
    highlight: true,
  },
];

export function PricingContent() {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Planos simples, ROI claro</h1>
        <p className="mt-3 text-slate-600">
          Uma única venda recuperada de R$ 500 já paga o Plano Profissional por mais de 3 meses.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col rounded-3xl p-6 sm:p-8 ${
              p.highlight ? 'bg-ink text-white shadow-lift' : 'card'
            }`}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white">
                <Sparkles className="size-3" /> Mais completo
              </span>
            )}
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className={`text-sm ${p.highlight ? 'text-slate-400' : 'text-slate-500'}`}>{p.tagline}</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="num text-5xl font-extrabold tracking-tight">R$ {p.price}</span>
              <span className={p.highlight ? 'text-slate-400' : 'text-slate-500'}>/mês</span>
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm">
                  <span className={`flex size-5 items-center justify-center rounded-full ${p.highlight ? 'bg-brand-500/20 text-brand-300' : 'bg-brand-50 text-brand-600'}`}>
                    <Check className="size-3.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setChosen(p.name)}
              className={`mt-8 w-full py-3 ${p.highlight ? 'btn bg-brand-500 text-white hover:bg-brand-400' : 'btn-dark'}`}
            >
              Quero testar
            </button>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-slate-500">Preços em reais. Sem fidelidade. Nenhuma cobrança é feita nesta versão.</p>

      <Modal open={!!chosen} onClose={() => setChosen(null)} title={<p className="text-base font-bold">Obrigado pelo interesse! 🙌</p>}>
        <div className="space-y-3 p-6 text-sm text-slate-600">
          <p>
            Você escolheu o <strong className="text-ink">{chosen}</strong>. O RecuperaAI está em fase de validação e ainda não
            cobra nada.
          </p>
          <p>Registramos seu interesse. Enquanto isso, continue usando a demonstração completa à vontade.</p>
          <button className="btn-primary mt-2 w-full" onClick={() => setChosen(null)}>
            Continuar testando
          </button>
        </div>
      </Modal>
    </>
  );
}

export function Pricing() {
  return (
    <div className="py-4">
      <PricingContent />
    </div>
  );
}

export function PublicPricing() {
  const { user } = useAppState();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/"><Logo /></Link>
        <Link to={user ? '/app' : '/cadastro'} className="btn-secondary">{user ? 'Ir para o painel' : 'Criar conta'}</Link>
      </header>
      <main className="px-4 pb-20 pt-8 sm:px-6">
        <PricingContent />
      </main>
    </div>
  );
}
