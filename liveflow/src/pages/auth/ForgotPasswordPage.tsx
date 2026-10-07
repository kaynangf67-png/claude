import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth';
import { AuthLayout } from '@/layouts/AuthLayout';
import { backendMode } from '@/services/backend';
import { z } from 'zod';

export default function ForgotPasswordPage() {
  const { auth } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return setError('Informe um e-mail válido.');
    setLoading(true);
    try {
      await auth.sendPasswordReset(parsed.data);
      // Mesma resposta exista ou não a conta (evita enumeração de e-mails).
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {sent ? (
        <div className="flex flex-col items-center rounded-xl border p-6 text-center">
          <MailCheck className="size-10 text-primary" />
          <p className="mt-3 text-sm">Se existir uma conta para <strong>{email}</strong>, o link chegará em instantes.</p>
          {backendMode === 'demo' && <p className="mt-2 text-xs text-muted-foreground">No modo demonstração nenhum e-mail é enviado.</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="E-mail" htmlFor="email" error={error}>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} />
          </Field>
          <Button type="submit" size="lg" loading={loading}>
            Enviar link
          </Button>
        </form>
      )}
      <Link to="/entrar" className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para o login
      </Link>
    </AuthLayout>
  );
}
