// Efeitos sonoros e música chiptune sintetizados com WebAudio.
let ctx = null, sfxGain = null, musicGain = null;
let musicTimer = null, musicStep = 0, currentSong = null;
const vol = { sfx: 0.6, music: 0.35 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx; sfxGain.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = vol.music; musicGain.connect(ctx.destination);
}

export const audioReady = () => !!ctx;

export function setVolumes({ sfx, music }) {
  if (sfx != null) vol.sfx = sfx;
  if (music != null) vol.music = music;
  if (sfxGain) sfxGain.gain.value = vol.sfx;
  if (musicGain) musicGain.gain.value = vol.music;
}

function tone({ f = 440, f2, type = 'square', dur = 0.1, gain = 0.3, delay = 0, out = sfxGain }) {
  if (!ctx || !out) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur = 0.2, gain = 0.3, delay = 0) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = gain;
  src.buffer = buf; src.connect(g); g.connect(sfxGain);
  src.start(ctx.currentTime + delay);
}

export const sfx = {
  jump: () => tone({ f: 320, f2: 640, dur: 0.09, gain: 0.18 }),
  walljump: () => tone({ f: 420, f2: 840, dur: 0.08, gain: 0.18 }),
  land: () => tone({ f: 120, f2: 60, type: 'triangle', dur: 0.06, gain: 0.2 }),
  coin: () => { tone({ f: 988, dur: 0.06, gain: 0.15 }); tone({ f: 1319, dur: 0.12, gain: 0.15, delay: 0.06 }); },
  spring: () => tone({ f: 200, f2: 900, type: 'triangle', dur: 0.2, gain: 0.3 }),
  die: () => faaa(),
  checkpoint: () => [523, 659, 784].forEach((f, i) => tone({ f, dur: 0.1, gain: 0.15, delay: i * 0.07 })),
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.18, gain: 0.18, delay: i * 0.1 })),
  record: () => [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => tone({ f, dur: 0.14, gain: 0.16, delay: i * 0.09 })),
  crumble: () => noise(0.12, 0.12),
  bossHit: () => { tone({ f: 180, f2: 90, type: 'square', dur: 0.2, gain: 0.3 }); noise(0.15, 0.2); },
  bossDown: () => { noise(0.6, 0.35); [392, 330, 262, 196].forEach((f, i) => tone({ f, dur: 0.2, gain: 0.2, delay: i * 0.12 })); },
  bossShoot: () => tone({ f: 700, f2: 300, type: 'sawtooth', dur: 0.12, gain: 0.1 }),
  bossLand: () => tone({ f: 80, f2: 40, type: 'triangle', dur: 0.2, gain: 0.35 }),
  beep: () => tone({ f: 660, dur: 0.12, gain: 0.2 }),
  go: () => tone({ f: 1320, dur: 0.3, gain: 0.22 }),
  click: () => tone({ f: 900, dur: 0.03, gain: 0.08, type: 'triangle' }),
  buy: () => [660, 880, 1320].forEach((f, i) => tone({ f, dur: 0.1, gain: 0.15, delay: i * 0.06 })),
  error: () => tone({ f: 200, f2: 150, dur: 0.18, gain: 0.15 }),
};

// ---- música: sequência simples (baixo + melodia) por mundo
const N = (s) => s.split(' ').map((x) => (x === '-' ? 0 : 440 * 2 ** ((x - 69) / 12)));
const SONGS = {
  1: { bpm: 140, bass: N('48 - 48 - 55 - 55 - 53 - 53 - 55 - 55 -'), lead: N('72 - 76 79 - 76 74 - 72 - 74 76 77 - 79 -') },
  2: { bpm: 120, bass: N('45 - 45 - 48 - 48 - 43 - 43 - 40 - 40 -'), lead: N('69 - 72 - 76 - 74 72 71 - 72 - 69 - - -') },
  3: { bpm: 130, bass: N('50 - 57 - 50 - 57 - 48 - 55 - 48 - 55 -'), lead: N('74 76 78 - 81 - 78 76 74 - 73 - 74 - - -') },
  4: { bpm: 160, bass: N('40 40 - 40 43 - 40 - 38 38 - 38 41 - 38 -'), lead: N('64 - 67 - 70 - 69 67 64 - 62 - 64 - - -') },
  // tema do menu (composição própria, 32 passos, com bateria)
  menu: {
    bpm: 132,
    bass: N('45 - 45 57 45 - 45 57 41 - 41 53 41 - 41 53 48 - 48 60 48 - 48 60 43 - 43 55 43 - 47 55'),
    lead: N('69 - 72 - 76 - 74 72 - - 72 74 76 - 77 76 74 - 72 - 71 - 72 74 - - 71 - 67 - - -'),
    arp: N('81 76 72 76 81 76 72 76 77 72 69 72 77 72 69 72 84 79 76 79 84 79 76 79 79 74 71 74 79 74 71 74'),
    drums: 'k-h-s-h-k-h-s-hhk-h-s-h-k-h-s-hh',
  },
  0: { bpm: 150, bass: N('45 - 52 - 45 - 52 - 41 - 48 - 43 - 50 -'), lead: N('69 72 76 - 74 72 - 69 67 - 69 - 72 - 74 -') },
};

