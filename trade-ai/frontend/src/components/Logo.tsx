/** Logo: dois candles, verde (alta) e vermelho (baixa), com face lateral para dar volume. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Trade AI" role="img">
      <defs>
        <linearGradient id="lg-up" x1="0" x2="1">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="lg-down" x1="0" x2="1">
          <stop offset="0" stopColor="#f87171" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f1a14" />
          <stop offset="1" stopColor="#1a0f10" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#lg-bg)" stroke="#ffffff14" />
      {/* candle verde */}
      <line x1="17" y1="8" x2="17" y2="40" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 14 l3 -2 v18 l-3 2 z" fill="#14532d" />
      <rect x="12" y="14" width="9" height="18" rx="1.5" fill="url(#lg-up)" />
      {/* candle vermelho */}
      <line x1="32" y1="12" x2="32" y2="42" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 18 l3 -2 v16 l-3 2 z" fill="#7f1d1d" />
      <rect x="27" y="18" width="9" height="16" rx="1.5" fill="url(#lg-down)" />
    </svg>
  );
}
