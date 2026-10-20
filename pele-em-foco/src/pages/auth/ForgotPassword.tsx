import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field, Notice, SubmitButton } from '../../components/ui';
import { useBackend } from '../../app/session';
import { validateEmail } from '../../lib/validation';

export function ForgotPassword() {
  const { auth } = useBackend();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateEmail(email);
    setError(v);
    setFormError(null);
    if (v) return;
    setBusy(true);
    try {
      await auth.sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack-lg" aria-labelledby="titulo">
      <div className="stack">
        <h1 id="titulo">Recuperar senha</h1>
        <p className="muted" style={{ marginBottom: 0 }}>Enviaremos um link para você criar uma senha nova.</p>
      </div>
      {sent ? (
        <Notice tone="success">Se existir uma conta com <strong>{email.trim()}</strong>, você vai receber o link em instantes. Ele vale por tempo limitado.</Notice>
      ) : (
        <>
          {formError && <Notice tone="alert">{formError}</Notice>}
          <form className="stack" onSubmit={submit} noValidate>
            <Field label="E-mail da conta" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} required />
            <SubmitButton busy={busy} busyLabel="Enviando…">Enviar link</SubmitButton>
          </form>
        </>
      )}
      <p className="small center"><Link to="/entrar">Voltar para entrar</Link></p>
    </section>
  );
}
