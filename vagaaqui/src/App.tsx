import gsap from 'gsap';
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { SplashScreen } from './components/splash/SplashScreen';
import { BottomPanel, Legend } from './components/ui/BottomPanel';
import { DriverMode } from './components/ui/DriverMode';
import { MapControls } from './components/ui/MapControls';
import { NavigationControls } from './components/ui/NavigationControls';
import { Preview3D } from './components/ui/Preview3D';
import { RewardSystem } from './components/ui/RewardSystem';
import { SearchBar } from './components/ui/SearchBar';
import { SettingsPanel } from './components/ui/SettingsPanel';
import { NoticeBar, TopBar } from './components/ui/TopBar';
import { UserConfirmation } from './components/ui/UserConfirmation';
import { UserProfile } from './components/ui/UserProfile';
import { actions, useApp } from './store/appStore';

const loadMap = () => import('./components/map/Map3D');
const Map3D = lazy(loadMap);

class MapErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="map-fallback">
          <h2>Não foi possível iniciar o mapa 3D</h2>
          <p>Seu navegador ou aparelho não suporta WebGL 2. Atualize o navegador ou ative a aceleração de hardware.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const phase = useApp((s) => s.phase);
  const driverMode = useApp((s) => s.driverMode);
  const panel = useApp((s) => s.panel);
  const navStatus = useApp((s) => s.navStatus);
  const [mapReady, setMapReady] = useState(false);
  const mapLayer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void actions.init();
    // pré-carrega o bundle 3D enquanto a abertura anima
    loadMap().then(() => setMapReady(true));
  }, []);

  useEffect(() => {
    if (phase === 'map' && mapLayer.current) {
      gsap.fromTo(mapLayer.current, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out' });
      gsap.fromTo('.hud-anim', { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, delay: 0.5 });
    }
  }, [phase]);

  return (
    <div className={`app ${driverMode ? 'driver-on' : ''} ${navStatus === 'navigating' ? 'nav-on' : ''}`}>
      <div ref={mapLayer} className="map-layer" style={{ opacity: phase === 'map' ? 1 : 0 }}>
        {mapReady && (
          <MapErrorBoundary>
            <Suspense fallback={null}>
              <Map3D />
            </Suspense>
          </MapErrorBoundary>
        )}
      </div>

      {phase === 'splash' && <SplashScreen ready={mapReady} onStart={() => void actions.enterMap()} />}

      {phase === 'map' && (
        <div className="hud">
          {driverMode ? (
            <DriverMode />
          ) : (
            <>
              <div className="hud-top">
                <div className="hud-anim">
                  <TopBar />
                </div>
                <div className="hud-anim">
                  <SearchBar />
                </div>
                <div className="hud-anim">
                  <Legend />
                </div>
              </div>
              <NavigationControls />
              <div className="hud-anim hud-right">
                <MapControls />
              </div>
              <Preview3D />
              <div className="hud-bottom">
                <BottomPanel />
              </div>
            </>
          )}
          <NoticeBar />
          <UserConfirmation />
          <RewardSystem />
          {panel === 'profile' && <UserProfile />}
          {panel === 'settings' && <SettingsPanel />}
          {panel && <div className="panel-backdrop" onClick={() => actions.setPanel(null)} />}
        </div>
      )}
    </div>
  );
}
