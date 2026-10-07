import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clapperboard, Package, Search } from 'lucide-react';
import { PageHeader } from '@/components/app/page';
import { ProductImage, VideoThumb } from '@/components/app/media';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useServices } from '@/contexts/services';
import { qk, useAction, usePlan, useProducts, useProfile, useVideos } from '@/hooks/queries';
import { formatCurrency, formatDateTime, formatDuration, formatMinutes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fieldErrors, liveSchema } from '@/lib/validation';
import { combineDateTime, describeRecurrence, expandRecurrence, WEEKDAY_LABELS } from '@/services/recurrence';
import { GENERATION_HORIZON_DAYS } from '@/services/domain/lives';
import type { Recurrence, RecurrenceFrequency } from '@/types/domain';

const STEPS = ['Vídeo', 'Produto', 'Detalhes', 'Agenda', 'Revisão'] as const;

const FREQUENCIES: { value: RecurrenceFrequency; label: string; hint: string }[] = [
  { value: 'none', label: 'Não repetir', hint: 'Uma única live' },
  { value: 'daily', label: 'Todos os dias', hint: 'Diariamente no mesmo horário' },
  { value: 'weekdays', label: 'Segunda a sexta', hint: 'Somente dias úteis' },
  { value: 'weekly', label: 'Dias específicos', hint: 'Escolha os dias da semana' },
  { value: 'interval', label: 'Intervalo personalizado', hint: 'A cada N dias' },
];

