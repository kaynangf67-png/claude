import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';

/** Hook de confirmação: `const [confirm, node] = useConfirm()` e `await confirm({...})`. */
export function useConfirm(): [
  (opts: { title: string; description?: string; confirmLabel?: string; destructive?: boolean }) => Promise<boolean>,
  ReactNode,
] {
  const [state, setState] = useState<{ title: string; description?: string; confirmLabel?: string; destructive?: boolean; resolve: (v: boolean) => void } | null>(null);

  const confirm = (opts: { title: string; description?: string; confirmLabel?: string; destructive?: boolean }) =>
    new Promise<boolean>((resolve) => setState({ ...opts, resolve }));

  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  const node = (
    <Dialog open={Boolean(state)} onOpenChange={(o) => !o && close(false)}>
      {state && (
        <DialogContent title={state.title} description={state.description}>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              Voltar
            </Button>
            <Button variant={state.destructive ? 'destructive' : 'default'} onClick={() => close(true)}>
              {state.confirmLabel ?? 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
  return [confirm, node];
}
