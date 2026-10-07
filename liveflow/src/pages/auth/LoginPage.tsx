import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth';
import { AuthLayout } from '@/layouts/AuthLayout';
import { credentialsSchema, fieldErrors } from '@/lib/validation';
import { DEMO_ACCOUNT } from '@/services/auth/demo-auth';
import { backendMode } from '@/services/backend';

export default function LoginPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setLoading(true);
    try {
      await auth.signIn(parsed.data.email, parsed.data.password);
      navigate(from, { replace: true });
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : 'Não foi possível entrar.' });
    } finally {
      setLoading(false);
    }
  }

  async function enterDemo() {
    setLoading(true);
    try {
      await auth.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua operação de vídeos.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password}>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
        </Field>
        <div className="-mt-1 text-right">
          <Link to="/recuperar-senha" className="text-[13px] text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        {errors._ && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors._}</p>}
        <Button type="submit" size="lg" loading={loading}>
          Entrar
        </Button>
      </form>
      {backendMode === 'demo' && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" size="lg" className="w-full" onClick={enterDemo} disabled={loading}>
            <PlayCircle /> Entrar com conta de demonstração
          </Button>
        </>
      )}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-medium text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
}
