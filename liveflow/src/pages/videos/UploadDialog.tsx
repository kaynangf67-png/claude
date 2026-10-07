import { useEffect, useState } from 'react';
import { CheckCircle2, FileVideo, Loader2, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Progress } from '@/components/ui/misc';
import { useServices } from '@/contexts/services';
import { errorMessage, qk, usePlan, useProducts } from '@/hooks/queries';
import { formatBytes } from '@/lib/format';
import { extractVideoMeta } from '@/lib/video-meta';
import { validateVideoFile } from '@/lib/validation';

interface QueueItem {
  file: File;
  name: string;
  productId: string;
  state: 'ready' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export function UploadDialog({ files, onClose }: { files: File[]; onClose: () => void }) {
  const services = useServices();
  const plan = usePlan();
  const products = useProducts();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setItems(
      files.map((file) => {
        const invalid = validateVideoFile(file);
        return {
          file,
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 160),
          productId: '',
          state: invalid ? 'error' : 'ready',
          progress: 0,
          error: invalid ?? undefined,
        };
      }),
    );
  }, [files]);

  const update = (i: number, patch: Partial<QueueItem>) => setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function start() {
    setRunning(true);
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.state !== 'ready') continue;
      update(i, { state: 'uploading', progress: 3 });
      try {
        const meta = await extractVideoMeta(it.file);
        update(i, { progress: 15 });
        await services.videos.upload(it.file, {
          name: it.name,
          productId: it.productId || null,
          meta,
          plan,
          onProgress: (p) => update(i, { progress: Math.max(15, p) }),
        });
        update(i, { state: 'done', progress: 100 });
        ok++;
      } catch (err) {
        update(i, { state: 'error', error: errorMessage(err) });
      }
    }
    setRunning(false);
    await Promise.all([queryClient.invalidateQueries({ queryKey: qk.videos }), queryClient.invalidateQueries({ queryKey: qk.notifications })]);
    if (ok) toast.success(ok === 1 ? 'Vídeo enviado' : `${ok} vídeos enviados`);
  }

  const pending = items.some((i) => i.state === 'ready');
  const finished = items.length > 0 && !pending && !running;

  return (
    <Dialog open={files.length > 0} onOpenChange={(o) => !o && !running && onClose()}>
      {files.length > 0 && (
        <DialogContent title="Enviar vídeos" description="Os arquivos ficam privados na sua conta. Nada é publicado em outra plataforma.">
          <div className="grid gap-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    {it.state === 'done' ? <CheckCircle2 className="size-4 text-success" /> : it.state === 'error' ? <XCircle className="size-4 text-destructive" /> : it.state === 'uploading' ? <Loader2 className="size-4 animate-spin" /> : <FileVideo className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(it.file.size)}</p>
                  </div>
                </div>
                {it.state === 'ready' && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Input value={it.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Nome do vídeo" placeholder="Nome do vídeo" />
                    <NativeSelect value={it.productId} onChange={(e) => update(i, { productId: e.target.value })} aria-label="Produto relacionado">
                      <option value="">Sem produto</option>
                      {(products.data ?? []).filter((p) => p.status !== 'archived').map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                {it.state === 'uploading' && <Progress value={it.progress} className="mt-3" />}
                {it.error && <p className="mt-2 text-xs text-destructive">{it.error}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            {finished ? (
              <Button onClick={onClose}>Concluir</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} disabled={running}>Cancelar</Button>
                <Button onClick={start} loading={running} disabled={!pending}>Enviar {items.filter((i) => i.state === 'ready').length || ''}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
