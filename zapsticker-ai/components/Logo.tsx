export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="zs-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#25D366" />
          <stop offset="1" stopColor="#128C7E" />
        </linearGradient>
      </defs>
      <path d="M14 6h28l16 16v28a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" fill="url(#zs-g)" />
      <path d="M42 6v10a6 6 0 0 0 6 6h10z" fill="#fff" opacity=".85" />
      <path d="M24 26v14M30 22v22M36 28v10M42 31v4" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-[17px] font-bold tracking-tight">
        ZapSticker <span className="text-brand">AI</span>
      </span>
    </span>
  );
}
