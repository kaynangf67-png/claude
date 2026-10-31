import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { VideoThumb } from '@/components/app/media';
import { useServices } from '@/contexts/services';
import { qk, useAction, usePlan, usePosts, useProducts, useVideos } from '@/hooks/queries';
import { formatDate, formatTime } from '@/lib/format';
import { formatFor, MAX_BATCH, parseTimes, planSlots } from '@/services/batch';
import { FORMAT_KEYS, POST_FORMATS } from '@/services/formats';
import type { PostFormat } from '@/types/domain';

/**
 * Programa vários vídeos de uma vez: escolhe os vídeos, os horários do dia e o
 * app distribui, gerando legenda e hashtags a partir do produto de cada vídeo.
 */
export function BatchScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const services = useServices();
  const plan = usePlan();
  const videos = useVideos();
  const products = useProducts();
  const posts = usePosts();

  const available = useMemo(() => (videos.data ?? []).filter((v) => v.status !== 'archived'), [videos.data]);
  const activeProducts = useMemo(() => (products.data ?? []).filter((p) => p.status !== 'archived'), [products.data]);
  const productIds = useMemo(() => new Set(activeProducts.map((p) => p.id)), [activeProducts]);
  // Vídeos que já têm publicação programada ou feita: o usuário decide se repete.
  const usedVideoIds = useMemo(() => new Set((posts.data ?? []).filter((p) => p.status === 'scheduled' || p.status === 'published').map((p) => p.video_id)), [posts.data]);

  const [selected, setSelected] = useState<string[]>([]);
  const [fallbackProduct, setFallbackProduct] = useState('');
  const [fmt, setFmt] = useState<PostFormat | 'alternar'>('alternar');
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [timesRaw, setTimesRaw] = useState('12:00, 18:00, 21:00');
  const [skipWeekends, setSkipWeekends] = useState(false);

  const { times, invalid } = useMemo(() => parseTimes(timesRaw), [timesRaw]);
  const busy = useMemo(() => (posts.data ?? []).filter((p) => p.status === 'scheduled' && p.scheduled_at).map((p) => new Date(p.scheduled_at!)), [posts.data]);
  const slots = useMemo(() => planSlots({ count: selected.length, startDate, times, skipWeekends, busy }), [selected.length, startDate, times, skipWeekends, busy]);

  const videoMap = new Map(available.map((v) => [v.id, v]));
  const productFor = (videoId: string) => {
    const own = videoMap.get(videoId)?.product_id;
    return own && productIds.has(own) ? own : fallbackProduct;
  };
  const missingProduct = selected.filter((id) => !productFor(id)).length;

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_BATCH ? s : [...s, id]));
  const allSelected = available.length > 0 && selected.length === Math.min(available.length, MAX_BATCH);

  const save = useAction(
    () =>
      services.posts.createBatch(
        selected.map((videoId, i) => ({ video_id: videoId, product_id: productFor(videoId), format: formatFor(i, fmt), scheduled_at: slots[i].toISOString() })),
        plan,
      ),
    { invalidate: [qk.posts], success: (r) => `${r.length} publicações programadas`, onSuccess: onClose },
  );

  const problem =
    selected.length === 0 ? 'Selecione os vídeos.'
    : times.length === 0 ? 'Informe ao menos um horário.'
    : invalid.length > 0 ? `Horário inválido: ${invalid.join(', ')}`
    : missingProduct > 0 ? `${missingProduct === 1 ? '1 vídeo está' : `${missingProduct} vídeos estão`} sem produto: escolha um produto padrão.`
    : slots.length < selected.length ? 'Não há horários livres suficientes. Adicione horários ou mude a data.'
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && (
        <DialogContent title="Programar em lote" description="Escolha os vídeos e os horários; legenda e hashtags saem do produto de cada vídeo." side="sheet">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">Vídeos <span className="text-muted-foreground">({selected.length}/{Math.min(available.length, MAX_BATCH)})</span></span>
                {available.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(allSelected ? [] : available.slice(0, MAX_BATCH).map((v) => v.id))}>
                    {allSelected ? 'Limpar' : 'Selecionar todos'}
                  </Button>
                )}
              </div>
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground">Envie vídeos na biblioteca primeiro.</p>
              ) : (
                <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                  {available.map((v) => {
                    const idx = selected.indexOf(v.id);
                    const slot = idx >= 0 ? slots[idx] : undefined;
                    return (
                      <label key={v.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                        <input type="checkbox" checked={idx >= 0} onChange={() => toggle(v.id)} className="accent-[var(--primary)]" />
                        <VideoThumb video={v} className="aspect-[9/12] w-9" showDuration={false} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{v.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {slot ? `${formatDate(slot, 'EEE dd/MM')} ${formatTime(slot)} · ${POST_FORMATS[formatFor(idx, fmt)].label}` : usedVideoIds.has(v.id) ? 'Já tem publicação' : 'Ainda não publicado'}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <Field label="Produto padrão" htmlFor="bs-prod" hint="Usado nos vídeos que não têm produto vinculado.">
              <NativeSelect id="bs-prod" value={fallbackProduct} onChange={(e) => setFallbackProduct(e.target.value)}>
                <option value="">Nenhum</option>
                {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Formato" htmlFor="bs-fmt" hint={fmt === 'alternar' ? 'Varia o formato entre os vídeos para comparar o que vende mais.' : POST_FORMATS[fmt].description}>
              <NativeSelect id="bs-fmt" value={fmt} onChange={(e) => setFmt(e.target.value as PostFormat | 'alternar')}>
                <option value="alternar">Alternar formatos</option>
                {FORMAT_KEYS.map((k) => <option key={k} value={k}>{POST_FORMATS[k].label}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="A partir de" htmlFor="bs-date"><Input id="bs-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="Horários do dia" htmlFor="bs-times" hint={`${times.length} por dia`}>
                <Input id="bs-times" value={timesRaw} onChange={(e) => setTimesRaw(e.target.value)} placeholder="12:00, 18:00, 21:00" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipWeekends} onChange={(e) => setSkipWeekends(e.target.checked)} className="accent-[var(--primary)]" />
              Pular sábado e domingo
            </label>
            <p className={`text-xs ${problem ? 'text-destructive' : 'text-muted-foreground'}`}>
              {problem ?? `${slots.length} publicações de ${formatDate(slots[0], 'dd/MM')} ${formatTime(slots[0])} a ${formatDate(slots[slots.length - 1], 'dd/MM')} ${formatTime(slots[slots.length - 1])}. Horários a menos de 30 min de outra publicação são pulados.`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => save.mutate(undefined)} disabled={!!problem} loading={save.isPending}>
              Programar {selected.length > 0 ? selected.length : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
