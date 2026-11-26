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
  die: () => { noise(0.25, 0.35); tone({ f: 400, f2: 60, type: 'sawtooth', dur: 0.3, gain: 0.18 }); },
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
    const i = musicStep % 16;
    const b = song.bass[i], l = song.lead[i];
    if (b) tone({ f: b, type: 'triangle', dur: stepDur * 1.6, gain: 0.35, out: musicGain });
    if (l) tone({ f: l, type: 'square', dur: stepDur * 0.9, gain: 0.08, out: musicGain });
    musicStep++;
  }, stepDur * 1000);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null; currentSong = null;
}