export default function LiveWizardPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const services = useServices();
  const plan = usePlan();
  const { data: profile } = useProfile();
  const videos = useVideos();
  const products = useProducts();

  const [step, setStep] = useState(params.get('video') ? 1 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [videoQuery, setVideoQuery] = useState('');
  const [form, setForm] = useState(() => ({
    video_id: params.get('video') ?? '',
    product_id: params.get('produto') ?? '',
    title: '',
    description: '',
    duration_minutes: String(profile?.preferences.defaultLiveDuration ?? 60),
    recurrence: {
      frequency: 'none',
      time: /^\d{2}:\d{2}$/.test(params.get('hora') ?? '') ? params.get('hora')! : '20:00',
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '') && params.get('data')! >= format(new Date(), 'yyyy-MM-dd')
        ? params.get('data')!
        : format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      endDate: null,
      weekdays: [1, 3, 5],
      intervalDays: 2,
    } as Recurrence,
  }));

  const video = videos.data?.find((v) => v.id === form.video_id);
  const product = products.data?.find((p) => p.id === form.product_id);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setRec = (patch: Partial<Recurrence>) => setForm((f) => ({ ...f, recurrence: { ...f.recurrence, ...patch } }));

  const availableVideos = useMemo(
    () => (videos.data ?? []).filter((v) => v.status !== 'archived' && v.name.toLowerCase().includes(videoQuery.toLowerCase())),
    [videos.data, videoQuery],
  );

  const occurrences = useMemo(() => {
    try {
      return expandRecurrence(form.recurrence, { from: new Date(), until: addDays(new Date(), GENERATION_HORIZON_DAYS), limit: 60 });
    } catch {
      return [];
    }
  }, [form.recurrence]);

  const create = useAction(
    (asDraft: boolean) => services.lives.create({ ...form, duration_minutes: Number(form.duration_minutes) }, { plan, asDraft }),
    {
      invalidate: [qk.lives, qk.automations, qk.schedules, qk.videos],
      success: (r) => (r.automation ? `Automação criada com ${r.lives.length} lives programadas` : r.lives[0].status === 'draft' ? 'Rascunho salvo' : 'Live programada'),
      onSuccess: (r) => navigate(r.automation ? '/automacoes' : `/lives/${r.lives[0].id}`),
    },
  );

  function validateStep(target: number): boolean {
    const e: Record<string, string> = {};
    if (target > 0 && !form.video_id) e.video_id = 'Selecione um vídeo';
    if (target > 1 && !form.product_id) e.product_id = 'Selecione um produto';
    if (target > 2) {
      const r = liveSchema.pick({ title: true, description: true, duration_minutes: true }).safeParse(form);
      if (!r.success) Object.assign(e, fieldErrors(r.error));
    }
    if (target > 3) {
      const r = liveSchema.shape.recurrence.safeParse(form.recurrence);
      if (!r.success) Object.assign(e, Object.fromEntries(Object.entries(fieldErrors(r.error)).map(([k, v]) => [`recurrence.${k}`, v])));
      else if (form.recurrence.frequency === 'none' && combineDateTime(form.recurrence.startDate, form.recurrence.time) < new Date()) e['recurrence.time'] = 'Esse horário já passou';
      else if (occurrences.length === 0) e['recurrence.frequency'] = 'Nenhuma ocorrência nos próximos 30 dias';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const go = (target: number) => {
    if (target <= step || validateStep(target)) {
      // sugere título a partir do produto
      if (target === 2 && !form.title && product) set('title', `${product.name} — oferta ao vivo`.slice(0, 160));
      if (target === 1 && !form.product_id && video?.product_id) set('product_id', video.product_id);
      setStep(target);
    }
  };

  return (
    <div className="animate-in mx-auto max-w-3xl">
      <Link to="/lives" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Lives
      </Link>
      <PageHeader title="Nova live" description="Transforme um vídeo da sua biblioteca em uma live programada." />

      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {STEPS.map((label, i) => (
          <li key={label} className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => go(i)}
              className={cn(
                'flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                i === step ? 'bg-accent text-accent-foreground' : i < step ? 'text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span className={cn('grid size-5 place-items-center rounded-full text-[11px]', i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-primary/15 text-primary' : 'bg-muted')}>
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-border" />}
          </li>
        ))}
      </ol>

      <Card className="p-4 sm:p-6">
        {step === 0 && (
          <div>
            <h2 className="font-semibold">1. Selecione o vídeo</h2>
            <p className="mb-4 text-sm text-muted-foreground">O conteúdo que será usado nesta configuração de live.</p>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={videoQuery} onChange={(e) => setVideoQuery(e.target.value)} placeholder="Buscar vídeo" className="pl-9" />
            </div>
            {availableVideos.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Clapperboard className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-sm">Nenhum vídeo disponível.</p>
                <Button asChild size="sm" className="mt-3"><Link to="/videos">Enviar vídeo</Link></Button>
              </div>
            ) : (
              <div className="grid max-h-[420px] gap-2 overflow-y-auto sm:grid-cols-2">
                {availableVideos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => set('video_id', v.id)}
                    className={cn('flex items-center gap-3 rounded-xl border p-2 text-left transition-colors', form.video_id === v.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}
                  >
                    <VideoThumb video={v} className="aspect-video w-24" />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDuration(v.duration_seconds)} · {v.usage_count} {v.usage_count === 1 ? 'uso' : 'usos'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {errors.video_id && <p className="mt-2 text-sm text-destructive">{errors.video_id}</p>}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-semibold">2. Selecione o produto</h2>
            <p className="mb-4 text-sm text-muted-foreground">O produto em destaque na live.</p>
            <div className="grid max-h-[460px] gap-2 overflow-y-auto sm:grid-cols-2">
              {(products.data ?? []).filter((p) => p.status !== 'archived').map((p) => (
                <button
                  key={p.id}
                  onClick={() => set('product_id', p.id)}
                  className={cn('flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors', form.product_id === p.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}
                >
                  <ProductImage product={p} className="size-12" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(Number(p.promo_price ?? p.price))} · {Number(p.commission_rate)}% comissão
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {(products.data ?? []).length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Package className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-sm">Cadastre um produto primeiro.</p>
                <Button asChild size="sm" className="mt-3"><Link to="/produtos">Ir para produtos</Link></Button>
              </div>
            )}
            {errors.product_id && <p className="mt-2 text-sm text-destructive">{errors.product_id}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <div>
              <h2 className="font-semibold">3. Detalhes da live</h2>
              <p className="text-sm text-muted-foreground">Título, descrição e duração.</p>
            </div>
            <Field label="Título" htmlFor="l-title" error={errors.title}>
              <Input id="l-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} aria-invalid={!!errors.title} />
            </Field>
            <Field label="Descrição" htmlFor="l-desc" error={errors.description}>
              <Textarea id="l-desc" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="O que o público vai ver, oferta do dia, cupom…" />
            </Field>
            <Field label="Duração (minutos)" htmlFor="l-dur" error={errors.duration_minutes} hint={video ? `O vídeo tem ${formatDuration(video.duration_seconds)}.` : undefined}>
              <Input id="l-dur" type="number" min={5} max={720} value={form.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)} className="w-32" aria-invalid={!!errors.duration_minutes} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <div>
              <h2 className="font-semibold">4. Data, horário e repetição</h2>
              <p className="text-sm text-muted-foreground">Com repetição, o LiveFlow cria uma automação e gera as ocorrências.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={form.recurrence.frequency === 'none' ? 'Data' : 'Início'} htmlFor="l-date" error={errors['recurrence.startDate']}>
                <Input id="l-date" type="date" value={form.recurrence.startDate} min={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setRec({ startDate: e.target.value })} />
              </Field>
              <Field label="Horário" htmlFor="l-time" error={errors['recurrence.time']}>
                <Input id="l-time" type="time" value={form.recurrence.time} onChange={(e) => setRec({ time: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-2">
              <span className="text-[13px] font-medium">Repetição</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setRec({ frequency: f.value })}
                    className={cn('rounded-xl border p-3 text-left transition-colors', form.recurrence.frequency === f.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}
                  >
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.hint}</p>
                  </button>
                ))}
              </div>
              {errors['recurrence.frequency'] && <p className="text-xs text-destructive">{errors['recurrence.frequency']}</p>}
            </div>
            {form.recurrence.frequency === 'weekly' && (
              <Field label="Dias da semana" error={errors['recurrence.weekdays']}>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((d, i) => {
                    const on = form.recurrence.weekdays?.includes(i);
                    return (
                      <button
                        key={d}
                        onClick={() => setRec({ weekdays: on ? form.recurrence.weekdays!.filter((x) => x !== i) : [...(form.recurrence.weekdays ?? []), i] })}
                        className={cn('h-9 w-12 rounded-lg border text-sm font-medium', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            {form.recurrence.frequency === 'interval' && (
              <Field label="Repetir a cada (dias)" htmlFor="l-int" error={errors['recurrence.intervalDays']}>
                <Input id="l-int" type="number" min={1} max={90} value={form.recurrence.intervalDays ?? 2} onChange={(e) => setRec({ intervalDays: Number(e.target.value) })} className="w-28" />
              </Field>
            )}
            {form.recurrence.frequency !== 'none' && (
              <Field label="Termina em (opcional)" htmlFor="l-end" error={errors['recurrence.endDate']} hint="Sem data final, a automação continua até ser desativada.">
                <Input id="l-end" type="date" value={form.recurrence.endDate ?? ''} min={form.recurrence.startDate} onChange={(e) => setRec({ endDate: e.target.value || null })} className="w-48" />
              </Field>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5">
            <div>
              <h2 className="font-semibold">5. Revise e programe</h2>
              <p className="text-sm text-muted-foreground">Confira antes de confirmar.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {video && (
                <div className="flex items-center gap-3 rounded-xl border p-2.5">
                  <VideoThumb video={video} className="aspect-video w-24" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Vídeo</p>
                    <p className="truncate text-sm font-medium">{video.name}</p>
                  </div>
                </div>
              )}
              {product && (
                <div className="flex items-center gap-3 rounded-xl border p-2.5">
                  <ProductImage product={product} className="size-12" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Produto</p>
                    <p className="truncate text-sm font-medium">{product.name}</p>
                  </div>
                </div>
              )}
            </div>
            <dl className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Título</dt><dd className="font-medium">{form.title}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Duração</dt><dd className="font-medium">{formatMinutes(Number(form.duration_minutes))}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Quando</dt><dd className="font-medium">{describeRecurrence(form.recurrence)}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">
                  {form.recurrence.frequency === 'none' ? 'Data' : `Próximas ocorrências (${occurrences.length} nos próximos ${GENERATION_HORIZON_DAYS} dias)`}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {occurrences.slice(0, 6).map((d) => (
                    <span key={d.toISOString()} className="rounded-md border bg-card px-2 py-0.5 text-xs">{formatDateTime(d)}</span>
                  ))}
                  {occurrences.length > 6 && <span className="px-1 text-xs text-muted-foreground">+{occurrences.length - 6}</span>}
                </dd>
              </div>
            </dl>
            <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-[13px] leading-relaxed">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                O LiveFlow <strong>não transmite nem publica nada</strong> no TikTok: ele organiza e agenda sua operação. As regras de LIVE do TikTok Shop
                exigem interação em tempo real e restringem conteúdo pré-gravado apresentado como ao vivo. Use os vídeos como roteiro/apoio, não como substituto da live.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? navigate('/lives') : setStep(step - 1))}>
            <ArrowLeft /> {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < 4 ? (
            <Button onClick={() => go(step + 1)}>
              Continuar <ArrowRight />
            </Button>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {form.recurrence.frequency === 'none' && (
                <Button variant="outline" onClick={() => create.mutate(true)} disabled={create.isPending}>
                  Salvar como rascunho
                </Button>
              )}
              <Button variant="brand" onClick={() => validateStep(5) && create.mutate(false)} loading={create.isPending}>
                {form.recurrence.frequency === 'none' ? 'Programar live' : 'Criar automação'}
              </Button>
            </div>
          )}
        </div>
      </Card>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Plano atual: {plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Premium'} · limites verificados ao programar.
      </p>
    </div>
  );
}
