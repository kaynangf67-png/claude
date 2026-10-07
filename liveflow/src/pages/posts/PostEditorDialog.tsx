import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useServices } from '@/contexts/services';
import { qk, useAction, usePlan, useProducts, useVideos } from '@/hooks/queries';
import { fieldErrors } from '@/lib/validation';
import { buildCaption, normalizeHashtags } from '@/services/caption';
import { postSchema } from '@/services/domain/posts';
import { FORMAT_KEYS, POST_FORMATS } from '@/services/formats';
import { combineDateTime } from '@/services/recurrence';
import type { Post, PostFormat } from '@/types/domain';

export function PostEditorDialog({ open, post, defaults, onClose }: { open: boolean; post?: Post | null; defaults?: { videoId?: string; productId?: string; date?: string }; onClose: () => void }) {
  const services = useServices();
  const plan = usePlan();
  const products = useProducts();
  const videos = useVideos();
  const initialDate = post?.scheduled_at ? new Date(post.scheduled_at) : defaults?.date ? new Date(`${defaults.date}T12:00:00`) : addDays(new Date(), 1);
  const [form, setForm] = useState(() => ({
    video_id: post?.video_id ?? defaults?.videoId ?? '',
    product_id: post?.product_id ?? defaults?.productId ?? '',
    format: (post?.format ?? 'maos') as PostFormat,
    caption: post?.caption ?? '',
    hashtags: (post?.hashtags ?? []).map((h) => `#${h}`).join(' '),
    date: format(initialDate, 'yyyy-MM-dd'),
    time: post?.scheduled_at ? format(initialDate, 'HH:mm') : '12:00',
    schedule: post ? post.scheduled_at != null : true,
    notes: post?.notes ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const product = products.data?.find((p) => p.id === form.product_id);
  const availableVideos = useMemo(() => (videos.data ?? []).filter((v) => v.status !== 'archived'), [videos.data]);

  function payload() {
    return {
      video_id: form.video_id,
      product_id: form.product_id,
      format: form.format,
      caption: form.caption,
      hashtags: form.hashtags,
      notes: form.notes,
      scheduled_at: form.schedule ? combineDateTime(form.date, form.time).toISOString() : null,
    };
  }

  const save = useAction(
    (asDraft: boolean) => (post ? services.posts.update(post.id, payload()) : services.posts.create(payload(), plan, { asDraft })),
    { invalidate: [qk.posts], success: post ? 'Publicação atualizada' : 'Publicação salva', onSuccess: onClose },
  );

  function submit(asDraft: boolean) {
    const parsed = postSchema.safeParse(payload());
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    if (!asDraft && form.schedule && combineDateTime(form.date, form.time) < new Date() && post?.status !== 'scheduled') return setErrors({ time: 'Escolha um horário futuro' });
    setErrors({});
    save.mutate(asDraft);
  }

  function generate() {
    if (!product) return setErrors({ product_id: 'Escolha o produto para gerar a legenda' });
    const { caption, hashtags } = buildCaption({ productName: product.name, price: Number(product.promo_price ?? product.price), category: product.category, format: form.format });
    setForm((f) => ({ ...f, caption, hashtags: hashtags.map((h) => `#${h}`).join(' ') }));
  }

  const tagCount = normalizeHashtags(form.hashtags).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && (
        <DialogContent title={post ? 'Editar publicação' : 'Nova publicação'} description="Vídeo curto sem aparecer: prepare tudo aqui e poste em 1 minuto." side="sheet">
          <div className="grid gap-4">
            <Field label="Vídeo" htmlFor="po-video" error={errors.video_id}>
              <NativeSelect
                id="po-video"
                value={form.video_id}
                onChange={(e) => {
                  const v = availableVideos.find((x) => x.id === e.target.value);
                  setForm((f) => ({ ...f, video_id: e.target.value, product_id: f.product_id || v?.product_id || '' }));
                }}
              >
                <option value="">Selecione…</option>
                {availableVideos.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Produto (link no carrinho)" htmlFor="po-prod" error={errors.product_id}>
              <NativeSelect id="po-prod" value={form.product_id} onChange={(e) => set('product_id', e.target.value)}>
                <option value="">Selecione…</option>
                {(products.data ?? []).filter((p) => p.status !== 'archived').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Formato (sem rosto)" htmlFor="po-fmt" hint={POST_FORMATS[form.format].description}>
              <NativeSelect id="po-fmt" value={form.format} onChange={(e) => set('format', e.target.value as PostFormat)}>
                {FORMAT_KEYS.map((k) => <option key={k} value={k}>{POST_FORMATS[k].label}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="po-cap" className="text-[13px] font-medium">Legenda</label>
                <Button type="button" variant="ghost" size="sm" onClick={generate}><Wand2 /> Gerar</Button>
              </div>
              <Textarea id="po-cap" value={form.caption} onChange={(e) => set('caption', e.target.value)} maxLength={2200} className="min-h-28" />
              <p className={`text-xs ${errors.caption ? 'text-destructive' : 'text-muted-foreground'}`}>{errors.caption ?? `${form.caption.length}/2200`}</p>
            </div>
            <Field label="Hashtags" htmlFor="po-tags" hint={`${tagCount}/8 — separadas por espaço`}>
              <Input id="po-tags" value={form.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#tiktokshop #achadinhos" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.schedule} onChange={(e) => set('schedule', e.target.checked)} className="accent-[var(--primary)]" />
              Programar horário
            </label>
            {form.schedule && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data" htmlFor="po-date"><Input id="po-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
                <Field label="Horário" htmlFor="po-time" error={errors.time}><Input id="po-time" type="time" value={form.time} onChange={(e) => set('time', e.target.value)} /></Field>
              </div>
            )}
            <Field label="Notas (opcional)" htmlFor="po-notes">
              <Input id="po-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex.: usar som em alta, cupom do dia" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            {!post && <Button variant="outline" onClick={() => submit(true)} disabled={save.isPending}>Salvar rascunho</Button>}
            <Button onClick={() => submit(false)} loading={save.isPending}>{post ? 'Salvar' : form.schedule ? 'Programar' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
