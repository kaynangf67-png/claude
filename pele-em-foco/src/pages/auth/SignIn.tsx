import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Field, Notice, SubmitButton } from '../../components/ui';
import { useBackend } from '../../app/session';
import { validateEmail } from '../../lib/validation';
import { takeNextNotice } from '../../app/notice';

export function SignIn() {
  const { auth } = useBackend();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [notice] = useState(takeNextNotice);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { email: validateEmail(email), password: password ? null : 'Informe sua senha.' };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    try {
      await auth.signIn(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Não foi possível entrar.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack-lg" aria-labelledby="titulo">
      <div className="stack">
        <h1 id="titulo">Entrar</h1>
        <p className="muted" style={{ marginBottom: 0 }}>Acesse sua rotina, seu diário e a biblioteca.</p>
      </div>
      {notice && <Notice tone="success">{notice}</Notice>}
      {errors.form && <Notice tone="alert">{errors.form}</Notice>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
        <div className="row between wrap">
          <Link to="/recuperar-senha" className="small">Esqueci minha senha</Link>
        </div>
        <SubmitButton busy={busy} busyLabel="Entrando…">Entrar</SubmitButton>
      </form>
      <p className="small center">Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link></p>
    </section>
  );
}
