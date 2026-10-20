import { Link } from 'react-router-dom';

export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="#A8B5A0" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#A8B5A0" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3.6" fill="#263D32" />
    </svg>
  );
}

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="Pele em Foco — início">
      <BrandMark />
      <span>
        Pele <em>em foco</em>
      </span>
    </Link>
  );
}
