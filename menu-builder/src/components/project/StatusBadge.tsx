import { STATUS_LABEL, type ProjectStatus } from '@/domain/types';
import { Badge } from '@/components/ui';

const TONE: Record<ProjectStatus, 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'> = {
  setup: 'neutral',
  awaiting_analysis: 'accent',
  awaiting_review: 'warn',
  approved: 'accent',
  published: 'ok',
  unpublished: 'neutral',
  archived: 'neutral',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={TONE[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
