import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, ChevronLeft, ChevronRight, Copy, Eye, Plus, Repeat, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/app/page';
import { LIVE_EVENT_CLASS, LiveStatusBadge } from '@/components/app/status';
import { RescheduleDialog } from '@/components/app/live-actions';
import { useConfirm } from '@/components/app/confirm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useServices } from '@/contexts/services';
import { qk, useAction, useLives, usePlan, useProducts } from '@/hooks/queries';
import { formatMinutes, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Live } from '@/types/domain';

type View = 'month' | 'week' | 'day';
const WEEK_OPTS = { weekStartsOn: 0 as const, locale: ptBR };
const HOUR_PX = 48;

function EventChip({ live, onClick, compact }: { live: Live; onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn('flex w-full min-w-0 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80', LIVE_EVENT_CLASS[live.status])}
      title={`${formatTime(live.starts_at)} ${live.title}`}
    >
      {live.status === 'running' && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-current" />}
      <span className="tabular shrink-0 opacity-80">{formatTime(live.starts_at)}</span>
      {!compact && <span className="truncate">{live.title}</span>}
    </button>
  );
}

function EventDialog({ live, onClose, onReschedule }: { live: Live | null; onClose: () => void; onReschedule: (l: Live) => void }) {
  const services = useServices();
  const plan = usePlan();
  const products = useProducts();
  const navigate = useNavigate();
  const [confirm, confirmNode] = useConfirm();
  const keys = [qk.lives, qk.videos, qk.automations];
  const duplicate = useAction(() => services.lives.duplicate(live!.id, plan), { invalidate: keys, success: 'Live duplicada como rascunho (amanhã)', onSuccess: onClose });
  const cancel = useAction(() => services.lives.cancel(live!.id), { invalidate: keys, success: 'Live cancelada', onSuccess: onClose });
  const product = live?.product_id ? products.data?.find((p) => p.id === live.product_id) : null;
  const editable = live?.status === 'scheduled' || live?.status === 'draft';

  return (
    <>
      <Dialog open={Boolean(live)} onOpenChange={(o) => !o && onClose()}>
        {live && (
          <DialogContent title={live.title} description={format(new Date(live.starts_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}>
            <div className="grid gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <LiveStatusBadge status={live.status} />
                {live.schedule_id && <span className="inline-flex items-center gap-1 text-xs text-primary"><Repeat className="size-3.5" /> Recorrente</span>}
              </div>
              <p><span className="text-muted-foreground">Horário:</span> {formatTime(live.starts_at)} · {formatMinutes(live.duration_minutes)}</p>
              <p><span className="text-muted-foreground">Produto:</span> {product?.name ?? '—'}</p>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => navigate(`/lives/${live.id}`)}><Eye /> Detalhes</Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                {editable && <Button variant="outline" onClick={() => onReschedule(live)}><CalendarClock /> Editar horário</Button>}
                <Button variant="outline" onClick={() => duplicate.mutate(undefined)} loading={duplicate.isPending}><Copy /> Duplicar</Button>
                {editable && (
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (await confirm({ title: 'Cancelar esta live?', description: live.title, confirmLabel: 'Cancelar live', destructive: true })) cancel.mutate(undefined);
                    }}
                  >
                    <XCircle /> Cancelar
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      {confirmNode}
    </>
  );
}

export default function SchedulePage() {
  const lives = useLives();
  const navigate = useNavigate();
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'month'));
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Live | null>(null);
  const [rescheduling, setRescheduling] = useState<Live | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const visible = useMemo(() => (lives.data ?? []).filter((l) => showCancelled || l.status !== 'cancelled'), [lives.data, showCancelled]);
  const byDay = useMemo(() => {
    const map = new Map<string, Live[]>();
    for (const l of visible) {
      const k = format(new Date(l.starts_at), 'yyyy-MM-dd');
      (map.get(k) ?? map.set(k, []).get(k)!).push(l);
    }
    for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [visible]);
  const eventsOn = (d: Date) => byDay.get(format(d, 'yyyy-MM-dd')) ?? [];

  const move = (dir: 1 | -1) =>
    setCursor((c) => (view === 'month' ? addMonths(c, dir) : view === 'week' ? addWeeks(c, dir) : addDays(c, dir)));

  const title =
    view === 'month'
      ? format(cursor, 'MMMM yyyy', { locale: ptBR })
      : view === 'week'
        ? `${format(startOfWeek(cursor, WEEK_OPTS), 'dd MMM', { locale: ptBR })} – ${format(endOfWeek(cursor, WEEK_OPTS), 'dd MMM yyyy', { locale: ptBR })}`
        : format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const newLiveOn = (d: Date) => navigate(`/lives/nova?data=${format(d, 'yyyy-MM-dd')}`);

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), WEEK_OPTS), end: endOfWeek(endOfMonth(cursor), WEEK_OPTS) }),
    [cursor],
  );
  const weekDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(cursor, WEEK_OPTS), end: endOfWeek(cursor, WEEK_OPTS) }), [cursor]);

  return (
    <div className="animate-in">
      <PageHeader
        title="Agenda"
        description="Todas as suas lives no calendário."
        actions={
          <Button asChild variant="brand">
            <Link to="/lives/nova"><Plus /> Nova live</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" onClick={() => move(1)} aria-label="Próximo"><ChevronRight /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>Hoje</Button>
          <h2 className="ml-1 text-base font-semibold first-letter:uppercase sm:text-lg">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="accent-[var(--primary)]" />
            Canceladas
          </label>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="day">Dia</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {view === 'month' && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium uppercase text-muted-foreground">
            {weekDays.map((d) => (
              <div key={d.toISOString()} className="py-2">{format(d, 'EEEEEE', { locale: ptBR })}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((d) => {
              const events = eventsOn(d);
              return (
                <div
                  key={d.toISOString()}
                  onClick={() => {
                    setCursor(d);
                    if (window.innerWidth < 640) setView('day');
                  }}
                  onDoubleClick={() => newLiveOn(d)}
                  className={cn(
                    'group min-h-16 cursor-pointer border-r border-b p-1 transition-colors last:border-r-0 hover:bg-muted/40 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0',
                    !isSameMonth(d, cursor) && 'bg-muted/25 text-muted-foreground',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn('grid size-6 place-items-center rounded-full text-xs font-medium', isToday(d) && 'bg-primary text-primary-foreground', isSameDay(d, cursor) && !isToday(d) && 'ring-1 ring-primary')}>
                      {format(d, 'd')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        newLiveOn(d);
                      }}
                      className="hidden size-5 place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted sm:grid"
                      aria-label="Criar live neste dia"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  {/* mobile: pontos */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {events.slice(0, 4).map((l) => (
                      <span key={l.id} className={cn('size-1.5 rounded-full', l.status === 'running' || l.status === 'error' ? 'bg-destructive' : l.status === 'finished' ? 'bg-success' : 'bg-primary')} />
                    ))}
                  </div>
                  <div className="hidden gap-0.5 sm:grid">
                    {events.slice(0, 3).map((l) => <EventChip key={l.id} live={l} onClick={() => setSelected(l)} />)}
                    {events.length > 3 && (
                      <button
                        className="text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCursor(d);
                          setView('day');
                        }}
                      >
                        +{events.length - 3} mais
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === 'week' && (
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays.map((d) => {
            const events = eventsOn(d);
            return (
              <Card key={d.toISOString()} className={cn('flex flex-col p-2 md:min-h-80', isToday(d) && 'ring-1 ring-primary')}>
                <button onClick={() => { setCursor(d); setView('day'); }} className="mb-2 flex items-center justify-between rounded-md px-1 py-0.5 text-left hover:bg-muted md:flex-col md:items-start">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">{format(d, 'EEE', { locale: ptBR })}</span>
                  <span className={cn('text-lg font-semibold', isToday(d) && 'text-primary')}>{format(d, 'dd')}</span>
                </button>
                <div className="grid gap-1">
                  {events.length === 0 && <p className="px-1 text-xs text-muted-foreground/70 md:hidden">Sem lives</p>}
                  {events.map((l) => (
                    <button key={l.id} onClick={() => setSelected(l)} className={cn('rounded-lg border p-2 text-left text-xs transition-opacity hover:opacity-80', LIVE_EVENT_CLASS[l.status])}>
                      <p className="tabular font-semibold">{formatTime(l.starts_at)}</p>
                      <p className="line-clamp-2 font-medium">{l.title}</p>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-auto hidden text-muted-foreground md:inline-flex" onClick={() => newLiveOn(d)}>
                  <Plus /> Live
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <Card className="overflow-hidden">
          <div className="relative max-h-[70vh] overflow-y-auto" key={format(cursor, 'yyyy-MM-dd')} ref={(el) => {
            if (!el || el.dataset.scrolled) return;
            // Abre no primeiro evento do dia (ou na hora atual), não sempre às 8h.
            const first = eventsOn(cursor)[0];
            const hour = first ? new Date(first.starts_at).getHours() : isToday(cursor) ? new Date().getHours() : 8;
            el.scrollTop = Math.max(0, hour - 1) * HOUR_PX;
            el.dataset.scrolled = '1';
          }}>
            <div className="relative" style={{ height: 24 * HOUR_PX }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute inset-x-0 flex border-t" style={{ top: h * HOUR_PX, height: HOUR_PX }}>
                  <span className="tabular w-14 shrink-0 -translate-y-2 bg-card pr-2 text-right text-[11px] text-muted-foreground">{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>
                  <button className="flex-1 hover:bg-muted/30" onClick={() => navigate(`/lives/nova?data=${format(cursor, 'yyyy-MM-dd')}&hora=${String(h).padStart(2, '0')}:00`)} aria-label={`Criar live às ${h}h`} />
                </div>
              ))}
              {isToday(cursor) && (
                <div className="pointer-events-none absolute right-0 left-14 z-10 border-t-2 border-destructive" style={{ top: (new Date().getHours() + new Date().getMinutes() / 60) * HOUR_PX }}>
                  <span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-destructive" />
                </div>
              )}
              {eventsOn(cursor).map((l, _i, arr) => {
                const s = new Date(l.starts_at);
                const top = (s.getHours() + s.getMinutes() / 60) * HOUR_PX;
                const height = Math.max(26, (l.duration_minutes / 60) * HOUR_PX - 2);
                const overlaps = arr.filter((o) => Math.abs(new Date(o.starts_at).getTime() - s.getTime()) < l.duration_minutes * 60_000);
                const col = overlaps.indexOf(l);
                const width = 100 / Math.max(1, overlaps.length);
                return (
                  <button
                    key={l.id}
                    onClick={() => setSelected(l)}
                    className={cn('absolute overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition-opacity hover:opacity-85', LIVE_EVENT_CLASS[l.status])}
                    style={{ top, height, left: `calc(3.75rem + (100% - 4.25rem) * ${(col * width) / 100})`, width: `calc((100% - 4.25rem) * ${width / 100})` }}
                  >
                    <p className="truncate font-semibold">{l.title}</p>
                    <p className="tabular opacity-80">{formatTime(l.starts_at)} · {formatMinutes(l.duration_minutes)}</p>
                  </button>
                );
              })}
            </div>
          </div>
          {eventsOn(cursor).length === 0 && <p className="border-t p-4 text-center text-sm text-muted-foreground">Nenhuma live neste dia. Toque em um horário para criar.</p>}
        </Card>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {(['scheduled', 'running', 'finished', 'draft', 'error'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm border', LIVE_EVENT_CLASS[s])} />
            {{ scheduled: 'Programada', running: 'Em execução', finished: 'Finalizada', draft: 'Rascunho', error: 'Erro' }[s]}
          </span>
        ))}
      </div>

      <EventDialog live={selected} onClose={() => setSelected(null)} onReschedule={(l) => { setSelected(null); setRescheduling(l); }} />
      {rescheduling && <RescheduleDialog live={rescheduling} onClose={() => setRescheduling(null)} />}
    </div>
  );
}