export function playMusic(id) {
  if (!ctx) return;
  if (currentSong === id && musicTimer) return;
  stopMusic();
  const song = SONGS[id] || SONGS[0];
  currentSong = id;
  musicStep = 0;
  const stepDur = 60 / song.bpm / 2;
  musicTimer = setInterval(() => {
    const len = song.bass.length;
    const i = musicStep % len;
    const b = song.bass[i], l = song.lead[i % song.lead.length];
    if (b) tone({ f: b, type: 'triangle', dur: stepDur * 1.6, gain: 0.35, out: musicGain });
    if (l) tone({ f: l, type: 'square', dur: stepDur * 0.9, gain: 0.08, out: musicGain });
    if (song.arp) { const a = song.arp[i % song.arp.length]; if (a) tone({ f: a, type: 'square', dur: stepDur * 0.4, gain: 0.025, out: musicGain }); }
    if (song.drums) {
      const d = song.drums[i % song.drums.length];
      if (d === 'k') tone({ f: 140, f2: 45, type: 'sine', dur: 0.14, gain: 0.5, out: musicGain });
      else if (d === 's') drum(0.12, 0.18, 1200);
      else if (d === 'h') drum(0.03, 0.06, 6000);
    }
    musicStep++;
  }, stepDur * 1000);
}

// percussão (ruído filtrado) para a música
function drum(dur, gain, freq) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = gain;
  src.buffer = buf; src.connect(f); f.connect(g); g.connect(musicGain);
  src.start();
}

// "FAAAA!" da morte: voz sintetizada (ruído do "F" + vogal "A" com formantes), sem gravação externa.
function faaa() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = 0.9; out.connect(sfxGain);
  // "F": sopro de ruído agudo
  const len = Math.floor(ctx.sampleRate * 0.16);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const nd = buf.getChannelData(0);
  for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(); ns.buffer = buf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.35, t + 0.04); ng.gain.linearRampToValueAtTime(0.0001, t + 0.16);
  ns.connect(hp); hp.connect(ng); ng.connect(out); ns.start(t); ns.stop(t + 0.17);
  // "AAAA": pregas vocais (dente de serra) + formantes da vogal "a", com a voz caindo no fim
  const src = ctx.createOscillator(); src.type = 'sawtooth';
  src.frequency.setValueAtTime(260, t + 0.1);
  src.frequency.linearRampToValueAtTime(230, t + 0.5);
  src.frequency.exponentialRampToValueAtTime(120, t + 1.15);
  const vib = ctx.createOscillator(); vib.frequency.value = 6;
  const vibG = ctx.createGain(); vibG.gain.value = 6; vib.connect(vibG); vibG.connect(src.frequency);
  const vg = ctx.createGain();
  vg.gain.setValueAtTime(0.0001, t + 0.1); vg.gain.linearRampToValueAtTime(1, t + 0.18);
  vg.gain.setValueAtTime(1, t + 0.85); vg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  src.connect(vg);
  for (const [f, q, g] of [[800, 6, 1], [1200, 8, 0.6], [2600, 10, 0.25]]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const fg = ctx.createGain(); fg.gain.value = g * 0.9;
    vg.connect(bp); bp.connect(fg); fg.connect(out);
  }
  src.start(t + 0.1); vib.start(t + 0.1); src.stop(t + 1.25); vib.stop(t + 1.25);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null; currentSong = null;
}
