/**
 * Voz da navegação.
 * 1º tenta a voz humanizada do servidor (/api/tts → Google Chirp 3 HD ou ElevenLabs);
 * se não estiver configurada/der erro, usa a melhor voz pt-BR do próprio celular.
 * `stop()` corta a fala NA HORA (áudio tocando, fila do sistema e áudios ainda baixando).
 */
export type VoiceEngine = 'natural' | 'device' | 'none';

let current: HTMLAudioElement | null = null;
/** cada fala/parada incrementa: áudio que chegar atrasado de uma fala antiga é descartado */
let generation = 0;
let naturalUnavailable = false;
let lastEngine: VoiceEngine = 'none';
const cache = new Map<string, string>(); // texto → objectURL do MP3

export const voiceEngine = () => lastEngine;

const RANK = [/natural|neural|online/i, /google/i, /luciana|francisca|thalita|maria|vit[oó]ria/i];

/** melhor voz pt-BR instalada (as "naturais" do Edge/Android/iPhone primeiro) */
export function pickDeviceVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const pt = voices.filter((v) => /^pt[-_]BR/i.test(v.lang));
  const pool = pt.length ? pt : voices.filter((v) => /^pt/i.test(v.lang));
  if (!pool.length) return null;
  const score = (v: SpeechSynthesisVoice) => RANK.reduce((s, re, i) => s + (re.test(v.name) ? 10 - i * 3 : 0), 0) + (v.localService ? 0 : 1);
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

function speakDevice(text: string, gen: number) {
  if (!('speechSynthesis' in window) || gen !== generation) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    const v = pickDeviceVoice(window.speechSynthesis.getVoices());
    if (v) u.voice = v;
    u.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    lastEngine = 'device';
  } catch {
    /* aparelho sem voz */
  }
}

async function naturalAudio(text: string): Promise<string | null> {
  const hit = cache.get(text);
  if (hit) return hit;
  if (naturalUnavailable) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`, { signal: ctrl.signal });
    if (res.status === 501 || res.status === 404) naturalUnavailable = true; // não configurada: não tenta de novo
    if (!res.ok || !(res.headers.get('Content-Type') || '').includes('audio')) return null;
    const url = URL.createObjectURL(await res.blob());
    cache.set(text, url);
    if (cache.size > 60) {
      const [k, v] = cache.entries().next().value!;
      URL.revokeObjectURL(v);
      cache.delete(k);
    }
    return url;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function speak(text: string) {
  stop();
  const gen = ++generation;
  const url = await naturalAudio(text);
  if (gen !== generation) return; // foi silenciado/substituído enquanto baixava
  if (!url) return speakDevice(text, gen);
  const a = new Audio(url);
  current = a;
  lastEngine = 'natural';
  a.play().catch(() => {
    // navegador bloqueou o áudio (sem interação) → voz do aparelho
    if (gen === generation) speakDevice(text, gen);
  });
}

/** Silencia imediatamente. */
export function stop() {
  generation++;
  if (current) {
    current.pause();
    current.src = '';
    current = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** Pré-carrega frases fixas para tocarem sem atraso. */
export function warm(texts: string[]) {
  texts.forEach((t) => void naturalAudio(t));
}

// as vozes do sistema carregam de forma assíncrona em alguns navegadores
if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.getVoices();
