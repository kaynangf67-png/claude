import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Brand } from '@/components/layout/AppShell';
import { Button, Field, Input, Notice } from '@/components/ui';

export function LoginPage() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    setBusy(true);
    try {
      if (mode === 'entrar') {
        await signIn(email.trim(), password);
        navigate('/');
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) setInfo('Conta criada. Abra o link enviado para o seu e-mail para confirmar e depois entre.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <Brand />
        <div className="mt-8 rounded-xl bg-panel p-6 shadow-card ring-1 ring-line">
          <h1 className="text-lg font-semibold">{mode === 'entrar' ? 'Entrar no painel' : 'Criar conta'}</h1>
          <p className="mt-1 text-sm text-ink-soft">Acesso restrito à equipe Web Company.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="E-mail" required>
              {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
            </Field>
            <Field label="Senha" required hint={mode === 'criar' ? 'Mínimo de 8 caracteres.' : undefined}>
              {(id, d) => (
                <Input id={id} aria-describedby={d} type="password" autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
              )}
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            {info && <Notice tone="ok">{info}</Notice>}
            <Button type="submit" variant="primary" loading={busy} className="w-full">
              {mode === 'entrar' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-ink-soft">
          {mode === 'entrar' ? 'Primeiro acesso?' : 'Já tem conta?'}{' '}
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => setMode(mode === 'entrar' ? 'criar' : 'entrar')}>
            {mode === 'entrar' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  );
}
