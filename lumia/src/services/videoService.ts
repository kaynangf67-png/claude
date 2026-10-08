/**
 * VIDEO SERVICE — renditions, WebVTT e utilidades do player.
 */
import type { TimedCue } from '@/ai/types';
import type { CatalogItem, VideoRendition } from '@/types/content';

/** Converte "00:00:23.600" ou "00:23.600" em segundos. */
export function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(':');
  let s = 0;
  for (const p of parts) s = s * 60 + parseFloat(p.replace(',', '.'));
  return s;
}

/**
 * Parser WebVTT enxuto: cabeçalho, NOTE, identificadores de cue, timings,
 * configurações e <v Falante>. Outras tags (<i>, <b>, <c.classe>) são removidas.
 */
export function parseWebVTT(text: string): TimedCue[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (!lines[0]?.startsWith('WEBVTT')) throw new Error('Arquivo não é WebVTT');
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === '') {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) blocks.push(cur);
  const cues: TimedCue[] = [];
  blocks.forEach((b, i) => {
    if (b[0].startsWith('NOTE') || b[0].startsWith('STYLE') || b[0].startsWith('REGION')) return;
    let idx = 0;
    let id = `cue-${i}`;
    if (!b[0].includes('-->')) {
      id = b[0].trim();
      idx = 1;
    }
    const timing = b[idx];
    if (!timing || !timing.includes('-->')) return;
    const [a, rest] = timing.split('-->');
    const end = rest.trim().split(/\s+/)[0];
    const payload = b.slice(idx + 1).join('\n');
    const voice = payload.match(/<v(?:\.[^\s>]+)?\s+([^>]+)>/)?.[1]?.trim();
    const clean = payload.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    cues.push({ id, start: parseTimestamp(a), end: parseTimestamp(end), text: clean, voice });
  });
  return cues.sort((x, y) => x.start - y.start);
}

const vttCache = new Map<string, Promise<TimedCue[]>>();

export function loadWebVTT(src: string): Promise<TimedCue[]> {
  let p = vttCache.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`Falha ao carregar ${src} (${r.status})`);
        return r.text();
      })
      .then(parseWebVTT);
    p.catch(() => vttCache.delete(src));
    vttCache.set(src, p);
  }
  return p;
}

/** Cues ativos em t (podem ser vários, ex.: sons sobrepostos). */
export function activeCues(cues: TimedCue[], t: number): TimedCue[] {
  return cues.filter((c) => t >= c.start && t < c.end);
}

/**
 * Escolha automática de qualidade: usa a conexão (Network Information API,
 * quando existe) e o tamanho real do player. Sem a API, escolhe pela tela.
 */
export function pickAutoRendition(item: CatalogItem, playerHeightPx: number): VideoRendition | undefined {
  const r = item.video?.renditions ?? [];
  if (!r.length) return undefined;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string; downlink?: number } }).connection;
  const sorted = [...r].sort((a, b) => b.height - a.height);
  if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return sorted[sorted.length - 1];
  const target = playerHeightPx * Math.min(window.devicePixelRatio || 1, 2);
  return sorted.find((x) => x.height <= Math.max(target, 360) * 1.2) ?? sorted[sorted.length - 1];
}

let mp4Support: boolean | null = null;
/** Escolhe o arquivo que este navegador consegue decodificar. */
export function resolveSource(r: VideoRendition): string {
  if (mp4Support === null) {
    const v = document.createElement('video');
    mp4Support = v.canPlayType('video/mp4; codecs="avc1.4D401F, mp4a.40.2"') !== '';
  }
  return mp4Support || !r.webm ? r.src : r.webm;
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const h = Math.floor(m / 60);
  return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
