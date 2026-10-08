import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signInDemo, signUp, GOOGLE_CLIENT_ID } from '@/services/authService';
import { useApp } from '@/context/AppContext';

export default function LoginPage() {
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleInfo, setGoogleInfo] = useState(false);
  const { setUser, toast } = useApp();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = tab === 'in' ? await signIn(email, password) : await signUp(name, email, password);
      setUser(u);
      toast(tab === 'in' ? `Bem-vindo de volta, ${u.name}.` : 'Conta criada. Configure suas preferências de acessibilidade.', 'success');
      nav(tab === 'in' ? '/' : '/perfil');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const demo = () => {
    setUser(signInDemo());
    toast('Você entrou com a conta de demonstração.', 'success');
    nav('/');
  };

  return (
    <main className="auth-wrap" id="conteudo">
      <div className="auth-art">
        <img src="/media/a-ligacao/backdrop.webp" alt="" />
        <div className="quote">
          <p className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: 0 }}>
            “Assista. Entenda. <em className="gradient-text">Viva a história.</em>”
          </p>
        </div>
      </div>
      <div className="auth-card">
        <h1 className="serif" style={{ fontSize: 48 }}>
          {tab === 'in' ? 'Entrar' : 'Criar conta'}
        </h1>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'in'} onClick={() => setTab('in')}>
            Entrar
          </button>
          <button role="tab" aria-selected={tab === 'up'} onClick={() => setTab('up')}>
            Criar conta
          </button>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setGoogleInfo(true)}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          Continuar com Google
        </button>
        <div className="divider">ou com e-mail</div>
        <form onSubmit={submit} noValidate>
          {tab === 'up' && (
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === 'in' ? 'current-password' : 'new-password'} required minLength={6} />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {tab === 'in' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={demo}>
          Entrar com conta de demonstração
        </button>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 20 }}>
          Protótipo: contas ficam salvas apenas neste navegador (sem servidor). Não use uma senha real.
        </p>
      </div>
      {googleInfo && (
        <div className="dialog-backdrop" onClick={() => setGoogleInfo(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="g-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="g-title">Login com Google ainda não configurado</h2>
            <p className="muted">
              {GOOGLE_CLIENT_ID
                ? 'Há um VITE_GOOGLE_CLIENT_ID configurado, mas o fluxo OAuth ainda precisa de um backend para validar o token.'
                : 'Para ativar, é preciso registrar um app OAuth no Google Cloud (VITE_GOOGLE_CLIENT_ID) e um backend que valide o token. Este protótipo não finge um login que não existe.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={demo}>
                Usar conta de demonstração
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setGoogleInfo(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
