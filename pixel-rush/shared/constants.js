// Constantes compartilhadas entre cliente e servidor.
// A simulação usa apenas + - * / e comparações em ponto flutuante (IEEE-754),
// o que garante resultados idênticos no navegador e no servidor.
export const TPS = 60;                 // ticks por segundo (passo fixo)
export const TILE = 16;                // pixels por tile
export const VIEW_W = 384;             // resolução interna (pixel art)
export const VIEW_H = 216;

export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_JUMP = 4;

export const MAX_RUN_TICKS = TPS * 60 * 30; // 30 minutos por tentativa

export const PHYS = {
  pw: 10, ph: 12,          // hitbox do jogador
  maxRun: 2.6,
  accGround: 0.35, decGround: 0.45,
  accIce: 0.07, decIce: 0.025,
  accAir: 0.22, decAir: 0.12,
  overDecay: 0.08,         // desaceleração quando acima da velocidade máxima
  jumpV: 6.2,
  jumpCut: 2.4,            // soltar o botão corta a subida (pulo com controle de altura)
  gUp: 0.36, gDown: 0.48,
  maxFall: 7,
  wallSlide: 1.6,
  wallJumpVX: 3.0, wallJumpVY: 5.8, wallLock: 9,
  springV: 9.2,
  coyote: 6, jumpBuffer: 7,
  respawnTicks: 36,
  crumbleDelay: 28, crumbleRespawn: 160,
};

export function ticksToMs(t) { return Math.round((t * 1000) / TPS); }

export function fmtTime(ms) {
  if (ms == null || !isFinite(ms)) return '--:--.---';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}
