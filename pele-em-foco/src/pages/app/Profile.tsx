import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { setNextNotice } from '../../app/notice';
import { CalendarClock, Download, LogOut, Mail, Trash2, UserX } from 'lucide-react';
import { AccessLocked } from '../../components/AccessLocked';
import { DemoAccessControls } from '../../components/DemoAccessControls';
import { ConfigPending, ConfirmDialog, Field, Spinner, SubmitButton, useFlash } from '../../components/ui';
import { launch } from '../../config/launch';
import { useBackend, useSession } from '../../app/session';
import { formatDateBR, formatDateTimeBR, todayKey } from '../../lib/dates';
import { validateDisplayName } from '../../lib/validation';

export function Profile() {
  const { auth, data, mode } = useBackend();
  const { user, profile, access, refreshProfile, refreshAccess } = useSession();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [confirm, setConfirm] = useState<'data' | 'account' | null>(null);
  const [working, setWorking] = useState(false);
  const flash = useFlash(3500);

  useEffect(() => setName(profile?.displayName ?? ''), [profile?.displayName]);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateDisplayName(name);
    setNameError(err);
    if (err) return;
    setSavingName(true);
    try {
      await data.updateDisplayName(name);
      await refreshProfile();
      flash.show('Nome atualizado.');
    } catch (e2) {
      flash.show(e2 instanceof Error ? e2.message : 'Não foi possível salvar.', 'error');
    } finally {
      setSavingName(false);
    }
  };

  const exportData = async () => {
    try {
      const payload = await data.exportData(user?.email ?? '');
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `pele-em-foco-${todayKey()}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      flash.show(e instanceof Error ? e.message : 'Não foi possível exportar.', 'error');
    }
  };

  const runDelete = async () => {
    setWorking(true);
    try {
      if (confirm === 'data') {
        await data.deleteMyData();
        flash.show('Rotina e diário apagados.');
        setConfirm(null);
      } else if (confirm === 'account') {
        setNextNotice('Sua conta e seus dados foram excluídos.');
        await data.deleteAccount(); // a sessão termina e o guard leva para /entrar
      }
    } catch (e) {
      flash.show(e instanceof Error ? e.message : 'Não foi possível concluir.', 'error');
      setConfirm(null);
    } finally {
      setWorking(false);
    }
  };

  const signOut = () => auth.signOut(); // o guard leva para /entrar

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Perfil</p>
        <h1>Sua conta</h1>
      </header>

      <section className="card stack" aria-labelledby="conta">
        <h2 id="conta" className="h3">Dados da conta</h2>
        <dl className="details">
          <div><dt>E-mail</dt><dd>{user?.email}</dd></div>
          <div><dt>Conta criada em</dt><dd>{profile ? formatDateBR(profile.createdAt) : '—'}</dd></div>
          <div><dt>Aviso educativo aceito em</dt><dd>{profile?.acceptedDisclaimerAt ? formatDateTimeBR(profile.acceptedDisclaimerAt) : 'Não registrado'}</dd></div>
        </dl>
        <form className="stack" onSubmit={saveName} noValidate>
          <Field label="Como prefere ser chamado(a)" maxLength={60} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
          <SubmitButton busy={savingName} className="btn btn-secondary" busyLabel="Salvando…" disabled={name.trim() === (profile?.displayName ?? '')}>Salvar nome</SubmitButton>
        </form>
        {flash.node}
      </section>

      <section className="stack" aria-labelledby="acesso">
        <h2 id="acesso" className="h3">Acesso ao app</h2>
        {!access ? (
          <Spinner />
        ) : access.status === 'active' ? (
          <div className="card-sage stack">
            <p className="row" style={{ marginBottom: 0 }}><CalendarClock aria-hidden="true" /> <span>{access.expiresAt ? <>Acesso ativo até <strong>{formatDateTimeBR(access.expiresAt)}</strong>.</> : <>Acesso <strong>vitalício</strong> ativo.</>}</span></p>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Ativado em {formatDateTimeBR(access.startsAt!)}{access.source === 'demo' ? ' (demonstração)' : ''}. Sem mensalidade e sem cobrança automática.
            </p>
            {mode === 'demo' && <DemoAccessControls />}
          </div>
        ) : (
          <AccessLocked compact />
        )}
        {access && access.status !== 'active' && mode === 'supabase' && (
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => void refreshAccess()}>Atualizar situação do acesso</button>
        )}
      </section>

      <section className="card stack" aria-labelledby="privacidade">
        <h2 id="privacidade" className="h3">Privacidade e seus dados</h2>
        <ul className="small" style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>
          {mode === 'supabase' ? (
            <li>Guardamos só o necessário: e-mail, nome opcional, data do aceite, sua rotina, seu diário e a situação do acesso. Os dados ficam no servidor do app (Supabase), protegidos por regras que só deixam você ler os seus registros.</li>
          ) : (
            <li><strong>Modo demonstração:</strong> conta e registros ficam só neste navegador, sem servidor e sem proteção real.</li>
          )}
          <li>Não pedimos fotos do rosto, documentos nem informações médicas.</li>
          <li>Senhas são gerenciadas pelo provedor de autenticação; nunca as guardamos em texto.</li>
          <li>Você pode exportar tudo ou apagar a qualquer momento, mesmo se o acesso for encerrado.</li>
        </ul>
        <div className="row wrap">
          <button className="btn btn-secondary" onClick={() => void exportData()}><Download size={18} aria-hidden="true" /> Exportar meus dados</button>
          <button className="btn btn-danger" onClick={() => setConfirm('data')}><Trash2 size={18} aria-hidden="true" /> Apagar rotina e diário</button>
          <button className="btn btn-danger" onClick={() => setConfirm('account')}><UserX size={18} aria-hidden="true" /> Excluir minha conta</button>
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>Leia a <Link to="/privacidade">política de privacidade</Link> e os <Link to="/termos">termos de uso</Link>.</p>
      </section>

      <section className="card-beige stack" aria-labelledby="suporte">
        <h2 id="suporte" className="h3">Suporte</h2>
        {launch.supportEmail ? (
          <a className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} href={`mailto:${launch.supportEmail}`}><Mail size={18} aria-hidden="true" /> {launch.supportEmail}</a>
        ) : (
          <ConfigPending>e-mail de suporte (VITE_SUPPORT_EMAIL).</ConfigPending>
        )}
        <p className="xs muted" style={{ marginBottom: 0 }}>O suporte responde sobre conta, acesso e conteúdo. Não fazemos orientação médica individual.</p>
      </section>

      <button className="btn btn-secondary btn-lg" onClick={() => void signOut()}><LogOut size={18} aria-hidden="true" /> Sair da conta</button>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'account' ? 'Excluir sua conta?' : 'Apagar rotina e diário?'}
        confirmLabel={confirm === 'account' ? 'Excluir conta' : 'Apagar'}
        busy={working}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runDelete()}
      >
        {confirm === 'account' ? (
          <p>Sua conta, perfil, rotina, diário e o vínculo da compra serão excluídos definitivamente. Uma compra já usada não libera o acesso em outra conta. Exporte seus dados antes, se quiser guardar.</p>
        ) : (
          <p>Todos os registros de rotina e diário desta conta serão apagados. A conta e o acesso continuam. Não dá para desfazer.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
