import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus, Radio, Repeat } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/page';
import { LiveStatusBadge } from '@/components/app/status';
import { VideoThumb } from '@/components/app/media';
import { LiveActionsMenu } from '@/components/app/live-actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useLives, useProducts, useVideos } from '@/hooks/queries';
import { formatDate, formatMinutes, formatTime } from '@/lib/format';
import type { Live } from '@/types/domain';

type Tab = 'upcoming' | 'running' | 'drafts' | 'history';

const FILTERS: Record<Tab, (l: Live) => boolean> = {
  upcoming: (l) => l.status === 'scheduled',
  running: (l) => l.status === 'running',
  drafts: (l) => l.status === 'draft',
  history: (l) => l.status === 'finished' || l.status === 'cancelled' || l.status === 'error',
};

export default function LivesPage() {
  const lives = useLives();
  const products = useProducts();
  const videos = useVideos();
  const [tab, setTab] = useState<Tab>('upcoming');
  const productMap = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);
  const videoMap = useMemo(() => new Map((videos.data ?? []).map((v) => [v.id, v])), [videos.data]);

  const counts = useMemo(() => {
    const all = lives.data ?? [];
    return Object.fromEntries((Object.keys(FILTERS) as Tab[]).map((k) => [k, all.filter(FILTERS[k]).length])) as Record<Tab, number>;
  }, [lives.data]);

  const list = useMemo(() => {
    const items = (lives.data ?? []).filter(FILTERS[tab]);
    return tab === 'history' ? [...items].sort((a, b) => b.starts_at.localeCompare(a.starts_at)) : items;
  }, [lives.data, tab]);

  return (
    <div className="animate-in">
      <PageHeader
        title="Lives"
        description="Configurações de live criadas a partir dos seus vídeos."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/agenda"><CalendarDays /> Agenda</Link>
            </Button>
            <Button asChild variant="brand">
              <Link to="/lives/nova"><Plus /> Nova live</Link>
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList className="max-w-full overflow-x-auto scrollbar-none">
          <TabsTrigger value="upcoming">Programadas <span className="opacity-60">{counts.upcoming}</span></TabsTrigger>
          <TabsTrigger value="running">Em execução <span className="opacity-60">{counts.running}</span></TabsTrigger>
          <TabsTrigger value="drafts">Rascunhos <span className="opacity-60">{counts.drafts}</span></TabsTrigger>
          <TabsTrigger value="history">Histórico <span className="opacity-60">{counts.history}</span></TabsTrigger>
        </TabsList>
      </Tabs>

      {lives.isLoading ? (
        <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={Radio} title="Nenhuma live aqui" description="Crie uma live a partir de um vídeo da sua biblioteca." action={<Button asChild><Link to="/lives/nova"><Plus /> Nova live</Link></Button>} />
      ) : (
        <Card className="divide-y overflow-hidden">
          {list.map((l) => {
            const video = l.video_id ? videoMap.get(l.video_id) : null;
            const product = l.product_id ? productMap.get(l.product_id) : null;
            return (
              <div key={l.id} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/40 sm:px-5">
                <Link to={`/lives/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <div className="hidden w-14 shrink-0 text-center sm:block">
                    <p className="text-[11px] uppercase text-muted-foreground">{formatDate(l.starts_at, 'MMM')}</p>
                    <p className="tabular text-xl leading-tight font-semibold">{formatDate(l.starts_at, 'dd')}</p>
                  </div>
                  {video ? <VideoThumb video={video} className="aspect-video w-20 sm:w-24" showDuration={false} /> : <div className="aspect-video w-20 rounded-lg bg-muted sm:w-24" />}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {l.schedule_id && <Repeat className="size-3.5 shrink-0 text-primary" aria-label="Recorrente" />}
                      <span className="truncate">{l.title}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{product?.name ?? 'Sem produto'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="sm:hidden">{formatDate(l.starts_at, 'dd/MM')} · </span>
                      {formatTime(l.starts_at)} · {formatMinutes(l.duration_minutes)}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <LiveStatusBadge status={l.status} />
                  </div>
                </Link>
                <LiveActionsMenu live={l} />
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
