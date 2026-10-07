import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth';
import { AuthLayout } from '@/layouts/AuthLayout';

/** Destino do link de recuperação do Supabase (sessão de recovery já ativa). */
export default function ResetPasswordPage() {
  const { auth, user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('A senha precisa ter ao menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');
    setLoading(true);
    try {
      await auth.updatePassword(password);
      toast.success('Senha atualizada.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Nova senha" subtitle={user ? 'Defina sua nova senha.' : 'Abra esta página pelo link enviado ao seu e-mail.'}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Nova senha" htmlFor="pw">
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirmar senha" htmlFor="pw2" error={error}>
          <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" loading={loading} disabled={!user}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
}
