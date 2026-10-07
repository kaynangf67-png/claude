import { Badge } from '@/components/ui/badge';
import { isOverdue } from '@/services/domain/posts';
import type { Post, PostStatus } from '@/types/domain';

export const POST_STATUS: Record<PostStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }> = {
  draft: { label: 'Rascunho', tone: 'neutral' },
  scheduled: { label: 'Programada', tone: 'info' },
  published: { label: 'Publicada', tone: 'success' },
  failed: { label: 'Falhou', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'warning' },
};

export function PostStatusBadge({ post }: { post: Pick<Post, 'status' | 'scheduled_at'> }) {
  if (isOverdue(post)) return <Badge tone="danger" dot>Hora de postar</Badge>;
  const s = POST_STATUS[post.status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}
