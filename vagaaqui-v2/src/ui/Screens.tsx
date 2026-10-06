import { useState } from 'react';
import { currentSession, signInWithGoogle, signOut } from '../app/auth';
import { clearMyData, removeFavorite, subscribeClick } from '../app/controller';
import { computeMetrics } from '../app/metrics';
import { isPro, proDaysLeft, REPORTS_PER_PRO_DAY } from '../app/plan';
import { getState, setState, useApp } from '../app/state';
import { config, hasBackend } from '../config';
import { getStore } from '../data/store';

function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="screen" role="dialog" aria-label={title}>
      <header className="screen-head">
        <button className="icon-btn ghost" aria-label="Voltar ao mapa" onClick={() => setState({ screen: 'map' })}>
          ←
        </button>
        <h2>{title}</h2>
      </header>
      <div className="screen-body">{children}</div>
    </div>
  );
}

export function AccountScreen() {
  const plan = useApp((s) => s.plan);
  const favorites = useApp((s) => s.favorites);
  const [session, setSession] = useState(currentSession());
  const pro = isPro(plan);
  const toNext = REPORTS_PER_PRO_DAY - (plan.reports % REPORTS_PER_PRO_DAY);
  return (
    <Screen title="Conta e plano">
      <div className={`plan-card ${pro ? 'pro' : ''}`}>
        <small>SEU PLANO</small>
        <h3>{pro ? `VagaAqui Pro · ${proDaysLeft(plan)} dia(s)` : 'Grátis'}</h3>
        <p>
          Faltam <b>{toNext}</b> relato{toNext > 1 ? 's' : ''} para ganhar +1 dia de Pro. Você já fez {plan.reports}.
        </p>
        <div className="progress">
          <div style={{ width: `${((REPORTS_PER_PRO_DAY - toNext) / REPORTS_PER_PRO_DAY) * 100}%` }} />
        </div>
      </div>

      <h4>O que o Pro libera</h4>
      <ul className="benefits">
        <li>🕑 Previsão para outro horário ("amanhã 8h no trabalho") e a hora de sair</li>
        <li>⭐ Favoritos ilimitados (grátis: 2)</li>
        <li>🧭 "Onde deixei o carro?" com rota a pé</li>
        <li>🚫 Sem anúncios, para sempre</li>
      </ul>
      <button className="btn primary big" onClick={subscribeClick} disabled={!config.checkoutUrl && plan.waitlisted}>
        {config.checkoutUrl ? `Assinar Pro · ${config.proPriceLabel}` : plan.waitlisted ? 'Você está na lista do Pro ✓' : `Quero o Pro (${config.proPriceLabel}) — entrar na lista`}
      </button>
      {!config.checkoutUrl && <p className="muted small">Pagamento ainda não ativo neste piloto. Estamos medindo quantos motoristas assinariam.</p>}

      <h4>Favoritos</h4>
      {favorites.length === 0 && <p className="muted">Salve Casa e Trabalho no cartão da previsão (☆ Salvar).</p>}
      {favorites.map((f) => (
        <div key={f.label} className="row">
          <span>
            <b>{f.label}</b> · {f.place.name}
          </span>
          <button className="link-btn" onClick={() => removeFavorite(f.label)}>
            remover
          </button>
        </div>
      ))}

      <h4>Conta</h4>
      {hasBackend() ? (
        session ? (
          <div className="row">
            <span>Conectado{session.email ? ` como ${session.email}` : ''}</span>
            <button
              className="link-btn"
              onClick={() => {
                signOut();
                setSession(null);
              }}
            >
              sair
            </button>
          </div>
        ) : (
          <button className="btn" onClick={signInWithGoogle}>
            Entrar com Google
          </button>
        )
      ) : (
        <p className="muted">Conta local e anônima neste aparelho (o servidor ainda não está configurado).</p>
      )}

      <div className="screen-links">
        <button className="link-btn" onClick={() => setState({ screen: 'settings' })}>
          ⚙ Configurações
        </button>
        <button className="link-btn" onClick={() => setState({ screen: 'metrics' })}>
          📊 Painel do piloto
        </button>
      </div>
    </Screen>
  );
}

