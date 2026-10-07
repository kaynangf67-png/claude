import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth';
import { AuthLayout } from '@/layouts/AuthLayout';
import { fieldErrors, registerSchema } from '@/lib/validation';

export default function RegisterPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setLoading(true);
    try {
      const { needsConfirmation } = await auth.signUp(parsed.data.email, parsed.data.password, parsed.data.fullName);
      if (needsConfirmation) setConfirmEmail(true);
      else navigate('/boas-vindas', { replace: true });
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : 'Não foi possível criar a conta.' });
    } finally {
      setLoading(false);
    }
  }

  if (confirmEmail) {
    return (
      <AuthLayout title="Confirme seu e-mail" subtitle={`Enviamos um link de confirmação para ${form.email}.`}>
        <div className="flex flex-col items-center rounded-xl border p-6 text-center">
          <MailCheck className="size-10 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Depois de confirmar, volte e faça login.</p>
          <Button asChild className="mt-5 w-full">
            <Link to="/entrar">Ir para o login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AuthLayout title="Criar conta" subtitle="Comece a organizar sua operação de lives em minutos.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Nome" htmlFor="name" error={errors.fullName}>
          <Input id="name" autoComplete="name" value={form.fullName} onChange={set('fullName')} aria-invalid={!!errors.fullName} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password} hint="Mínimo de 8 caracteres.">
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} aria-invalid={!!errors.password} />
        </Field>
        {errors._ && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors._}</p>}
        <Button type="submit" size="lg" loading={loading}>
          Criar conta
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
