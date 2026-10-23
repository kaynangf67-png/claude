import { motion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo, Notice, Spinner } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

/** Só aceita caminhos internos em ?next= (evita redirecionamento aberto). */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/app');

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get('next'));

  if (user) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível continuar.');
    } finally {
      setBusy(false);
    }
  }

  const other = mode === 'login' ? '/cadastro' : '/entrar';
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[780px] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-brand/15 to-blue-brand/15 blur-3xl" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
          <div>
            <h1 className="text-xl font-bold">{mode === 'login' ? 'Entrar na sua conta' : 'Criar sua conta'}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {mode === 'login' ? 'Continue de onde parou.' : 'Seus anúncios e imagens ficam salvos no histórico.'}
            </p>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {mode === 'register' && (
            <div>
              <label className="label" htmlFor="name">Nome</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 10 : 1}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && <p className="mt-1.5 text-xs text-ink-500">Mínimo de 10 caracteres.</p>}
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner />}
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
          <p className="text-center text-sm text-ink-500">
            {mode === 'login' ? 'Ainda não tem conta? ' : 'Já tem conta? '}
            <Link to={`${other}?next=${encodeURIComponent(next)}`} className="font-semibold text-violet-brand hover:underline">
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
