import { Badge } from '@/components/ui/badge';
import type { LiveStatus, ProductStatus, VideoStatus } from '@/types/domain';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'live';

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: Tone }> = {
  active: { label: 'Ativo', tone: 'success' },
  paused: { label: 'Pausado', tone: 'warning' },
  archived: { label: 'Arquivado', tone: 'neutral' },
};

export const VIDEO_STATUS: Record<VideoStatus, { label: string; tone: Tone }> = {
  available: { label: 'Disponível', tone: 'success' },
  scheduled: { label: 'Agendado', tone: 'info' },
  streaming: { label: 'Em transmissão', tone: 'live' },
  finished: { label: 'Finalizado', tone: 'neutral' },
  archived: { label: 'Arquivado', tone: 'neutral' },
};

export const LIVE_STATUS: Record<LiveStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Rascunho', tone: 'neutral' },
  scheduled: { label: 'Programada', tone: 'info' },
  running: { label: 'Em execução', tone: 'live' },
  finished: { label: 'Finalizada', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'warning' },
  error: { label: 'Erro', tone: 'danger' },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const s = PRODUCT_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  const s = VIDEO_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function LiveStatusBadge({ status }: { status: LiveStatus }) {
  const s = LIVE_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

/** Cor de fundo para eventos no calendário. */
export const LIVE_EVENT_CLASS: Record<LiveStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-dashed border-muted-foreground/40',
  scheduled: 'bg-primary/12 text-primary border-primary/25',
  running: 'bg-destructive/12 text-destructive border-destructive/30',
  finished: 'bg-success/12 text-success border-success/25',
  cancelled: 'bg-muted text-muted-foreground line-through border-transparent',
  error: 'bg-destructive/10 text-destructive border-destructive/25',
};
