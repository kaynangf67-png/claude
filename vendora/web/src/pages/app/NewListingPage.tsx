import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Link2, PenLine, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { MARKETPLACE_IDS, MARKETPLACE_PROFILES, type MarketplaceId } from '@vendora/shared/marketplaces';
import type { ProductData, Spec } from '@vendora/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FieldStatusBadge, MarketplaceChip, Notice, PageHeader, Spinner } from '../../components/ui';
import { api, ApiError, type Asset, type ListingDetail, type Product } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { FIELD_LABELS, formatPrice } from '../../lib/format';
import { useToast } from '../../lib/toast';

type Phase = 'input' | 'analyzing' | 'review' | 'generating';

interface Draft {
  title: string;
  brand: string;
  model: string;
  gtin: string;
  description: string;
  price: string;
  features: string[];
  specifications: Spec[];
}

const toDraft = (d: ProductData): Draft => ({
  title: d.title ?? '',
  brand: d.brand ?? '',
  model: d.model ?? '',
  gtin: d.gtin ?? '',
  description: d.description ?? '',
  price: d.price ? String(d.price.amount) : '',
  features: d.features,
  specifications: d.specifications,
});

/** Só envia o que o vendedor mudou — o resto mantém o status original (confirmado/inferido). */
function diff(product: Product, draft: Draft): Partial<ProductData> {
  const d = product.data;
  const out: Partial<ProductData> = {};
  const str = (v: string) => (v.trim() ? v.trim() : null);
  if (str(draft.title) !== d.title) out.title = str(draft.title);
  if (str(draft.brand) !== d.brand) out.brand = str(draft.brand);
  if (str(draft.model) !== d.model) out.model = str(draft.model);
  if (str(draft.gtin) !== d.gtin) out.gtin = str(draft.gtin);
  if (str(draft.description) !== d.description) out.description = str(draft.description);
  const price = draft.price.trim() ? Number(draft.price.replace(',', '.')) : null;
  if (price !== (d.price?.amount ?? null))
    out.price = price != null && Number.isFinite(price) ? { amount: price, currency: d.price?.currency ?? 'BRL' } : null;
  const feats = draft.features.map((f) => f.trim()).filter(Boolean);
  if (JSON.stringify(feats) !== JSON.stringify(d.features)) out.features = feats;
  const specs = draft.specifications.filter((s) => s.name.trim() && s.value.trim());
  if (JSON.stringify(specs) !== JSON.stringify(d.specifications)) out.specifications = specs;
  return out;
}

