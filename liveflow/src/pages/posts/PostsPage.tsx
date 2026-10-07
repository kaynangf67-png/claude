import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isToday } from 'date-fns';
import { BellRing, CalendarCheck2, Copy, ExternalLink, MoreHorizontal, Pencil, Plus, Send, Trash2, Trophy, Video as VideoIcon, XCircle } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/page';
import { VideoThumb } from '@/components/app/media';
import { PostStatusBadge } from '@/components/app/post-status';
import { useConfirm } from '@/components/app/confirm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useServices } from '@/contexts/services';
import { qk, useAction, useAnalytics, usePlan, usePosts, useProducts, useVideos } from '@/hooks/queries';
import { formatCompact, formatCurrency, formatDate, formatTime } from '@/lib/format';
import { groupBy } from '@/lib/utils';
import { computeTotals, presetToRange } from '@/services/analytics';
import { isOverdue } from '@/services/domain/posts';
import { POST_FORMATS } from '@/services/formats';
import type { Post } from '@/types/domain';
import { PostEditorDialog } from './PostEditorDialog';
import { PublishDialog } from './PublishDialog';

type Tab = 'today' | 'scheduled' | 'published' | 'drafts';

export default function PostsPage() {
  const services = useServices();
  const plan = usePlan();
  const posts = usePosts();
  const videos = useVideos();
  const products = useProducts();
  const range = useMemo(() => presetToRange('30d'), []);
  const analytics = useAnalytics(range);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('today');
  type Defaults = { videoId?: string; productId?: string; date?: string };
  const [editor, setEditor] = useState<{ open: boolean; post: Post | null; defaults?: Defaults; seq: number }>({ open: false, post: null, seq: 0 });

  // /publicacoes?nova=1[&video=…&produto=…&data=…] abre o editor (também se já estiver na página).
  useEffect(() => {
    if (params.get('nova') !== '1') return;
    const defaults = { videoId: params.get('video') ?? undefined, productId: params.get('produto') ?? undefined, date: params.get('data') ?? undefined };
    setEditor((e) => ({ open: true, post: null, defaults, seq: e.seq + 1 }));
    setParams({}, { replace: true });
  }, [params, setParams]);
  const openEditor = (post: Post | null) => setEditor((e) => ({ open: true, post, seq: e.seq + 1 }));
  const [publishing, setPublishing] = useState<Post | null>(null);
  const [confirm, confirmNode] = useConfirm();

  const videoMap = useMemo(() => new Map((videos.data ?? []).map((v) => [v.id, v])), [videos.data]);
  const productMap = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);
  const metricsByPost = useMemo(() => {
    const g = groupBy((analytics.data ?? []).filter((r) => r.post_id), (r) => r.post_id!);
    return new Map([...g].map(([id, rows]) => [id, computeTotals(rows)]));
  }, [analytics.data]);

  const all = posts.data ?? [];
  const overdue = all.filter((p) => isOverdue(p));
  const filters: Record<Tab, (p: Post) => boolean> = {
    today: (p) => isOverdue(p) || (p.status === 'scheduled' && p.scheduled_at != null && isToday(new Date(p.scheduled_at))),
    scheduled: (p) => p.status === 'scheduled' && !isOverdue(p),
    published: (p) => p.status === 'published',
    drafts: (p) => p.status === 'draft',
  };
  const list = all.filter(filters[tab]);
  const sorted = tab === 'published' ? [...list].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '')) : list;

  // Qual formato vende mais por publicação (30 dias)?
  const bestFormat = useMemo(() => {
    const byFormat = new Map<string, { revenue: number; n: number }>();
    for (const p of all) {
      const m = metricsByPost.get(p.id);
      if (!m) continue;
      const cur = byFormat.get(p.format) ?? { revenue: 0, n: 0 };
      byFormat.set(p.format, { revenue: cur.revenue + m.revenue, n: cur.n + 1 });
    }
    // Só compara formatos com amostra mínima; 1–2 vídeos não dizem nada.
    const ranked = [...byFormat].filter(([, v]) => v.n >= 3).map(([f, v]) => ({ format: f as Post['format'], avg: v.revenue / v.n, n: v.n })).sort((a, b) => b.avg - a.avg);
    return ranked[0] ?? null;
  }, [all, metricsByPost]);

  const publishedWeek = all.filter((p) => p.status === 'published' && p.published_at && Date.now() - new Date(p.published_at).getTime() < 7 * 86_400_000).length;
  const next7 = all.filter((p) => p.status === 'scheduled' && p.scheduled_at && new Date(p.scheduled_at).getTime() - Date.now() < 7 * 86_400_000 && !isOverdue(p)).length;

  const duplicate = useAction((id: string) => services.posts.duplicate(id, plan), { invalidate: [qk.posts], success: 'Duplicada como rascunho' });
  const cancel = useAction((id: string) => services.posts.cancel(id), { invalidate: [qk.posts], success: 'Publicação cancelada' });
  const remove = useAction((id: string) => services.posts.remove(id), { invalidate: [qk.posts], success: 'Publicação excluída' });

  const counts = Object.fromEntries((Object.keys(filters) as Tab[]).map((k) => [k, all.filter(filters[k]).length])) as Record<Tab, number>;

  return (
    <div className="animate-in">
      <PageHeader
        title="Publicações"
        description="Vídeos curtos sem aparecer: prepare, programe e poste com o link do produto."
        actions={<Button variant="brand" onClick={() => openEditor(null)}><Plus /> Nova publicação</Button>}
      />

      {overdue.length > 0 && (
        <Card className="mb-4 flex flex-col gap-3 border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
          <BellRing className="size-5 shrink-0 text-destructive" />
          <p className="flex-1 text-sm">
            <strong>{overdue.length === 1 ? '1 publicação está' : `${overdue.length} publicações estão`} esperando você postar.</strong> O horário programado já chegou.
          </p>
          <Button size="sm" onClick={() => setPublishing(overdue[0])}><Send /> Postar agora</Button>
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-9 place-items-center rounded-lg bg-success/12 text-success"><CalendarCheck2 className="size-4" /></span>
          <div><p className="tabular text-lg font-semibold">{publishedWeek}</p><p className="text-xs text-muted-foreground">publicadas em 7 dias</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-9 place-items-center rounded-lg bg-info/12 text-info"><VideoIcon className="size-4" /></span>
          <div><p className="tabular text-lg font-semibold">{next7}</p><p className="text-xs text-muted-foreground">programadas p/ 7 dias</p></div>
        </Card>
        <Card className="col-span-2 flex items-center gap-3 p-4 lg:col-span-1">
          <span className="grid size-9 place-items-center rounded-lg bg-chart-4/16 text-chart-4"><Trophy className="size-4" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{bestFormat ? POST_FORMATS[bestFormat.format].label : '—'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {bestFormat ? `formato que mais vende · ${formatCurrency(bestFormat.avg)}/vídeo (${bestFormat.n} vídeos)` : 'publique ao menos 3 vídeos por formato para comparar'}
            </p>
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList className="max-w-full overflow-x-auto scrollbar-none">
          <TabsTrigger value="today">Para hoje <span className="opacity-60">{counts.today}</span></TabsTrigger>
          <TabsTrigger value="scheduled">Programadas <span className="opacity-60">{counts.scheduled}</span></TabsTrigger>
          <TabsTrigger value="published">Publicadas <span className="opacity-60">{counts.published}</span></TabsTrigger>
          <TabsTrigger value="drafts">Rascunhos <span className="opacity-60">{counts.drafts}</span></TabsTrigger>
        </TabsList>
      </Tabs>

      {posts.isLoading ? (
        <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={VideoIcon}
          title={tab === 'today' ? 'Nada para postar hoje' : 'Nenhuma publicação aqui'}
          description="Programe vídeos curtos com legenda e produto prontos."
          action={<Button onClick={() => openEditor(null)}><Plus /> Nova publicação</Button>}
        />
      ) : (
        <Card className="divide-y overflow-hidden">
          {sorted.map((p) => {
            const video = p.video_id ? videoMap.get(p.video_id) : null;
            const product = p.product_id ? productMap.get(p.product_id) : null;
            const m = metricsByPost.get(p.id);
            const when = p.published_at ?? p.scheduled_at;
            return (
              <div key={p.id} className="flex items-center gap-3 px-3 py-3 sm:px-5">
                {video ? <VideoThumb video={video} className="aspect-[9/12] w-12 sm:w-14" showDuration={false} /> : <div className="aspect-[9/12] w-12 rounded-lg bg-muted sm:w-14" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.caption.split('\n')[0] || 'Sem legenda'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {product?.name ?? 'Sem produto'} · {POST_FORMATS[p.format].label}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <PostStatusBadge post={p} />
                    {when && <span>{formatDate(when, 'dd/MM')} {formatTime(when)}</span>}
                    {m && <span className="tabular">· {formatCompact(m.views)} views · {formatCurrency(m.revenue)}</span>}
                  </div>
                </div>
                {(p.status === 'scheduled' || p.status === 'draft') && (
                  <Button size="sm" variant={isOverdue(p) ? 'default' : 'outline'} className="hidden sm:inline-flex" onClick={() => setPublishing(p)}>
                    <Send /> Postar
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Ações da publicação"><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {(p.status === 'scheduled' || p.status === 'draft') && (
                      <>
                        <DropdownMenuItem onSelect={() => setPublishing(p)}><Send /> Postar agora</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openEditor(p)}><Pencil /> Editar</DropdownMenuItem>
                      </>
                    )}
                    {p.published_url && (
                      <DropdownMenuItem asChild>
                        <a href={p.published_url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Ver no TikTok</a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => duplicate.mutate(p.id)}><Copy /> Duplicar</DropdownMenuItem>
                    {p.status === 'scheduled' && <DropdownMenuItem onSelect={() => cancel.mutate(p.id)}><XCircle /> Cancelar</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      onSelect={async () => {
                        if (await confirm({ title: 'Excluir esta publicação?', description: 'O vídeo continua na biblioteca.', confirmLabel: 'Excluir', destructive: true })) remove.mutate(p.id);
                      }}
                    >
                      <Trash2 /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </Card>
      )}

      <PostEditorDialog
        key={editor.seq}
        open={editor.open}
        post={editor.post}
        defaults={editor.defaults}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
      />
      <PublishDialog key={publishing?.id ?? 'none'} post={publishing} onClose={() => setPublishing(null)} />
      {confirmNode}
    </div>
  );
}
