import { useState, type FormEvent } from 'react';
import { FlaskConical, ShieldCheck } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { useApp } from '@/state/app';
import { Logo } from '@/components/Layout';
import { Button, Input, Label, Notice, Segmented } from '@/components/ui';

export default function LoginPage() {
  const { setDemo } = useApp();
  const [tab, setTab] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'red' | 'green'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const sb = getSupabase();
    const { data, error } =
      tab === 'entrar'
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setLoading(false);
    if (error) return setMessage({ tone: 'red', text: error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message });
    if (tab === 'criar' && !data.session) setMessage({ tone: 'green', text: 'Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.' });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,.12),transparent_55%)] px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <Logo className="mb-8 justify-center" />
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-2xl">
          <h1 className="text-lg font-semibold">Inteligência de produtos para dropshipping</h1>
          <p className="mt-1 text-sm text-ink-3">Entre para salvar favoritos, alertas, simulações e links de fornecedor na sua conta.</p>
          <Segmented
            className="mt-5 w-full [&>button]:flex-1"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'entrar', label: 'Entrar' },
              { value: 'criar', label: 'Criar conta' },
            ]}
          />
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {message && <Notice tone={message.tone}>{message.text}</Notice>}
            <Button type="submit" variant="primary" className="w-full justify-center" loading={loading}>
              {tab === 'entrar' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" className="w-full justify-center" onClick={() => setDemo(true)}>
            <FlaskConical className="h-4 w-4 text-warn" /> Explorar demonstração (dados fictícios)
          </Button>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-3">
          <ShieldCheck className="h-3.5 w-3.5" /> Cada conta só acessa os próprios dados (RLS no banco).
        </p>
      </div>
    </div>
  );
}
