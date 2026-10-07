import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium [&_svg]:size-3', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground',
      primary: 'bg-primary/12 text-primary',
      success: 'bg-success/14 text-success',
      warning: 'bg-warning/18 text-[color-mix(in_oklch,var(--warning)_70%,black)] dark:text-warning',
      danger: 'bg-destructive/12 text-destructive',
      info: 'bg-info/14 text-info',
      live: 'bg-destructive text-white',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, dot, children, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className={cn('size-1.5 rounded-full bg-current', tone === 'live' && 'animate-pulse')} />}
      {children}
    </span>
  );
}
