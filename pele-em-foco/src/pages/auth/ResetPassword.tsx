import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field, Notice, SubmitButton } from '../../components/ui';
import { useBackend, useSession } from '../../app/session';
import { PASSWORD_MIN, validatePassword } from '../../lib/validation';
import { setNextNotice } from '../../app/notice';

/** Destino do link de recuperação. O Supabase cria uma sessão temporária ao abrir o link. */
export function ResetPassword() {
  const { auth } = useBackend();
  const { user } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { password: validatePassword(password), confirm: confirm !== password ? 'As senhas não são iguais.' : null };
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    try {
      await auth.updatePassword(password);
      setNextNotice('Senha alterada. Entre com a nova senha.');
      await auth.signOut();
      navigate('/entrar', { replace: true });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Não foi possível alterar a senha.' });
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <section className="stack-lg" aria-labelledby="titulo">
        <h1 id="titulo">Link inválido ou expirado</h1>
        <p className="muted">Abra o link mais recente que enviamos por e-mail ou peça um novo.</p>
        <Link to="/recuperar-senha" className="btn btn-primary btn-lg btn-block">Pedir novo link</Link>
      </section>
    );
  }

  return (
    <section className="stack-lg" aria-labelledby="titulo">
      <div className="stack">
        <h1 id="titulo">Criar nova senha</h1>
        <p className="muted" style={{ marginBottom: 0 }}>Conta: {user.email}</p>
      </div>
      {errors.form && <Notice tone="alert">{errors.form}</Notice>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint={`Pelo menos ${PASSWORD_MIN} caracteres, com letras e números.`} required />
        <Field label="Confirme a nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} required />
        <SubmitButton busy={busy} busyLabel="Salvando…">Salvar nova senha</SubmitButton>
      </form>
    </section>
  );
}
