import { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { VideoThumb } from '@/components/app/media';
import { useServices } from '@/contexts/services';
import { qk, useAction, useFileUrl, useProducts, useVideos } from '@/hooks/queries';
import { composeCaption } from '@/services/caption';
import { cn } from '@/lib/utils';
import type { Post } from '@/types/domain';

/** Fluxo assistido: baixar → copiar legenda → postar no app com o produto → registrar link. */
export function PublishDialog({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const services = useServices();
  const videos = useVideos();
  const products = useProducts();
  const video = post?.video_id ? videos.data?.find((v) => v.id === post.video_id) : null;
  const product = post?.product_id ? products.data?.find((p) => p.id === post.product_id) : null;
  const { data: fileUrl } = useFileUrl('video-files', video?.storage_path);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [url, setUrl] = useState('');
  const mark = (k: string) => setDone((d) => ({ ...d, [k]: true }));

  const publish = useAction(() => services.posts.markPublished(post!.id, url), {
    invalidate: [qk.posts, qk.videos],
    success: 'Publicação registrada',
    onSuccess: onClose,
  });

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(composeCaption(post!.caption, post!.hashtags));
      mark('caption');
      toast.success('Legenda copiada');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  const Step = ({ n, k, title, children }: { n: number; k: string; title: string; children: React.ReactNode }) => (
    <li className="flex gap-3">
      <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold', done[k] ? 'bg-success text-white' : 'bg-muted text-muted-foreground')}>
        {done[k] ? <Check className="size-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="mt-1.5">{children}</div>
      </div>
    </li>
  );

  return (
    <Dialog open={Boolean(post)} onOpenChange={(o) => !o && onClose()}>
      {post && (
        <DialogContent title="Postar agora" description="O LiveFlow não publica por você: siga os passos e registre o link.">
          {video && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border p-2.5">
              <VideoThumb video={video} className="aspect-video w-24" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{video.name}</p>
                <p className="truncate text-xs text-muted-foreground">{product?.name ?? 'Sem produto'}</p>
              </div>
            </div>
          )}
          <ol className="grid gap-4">
            <Step n={1} k="download" title="Baixe o vídeo no celular">
              {fileUrl ? (
                <Button asChild variant="outline" size="sm" onClick={() => mark('download')}>
                  <a href={fileUrl} download={`${video?.name ?? 'video'}.mp4`}><Download /> Baixar vídeo</a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Vídeo de demonstração sem arquivo — no uso real, o botão de download aparece aqui.</p>
              )}
            </Step>
            <Step n={2} k="caption" title="Copie a legenda com hashtags">
              <Button variant="outline" size="sm" onClick={copyCaption}><Copy /> Copiar legenda</Button>
            </Step>
            <Step n={3} k="post" title="Poste no app do TikTok e adicione o produto">
              <p className="text-xs text-muted-foreground">
                Em “Adicionar link” → Produtos, selecione <strong className="text-foreground">{product?.name ?? 'o produto'}</strong>. Vídeos com produto passam por revisão do TikTok antes do link aparecer.
              </p>
              <Button asChild variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => mark('post')}>
                <a href="https://www.tiktok.com/upload" target="_blank" rel="noopener noreferrer"><ExternalLink /> Abrir TikTok</a>
              </Button>
            </Step>
            <Step n={4} k="link" title="Cole o link do vídeo publicado">
              <Field label="Link do TikTok" htmlFor="pub-url" className="[&>label]:sr-only">
                <Input id="pub-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@voce/video/…" inputMode="url" />
              </Field>
            </Step>
          </ol>
          <p className="mt-4 flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Publicação automática via API oficial exige auditoria do app pelo TikTok; sem ela, a API só permite posts privados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Depois</Button>
            <Button onClick={() => publish.mutate(undefined)} loading={publish.isPending} disabled={!url.trim()}>Marcar como publicada</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
