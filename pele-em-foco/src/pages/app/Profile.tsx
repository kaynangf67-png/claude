import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Mail, Trash2 } from 'lucide-react';
import { BonusNotice } from '../../components/BonusNotice';
import { ConfigPending, ConfirmDialog, Switch } from '../../components/ui';
import { launch } from '../../config/launch';
import { useStore } from '../../lib/store';
import type { Preferences, SkinFeel } from '../../lib/types';

const SKIN: { value: SkinFeel; label: string }[] = [
  { value: 'oleosa', label: 'Oleosa' },
  { value: 'mista', label: 'Mista' },
  { value: 'normal', label: 'Normal' },
  { value: 'seca', label: 'Seca' },
  { value: 'nao-sei', label: 'Não sei' },
];

export function Profile() {
  const { data, today, updatePreferences, resetAll } = useStore();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const prefs = data.preferences;
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => updatePreferences({ ...prefs, [key]: value });
  const daysWithData = Object.keys(data.days).length;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `pele-em-foco-${today}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Perfil</p>
        <h1>Preferências e privacidade</h1>
      </header>

      <section className="card stack" aria-labelledby="pref">
        <h2 id="pref" style={{ fontSize: 'var(--text-lg)' }}>Preferências</h2>
        <div className="field">
          <label htmlFor="nome">Como prefere ser chamado(a)</label>
          <input id="nome" className="input" value={prefs.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
        </div>
        <fieldset>
          <legend className="small">Como você sente sua pele</legend>
          <div className="option-grid">
            {SKIN.map((o) => (
              <label key={o.value} className="option">
                <input type="radio" name="skin-profile" checked={prefs.skinFeel === o.value} onChange={() => set('skinFeel', o.value)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Switch id="p-makeup" label="Uso maquiagem" checked={prefs.usesMakeup} onChange={(v) => set('usesMakeup', v)} />
          <Switch id="p-shave" label="Faço barba" checked={prefs.shaves} onChange={(v) => set('shaves', v)} />
          <Switch id="p-treat" label="Uso tratamento indicado por profissional" checked={prefs.hasTreatment} onChange={(v) => set('hasTreatment', v)} />
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>Mudar essas opções atualiza a rotina sugerida e mantém os passos que você criou ou desativou.</p>
      </section>

      <section className="stack" aria-labelledby="bonus">
        <h2 id="bonus" style={{ fontSize: 'var(--text-lg)' }}>Acesso ao app</h2>
        <BonusNotice />
        <p className="small muted" style={{ marginBottom: 0 }}>
          O app é um bônus para quem comprou o e-book Pele em Foco. Nesta versão não há login: o acesso é pelo link enviado no e-mail de compra, e o app não verifica compras nem bloqueia o uso automaticamente.
        </p>
      </section>

      <section className="card stack" aria-labelledby="privacidade">
        <h2 id="privacidade" style={{ fontSize: 'var(--text-lg)' }}>Seus dados</h2>
        <ul className="small" style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>
          <li>Tudo fica <strong>apenas neste navegador, neste aparelho</strong> (armazenamento local). Não há conta nem sincronização com a nuvem.</li>
          <li>Nada do que você registra é enviado para nossos servidores.</li>
          <li>Se você limpar os dados do navegador ou trocar de aparelho, os registros não vêm junto. Exporte uma cópia se quiser guardar.</li>
          <li>Não pedimos fotos do rosto, documentos nem informações médicas.</li>
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>{daysWithData === 0 ? 'Nenhum dia registrado ainda.' : `${daysWithData} ${daysWithData === 1 ? 'dia registrado' : 'dias registrados'} neste aparelho.`}</p>
        <div className="row wrap">
          <button className="btn btn-secondary" onClick={exportData}><Download size={18} aria-hidden="true" /> Exportar meus dados</button>
          <button className="btn btn-danger" onClick={() => setConfirming(true)}><Trash2 size={18} aria-hidden="true" /> Apagar todos os dados</button>
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>
          Leia a <Link to="/privacidade">política de privacidade</Link> e os <Link to="/termos">termos de uso</Link>.
        </p>
      </section>

      <section className="card-beige stack" aria-labelledby="suporte">
        <h2 id="suporte" style={{ fontSize: 'var(--text-lg)' }}>Suporte</h2>
        {launch.supportEmail ? (
          <a className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} href={`mailto:${launch.supportEmail}`}><Mail size={18} aria-hidden="true" /> {launch.supportEmail}</a>
        ) : (
          <ConfigPending>e-mail de suporte (VITE_SUPPORT_EMAIL).</ConfigPending>
        )}
        <p className="xs muted" style={{ marginBottom: 0 }}>O suporte responde dúvidas sobre o e-book e o app. Não fazemos orientação médica individual.</p>
      </section>

      <ConfirmDialog
        open={confirming}
        title="Apagar todos os dados?"
        confirmLabel="Apagar tudo"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          resetAll();
          navigate('/app/boas-vindas', { replace: true });
        }}
      >
        <p>Isso remove preferências, rotina e diário deste aparelho. Não dá para desfazer. Se quiser guardar uma cópia, exporte antes.</p>
      </ConfirmDialog>
    </div>
  );
}
