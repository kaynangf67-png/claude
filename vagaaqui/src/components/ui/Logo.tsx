export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="va-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b8cff" />
          <stop offset="1" stopColor="#38f8b0" />
        </linearGradient>
      </defs>
      <path
        className="logo-pin"
        d="M32 6c-10.5 0-19 8.3-19 18.6C13 38.5 32 58 32 58s19-19.5 19-33.4C51 14.3 42.5 6 32 6z"
        fill="none"
        stroke="url(#va-g)"
        strokeWidth="4.5"
      />
      <path className="logo-p" d="M26 37V17h8.5a6.5 6.5 0 010 13H26" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`}>
      Vaga<span className="wordmark-accent">Aqui</span>
    </span>
  );
}
