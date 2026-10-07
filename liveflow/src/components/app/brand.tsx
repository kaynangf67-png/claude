import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('brand-gradient grid size-8 place-items-center rounded-[10px] shadow-md shadow-primary/30', className)}>
      <svg viewBox="0 0 24 24" className="size-[55%] text-white" fill="currentColor" aria-hidden>
        <path d="M8 5.5v13l10.5-6.5z" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">
        Live<span className="text-brand-gradient">Flow</span>
      </span>
    </span>
  );
}
