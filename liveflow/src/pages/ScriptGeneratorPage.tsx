import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Copy, Layers, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useServices } from '@/contexts/services';
import { errorMessage, usePlan, useProducts } from '@/hooks/queries';
import { sanitizeText } from '@/lib/validation';
import { OBJECTIVE_LABELS, type Script, type ScriptInput, type ScriptObjective } from '@/services/ai/types';
import { FORMAT_KEYS, POST_FORMATS } from '@/services/formats';
import type { PostFormat } from '@/types/domain';

function scriptToText(s: Script) {
  return `GANCHO\n${s.hook}\n\nROTEIRO\n${s.script}\n\nBENEFÍCIOS\n${s.benefits.map((b) => `- ${b}`).join('\n')}\n\nPROVA\n${s.proof}\n\nCTA\n${s.cta}`;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error('Não foi possível copiar.');
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? 'Copiado' : 'Copiar'}
    </Button>
  );
}

function ScriptCard({ script, index }: { script: Script; index?: number }) {
  return (
    <Card className="animate-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {index != null ? <Badge tone="primary">Variação {index + 1}</Badge> : <Badge tone="primary"><Sparkles /> Roteiro</Badge>}
        </CardTitle>
        <CopyButton text={scriptToText(script)} />
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-xl brand-gradient p-[1px]">
          <div className="rounded-[11px] bg-card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Gancho</p>
            <p className="mt-1 text-base font-semibold">{script.hook}</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Roteiro</p>
          <pre className="mt-1.5 font-sans text-sm leading-relaxed whitespace-pre-wrap">{script.script}</pre>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Benefícios</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm">{script.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prova</p>
            <p className="mt-1.5 text-sm">{script.proof}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CTA</p>
            <p className="mt-1.5 text-sm font-medium">{script.cta}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScriptGeneratorPage() {
  const services = useServices();
  const plan = usePlan();
  const products = useProducts();
  const [params] = useSearchParams();
  const [productId, setProductId] = useState(params.get('produto') ?? '');
  const [input, setInput] = useState<ScriptInput>({ productName: '', price: null, benefits: '', audience: '', objective: 'vender', format: 'maos' });
  const [result, setResult] = useState<Script[] | null>(null);
  const [mode, setMode] = useState<'single' | 'variations'>('single');
  const [loading, setLoading] = useState<'single' | 'variations' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const p = products.data?.find((x) => x.id === productId);
    if (p) {
      setInput((i) => ({
        ...i,
        productName: p.name,
        price: Number(p.promo_price ?? p.price),
        benefits: i.benefits || p.description.split(/[.;]/).map((s) => s.trim()).filter(Boolean).slice(0, 4).join('\n'),
      }));
    }
  }, [productId, products.data]);

  async function run(kind: 'single' | 'variations', e?: FormEvent) {
    e?.preventDefault();
    const clean: ScriptInput = {
      productName: sanitizeText(input.productName).slice(0, 160),
      price: input.price,
      benefits: sanitizeText(input.benefits).slice(0, 2000),
      audience: sanitizeText(input.audience).slice(0, 200),
      objective: input.objective,
      format: input.format,
    };
    if (!clean.productName) return setError('Informe o nome do produto.');
    setError('');
    setLoading(kind);
    try {
      const out =
        kind === 'single'
          ? [await services.ai.generateScript(clean, plan, { productId: productId || null })]
          : await services.ai.generateVariations(clean, plan, { productId: productId || null, count: 5 });
      setResult(out);
      setMode(kind);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Gerador de roteiro"
        description="Gancho, roteiro, benefícios, prova e CTA — com cenas para gravar sem aparecer."
        actions={<Badge tone={services.ai.providerId === 'remote' ? 'primary' : 'neutral'}>{services.ai.providerId === 'remote' ? 'IA generativa' : 'Gerador local (templates)'}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit lg:sticky lg:top-24">
          <CardContent className="pt-4 sm:pt-5">
            <form onSubmit={(e) => run('single', e)} className="grid gap-4">
              <Field label="Usar dados de um produto" htmlFor="s-prod">
                <NativeSelect id="s-prod" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Preencher manualmente</option>
                  {(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Nome do produto" htmlFor="s-name" error={error}>
                <Input id="s-name" value={input.productName} onChange={(e) => setInput({ ...input, productName: e.target.value })} />
              </Field>
              <Field label="Preço (R$)" htmlFor="s-price">
                <Input id="s-price" inputMode="decimal" value={input.price ?? ''} onChange={(e) => setInput({ ...input, price: e.target.value ? Number(e.target.value.replace(',', '.')) || 0 : null })} />
              </Field>
              <Field label="Benefícios" htmlFor="s-ben" hint="Um por linha.">
                <Textarea id="s-ben" value={input.benefits} onChange={(e) => setInput({ ...input, benefits: e.target.value })} className="min-h-20" />
              </Field>
              <Field label="Público" htmlFor="s-aud">
                <Input id="s-aud" value={input.audience} onChange={(e) => setInput({ ...input, audience: e.target.value })} placeholder="Ex.: mães que trabalham em home office" />
              </Field>
              <Field label="Objetivo" htmlFor="s-obj">
                <NativeSelect id="s-obj" value={input.objective} onChange={(e) => setInput({ ...input, objective: e.target.value as ScriptObjective })}>
                  {Object.entries(OBJECTIVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Formato do vídeo" htmlFor="s-fmt" hint={input.format ? POST_FORMATS[input.format].description : 'Roteiro genérico (com apresentador).'}>
                <NativeSelect id="s-fmt" value={input.format ?? ''} onChange={(e) => setInput({ ...input, format: (e.target.value || undefined) as PostFormat | undefined })}>
                  {FORMAT_KEYS.map((k) => <option key={k} value={k}>{POST_FORMATS[k].label} (sem rosto)</option>)}
                  <option value="">Com apresentador</option>
                </NativeSelect>
              </Field>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Button type="submit" variant="brand" loading={loading === 'single'} disabled={loading !== null}>
                  {result ? <RefreshCw /> : <Wand2 />} {result ? 'Gerar novo roteiro' : 'Gerar roteiro'}
                </Button>
                <Button type="button" variant="outline" onClick={() => run('variations')} loading={loading === 'variations'} disabled={loading !== null}>
                  <Layers /> Gerar 5 variações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          {!result ? (
            <div className="grid min-h-80 place-items-center rounded-xl border border-dashed p-8 text-center">
              <div>
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl brand-gradient text-white"><Sparkles className="size-5" /></span>
                <p className="font-medium">Seu roteiro aparece aqui</p>
                <p className="mt-1 text-sm text-muted-foreground">Escolha um produto ou preencha os campos e clique em gerar.</p>
              </div>
            </div>
          ) : (
            result.map((s, i) => <ScriptCard key={`${s.hook}-${i}`} script={s} index={mode === 'variations' ? i : undefined} />)
          )}
        </div>
      </div>
    </div>
  );
}
