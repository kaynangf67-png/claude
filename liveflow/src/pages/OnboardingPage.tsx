import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ArrowRight, CalendarClock, CheckCircle2, Clapperboard, Package, PartyPopper, Send, Sparkles, UploadCloud } from 'lucide-react';
import { buildCaption } from '@/services/caption';
import { combineDateTime } from '@/services/recurrence';
import { toast } from 'sonner';
import { Logo } from '@/components/app/brand';
import { ProductForm } from '@/components/app/product-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Progress } from '@/components/ui/misc';
import { useServices } from '@/contexts/services';
import { ALL_DATA_KEYS, errorMessage, qk, usePlan, useProfile } from '@/hooks/queries';
import { useDemoSeed } from '@/hooks/use-demo-seed';
import { extractVideoMeta } from '@/lib/video-meta';
import { validateVideoFile, VIDEO_MIME_TYPES } from '@/lib/validation';
import { cn } from '@/lib/utils';
import type { Product, Video } from '@/types/domain';

const STEPS = ['Boas-vindas', 'Produto', 'Vídeo', 'Publicação', 'Pronto'];

export default function OnboardingPage() {
  const services = useServices();
  const plan = usePlan();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const seed = useDemoSeed();
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState<Product | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [uploading, setUploading] = useState(false);
  const [live, setLive] = useState({ title: '', date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), time: '12:00' });
  const [creatingLive, setCreatingLive] = useState(false);
  const [liveCreated, setLiveCreated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function finish() {
    if (profile) await services.account.updateProfile(profile.id, { onboarding_completed: true });
    await Promise.all(ALL_DATA_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: key })));
    navigate('/', { replace: true });
  }

  async function useDemo() {
    await seed.mutateAsync();
    await finish();
  }

  async function uploadVideo(file: File | undefined) {
    if (!file) return;
    const invalid = validateVideoFile(file);
    if (invalid) return toast.error(invalid);
    setUploading(true);
    try {
      const meta = await extractVideoMeta(file);
      const v = await services.videos.upload(file, { name: file.name.replace(/\.[^.]+$/, ''), productId: product?.id ?? null, meta, plan });
      setVideo(v);
      toast.success('Vídeo enviado');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function createLive() {
    if (!video || !product) return;
    setCreatingLive(true);
    try {
      const { caption, hashtags } = buildCaption({ productName: product.name, price: Number(product.promo_price ?? product.price), category: product.category, format: 'maos' });
      await services.posts.create(
        {
          video_id: video.id,
          product_id: product.id,
          format: 'maos',
          caption: live.title.trim() ? `${live.title.trim()}\n\n${caption}` : caption,
          hashtags,
          notes: '',
          scheduled_at: combineDateTime(live.date, live.time).toISOString(),
        },
        plan,
      );
      setLiveCreated(true);
      queryClient.invalidateQueries({ queryKey: qk.posts });
      setStep(4);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreatingLive(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_60%)]">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
        {step < 4 && (
          <button onClick={finish} className="text-sm text-muted-foreground hover:text-foreground">
            Pular configuração
          </button>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-10 sm:pt-6">
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Passo {step + 1} de {STEPS.length}</span>
            <span>{STEPS[step]}</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} indicatorClassName="brand-gradient" />
        </div>

        <Card className="animate-in p-5 sm:p-8" key={step}>
          {step === 0 && (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl brand-gradient text-white shadow-lg shadow-primary/30">
                <Sparkles className="size-6" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">Bem-vindo ao LiveFlow</h1>
              <p className="mt-2 text-muted-foreground">Venda no TikTok Shop sem aparecer. Vamos configurar o essencial em 3 passos.</p>
              <div className="mt-6 grid gap-2 text-left text-sm">
                {[
                  { icon: Package, t: 'Cadastre um produto' },
                  { icon: Clapperboard, t: 'Envie um vídeo' },
                  { icon: Send, t: 'Programe sua primeira publicação' },
                ].map(({ icon: Icon, t }) => (
                  <div key={t} className="flex items-center gap-3 rounded-xl border p-3">
                    <Icon className="size-4 text-primary" /> {t}
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-2">
                <Button size="lg" onClick={() => setStep(1)}>Começar <ArrowRight /></Button>
                <Button size="lg" variant="ghost" onClick={useDemo} loading={seed.isPending}>Prefiro explorar com dados de demonstração</Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <Package className="size-6 text-primary" />
              <h1 className="mt-3 text-xl font-semibold tracking-tight">Cadastre seu primeiro produto</h1>
              <p className="mt-1 mb-5 text-sm text-muted-foreground">Só o básico agora. Você completa depois.</p>
              {product ? (
                <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/5 p-4">
                  <CheckCircle2 className="size-5 text-success" />
                  <p className="text-sm"><strong>{product.name}</strong> cadastrado.</p>
                </div>
              ) : (
                <ProductForm
                  compact
                  submitLabel="Cadastrar produto"
                  onSubmit={async (input) => {
                    const p = await services.products.create(input, plan);
                    setProduct(p);
                    queryClient.invalidateQueries({ queryKey: qk.products });
                    setStep(2);
                  }}
                />
              )}
              <div className="mt-5 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>Voltar</Button>
                {product && <Button onClick={() => setStep(2)}>Continuar <ArrowRight /></Button>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <Clapperboard className="size-6 text-primary" />
              <h1 className="mt-3 text-xl font-semibold tracking-tight">Envie seu primeiro vídeo</h1>
              <p className="mt-1 mb-5 text-sm text-muted-foreground">O arquivo fica privado na sua conta.</p>
              {video ? (
                <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/5 p-4">
                  <CheckCircle2 className="size-5 text-success" />
                  <p className="truncate text-sm"><strong>{video.name}</strong> enviado.</p>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    uploadVideo(e.dataTransfer.files[0]);
                  }}
                  disabled={uploading}
                  className={cn('flex w-full flex-col items-center rounded-xl border-2 border-dashed p-10 transition-colors hover:border-primary/50 hover:bg-muted/40', uploading && 'opacity-60')}
                >
                  <UploadCloud className="size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">{uploading ? 'Enviando…' : 'Arraste um vídeo ou clique para escolher'}</p>
                  <p className="text-xs text-muted-foreground">MP4, MOV ou WebM</p>
                </button>
              )}
              <input ref={fileRef} type="file" accept={VIDEO_MIME_TYPES.join(',')} className="hidden" onChange={(e) => uploadVideo(e.target.files?.[0])} />
              <div className="mt-5 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                <Button variant={video ? 'default' : 'ghost'} onClick={() => setStep(video ? 3 : 4)}>
                  {video ? <>Continuar <ArrowRight /></> : 'Pular por enquanto'}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <CalendarClock className="size-6 text-primary" />
              <h1 className="mt-3 text-xl font-semibold tracking-tight">Programe sua primeira publicação</h1>
              <p className="mt-1 mb-5 text-sm text-muted-foreground">
                Com <strong>{video?.name}</strong> e <strong>{product?.name}</strong>.
              </p>
              <div className="grid gap-4">
                <Field label="Gancho da legenda (opcional)" htmlFor="ob-title" hint="Legenda e hashtags são geradas automaticamente; dá para editar depois.">
                  <Input id="ob-title" value={live.title} placeholder="Ex.: Isso mudou minha rotina" onChange={(e) => setLive({ ...live, title: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data" htmlFor="ob-date"><Input id="ob-date" type="date" value={live.date} min={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setLive({ ...live, date: e.target.value })} /></Field>
                  <Field label="Horário" htmlFor="ob-time"><Input id="ob-time" type="time" value={live.time} onChange={(e) => setLive({ ...live, time: e.target.value })} /></Field>
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(4)}>Pular</Button>
                <Button onClick={createLive} loading={creatingLive}>Programar publicação <ArrowRight /></Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <PartyPopper className="mx-auto size-10 text-primary" />
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">Pronto.</h1>
              <p className="mt-2 text-muted-foreground">
                {liveCreated ? 'Sua primeira publicação está programada — o LiveFlow te lembra na hora de postar.' : 'Sua conta está configurada.'} Agora é acompanhar tudo pelo dashboard.
              </p>
              <ul className="mx-auto mt-5 grid max-w-xs gap-2 text-left text-sm">
                {[
                  { ok: Boolean(product), t: 'Produto cadastrado' },
                  { ok: Boolean(video), t: 'Vídeo enviado' },
                  { ok: liveCreated, t: 'Publicação programada' },
                ].map((i) => (
                  <li key={i.t} className={cn('flex items-center gap-2', !i.ok && 'text-muted-foreground')}>
                    <CheckCircle2 className={cn('size-4', i.ok ? 'text-success' : 'text-muted-foreground/40')} /> {i.t}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-7 w-full" onClick={finish}>Ir para o dashboard</Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
