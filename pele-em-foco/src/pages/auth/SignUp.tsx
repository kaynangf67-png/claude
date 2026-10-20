import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Field, Notice, SubmitButton } from '../../components/ui';
import { useBackend } from '../../app/session';
import { PASSWORD_MIN, validateDisplayName, validateEmail, validatePassword } from '../../lib/validation';

export function SignUp() {
  const { auth } = useBackend();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', accepted: false });
  const [errors, setErrors] = useState<Record<string, string | null | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      name: validateDisplayName(form.name),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: form.confirm !== form.password ? 'As senhas não são iguais.' : null,
      accepted: form.accepted ? null : 'Para continuar, confirme que entendeu o aviso.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      const { needsConfirmation } = await auth.signUp({ email: form.email, password: form.password, displayName: form.name, acceptedDisclaimer: form.accepted });
      if (needsConfirmation) setSentTo(form.email.trim());
      else navigate('/app', { replace: true });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Não foi possível criar a conta.' });
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <section className="stack-lg" aria-labelledby="titulo">
        <MailCheck size={32} aria-hidden="true" />
        <h1 id="titulo">Confirme seu e-mail</h1>
        <p className="muted">
          Se ainda não houver uma conta com <strong>{sentTo}</strong>, enviamos um link de confirmação para esse endereço. Abra o link para ativar a conta e depois entre.
        </p>
        <Notice>Não chegou? Confira spam e promoções. O acesso ao app é liberado quando este e-mail estiver confirmado e for o mesmo da compra.</Notice>
        <Link to="/entrar" className="btn btn-primary btn-lg btn-block">Ir para entrar</Link>
      </section>
    );
  }

  return (
    <section className="stack-lg" aria-labelledby="titulo">
      <div className="stack">
        <h1 id="titulo">Criar conta</h1>
        <p className="muted" style={{ marginBottom: 0 }}>Use <strong>o mesmo e-mail da sua compra</strong> na Cakto para o bônus ser ativado.</p>
      </div>
      {errors.form && <Notice tone="alert">{errors.form}</Notice>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Como prefere ser chamado(a)? (opcional)" autoComplete="nickname" maxLength={60} value={form.name} onChange={set('name')} error={errors.name} />
        <Field label="E-mail" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} error={errors.email} required />
        <Field label="Senha" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint={`Pelo menos ${PASSWORD_MIN} caracteres, com letras e números.`} required />
        <Field label="Confirme a senha" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} required />
        <div className="field">
          <label className="checkbox-row">
            <input type="checkbox" checked={form.accepted} onChange={set('accepted')} aria-invalid={errors.accepted ? true : undefined} aria-describedby={errors.accepted ? 'aceite-erro' : 'aceite-texto'} />
            <span id="aceite-texto">
              Entendi que o Pele em Foco é <strong>educativo</strong>: não faz diagnóstico, não indica tratamento e não substitui consulta com dermatologista. Li a{' '}
              <Link to="/privacidade" target="_blank">política de privacidade</Link>.
            </span>
          </label>
          {errors.accepted && <span id="aceite-erro" className="field-error">{errors.accepted}</span>}
        </div>
        <SubmitButton busy={busy} busyLabel="Criando conta…">Criar conta</SubmitButton>
      </form>
      <p className="small center">Já tem conta? <Link to="/entrar">Entrar</Link></p>
    </section>
  );
}
