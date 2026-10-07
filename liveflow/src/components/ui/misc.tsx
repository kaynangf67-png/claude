import type { HTMLAttributes, ReactNode } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm [&_svg]:size-3.5',
        className,
      )}
      {...props}
    />
  );
}

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)} value={value}>
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full bg-primary transition-all duration-500', indicatorClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';
  return (
    <AvatarPrimitive.Root className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name} className="aspect-square size-full object-cover" />}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center bg-accent text-xs font-semibold text-accent-foreground">
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  );
}
export const THead = ({ children }: { children: ReactNode }) => <thead className="[&_tr]:border-b">{children}</thead>;
export const TBody = ({ children }: { children: ReactNode }) => <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b transition-colors hover:bg-muted/40', className)} {...props} />;
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-muted-foreground first:pl-5 last:pr-5', className)} {...props} />;
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-3 align-middle first:pl-5 last:pr-5', className)} {...props} />;
}
