import { lazy, Suspense, useEffect } from 'react';
import { init } from './app/controller';
import { useApp } from './app/state';
import { installTheme } from './app/theme';
import { ForecastCard } from './ui/ForecastCard';
import { NavPanel } from './ui/NavPanel';
import { ArrivalPrompt, ParkedBar } from './ui/Prompts';
import { AccountScreen, MetricsScreen, SettingsScreen } from './ui/Screens';
import { SearchBar } from './ui/SearchBar';

// O mapa (MapLibre) é o maior pedaço: carrega em paralelo, a busca já funciona antes.
const MapView = lazy(() => import('./ui/MapView'));

const GPS_TEXT: Record<string, string> = {
  searching: 'Procurando GPS…',
  weak: 'GPS impreciso',
  denied: 'GPS negado — usando o centro da cidade',
  unavailable: 'Sem GPS neste aparelho',
};

export default function App() {
  const screen = useApp((s) => s.screen);
  const gps = useApp((s) => s.gps);
  const toast = useApp((s) => s.toast);
  const hasDest = useApp((s) => Boolean(s.dest));
  const navigating = useApp((s) => Boolean(s.nav));

  useEffect(() => installTheme(), []);
  useEffect(() => init(), []);

  return (
    <div className="app">
      <Suspense fallback={<div className="map map-loading" />}>
        <MapView />
      </Suspense>
      {!navigating && <SearchBar />}
      {GPS_TEXT[gps.status] && !navigating && (
        <div className={`gps-pill ${gps.status}`}>
          {GPS_TEXT[gps.status]}
          {gps.status === 'weak' && gps.accuracy ? ` (±${Math.round(gps.accuracy)} m)` : ''}
        </div>
      )}
      {!hasDest && !navigating && (
        <button className="fab" aria-label="Centralizar em mim" onClick={() => window.dispatchEvent(new Event('vq:recenter'))}>
          ◎
        </button>
      )}
      <ForecastCard />
      <NavPanel />
      <ParkedBar />
      <ArrivalPrompt />
      {screen === 'account' && <AccountScreen />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'metrics' && <MetricsScreen />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
