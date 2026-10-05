import { Sparkles, Store, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BusinessForm, EMPTY_BUSINESS } from '../components/BusinessForm';
import { Logo } from '../components/ui';
import { DEMO_BUSINESS } from '../lib/demoData';
import { actions, useAppState } from '../lib/store';

export function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    actions.signup({ name: name.trim(), email: email.trim() });
    navigate('/onboarding');
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <Link to="/" className="mb-8">
        <Logo />
      </Link>
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Crie sua conta</h1>
          <p className="mt-1 text-sm text-slate-500">Leva 1 minuto. Você testa tudo sem conectar o WhatsApp.</p>
        </div>
        <div>
          <label className="label" htmlFor="su-name">Seu nome</label>
          <input id="su-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="su-email">E-mail</label>
          <input id="su-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="su-pass">Senha</label>
          <input id="su-pass" type="password" className="input" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <button className="btn-primary w-full py-3">Criar conta</button>
        <p className="text-center text-xs text-slate-400">
          Versão de validação: sua conta e seus dados ficam salvos apenas neste navegador.
        </p>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        Só quer ver funcionando?{' '}
        <button
          className="font-semibold text-brand-700 hover:underline"
          onClick={() => {
            actions.startDemo();
            navigate('/app');
          }}
        >
          Abrir demonstração
        </button>
      </p>
    </div>
  );
}

export function Onboarding() {
  const { user, business } = useAppState();
  const navigate = useNavigate();
  const [seed, setSeed] = useState(0);
  const [initial, setInitial] = useState(EMPTY_BUSINESS);

  if (!user) return <Navigate to="/cadastro" replace />;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <span className="text-sm text-slate-500">Passo 1 de 1</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
              <Store className="size-4" /> Olá, {user.name.split(' ')[0]}!
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Cadastre seu negócio</h1>
            <p className="mt-1 text-slate-500">Essas informações são a única fonte que a IA usa para falar com seus clientes.</p>
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => {
              setInitial(structuredClone(DEMO_BUSINESS));
              setSeed((s) => s + 1);
            }}
          >
            <Wand2 className="size-4" /> Preencher com exemplo
          </button>
        </div>
        <BusinessForm
          key={seed}
          initial={business ?? initial}
          submitLabel="Salvar e ir para o painel"
          onSubmit={(b) => {
            actions.saveBusiness(b, true);
            navigate('/app');
          }}
        />
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          Para você entender o produto em 2 minutos, seu painel começa com 10 conversas de exemplo (de uma loja de
          móveis). Você pode apagá-las em “Minha empresa”.
        </p>
      </div>
    </div>
  );
}
