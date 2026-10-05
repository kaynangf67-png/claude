import { Check, CheckCircle2, Clock, ExternalLink, Lock, Mail, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, Modal } from '../components/ui';
import { buildCheckoutUrl, checkoutLink, type PlanId } from '../lib/checkout';
import { useAppState } from '../lib/store';
import { LegalFooter } from './Legal';

const PLANS: {
  id: PlanId;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: 'inicial',
    name: 'Plano Inicial',
    price: 79,
    tagline: 'Para começar a recuperar vendas hoje',
    features: ['Até 300 leads', 'Follow-ups com IA', 'Dashboard', 'Recuperação de clientes'],
  },
  {
    id: 'profissional',
    name: 'Plano Profissional',
    price: 149,
    tagline: 'Para quem quer escalar o atendimento',
    features: ['Até 1.000 leads', 'IA avançada', 'Automação', 'CRM', 'Relatórios'],
    highlight: true,
  },
];

const DEMO_EMAIL = 'demo@recupera.ai';

function CheckoutDialog({ plan }: { plan: (typeof PLANS)[number] }) {
  const { user, business } = useAppState();
  const [name, setName] = useState(user && user.name !== 'Você' ? user.name : '');
  const [email, setEmail] = useState(user && user.email !== DEMO_EMAIL ? user.email : '');
  const base = checkoutLink(plan.id)!;

  const ready = name.trim().length > 1 && /^\S+@\S+\.\S+$/.test(email.trim());
  // Link real (e não window.open) para não ser barrado por bloqueadores de pop-up.
  const url = buildCheckoutUrl(base, { name, email, phone: business?.whatsapp });

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-5 p-5 sm:p-6">
      <div className="rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
        <p className="font-semibold text-ink">O que você está assinando</p>
        <ul className="mt-2 space-y-1.5 text-slate-600">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" />
            Acesso antecipado ao RecuperaAI: painel, diagnóstico de leads e follow-ups com IA.
          </li>
          <li className="flex gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
            A conexão direta com o WhatsApp ainda está em desenvolvimento. Por enquanto, você registra as conversas e
            envia as mensagens pelo seu WhatsApp.
          </li>
          <li className="flex gap-2">
            <Mail className="mt-0.5 size-4 shrink-0 text-slate-500" />
            Ativamos seu acesso em até 24 horas, no e-mail usado na compra.
          </li>
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="co-name">Nome</label>
          <input id="co-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="co-email">E-mail</label>
          <input id="co-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
      </div>

      <a
        href={ready ? url : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!ready}
        className={`btn-primary w-full py-3 text-base ${ready ? '' : 'pointer-events-none opacity-50'}`}
      >
        Ir para o pagamento · R$ {plan.price}/mês
        <ExternalLink className="size-4" />
      </a>
      {!ready && <p className="-mt-3 text-center text-xs text-slate-500">Preencha nome e e-mail para continuar.</p>}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
        <Lock className="size-3.5" />
        Pagamento seguro processado pela Cakto. O RecuperaAI não vê nem guarda dados do seu cartão.
      </p>
      <p className="-mt-2 text-center text-xs text-slate-500">
        Ao continuar, você concorda com os{' '}
        <a href="#/termos" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
          Termos de uso
        </a>{' '}
        e a{' '}
        <a href="#/privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
          Política de privacidade
        </a>
        .
      </p>
    </form>
  );
}

export function PricingContent() {
  const [chosen, setChosen] = useState<(typeof PLANS)[number] | null>(null);
  const hasCheckout = chosen ? !!checkoutLink(chosen.id) : false;

  return (
    <>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Planos simples, ROI claro</h1>
        <p className="mt-3 text-slate-600">
          Uma única venda recuperada de R$ 500 já paga o Plano Profissional por mais de 3 meses.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
        {PLANS.map((p) => {
          const available = !!checkoutLink(p.id);
          return (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-3xl p-6 sm:p-8 ${p.highlight ? 'bg-ink text-white shadow-lift' : 'card'}`}
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
                    <span
                      className={`flex size-5 items-center justify-center rounded-full ${
                        p.highlight ? 'bg-brand-500/20 text-brand-300' : 'bg-brand-50 text-brand-600'
                      }`}
                    >
                      <Check className="size-3.5" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setChosen(p)}
                className={`mt-8 w-full py-3 ${p.highlight ? 'btn bg-brand-500 text-white hover:bg-brand-400' : 'btn-dark'}`}
              >
                Quero testar
              </button>
              <p className={`mt-2 text-center text-xs ${p.highlight ? 'text-slate-400' : 'text-slate-500'}`}>
                {available ? 'Acesso antecipado · cancele quando quiser' : 'Em breve · entre na lista de espera'}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-slate-500">Preços em reais. Sem fidelidade. Arrependimento em até 7 dias com reembolso integral.</p>
      <LegalFooter />

      <Modal
        open={!!chosen}
        onClose={() => setChosen(null)}
        title={
          <p className="text-base font-bold">
            {hasCheckout ? `Assinar o ${chosen?.name}` : 'Obrigado pelo interesse!'}
          </p>
        }
      >
        {chosen && hasCheckout ? (
          <CheckoutDialog plan={chosen} />
        ) : (
          <div className="space-y-3 p-6 text-sm text-slate-600">
            <p>
              O <strong className="text-ink">{chosen?.name}</strong> ainda não está aberto para assinatura. Registramos seu
              interesse e avisamos quando abrir.
            </p>
            <p>Enquanto isso, continue usando a demonstração completa à vontade.</p>
            <button className="btn-primary mt-2 w-full" onClick={() => setChosen(null)}>
              Continuar testando
            </button>
          </div>
        )}
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
        <Link to="/">
          <Logo />
        </Link>
        <Link to={user ? '/app' : '/cadastro'} className="btn-secondary">
          {user ? 'Ir para o painel' : 'Criar conta'}
        </Link>
      </header>
      <main className="px-4 pb-20 pt-8 sm:px-6">
        <PricingContent />
      </main>
    </div>
  );
}

/** Página para onde a Cakto pode redirecionar depois da compra (configure como "página de obrigado"). */
export function ThankYou() {
  const { user } = useAppState();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <Link to="/" className="mb-8">
        <Logo />
      </Link>
      <div className="card w-full max-w-md p-6 text-center sm:p-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Assinatura recebida</h1>
        <p className="mt-2 text-sm text-slate-600">
          Obrigado por apoiar o RecuperaAI desde o começo. A Cakto envia o comprovante para o seu e-mail.
        </p>
        <ol className="mt-6 space-y-3 text-left text-sm">
          <li className="flex gap-3">
            <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">1</span>
            <span>Ativamos seu acesso em até 24 horas no e-mail usado na compra.</span>
          </li>
          <li className="flex gap-3">
            <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">2</span>
            <span>Enquanto isso, cadastre seus produtos e preços em “Minha empresa” para a IA usar só os seus dados.</span>
          </li>
          <li className="flex gap-3">
            <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">3</span>
            <span>Pagamento pendente (Pix ou boleto)? O acesso é ativado quando a Cakto confirmar.</span>
          </li>
        </ol>
        <Link to={user ? '/app' : '/cadastro'} className="btn-primary mt-6 w-full py-3">
          {user ? 'Voltar para o painel' : 'Criar minha conta'}
        </Link>
      </div>
    </div>
  );
}
