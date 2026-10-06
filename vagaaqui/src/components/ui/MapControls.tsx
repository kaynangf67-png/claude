import { Box, ChevronDown, ChevronUp, Compass, LocateFixed, Map as MapIcon, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { actions, useApp } from '../../store/appStore';
import { cameraBus } from '../../store/cameraBus';

/** Botões de câmera (complementam os gestos) — úteis para quem não conhece os gestos 3D. */
export function MapControls() {
  const mode = useApp((s) => s.cameraMode);
  return (
    <div className="map-controls" aria-label="Controles do mapa">
      <button
        className={`ctrl ${mode === 'preview' ? 'active' : ''}`}
        onClick={() => actions.setCameraMode(mode === 'preview' ? 'follow' : 'preview')}
        aria-label="Preview 3D"
        title="Preview 3D"
      >
        <Box size={20} />
        <span className="ctrl-label">3D</span>
      </button>
      <div className="ctrl-group">
        <button className="ctrl" onClick={() => cameraBus.emit({ type: 'zoom', factor: 0.7 })} aria-label="Aproximar">
          <Plus size={20} />
        </button>
        <button className="ctrl" onClick={() => cameraBus.emit({ type: 'zoom', factor: 1.4 })} aria-label="Afastar">
          <Minus size={20} />
        </button>
      </div>
      <div className="ctrl-group ctrl-secondary">
        <button className="ctrl" onClick={() => cameraBus.emit({ type: 'rotate', radians: Math.PI / 6 })} aria-label="Girar à esquerda">
          <RotateCcw size={18} />
        </button>
        <button className="ctrl" onClick={() => cameraBus.emit({ type: 'rotate', radians: -Math.PI / 6 })} aria-label="Girar à direita">
          <RotateCw size={18} />
        </button>
      </div>
      <div className="ctrl-group ctrl-secondary">
        <button className="ctrl" onClick={() => cameraBus.emit({ type: 'tilt', radians: -0.18 })} aria-label="Inclinar mais (visão 3D)">
          <ChevronUp size={20} />
        </button>
        <button className="ctrl" onClick={() => cameraBus.emit({ type: 'tilt', radians: 0.18 })} aria-label="Visão mais de cima">
          <ChevronDown size={20} />
        </button>
      </div>
      <button className="ctrl" onClick={() => cameraBus.emit({ type: 'north' })} aria-label="Apontar para o norte">
        <Compass size={20} />
      </button>
      <button className="ctrl" onClick={() => cameraBus.emit({ type: 'overview' })} aria-label="Ver região inteira">
        <MapIcon size={20} />
      </button>
      <button
        className={`ctrl ${mode === 'follow' ? 'active' : ''}`}
        onClick={() => actions.setCameraMode('follow')}
        aria-label="Seguir meu carro"
      >
        <LocateFixed size={20} />
      </button>
    </div>
  );
}
