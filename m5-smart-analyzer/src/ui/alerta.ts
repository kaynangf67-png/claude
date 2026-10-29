import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Alerta de ENTRADA: som curto (Web Audio, sem arquivo), vibração no celular e o
 * título da aba piscando. O navegador só libera som depois de um toque do
 * usuário, por isso o alerta é ligado por um botão.
 */
const KEY = 'm5sa.alerta.v1';

export function useAlerta() {
  const [ligado, setLigado] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  // som destravado nesta visita (exige toque do usuário)
  const [somPronto, setSomPronto] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const disparados = useRef(new Set<string>());
  const tituloOriginal = useRef(typeof document !== 'undefined' ? document.title : '');
  const pisca = useRef<number | null>(null);

  const destravar = useCallback(() => {
    try {
      ctx.current ??= new AudioContext();
      void ctx.current.resume();
      setSomPronto(true);
    } catch { /* sem Web Audio: segue só com vibração e título */ }
  }, []);

  const alternar = useCallback(() => {
    const novo = !ligado;
    setLigado(novo);
    try { localStorage.setItem(KEY, novo ? '1' : '0'); } catch { /* preferência não essencial */ }
    if (novo) destravar();
  }, [ligado, destravar]);

  const tocar = useCallback(() => {
    const c = ctx.current;
    if (c && c.state === 'running') {
      [0, 0.18].forEach((dt, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = i ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, c.currentTime + dt);
        g.gain.exponentialRampToValueAtTime(0.3, c.currentTime + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dt + 0.16);
        o.connect(g).connect(c.destination);
        o.start(c.currentTime + dt);
        o.stop(c.currentTime + dt + 0.17);
      });
    }
    try { navigator.vibrate?.([200, 80, 200]); } catch { /* sem vibração */ }
  }, []);

  /** Dispara uma vez por chave (par + zona + candle). Devolve true se disparou. */
  const avisar = useCallback((chave: string, texto: string): boolean => {
    if (!ligado || disparados.current.has(chave)) return false;
    disparados.current.add(chave);
    tocar();
    if (pisca.current !== null) window.clearInterval(pisca.current);
    let n = 0;
    pisca.current = window.setInterval(() => {
      document.title = n % 2 ? tituloOriginal.current : `● ${texto}`;
      if (++n > 12) { window.clearInterval(pisca.current!); pisca.current = null; document.title = tituloOriginal.current; }
    }, 700);
    return true;
  }, [ligado, tocar]);

  useEffect(() => () => {
    if (pisca.current !== null) window.clearInterval(pisca.current);
    document.title = tituloOriginal.current;
  }, []);

  return { ligado, somPronto, alternar, destravar, avisar };
}
