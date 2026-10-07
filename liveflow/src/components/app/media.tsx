import { Clapperboard, ImageOff, Package } from 'lucide-react';
import { useFileUrl } from '@/hooks/queries';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Product, Video } from '@/types/domain';

const HUES = [285, 350, 190, 75, 155, 25, 230];
function hueFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

function Placeholder({ seed, icon: Icon, className }: { seed: string; icon: typeof Package; className?: string }) {
  const hue = hueFor(seed);
  return (
    <div
      className={cn('grid place-items-center', className)}
      style={{ background: `linear-gradient(135deg, oklch(0.72 0.12 ${hue} / 0.35), oklch(0.6 0.16 ${(hue + 40) % 360} / 0.25))` }}
    >
      <Icon className="size-[38%] max-h-8 max-w-8 text-foreground/45" strokeWidth={1.6} />
    </div>
  );
}

function isUrl(v: string) {
  return /^(https?:|data:|blob:)/.test(v);
}

export function ProductImage({ product, className }: { product: Pick<Product, 'id' | 'name' | 'image_url'>; className?: string }) {
  const path = product.image_url && !isUrl(product.image_url) ? product.image_url : null;
  const { data: resolved } = useFileUrl('product-images', path);
  const src = product.image_url && isUrl(product.image_url) ? product.image_url : resolved;
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-lg bg-muted', className)}>
      {src ? (
        <img src={src} alt={product.name} className="size-full object-cover" loading="lazy" />
      ) : (
        <Placeholder seed={product.id} icon={product.image_url ? ImageOff : Package} className="size-full" />
      )}
    </div>
  );
}

export function VideoThumb({ video, className, showDuration = true }: { video: Pick<Video, 'id' | 'name' | 'thumbnail_path' | 'duration_seconds'>; className?: string; showDuration?: boolean }) {
  const { data: src } = useFileUrl('thumbnails', video.thumbnail_path);
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-lg bg-muted', className)}>
      {src ? <img src={src} alt={video.name} className="size-full object-cover" loading="lazy" /> : <Placeholder seed={video.id} icon={Clapperboard} className="size-full" />}
      {showDuration && video.duration_seconds > 0 && (
        <span className="tabular absolute right-1.5 bottom-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
          {formatDuration(video.duration_seconds)}
        </span>
      )}
    </div>
  );
}
