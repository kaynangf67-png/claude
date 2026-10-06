import { Camera, Cpu, Database, Gauge, LocateFixed, Map as MapIcon, Volume2, X } from 'lucide-react';
import { env } from '../../config/env';
import { DATA_SOURCES } from '../../services/dataSources/registry';
import { repository } from '../../services/repository';
import { speechSupported } from '../../services/speech';
import { actions, effectiveTier, useApp } from '../../store/appStore';
import { clearCityCache, getCity } from '../../world/cityStore';

const ORIGIN_LABEL = {
  snapshot: 'OpenStreetMap (snapshot do projeto)',
  cache: 'OpenStreetMap (cache deste aparelho)',
  live: 'OpenStreetMap (baixado agora)',
  procedural: 'cidade de demonstração (fictícia)',
} as const;

const GPS_LABEL = {
  off: 'Desligado — usando o carro simulado',
  waiting: 'Aguardando sinal (GPS fraco ou parado)…',
  ok: 'Ativo: o carro no mapa segue você',
  outside: 'Você está fora da área do mapa (usando o carro simulado)',
  denied: 'Permissão negada no navegador',
  unavailable: 'GPS indisponível',
} as const;

const TIER_LABEL = { low: 'Leve', medium: 'Equilibrada', high: 'Máxima' } as const;

export function SettingsPanel() {
  const quality = useApp((s) => s.qualityOverride);
  const detected = useApp((s) => s.detectedTier);
  const tier = useApp(effectiveTier);
  const voice = useApp((s) => s.voice);
  const showBuildings = useApp((s) => s.showBuildings);
  const simSpeed = useApp((s) => s.simSpeed);
  const locationSource = useApp((s) => s.locationSource);
  const gps = useApp((s) => s.gps);
  const cityOrigin = useApp((s) => s.cityOrigin);
  const city = getCity();

  return (
    <aside className="panel" role="dialog" aria-label="Configurações">
      <header className="panel-head">
        <h2>Configurações</h2>
        <button className="icon-btn ghost" onClick={() => actions.setPanel(null)} aria-label="Fechar">
          <X size={20} />
        </button>
      </header>

      <h4 className="section-title">
        <Cpu size={16} /> Qualidade gráfica
      </h4>
      <p className="muted small">
        Detectado: {TIER_LABEL[detected]} · em uso: {TIER_LABEL[tier]}. Em aparelhos fracos reduzimos prédios, carros, partículas,
        sombras e resolução automaticamente.
      </p>
      <div className="segmented">
        {(['auto', 'low', 'medium', 'high'] as const).map((q) => (
          <button key={q} className={quality === q ? 'active' : ''} onClick={() => actions.setQuality(q)}>
            {q === 'auto' ? 'Auto' : TIER_LABEL[q]}
          </button>
        ))}
      </div>

      <h4 className="section-title">
        <LocateFixed size={16} /> Localização em tempo real
      </h4>
      <label className="switch-row">
        <span>
          Usar o GPS do aparelho
          <small className="muted small" style={{ display: 'block' }}>
            {GPS_LABEL[gps.status]}
            {gps.accuracy != null ? ` · precisão ±${Math.round(gps.accuracy)} m` : ''}
          </small>
        </span>
        <input
          type="checkbox"
          checked={gps.status !== 'off' && gps.status !== 'denied' && gps.status !== 'unavailable'}
          onChange={(e) => (e.target.checked ? actions.enableGps() : actions.disableGps())}
        />
      </label>
      <p className="muted small">GPS de celular erra de 5 a 15 m na cidade: ele mostra onde você está, mas não enxerga as vagas.</p>
      <button className="btn btn-secondary btn-block" onClick={() => actions.setCameraSensorOpen(true)}>
        <Camera size={18} /> Sensor de câmera (protótipo)
      </button>

      <h4 className="section-title">
        <Volume2 size={16} /> Voz
      </h4>
      <label className="switch-row">
        <span>Instruções faladas {speechSupported() ? '' : '(indisponível neste navegador)'}</span>
        <input type="checkbox" checked={voice} onChange={actions.toggleVoice} disabled={!speechSupported()} />
      </label>

      <h4 className="section-title">
        <Gauge size={16} /> Simulação
      </h4>
      <p className="muted small">Velocidade do carro simulado e do tempo nesta demonstração.</p>
      <div className="segmented">
        {([1, 2, 4] as const).map((s) => (
          <button key={s} className={simSpeed === s ? 'active' : ''} onClick={() => actions.setSimSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
      <p className="muted small">
        Localização: {locationSource === 'gps' ? 'GPS do aparelho' : 'simulada'} · Backend:{' '}
        {repository.kind === 'http' ? env.apiUrl : 'mock local'}
      </p>

      <h4 className="section-title">
        <MapIcon size={16} /> Mapa
      </h4>
      <p className="muted small">
        Ruas: {cityOrigin ? ORIGIN_LABEL[cityOrigin] : '—'}
        {city.fetchedAt ? ` · dados de ${new Date(city.fetchedAt).toLocaleDateString('pt-BR')}` : ''} · {city.edges.size} trechos,{' '}
        {city.buildings.length} prédios. {city.source === 'osm' ? 'Alturas sem tag no OSM são estimadas.' : ''}
      </p>
      <label className="switch-row">
        <span>Prédios 3D (o mapa limpo mostra só ruas, vagas e carros)</span>
        <input type="checkbox" checked={showBuildings} onChange={actions.toggleBuildings} />
      </label>
      <button
        className="btn btn-ghost btn-block"
        onClick={() => {
          clearCityCache();
          window.location.reload();
        }}
      >
        Baixar o mapa novamente
      </button>

      <h4 className="section-title">
        <Database size={16} /> Sistema de detecção — fontes de dados
      </h4>
      <ul className="sources">
        {DATA_SOURCES.map((s) => (
          <li key={s.id} className={s.enabled ? 'on' : ''}>
            <div className="source-head">
              <strong>{s.name}</strong>
              <span className={`tag ${s.enabled ? 'tag-on' : ''}`}>{s.enabled ? 'ativa (simulada)' : 'preparada'}</span>
            </div>
            <p className="muted small">{s.limitations}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
