/**
 * Marca LUMIA: dois arcos (as mãos no espaço de sinalização) envolvendo um
 * ponto de luz (a história / o projetor). Minimalista, sem infantilizar.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  const id = `lg${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffb86b" />
          <stop offset=".5" stopColor="#ff7aa8" />
          <stop offset="1" stopColor="#8c7bff" />
        </linearGradient>
      </defs>
      <path d="M24 12a20 20 0 0 0 0 40" fill="none" stroke={`url(#${id})`} strokeWidth="5" strokeLinecap="round" />
      <path d="M40 12a20 20 0 0 1 0 40" fill="none" stroke={`url(#${id})`} strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="6.5" fill="#ffb86b" />
    </svg>
  );
}

export function Logo({ tagline = false }: { tagline?: boolean }) {
  return (
    <span className="logo">
      <LogoMark />
      <span>
        LUMIA
        {tagline && <small>O intérprete de IA para filmes.</small>}
      </span>
    </span>
  );
}
