import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, RotateCcw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { AVATAR_COLORS, updateProfile } from '@/services/authService';
import { AccessibilitySettings } from '@/components/AccessibilityPanel';
import { Segmented, Switch } from '@/components/ui';
import { PLANS, planFor } from '@/business/plans';
import type { AccessibilityPrefs } from '@/services/accessibilityService';
import { Footer } from '@/components/Footer';

export default function ProfilePage() {
  const { user, setUser, prefs, setPrefs, resetPrefs, toast } = useApp();
  const [draft, setDraft] = useState<AccessibilityPrefs>(prefs);
  const [name, setName] = useState(user?.name ?? '');
  const [color, setColor] = useState(user?.avatarColor ?? AVATAR_COLORS[0]);
  useEffect(() => setDraft(prefs), [prefs]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs) || (user && (name !== user.name || color !== user.avatarColor));
  const patch = (p: Partial<AccessibilityPrefs>) => setDraft((d) => ({ ...d, ...p }));

  const saveAll = () => {
    setPrefs(draft);
    if (user) {
      const u = updateProfile(user.id, { name: name.trim() || user.name, avatarColor: color });
      if (u) setUser(u);
    }
    toast('Preferências salvas. O player vai respeitá-las em todos os títulos.', 'success');
  };

  const plan = planFor(user?.plan ?? 'FREE');
  return (
    <main className="page" id="conteudo">
      <div className="container" style={{ maxWidth: 1100 }}>
        <p className="eyebrow">Perfil</p>
        <h1 className="serif" style={{ fontSize: 'clamp(40px,6vw,72px)', margin: '6px 0 26px' }}>
          {user ? user.name : 'Visitante'}
        </h1>
        <div className="split">
          <div className="panel">
            <h3>Conta</h3>
            {user ? (
              <>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
                  <span className="avatar-dot" style={{ width: 64, height: 64, fontSize: 26, background: color }}>
                    {(name || user.name).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>{user.provider === 'demo' ? 'Conta de demonstração' : user.email}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }} role="radiogroup" aria-label="Cor do avatar">
                      {AVATAR_COLORS.map((c) => (
                        <button key={c} role="radio" aria-checked={color === c} aria-label={`Cor ${c}`} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent' }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="pname">Nome</label>
                  <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </>
            ) : (
              <p className="muted">
                Você está como visitante — as preferências ficam salvas neste navegador. <Link to="/entrar" style={{ color: 'var(--amber)' }}>Entre ou crie uma conta</Link> para ter um perfil próprio.
              </p>
            )}
            <div className="setting">
              <div className="lbl">
                <div>
                  <strong>Idioma da interface</strong>
                  <small>Inglês: em breve (a interface ainda é só em português)</small>
                </div>
              </div>
              <Segmented label="Idioma" value={draft.uiLanguage} onChange={(v) => patch({ uiLanguage: v })} options={[{ value: 'pt-BR', label: 'Português' }]} />
            </div>
            <div className="setting">
              <div className="lbl">
                <div>
                  <strong>🎬 Modo cinema por padrão</strong>
                  <small>Abre o player ocupando a tela, com controles discretos</small>
                </div>
              </div>
              <Switch label="Modo cinema" checked={draft.cinemaMode} onChange={(v) => patch({ cinemaMode: v })} />
            </div>
            <div className="setting">
              <div className="lbl">
                <div>
                  <strong>🤟 Iniciar com intérprete ligado</strong>
                  <small>Em todo título com interpretação disponível</small>
                </div>
              </div>
              <Switch label="Iniciar com intérprete" checked={draft.interpreterEnabled} onChange={(v) => patch({ interpreterEnabled: v })} />
            </div>
            <h3 style={{ marginTop: 26 }}>Plano</h3>
            <p style={{ margin: '0 0 12px' }}>
              <span className="chip chip-amber">{plan.name}</span> <span className="muted" style={{ fontSize: 13 }}>· pagamentos ainda não implementados</span>
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {PLANS.map((p) => (
                <div key={p.tier} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span>
                    <strong>{p.name}</strong> <span className="muted">· {p.audience}</span>
                  </span>
                  <span className="muted" style={{ textAlign: 'right' }}>{p.highlights[0]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3>Preferências de acessibilidade</h3>
            <AccessibilitySettings prefs={draft} setPrefs={patch} librasOn={draft.interpreterEnabled} setLibrasOn={(v) => patch({ interpreterEnabled: v })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, margin: '22px 0 40px', position: 'sticky', bottom: 16, zIndex: 5 }}>
          <button className="btn btn-primary" onClick={saveAll} disabled={!dirty}>
            <Save size={18} /> Salvar preferências
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              resetPrefs();
              toast('Preferências restauradas.', 'info');
            }}
          >
            <RotateCcw size={18} /> Restaurar padrão
          </button>
        </div>
      </div>
      <Footer />
    </main>
  );
}
