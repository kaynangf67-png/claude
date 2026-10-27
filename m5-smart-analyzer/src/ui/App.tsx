import type { ReactNode } from 'react';
import { StoreProvider, useStore, type Tab } from './store';
import { Dashboard } from './Dashboard';
import { ChartPage } from './ChartPage';
import { FiltersPage } from './FiltersPage';
import { HistoryPage } from './HistoryPage';
import { SettingsPage } from './SettingsPage';
import { LivePage } from './LivePage';
import { LiveProvider } from './live';
import { RISK_NOTICE, Status } from './kit';
import { formatDateTime } from '../core/time';

const TABS: Array<{ id: Tab; label: string; short: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', short: 'Painel', icon: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" /> },
  { id: 'grafico', label: 'Gráfico', short: 'Gráfico', icon: <path d="M5 19V9m4 10V5m4 14v-7m4 7V8M3 21h18" /> },
  { id: 'filtros', label: 'Filtros', short: 'Filtros', icon: <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" /> },
  { id: 'aovivo', label: 'Ao vivo', short: 'Ao vivo', icon: <path d="M3 12h4l3-8 4 16 3-8h4" /> },
  { id: 'historico', label: 'Histórico', short: 'Histórico', icon: <path d="M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /> },
  { id: 'configuracoes', label: 'Configurações', short: 'Config.', icon: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1.5-2-3.5-2.3.8a7 7 0 0 0-1.7-1L14.5 4h-4l-.5 2.8a7 7 0 0 0-1.7 1L6 7 4 10.5 6 12l-2 1.5L6 17l2.3-.8a7 7 0 0 0 1.7 1L10.5 20h4l.5-2.8a7 7 0 0 0 1.7-1L19 17l2-3.5L19 12Z" /> },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function SourceBadge() {
  const { data, displayTimezone } = useStore();
  if (!data) return <Status tone="mute">Sem dados carregados</Status>;
  const s = data.source;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {s.synthetic ? <Status tone="warn">DADOS FICTÍCIOS</Status> : s.kind === 'binance_live' ? <Status tone="pos">AO VIVO · Binance (cripto)</Status> : <Status tone="info">CSV importado</Status>}
      <span className="max-w-[28ch] truncate text-xs text-muted" title={s.name}>{s.name}</span>
      <span className="num text-xs text-faint">até {formatDateTime(s.lastT, displayTimezone)}</span>
    </div>
  );
}

function Shell() {
  const { tab, setTab, storageWarning } = useStore();
  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav aria-label="Navegação principal" className="hidden w-52 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="px-4 py-4">
          <div className="text-[15px] font-semibold tracking-tight">M5 Smart Analyzer</div>
          <div className="text-[11px] text-faint">Retração · M5 · análise informativa</div>
        </div>
        <ul className="flex flex-col gap-0.5 px-2">
          {TABS.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] ${tab === t.id ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
              >
                <Icon>{t.icon}</Icon>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-auto p-4 text-[11px] leading-snug text-faint">{RISK_NOTICE}</p>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2.5">
          <span className="text-[14px] font-semibold md:hidden">M5 Smart Analyzer</span>
          <SourceBadge />
        </header>
        {storageWarning && <div role="alert" className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-xs text-warn">{storageWarning}</div>}
        <main className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'grafico' && <ChartPage />}
          {tab === 'filtros' && <FiltersPage />}
          {tab === 'aovivo' && <LivePage />}
          {tab === 'historico' && <HistoryPage />}
          {tab === 'configuracoes' && <SettingsPage />}
          <p className="mt-6 text-[11px] leading-snug text-faint md:hidden">{RISK_NOTICE}</p>
        </main>
        <nav aria-label="Navegação principal (celular)" className="grid grid-cols-6 border-t border-line bg-surface md:hidden">
          {TABS.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              aria-label={t.label}
              className={`flex min-w-0 flex-col items-center gap-0.5 py-2 text-[10px] ${tab === t.id ? 'text-ink' : 'text-faint'}`}
            >
              <Icon>{t.icon}</Icon>
              {t.short}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <LiveProvider>
        <Shell />
      </LiveProvider>
    </StoreProvider>
  );
}
