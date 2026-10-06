import { Car, Settings, User } from 'lucide-react';
import { actions, useApp } from '../../store/appStore';
import { LogoMark, Wordmark } from './Logo';
import { PointsChip } from './RewardSystem';

export function TopBar() {
  const driverMode = useApp((s) => s.driverMode);
  return (
    <div className="topbar">
      <div className="brand">
        <LogoMark size={30} />
        <Wordmark className="brand-name" />
      </div>
      <div className="topbar-actions">
        <PointsChip />
        <button
          className={`icon-btn ${driverMode ? 'active' : ''}`}
          onClick={actions.toggleDriverMode}
          aria-label="Modo Motorista"
          title="Modo Motorista"
        >
          <Car size={20} />
        </button>
        <button className="icon-btn" onClick={() => actions.setPanel('profile')} aria-label="Perfil" title="Perfil">
          <User size={20} />
        </button>
        <button className="icon-btn" onClick={() => actions.setPanel('settings')} aria-label="Configurações" title="Configurações">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}

/** Atribuição obrigatória pela licença ODbL quando o mapa usa dados do OpenStreetMap. */
export function MapAttribution() {
  const origin = useApp((s) => s.cityOrigin);
  if (!origin || origin === 'procedural') {
    return <div className="attribution">Cidade de demonstração (fictícia)</div>;
  }
  return (
    <div className="attribution">
      Ruas e prédios ©{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        colaboradores do OpenStreetMap
      </a>
    </div>
  );
}

export function NoticeBar() {
  const notice = useApp((s) => s.notice);
  if (!notice) return null;
  return <div className={`notice ${notice.tone}`}>{notice.text}</div>;
}
