import { Clapperboard } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VideoStatusBadge } from '@/components/app/status';
import { useFileUrl } from '@/hooks/queries';
import { formatBytes, formatDate, formatDuration } from '@/lib/format';
import type { Product, Video } from '@/types/domain';

export function VideoPlayerDialog({ video, product, onOpenChange }: { video: Video | null; product?: Product | null; onOpenChange: (o: boolean) => void }) {
  const { data: src, isLoading } = useFileUrl('video-files', video?.storage_path);
  const { data: poster } = useFileUrl('thumbnails', video?.thumbnail_path);
  return (
    <Dialog open={Boolean(video)} onOpenChange={onOpenChange}>
      {video && (
        <DialogContent title={video.name} className="sm:max-w-3xl">
          <div className="overflow-hidden rounded-xl bg-black">
            {src ? (
              <video key={src} src={src} poster={poster ?? undefined} controls playsInline className="aspect-video w-full" />
            ) : (
              <div className="grid aspect-video place-items-center text-center text-white/70">
                <div>
                  <Clapperboard className="mx-auto size-8" />
                  <p className="mt-2 text-sm">{isLoading ? 'Carregando…' : 'Vídeo de demonstração (sem arquivo enviado).'}</p>
                </div>
              </div>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-0.5"><VideoStatusBadge status={video.status} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Duração</dt>
              <dd className="tabular mt-0.5 font-medium">{formatDuration(video.duration_seconds)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Enviado em</dt>
              <dd className="mt-0.5 font-medium">{formatDate(video.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tamanho</dt>
              <dd className="mt-0.5 font-medium">{formatBytes(video.size_bytes)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Produto</dt>
              <dd className="mt-0.5 truncate font-medium">{product?.name ?? 'Nenhum'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Usos em lives</dt>
              <dd className="mt-0.5 font-medium">{video.usage_count}</dd>
            </div>
          </dl>
        </DialogContent>
      )}
    </Dialog>
  );
}
