// Ilustrações esquemáticas do teste: um "pedaço de pele" ampliado ou um rosto em
// linha. São desenhos, não fotos, para a pessoa se reconhecer sem expor ninguém.
import type { ReactNode } from 'react';

const SKIN = '#e7c6a8';
const SKIN_SHADE = '#d9b08f';
const RED = '#c4564a';
const RED_SOFT = '#e39a8c';
const DARK = '#4a3428';

function Patch({ children, label }: { children?: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={label} className="teste-art">
      <defs>
        <radialGradient id="deep" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a63f36" />
          <stop offset="70%" stopColor="#c86a5c" stopOpacity="0.8" />
          <stop offset="100%" stopColor={SKIN} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={RED_SOFT} />
          <stop offset="100%" stopColor={SKIN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="22" fill={SKIN} />
      {/* poros */}
      {[[22, 30], [48, 18], [86, 26], [100, 60], [18, 74], [60, 98], [94, 96], [36, 52]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill={SKIN_SHADE} />
      ))}
      {children}
    </svg>
  );
}

const Papule = ({ x, y, r = 6 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r * 2} fill="url(#halo)" />
    <circle cx={x} cy={y} r={r} fill={RED} />
    <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="#fff" opacity="0.35" />
  </g>
);

const Pustule = ({ x, y, r = 6 }: { x: number; y: number; r?: number }) => (
  <g>
    <Papule x={x} y={y} r={r} />
    <circle cx={x} cy={y} r={r * 0.5} fill="#f6ecc8" />
  </g>
);

export const LESION_ART = {
  cravos: (
    <Patch label="Pele com pontinhos pretos e pontinhos brancos pequenos">
      {[[30, 40], [52, 34], [70, 50], [44, 62], [82, 74], [60, 80], [34, 86]].map(([x, y], i) =>
        i % 2 === 0
          ? <circle key={i} cx={x} cy={y} r="2.6" fill={DARK} />
          : <g key={i}><circle cx={x} cy={y} r="4" fill="#f3e3d2" /><circle cx={x} cy={y} r="4" fill="none" stroke={SKIN_SHADE} /></g>,
      )}
    </Patch>
  ),
  espinhas: (
    <Patch label="Pele com bolinhas vermelhas pequenas">
      <Papule x={38} y={42} r={5.5} /><Papule x={76} y={36} r={5} /><Papule x={58} y={70} r={6} /><Papule x={88} y={84} r={4.5} />
    </Patch>
  ),
  pus: (
    <Patch label="Pele com espinhas vermelhas de ponta branca ou amarelada">
      <Pustule x={40} y={44} r={7} /><Pustule x={78} y={62} r={6} /><Papule x={52} y={86} r={5} />
    </Patch>
  ),
  carocos: (
    <Patch label="Pele com caroços grandes, vermelhos e profundos">
      <circle cx="46" cy="50" r="30" fill="url(#deep)" />
      <circle cx="84" cy="82" r="22" fill="url(#deep)" />
    </Patch>
  ),
  nenhuma: (
    <Patch label="Pele sem espinhas">
      <path d="M44 62 l12 12 22-26" fill="none" stroke="#5d6d55" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </Patch>
  ),
};

export const MARKS_ART = {
  nao: LESION_ART.nenhuma,
  manchas: (
    <Patch label="Pele com manchas planas, avermelhadas ou escuras">
      <ellipse cx="40" cy="44" rx="11" ry="8" fill="#b77a63" opacity="0.6" />
      <ellipse cx="78" cy="56" rx="9" ry="7" fill="#c98270" opacity="0.55" />
      <ellipse cx="56" cy="84" rx="12" ry="8" fill="#a8705a" opacity="0.55" />
    </Patch>
  ),
  cicatrizes: (
    <Patch label="Pele com pequenos buracos ou afundamentos">
      {[[40, 42], [76, 50], [56, 80], [86, 86]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y} rx="7" ry="5.5" fill={SKIN_SHADE} />
          <path d={`M${x - 7} ${y} a7 5.5 0 0 1 14 0`} fill="#b98d6d" />
        </g>
      ))}
    </Patch>
  ),
};

function Face({ children, label }: { children?: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={label} className="teste-art">
      <rect x="4" y="4" width="112" height="112" rx="22" fill="#f0ebe1" />
      <ellipse cx="60" cy="62" rx="34" ry="44" fill={SKIN} />
      {children}
    </svg>
  );
}

const Shine = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <path d={`M${x} ${y - 6 * s} L${x + 1.6 * s} ${y - 1.6 * s} L${x + 6 * s} ${y} L${x + 1.6 * s} ${y + 1.6 * s} L${x} ${y + 6 * s} L${x - 1.6 * s} ${y + 1.6 * s} L${x - 6 * s} ${y} L${x - 1.6 * s} ${y - 1.6 * s} Z`} fill="#fffaf0" />
);

export const SKIN_ART = {
  oleosa: (
    <Face label="Rosto com brilho na testa, no nariz, no queixo e nas bochechas">
      <Shine x={60} y={34} /><Shine x={60} y={62} s={0.8} /><Shine x={60} y={92} s={0.8} /><Shine x={38} y={68} /><Shine x={82} y={68} />
    </Face>
  ),
  mista: (
    <Face label="Rosto com brilho só na testa, no nariz e no queixo">
      <path d="M36 30 H84 V42 H68 V96 H52 V42 H36 Z" fill="#f3d8bf" opacity="0.7" />
      <Shine x={60} y={34} /><Shine x={60} y={64} s={0.8} /><Shine x={60} y={92} s={0.8} />
    </Face>
  ),
  normal: <Face label="Rosto sem brilho nem descamação" />,
  seca: (
    <Face label="Rosto com pequenas linhas de ressecamento nas bochechas">
      {[[36, 64], [40, 74], [80, 64], [76, 74]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x - 6} ${y} l4 -3 l4 3 l4 -3`} fill="none" stroke="#b98d6d" strokeWidth="1.6" strokeLinecap="round" />
      ))}
    </Face>
  ),
};
