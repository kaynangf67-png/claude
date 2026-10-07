import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info, MoreHorizontal, Plus, Trash2, Workflow } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/page';
import { ProductImage, VideoThumb } from '@/components/app/media';
import { useConfirm } from '@/components/app/confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton, Switch, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useServices } from '@/contexts/services';
import { qk, useAction, useAutomations, useLives, useProducts, useSchedules, useVideos } from '@/hooks/queries';
import { formatDateTime, formatRelative } from '@/lib/format';
import { describeRecurrence } from '@/services/recurrence';
import type { Automation } from '@/types/domain';

const KEYS = [qk.automations, qk.lives, qk.schedules, qk.videos];

export default function AutomationsPage() {
  const services = useServices();
  const automations = useAutomations();
  const schedules = useSchedules();
  const products = useProducts();
  const videos = useVideos();
  const lives = useLives();
  const [confirm, confirmNode] = useConfirm();

  const scheduleMap = useMemo(() => new Map((schedules.data ?? []).map((s) => [s.id, s])), [schedules.data]);
  const productMap = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);
  const videoMap = useMemo(() => new Map((videos.data ?? []).map((v) => [v.id, v])), [videos.data]);
  const upcomingBySchedule = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lives.data ?? []) if (l.schedule_id && l.status === 'scheduled') m.set(l.schedule_id, (m.get(l.schedule_id) ?? 0) + 1);
    return m;
  }, [lives.data]);

  const toggle = useAction(({ id, active }: { id: string; active: boolean }) => services.lives.setAutomationActive(id, active), {
    invalidate: KEYS,
    success: (a) => (a.is_active ? 'Automação ativada — ocorrências geradas' : 'Automação pausada — lives futuras canceladas'),
  });
  const remove = useAction((id: string) => services.lives.removeAutomation(id), { invalidate: KEYS, success: 'Automação excluída' });

  const rows = (automations.data ?? []).map((a) => {
    const s = scheduleMap.get(a.schedule_id);
    return { a, s, product: s?.product_id ? productMap.get(s.product_id) : null, video: s?.video_id ? videoMap.get(s.video_id) : null };
  });

  const Toggle = ({ a }: { a: Automation }) => (
    <Switch checked={a.is_active} onCheckedChange={(v) => toggle.mutate({ id: a.id, active: v })} disabled={toggle.isPending} aria-label={a.is_active ? 'Desativar' : 'Ativar'} />
  );

  const Menu = ({ a }: { a: Automation }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Ações"><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          destructive
          onSelect={async () => {
            if (await confirm({ title: `Excluir "${a.name}"?`, description: 'As lives futuras programadas por ela serão removidas. O histórico é mantido.', confirmLabel: 'Excluir', destructive: true }))
              remove.mutate(a.id);
          }}
        >
          <Trash2 /> Excluir automação
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="animate-in">
      <PageHeader
        title="Automações"
        description="Regras que criam lives automaticamente. Ex.: “Transmitir este vídeo todos os dias às 20:00”."
        actions={<Button asChild variant="brand"><Link to="/lives/nova"><Plus /> Nova automação</Link></Button>}
      />

      <div className="mb-4 flex gap-2.5 rounded-xl border bg-card p-3.5 text-[13px] text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          Cada automação mantém lives programadas para os próximos 30 dias. Ao pausar, as ocorrências futuras são canceladas; ao reativar, são geradas novamente.
        </p>
      </div>

      {automations.isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Workflow} title="Nenhuma automação" description="Crie uma live com repetição para gerar uma automação." action={<Button asChild><Link to="/lives/nova"><Plus /> Criar automação</Link></Button>} />
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Nome</TH>
                  <TH>Produto</TH>
                  <TH>Vídeo</TH>
                  <TH>Frequência</TH>
                  <TH>Próxima execução</TH>
                  <TH>Status</TH>
                  <TH className="w-24" />
                </TR>
              </THead>
              <TBody>
                {rows.map(({ a, s, product, video }) => (
                  <TR key={a.id}>
                    <TD>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{upcomingBySchedule.get(a.schedule_id) ?? 0} lives programadas</p>
                    </TD>
                    <TD>
                      {product ? (
                        <Link to={`/produtos/${product.id}`} className="flex items-center gap-2 hover:underline">
                          <ProductImage product={product} className="size-8" />
                          <span className="max-w-40 truncate">{product.name}</span>
                        </Link>
                      ) : '—'}
                    </TD>
                    <TD>
                      {video ? (
                        <div className="flex items-center gap-2">
                          <VideoThumb video={video} className="aspect-video w-14" showDuration={false} />
                          <span className="max-w-40 truncate">{video.name}</span>
                        </div>
                      ) : '—'}
                    </TD>
                    <TD className="text-muted-foreground">{s ? describeRecurrence(s.recurrence) : '—'}</TD>
                    <TD>
                      {a.is_active && a.next_run_at ? (
                        <div>
                          <p>{formatDateTime(a.next_run_at)}</p>
                          <p className="text-xs text-muted-foreground">{formatRelative(a.next_run_at)}</p>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TD>
                    <TD><Badge tone={a.is_active ? 'success' : 'neutral'} dot>{a.is_active ? 'Ativa' : 'Pausada'}</Badge></TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2"><Toggle a={a} /><Menu a={a} /></div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <div className="grid gap-3 lg:hidden">
            {rows.map(({ a, s, product, video }) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{s ? describeRecurrence(s.recurrence) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-1"><Toggle a={a} /><Menu a={a} /></div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-muted-foreground">Produto</dt><dd className="truncate font-medium">{product?.name ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Vídeo</dt><dd className="truncate font-medium">{video?.name ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Próxima execução</dt><dd className="font-medium">{a.is_active && a.next_run_at ? formatDateTime(a.next_run_at) : '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Status</dt><dd><Badge tone={a.is_active ? 'success' : 'neutral'} dot>{a.is_active ? 'Ativa' : 'Pausada'}</Badge></dd></div>
                </dl>
              </Card>
            ))}
          </div>
        </>
      )}
      {confirmNode}
    </div>
  );
}
