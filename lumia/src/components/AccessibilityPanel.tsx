import { Accessibility, X } from 'lucide-react';
import type { AccessibilityPrefs } from '@/services/accessibilityService';
import type { CatalogItem, SignLanguageCode } from '@/types/content';
import { SIGN_LANGUAGES } from '@/types/content';
import { Segmented, StatusChip, Switch } from './ui';

export interface AccessibilityPanelProps {
  prefs: AccessibilityPrefs;
  setPrefs: (p: Partial<AccessibilityPrefs>) => void;
  librasOn: boolean;
  setLibrasOn: (on: boolean) => void;
  item?: CatalogItem;
  onClose: () => void;
  embedded?: boolean; // dentro do player (absoluto) ou página
}

export function AccessibilitySettings({ prefs, setPrefs, librasOn, setLibrasOn, item }: Omit<AccessibilityPanelProps, 'onClose'>) {
  const pos = prefs.interpreterPosition;
  return (
    <>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>🤟</span>
          <div>
            <strong>Intérprete IA</strong>
            <small>Avatar 3D interpretando em língua de sinais</small>
          </div>
        </div>
        <Switch label="Intérprete IA" checked={librasOn} onChange={setLibrasOn} />
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>📏</span>
          <div>
            <strong>Tamanho do intérprete</strong>
            {prefs.interpreterWidth && <small>Personalizado ({Math.round(prefs.interpreterWidth * 100)}% da largura)</small>}
          </div>
        </div>
        <Segmented
          label="Tamanho do intérprete"
          value={prefs.interpreterWidth ? ('X' as never) : prefs.interpreterSize}
          onChange={(v) => setPrefs({ interpreterSize: v, interpreterWidth: null })}
          options={[
            { value: 'S', label: 'Pequeno' },
            { value: 'M', label: 'Médio' },
            { value: 'L', label: 'Grande' },
          ]}
        />
      </div>
      <div className="setting col">
        <div className="lbl">
          <span aria-hidden>📍</span>
          <div>
            <strong>Posição</strong>
            <small>{pos === 'custom' ? 'Personalizada — arraste o intérprete sobre o vídeo' : 'Arraste o intérprete para personalizar'}</small>
          </div>
        </div>
        <Segmented
          label="Posição do intérprete"
          value={pos}
          onChange={(v) => setPrefs({ interpreterPosition: v, customPosition: v === 'custom' ? prefs.customPosition ?? { x: 0.62, y: 0.3 } : null })}
          options={[
            { value: 'bottom-right', label: 'Inferior direito' },
            { value: 'bottom-left', label: 'Inferior esquerdo' },
            { value: 'custom', label: 'Personalizado' },
          ]}
        />
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>🛡️</span>
          <div>
            <strong>Não cobrir o essencial</strong>
            <small>Troca de canto se o intérprete cobrir rosto, ação ou texto importante</small>
          </div>
        </div>
        <Switch label="Não cobrir o essencial" checked={prefs.avoidImportantRegions} onChange={(v) => setPrefs({ avoidImportantRegions: v })} />
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>💬</span>
          <div>
            <strong>Legendas</strong>
            <small>Com nome de quem fala</small>
          </div>
        </div>
        <Switch label="Legendas" checked={prefs.captions} onChange={(v) => setPrefs({ captions: v })} />
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>🔠</span>
          <div>
            <strong>Tamanho da legenda</strong>
          </div>
        </div>
        <Segmented
          label="Tamanho da legenda"
          value={prefs.captionSize}
          onChange={(v) => setPrefs({ captionSize: v })}
          options={[
            { value: 'S', label: 'P' },
            { value: 'M', label: 'M' },
            { value: 'L', label: 'G' },
          ]}
        />
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>🔊</span>
          <div>
            <strong>Sons importantes</strong>
            <small>Porta batendo, telefone, silêncio repentino…</small>
          </div>
        </div>
        <Switch label="Sons importantes" checked={prefs.soundCues} onChange={(v) => setPrefs({ soundCues: v })} />
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>🎭</span>
          <div>
            <strong>Descrição emocional</strong>
            <small>Tom de cada fala e clima da cena</small>
          </div>
        </div>
        <Switch label="Descrição emocional" checked={prefs.emotionalDescription} onChange={(v) => setPrefs({ emotionalDescription: v })} />
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>🌓</span>
          <div>
            <strong>Alto contraste</strong>
          </div>
        </div>
        <Switch label="Alto contraste" checked={prefs.highContrast} onChange={(v) => setPrefs({ highContrast: v })} />
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>🧘</span>
          <div>
            <strong>Reduzir movimento</strong>
            <small>Desliga animações da interface (não do intérprete)</small>
          </div>
        </div>
        <Switch label="Reduzir movimento" checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} />
      </div>
      <div className="setting col">
        <div className="lbl">
          <span aria-hidden>🌍</span>
          <div>
            <strong>Língua de sinais</strong>
            <small>Libras, ASL e BSL são línguas diferentes — cada título informa o que tem.</small>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(Object.keys(SIGN_LANGUAGES) as SignLanguageCode[]).slice(0, 4).map((code) => {
            const av = item?.signLanguages.find((s) => s.language === code);
            const usable = av && av.source !== 'none';
            return (
              <button
                key={code}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between', borderColor: prefs.signLanguage === code ? 'var(--amber)' : undefined }}
                disabled={Boolean(item) && !usable}
                onClick={() => setPrefs({ signLanguage: code })}
                aria-pressed={prefs.signLanguage === code}
              >
                <span>
                  {SIGN_LANGUAGES[code].short} · {SIGN_LANGUAGES[code].country}
                </span>
                {item ? <StatusChip status={av?.status ?? 'NOT_AVAILABLE'} /> : <code style={{ fontSize: 11 }}>{code}</code>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="setting">
        <div className="lbl">
          <span aria-hidden>📈</span>
          <div>
            <strong>Diagnóstico de desempenho</strong>
            <small>FPS do avatar, quadros perdidos do vídeo, regiões protegidas</small>
          </div>
        </div>
        <Switch label="Diagnóstico" checked={prefs.diagnostics} onChange={(v) => setPrefs({ diagnostics: v })} />
      </div>
    </>
  );
}

export function AccessibilityPanel(props: AccessibilityPanelProps) {
  return (
    <>
      <div className="sheet-backdrop" onClick={props.onClose} />
      <aside className="sheet" aria-label="Acessibilidade" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>
            <Accessibility size={20} /> Acessibilidade
          </h2>
          <button className="icon-btn" aria-label="Fechar" onClick={props.onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="sheet-body">
          <AccessibilitySettings {...props} />
        </div>
      </aside>
    </>
  );
}
