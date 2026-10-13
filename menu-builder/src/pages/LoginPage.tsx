import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { AuthFailure, emailFormatError, normalizeEmail } from '@/auth/authErrors';
import { Brand } from '@/components/layout/AppShell';
import { Button, Field, Input, Notice, PasswordInput } from '@/components/ui';

export function LoginPage() {
  const { user, signIn, signUp, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [info, setInfo] = useState('');

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const cleanEmail = normalizeEmail(email);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo('');
    const emailError = emailFormatError(cleanEmail);
    if (emailError) return setError({ message: emailError });
    if (password.length < 8) return setError({ message: 'A senha precisa ter pelo menos 8 caracteres.' });
    setBusy(true);
    try {
      if (mode === 'entrar') {
        await signIn(cleanEmail, password);
        navigate('/');
      } else {
        const { needsConfirmation } = await signUp(cleanEmail, password);
        if (needsConfirmation) {
          setInfo(`Conta criada. Enviamos um link de confirmação para ${cleanEmail}. Abra o link (veja também o spam) e depois entre.`);
          setMode('entrar');
        }
      }
    } catch (err) {
      setError({ message: (err as Error).message, code: err instanceof AuthFailure ? err.code : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await resendConfirmation(cleanEmail);
      setError(null);
      setInfo(`Enviamos um novo link de confirmação para ${cleanEmail}. Use o e-mail mais recente: os links antigos deixam de valer.`);
    } catch (err) {
      setError({ message: (err as Error).message });
    } finally {
      setResending(false);
    }
  }

  const canResend = error?.code === 'email_not_confirmed' || error?.code === 'user_already_exists';

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <Brand />
        <div className="mt-8 rounded-xl bg-panel p-6 shadow-card ring-1 ring-line">
          <h1 className="text-lg font-semibold">{mode === 'entrar' ? 'Entrar no painel' : 'Criar conta'}</h1>
          <p className="mt-1 text-sm text-ink-soft">Acesso restrito à equipe Web Company.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="E-mail" required>
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="nome@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
            </Field>
            <Field label="Senha" required hint={mode === 'criar' ? 'Mínimo de 8 caracteres.' : undefined}>
              {(id, d) => (
                <PasswordInput
                  id={id}
                  aria-describedby={d}
                  autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}
            </Field>
            {error && (
              <Notice tone="danger">
                {error.message}
                {canResend && (
                  <div className="mt-2">
                    <Button type="button" size="sm" loading={resending} onClick={resend}>
                      Reenviar e-mail de confirmação
                    </Button>
                  </div>
                )}
              </Notice>
            )}
            {info && <Notice tone="ok">{info}</Notice>}
            <Button type="submit" variant="primary" loading={busy} className="w-full">
              {mode === 'entrar' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-ink-soft">
          {mode === 'entrar' ? 'Primeiro acesso?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => {
              setMode(mode === 'entrar' ? 'criar' : 'entrar');
              setError(null);
              setInfo('');
            }}
          >
            {mode === 'entrar' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  );
}
