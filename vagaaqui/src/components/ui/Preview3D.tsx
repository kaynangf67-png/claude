import gsap from 'gsap';
import { Box, Hand, Monitor, MousePointer2, Smartphone, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { actions, useApp } from '../../store/appStore';

const isTouch = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/** Modo de exploração livre (estilo mapa 3D) com guia de gestos para celular e computador. */
export function Preview3D() {
  const mode = useApp((s) => s.cameraMode);
  const is3d = useApp((s) => s.mapMode === '3d');
  const [showHelp, setShowHelp] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const touch = isTouch();

  useLayoutEffect(() => {
    if (mode !== 'preview') return;
    setShowHelp(true);
    if (ref.current) gsap.fromTo(ref.current, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.3 });
    const id = window.setTimeout(() => setShowHelp(false), 7000);
    return () => window.clearTimeout(id);
  }, [mode]);

  if (mode !== 'preview') return null;
  return (
    <div ref={ref} className="preview-overlay">
      <div className="preview-badge">
        <Box size={16} /> {is3d ? 'PREVIEW 3D' : 'EXPLORAR'} · toque nas vagas
        <button className="icon-btn ghost" onClick={() => actions.setCameraMode('follow')} aria-label="Sair do Preview 3D">
          <X size={18} />
        </button>
      </div>
      {showHelp && (
        <div className="gesture-help" onClick={() => setShowHelp(false)}>
          {touch ? (
            <>
              <h4>
                <Smartphone size={16} /> Gestos
              </h4>
              <ul>
                <li><Hand size={14} /> 1 dedo: arrastar para mover</li>
                <li>Pinçar: zoom</li>
                {is3d && <li>2 dedos para cima/baixo: inclinar</li>}
                <li>{is3d ? '2 dedos para os lados: girar' : '2 dedos: girar'}</li>
              </ul>
            </>
          ) : (
            <>
              <h4>
                <Monitor size={16} /> Controles
              </h4>
              <ul>
                <li><MousePointer2 size={14} /> Arrastar: mover</li>
                <li>Scroll: zoom (no ponto do cursor)</li>
                <li>Botão direito + arrastar: {is3d ? 'girar e inclinar' : 'girar'}</li>
                <li>Clique numa vaga: detalhes</li>
              </ul>
            </>
          )}
          <span className="muted small">toque para fechar</span>
        </div>
      )}
    </div>
  );
}