export function SettingsScreen() {
  const settings = useApp((s) => s.settings);
  const set = (patch: Partial<typeof settings>) => setState({ settings: { ...getState().settings, ...patch } });
  return (
    <Screen title="Configurações">
      <h4>Aparência</h4>
      <div className="segmented" role="radiogroup" aria-label="Tema">
        {(
          [
            ['light', '☀ Claro'],
            ['dark', '☾ Escuro'],
            ['auto', 'Automático'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} role="radio" aria-checked={settings.theme === t} className={settings.theme === t ? 'on' : ''} onClick={() => set({ theme: t })}>
            {label}
          </button>
        ))}
      </div>
      <small className="muted">Automático segue o tema do celular. O mapa acompanha o tema.</small>

      <h4>Navegação</h4>
      <label className="toggle">
        <input type="checkbox" checked={settings.voice} onChange={(e) => set({ voice: e.target.checked })} />
        <span>
          Instruções por voz
          <small>"Em 100 metros, vire à direita…" — para não precisar olhar a tela.</small>
        </span>
      </label>

      <h4>Quanto você aceita andar</h4>
      <div className="segmented" role="radiogroup" aria-label="Raio de caminhada">
        {[200, 400, 600].map((r) => (
          <button key={r} role="radio" aria-checked={settings.radiusM === r} className={settings.radiusM === r ? 'on' : ''} onClick={() => set({ radiusM: r })}>
            {r} m
          </button>
        ))}
      </div>

      <h4>Detecção automática</h4>
      <label className="toggle">
        <input type="checkbox" checked={settings.autoDetect} onChange={(e) => set({ autoDetect: e.target.checked })} />
        <span>
          Perceber sozinho quando estaciono e quando saio da vaga
          <small>Usa o GPS só neste aparelho. Envia apenas "estacionou/saiu" e o trecho da rua — nunca seu trajeto.</small>
        </span>
      </label>

      <h4>Demonstração</h4>
      <label className="toggle">
        <input type="checkbox" checked={settings.demo && !hasBackend()} disabled={hasBackend()} onChange={(e) => set({ demo: e.target.checked })} />
        <span>
          Relatos simulados
          <small>{hasBackend() ? 'Desligado: o app está usando relatos reais do servidor.' : 'Para testar sem outros usuários. A tela sempre avisa quando há dados simulados.'}</small>
        </span>
      </label>

      <h4>Privacidade</h4>
      <button
        className="btn red"
        onClick={() => {
          if (confirm('Apagar seus relatos, favoritos e preferências deste aparelho?')) void clearMyData();
        }}
      >
        Apagar meus dados
      </button>
      <p className="muted small">
        Mapa © colaboradores do OpenStreetMap. Busca: Photon. Chances são estimativas — nunca garantia de vaga.
      </p>
    </Screen>
  );
}

export function MetricsScreen() {
  const m = computeMetrics(getStore().events());
  const pctOr = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
  const sec = (v: number | null) => (v === null ? '—' : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(1)} s`);
  const rows: [string, string, string][] = [
    ['Acerto da previsão', pctOr(m.hitRate), 'previsão ≥50% e achou, ou <50% e não achou'],
    ['Erro médio (Brier)', m.brier === null ? '—' : m.brier.toFixed(3), '0 = perfeito · 0,25 = chute'],
    ['Achou vaga na rua', pctOr(m.foundRate), `${m.answers} resposta(s) de chegada`],
    ['Tempo até a resposta', sec(m.medianOpenToAnswerMs), 'mediana, do abrir o app à previsão'],
    ['Cálculo da previsão', sec(m.medianForecastMs), 'mediana'],
    ['Relatos', String(m.reports), `${m.autoReports} automáticos · ${m.reportsPerWeek === null ? '—' : m.reportsPerWeek.toFixed(1)}/semana`],
    ['Aberturas / previsões', `${m.opens} / ${m.forecasts}`, ''],
    ['Navegações iniciadas', String(m.navigations), 'Waze/Google'],
    ['Interesse no Pro', `${m.subscribeClicks}`, `${m.waitlist} na lista de espera`],
  ];
  return (
    <Screen title="Painel do piloto">
      <p className="muted small">
        {hasBackend() ? 'Números deste aparelho. Os do piloto inteiro estão na view metrics_overview do Supabase.' : 'Números deste aparelho (sem servidor configurado).'}
      </p>
      <table className="metrics">
        <tbody>
          {rows.map(([k, v, d]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>
                <b>{v}</b>
                {d && <small>{d}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Screen>
  );
}