export function NewListingPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { meta } = useAuth();
  const [phase, setPhase] = useState<Phase>('input');
  const [url, setUrl] = useState(params.get('url') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [extraction, setExtraction] = useState<{ ok: boolean; reason?: string; notes?: string[] } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [importing, setImporting] = useState(false);
  const [marketplace, setMarketplace] = useState<MarketplaceId>('mercado_livre');
  const [audience, setAudience] = useState('');
  const autoRan = useRef(false);

  async function importImages(p: Product) {
    if (p.data.images.length === 0) return;
    setImporting(true);
    try {
      const r = await api.post<{ assets: Asset[]; results: Array<{ ok: boolean }> }>(`/api/products/${p.id}/images/import`);
      setAssets(r.assets);
      const failed = r.results.filter((x) => !x.ok).length;
      if (failed) toast('error', `${failed} imagem(ns) não puderam ser baixadas da página.`);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Falha ao baixar as imagens.');
    } finally {
      setImporting(false);
    }
  }

  async function analyze(target: string) {
    setError(null);
    setPhase('analyzing');
    try {
      const r = await api.post<{ product: Product; extraction: { ok: boolean; reason?: string; notes?: string[] } }>(
        '/api/products/analyze',
        { url: target },
      );
      setProduct(r.product);
      setExtraction(r.extraction);
      setDraft(toDraft(r.product.data));
      setAssets([]);
      setPhase('review');
      setParams({ product: r.product.id }, { replace: true });
      if (r.extraction.ok) void importImages(r.product);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível analisar o link.');
      setPhase('input');
    }
  }

  // Abre direto na revisão (?product=) ou analisa o link vindo da página inicial (?url=).
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const pid = params.get('product');
    if (pid) {
      setPhase('analyzing');
      Promise.all([api.get<{ product: Product }>(`/api/products/${pid}`), api.get<{ assets: Asset[] }>(`/api/products/${pid}/assets`)])
        .then(([p, a]) => {
          setProduct(p.product);
          setDraft(toDraft(p.product.data));
          setAssets(a.assets);
          setExtraction(p.product.status === 'failed' ? { ok: false, reason: p.product.failureReason ?? undefined } : { ok: true });
          setPhase('review');
        })
        .catch(() => setPhase('input'));
    } else if (params.get('url')) void analyze(params.get('url')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startManual() {
    setError(null);
    const empty: Draft = { title: '', brand: '', model: '', gtin: '', description: '', price: '', features: [], specifications: [] };
    setProduct(null);
    setExtraction({ ok: false });
    setDraft(empty);
    setAssets([]);
    setPhase('review');
  }

  async function generate() {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast('error', 'Informe ao menos o nome do produto.');
      return;
    }
    setPhase('generating');
    try {
      let p = product;
      if (!p) {
        const price = draft.price.trim() ? Number(draft.price.replace(',', '.')) : undefined;
        p = (
          await api.post<{ product: Product }>('/api/products/manual', {
            sourceUrl: url.trim() && /^https?:\/\//.test(url.trim()) ? url.trim() : undefined,
            title: draft.title,
            brand: draft.brand || undefined,
            model: draft.model || undefined,
            gtin: draft.gtin || undefined,
            description: draft.description || undefined,
            price: price != null && Number.isFinite(price) ? price : undefined,
            features: draft.features.filter((f) => f.trim()),
            specifications: draft.specifications.filter((s) => s.name.trim() && s.value.trim()),
          })
        ).product;
      } else {
        const changes = diff(p, draft);
        if (Object.keys(changes).length) p = (await api.patch<{ product: Product }>(`/api/products/${p.id}`, { data: changes })).product;
      }
      const r = await api.post<ListingDetail>('/api/listings', { productId: p.id, marketplace, audience: audience || undefined });
      navigate(`/app/anuncios/${r.listing.id}`);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Falha ao gerar o anúncio.');
      setPhase('review');
    }
  }

  async function upload(file: File) {
    if (!product) {
      toast('error', 'Gere o produto primeiro para anexar fotos — ou anexe na tela do anúncio.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api.post<{ asset: Asset }>(`/api/products/${product.id}/images/upload`, form);
      setAssets((a) => [...a, r.asset]);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Falha no envio.');
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) void analyze(url.trim());
  };

  return (
    <>
      <PageHeader title="Novo anúncio" subtitle="Colar o link → conferir os dados reais → escolher o canal → gerar." />

      {(phase === 'input' || phase === 'analyzing') && (
        <form onSubmit={submit} className="card p-6 sm:p-8">
          <label htmlFor="url" className="label">
            Link do produto
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
              <input
                id="url"
                className="input py-3 pl-10"
                placeholder="Cole o link do produto aqui..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={phase === 'analyzing'}
                inputMode="url"
                autoFocus
              />
            </div>
            <button className="btn-primary py-3" disabled={phase === 'analyzing' || !url.trim()}>
              {phase === 'analyzing' ? <Spinner /> : <Sparkles className="size-4" />}
              {phase === 'analyzing' ? 'Lendo a página…' : 'Analisar produto'}
            </button>
          </div>
          {error && (
            <div className="mt-4">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500">
            <span>
              Lemos apenas dados públicos da página{meta?.respectRobotsTxt ? ', respeitando o robots.txt do site' : ''}.
            </span>
            <button type="button" className="inline-flex items-center gap-1 font-semibold text-violet-brand hover:underline" onClick={startManual}>
              <PenLine className="size-3.5" /> Prefiro digitar os dados
            </button>
          </div>
        </form>
      )}

      <AnimatePresence>
        {(phase === 'review' || phase === 'generating') && draft && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {extraction && !extraction.ok && (
              <Notice tone="warning">
                {extraction.reason ? (
                  <>
                    <strong>Não conseguimos ler esta página.</strong> {extraction.reason} Nada foi preenchido automaticamente — informe os dados
                    abaixo.
                  </>
                ) : (
                  'Cadastro manual: informe os dados reais do produto. A IA só usa o que você preencher.'
                )}
              </Notice>
            )}
            {extraction?.ok && extraction.notes?.map((n) => <Notice key={n}>{n}</Notice>)}

            <section className="card p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">Dados do produto</h2>
                  <p className="text-xs text-ink-500">
                    {product?.sourceDomain ? `Origem: ${product.sourceDomain}` : 'Origem: informado por você'} · Corrija o que estiver errado.
                    Campos alterados passam a ser “Informado por você”.
                  </p>
                </div>
                {product?.data.price && <span className="text-sm font-semibold">{formatPrice(product.data.price)}</span>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(['title', 'brand', 'model', 'gtin'] as const).map((f) => (
                  <div key={f} className={f === 'title' ? 'md:col-span-2' : ''}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="label mb-0" htmlFor={`f-${f}`}>
                        {f === 'title' ? 'Nome do produto (original)' : FIELD_LABELS[f]}
                      </label>
                      {product && <FieldStatusBadge status={product.fieldStatus[f]} />}
                    </div>
                    <input
                      id={`f-${f}`}
                      className="input"
                      value={draft[f]}
                      onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                      placeholder={f === 'title' ? 'Ex.: nome completo como na embalagem' : 'Não informado'}
                    />
                  </div>
                ))}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="label mb-0" htmlFor="f-price">
                      Preço
                    </label>
                    {product && <FieldStatusBadge status={product.fieldStatus.price} />}
                  </div>
                  <input id="f-price" className="input" inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Não informado" />
                </div>
                <div className="md:col-span-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="label mb-0" htmlFor="f-description">
                      Descrição original
                    </label>
                    {product && <FieldStatusBadge status={product.fieldStatus.description} />}
                  </div>
                  <textarea
                    id="f-description"
                    rows={5}
                    className="input"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Cole aqui a descrição do fabricante, se tiver."
                  />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="label mb-0" htmlFor="f-features">
                    Características (uma por linha)
                  </label>
                  {product && <FieldStatusBadge status={product.fieldStatus.features} />}
                </div>
                <textarea
                  id="f-features"
                  rows={3}
                  className="input"
                  value={draft.features.join('\n')}
                  onChange={(e) => setDraft({ ...draft, features: e.target.value.split('\n') })}
                  placeholder="Ex.: Parede dupla de aço inox"
                />
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="label mb-0">Especificações</span>
                  {product && <FieldStatusBadge status={product.fieldStatus.specifications} />}
                </div>
                <div className="space-y-2">
                  {draft.specifications.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input"
                        placeholder="Nome (ex.: Capacidade)"
                        value={s.name}
                        aria-label="Nome da especificação"
                        onChange={(e) => {
                          const next = [...draft.specifications];
                          next[i] = { ...s, name: e.target.value };
                          setDraft({ ...draft, specifications: next });
                        }}
                      />
                      <input
                        className="input"
                        placeholder="Valor (ex.: 500 ml)"
                        value={s.value}
                        aria-label="Valor da especificação"
                        onChange={(e) => {
                          const next = [...draft.specifications];
                          next[i] = { ...s, value: e.target.value };
                          setDraft({ ...draft, specifications: next });
                        }}
                      />
                      <button
                        type="button"
                        className="btn-ghost px-2"
                        aria-label="Remover especificação"
                        onClick={() => setDraft({ ...draft, specifications: draft.specifications.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-ghost text-violet-brand"
                    onClick={() => setDraft({ ...draft, specifications: [...draft.specifications, { name: '', value: '' }] })}
                  >
                    <Plus className="size-4" /> Adicionar especificação
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="label mb-0">Fotos originais</span>
                  {product && <FieldStatusBadge status={product.fieldStatus.images} />}
                </div>
                {importing && (
                  <p className="flex items-center gap-2 text-sm text-ink-500">
                    <Spinner /> Baixando as imagens da página…
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {assets
                    .filter((a) => a.kind === 'original')
                    .map((a) => (
                      <img key={a.id} src={a.url} alt="Foto original do produto" className="size-24 rounded-xl border border-ink-200 bg-white object-contain" />
                    ))}
                  {product && (
                    <label className="grid size-24 cursor-pointer place-items-center rounded-xl border border-dashed border-ink-300 text-ink-500 transition hover:border-violet-brand hover:text-violet-brand">
                      <span className="flex flex-col items-center gap-1 text-[11px]">
                        <Upload className="size-4" /> Enviar foto
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void upload(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                {!product && <p className="text-xs text-ink-500">Você poderá enviar fotos na tela do anúncio.</p>}
              </div>
            </section>

            <section className="card p-6">
              <h2 className="text-base font-semibold">Canal de destino</h2>
              <p className="text-xs text-ink-500">Cada canal tem limites e orientações próprias.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {MARKETPLACE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMarketplace(id)}
                    aria-pressed={marketplace === id}
                    className={`rounded-2xl border p-4 text-left transition ${
                      marketplace === id ? 'border-violet-brand bg-violet-brand/5 ring-4 ring-violet-brand/10' : 'border-ink-200 bg-white hover:border-ink-300'
                    }`}
                  >
                    <MarketplaceChip id={id} />
                    <p className="mt-3 text-xs text-ink-500">Título até {MARKETPLACE_PROFILES[id].title.maxLength.value} caracteres*</p>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-500">* Padrão do sistema; ajustável em Configurações.</p>
              <div className="mt-5">
                <label className="label" htmlFor="audience">
                  Público-alvo (opcional)
                </label>
                <input
                  id="audience"
                  className="input"
                  value={audience}
                  maxLength={300}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ex.: quem trabalha em escritório e quer manter o café quente"
                />
              </div>
            </section>

            {(() => {
              const missing = Object.entries(product?.fieldStatus ?? {}).filter(([, s]) => s === 'missing').map(([f]) => FIELD_LABELS[f] ?? f);
              return missing.length > 0 ? (
                <Notice tone="warning">
                  Não encontrados na origem: {missing.join(', ')}. O anúncio não vai inventar esses dados — ele vai listar o que você precisa
                  confirmar.
                </Notice>
              ) : null;
            })()}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setPhase('input');
                  setProduct(null);
                  setParams({}, { replace: true });
                }}
              >
                Analisar outro link
              </button>
              <button className="btn-primary px-6 py-3" onClick={generate} disabled={phase === 'generating'}>
                {phase === 'generating' ? <Spinner /> : <Sparkles className="size-4" />}
                {phase === 'generating' ? (meta?.ai.provider === 'anthropic' ? 'A IA está escrevendo…' : 'Montando o anúncio…') : 'Gerar meu anúncio'}
                {phase !== 'generating' && <ArrowRight className="size-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
