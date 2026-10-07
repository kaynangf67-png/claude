import type { ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  side,
}: {
  className?: string;
  children: ReactNode;
  title: string;
  description?: string;
  /** "sheet" desliza da direita (desktop) / de baixo (mobile) */
  side?: 'center' | 'sheet';
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in" />
      <D.Content
        className={cn(
          'fixed z-50 flex max-h-[92dvh] flex-col border bg-popover text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in',
          side === 'sheet'
            ? 'inset-x-0 bottom-0 rounded-t-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-2xl'
            : 'inset-x-0 bottom-0 rounded-t-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-base font-semibold tracking-tight">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-[13px] text-muted-foreground">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="-mr-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-safe">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('-mx-5 -mb-4 mt-5 flex flex-col-reverse gap-2 border-t bg-muted/40 px-5 py-3 sm:flex-row sm:justify-end', className)}>{children}</div>;
}
