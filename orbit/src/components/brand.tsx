import Link from "next/link";

export function OrbitMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <circle cx="16" cy="16" r="5" fill="#3b82f6" />
      <ellipse cx="16" cy="16" rx="13" ry="6.5" stroke="#3b82f6" strokeOpacity="0.55" strokeWidth="1.6" transform="rotate(-28 16 16)" />
      <circle cx="27" cy="10.2" r="1.8" fill="#e8edf6" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-[0.18em] text-fg" aria-label="ORBIT">
      <OrbitMark />
      <span className="text-sm">ORBIT</span>
    </Link>
  );
}
