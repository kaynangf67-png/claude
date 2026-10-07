import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarClock, Copy, Eye, MoreHorizontal, Send, Trash2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useServices } from '@/contexts/services';
import { qk, useAction, usePlan } from '@/hooks/queries';
import { combineDateTime } from '@/services/recurrence';
import type { Live } from '@/types/domain';
import { useConfirm } from './confirm';

const LIVE_KEYS = [qk.lives, qk.videos, qk.automations];

export function RescheduleDialog({ live, onClose }: { live: Live | null; onClose: () => void }) {
  const services = useServices();
  const [date, setDate] = useState(() => (live ? format(new Date(live.starts_at), 'yyyy-MM-dd') : ''));
  const [time, setTime] = useState(() => (live ? format(new Date(live.starts_at), 'HH:mm') : ''));
  const [duration, setDuration] = useState(() => String(live?.duration_minutes ?? 60));
  const [error, setError] = useState('');
  const save = useAction(
    () => services.lives.reschedule(live!.id, combineDateTime(date, time), Number(duration)),
    { invalidate: LIVE_KEYS, success: 'Horário atualizado', onSuccess: onClose },
  );
  return (
    <Dialog open={Boolean(live)} onOpenChange={(o) => !o && onClose()}>
      {live && (
        <DialogContent title="Editar horário" description={live.title}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!date || !time) return setError('Informe data e horário.');
              if (combineDateTime(date, time) < new Date()) return setError('Escolha um horário futuro.');
              const d = Number(duration);
              if (!(d >= 5 && d <= 720)) return setError('Duração entre 5 e 720 minutos.');
              save.mutate(undefined);
            }}
            className="grid gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" htmlFor="r-date"><Input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Horário" htmlFor="r-time"><Input id="r-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
            </div>
            <Field label="Duração (min)" htmlFor="r-dur" error={error}>
              <Input id="r-dur" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-32" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" loading={save.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Ações de uma live (menu). Reutilizado em lista, agenda e detalhe. */
export function LiveActionsMenu({ live, showView = true, trigger }: { live: Live; showView?: boolean; trigger?: React.ReactNode }) {
  const services = useServices();
  const plan = usePlan();
  const navigate = useNavigate();
  const [confirm, confirmNode] = useConfirm();
  const [rescheduling, setRescheduling] = useState(false);
  const open = live.status === 'draft' || live.status === 'scheduled';

  const duplicate = useAction(() => services.lives.duplicate(live.id, plan), {
    invalidate: LIVE_KEYS,
    success: 'Live duplicada como rascunho',
    onSuccess: (copy) => navigate(`/lives/${copy.id}`),
  });
  const cancel = useAction(() => services.lives.cancel(live.id), { invalidate: LIVE_KEYS, success: 'Live cancelada' });
  const publish = useAction(() => services.lives.publishDraft(live.id), { invalidate: LIVE_KEYS, success: 'Live programada' });
  const remove = useAction(() => services.lives.remove(live.id), { invalidate: LIVE_KEYS, success: 'Live excluída', onSuccess: () => navigate('/lives') });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${live.title}`}>
              <MoreHorizontal />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {showView && <DropdownMenuItem onSelect={() => navigate(`/lives/${live.id}`)}><Eye /> Ver detalhes</DropdownMenuItem>}
          {live.status === 'draft' && <DropdownMenuItem onSelect={() => publish.mutate(undefined)}><Send /> Programar</DropdownMenuItem>}
          {open && <DropdownMenuItem onSelect={() => setRescheduling(true)}><CalendarClock /> Editar horário</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => duplicate.mutate(undefined)}><Copy /> Duplicar</DropdownMenuItem>
          {open && (
            <DropdownMenuItem
              onSelect={async () => {
                if (await confirm({ title: 'Cancelar esta live?', description: live.title, confirmLabel: 'Cancelar live', destructive: true })) cancel.mutate(undefined);
              }}
            >
              <XCircle /> Cancelar live
            </DropdownMenuItem>
          )}
          {(live.status === 'draft' || live.status === 'cancelled' || live.status === 'error') && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={async () => {
                  if (await confirm({ title: 'Excluir esta live?', description: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', destructive: true })) remove.mutate(undefined);
                }}
              >
                <Trash2 /> Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {rescheduling && <RescheduleDialog live={live} onClose={() => setRescheduling(false)} />}
      {confirmNode}
    </>
  );
}
