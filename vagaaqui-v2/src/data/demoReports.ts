import { priorFree } from '../model/prior';
import type { Report, ReportKind, Segment } from '../model/types';

/** gerador pseudoaleatório determinístico (mulberry32) */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * RELATOS SIMULADOS para demonstrar o app sem usuários reais.
 * Marcados com `simulated: true`, nunca enviados ao servidor, e a tela avisa.
 * Estáveis dentro de janelas de 5 min (não "piscam" a cada atualização).
 */
export function demoReports(segments: Segment[], now: number): Report[] {
  const bucket = Math.floor(now / 300000);
  const out: Report[] = [];
  for (const s of segments) {
    if (s.noParking) continue;
    const r = rng(hash(s.id) ^ bucket);
    if (r() > 0.3) continue;
    const pFree = priorFree(s, new Date(now));
    const n = r() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const roll = r();
      const kind: ReportKind = roll < pFree * 0.5 ? 'left' : roll < pFree ? 'free' : 'full';
      out.push({ id: `sim-${s.id}-${bucket}-${i}`, segmentId: s.id, kind, at: now - Math.floor(r() * 40 * 60000), trust: 1, simulated: true });
    }
  }
  return out;
}
