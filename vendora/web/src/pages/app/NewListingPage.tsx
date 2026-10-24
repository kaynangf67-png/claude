import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Camera, PenLine, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { MARKETPLACE_IDS, MARKETPLACE_PROFILES, type MarketplaceId } from '@vendora/shared/marketplaces';
import type { ProductData, Spec } from '@vendora/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FieldStatusBadge, MarketplaceChip, Notice, PageHeader, Spinner } from '../../components/ui';
import { api, ApiError, type Asset, type ListingDetail, type Product } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { FIELD_LABELS, formatPrice } from '../../lib/format';
import { compressPhoto } from '../../lib/photos';
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

interface PickedPhoto {
  id: string;
  file: File;
  preview: string;
}

const MAX_PHOTOS = 6;

function MarketplacePicker({ value, onChange }: { value: MarketplaceId; onChange: (m: MarketplaceId) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {MARKETPLACE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={`rounded-2xl border p-4 text-left transition ${
            value === id ? 'border-violet-brand bg-violet-brand/5 ring-4 ring-violet-brand/10' : 'border-ink-200 bg-white hover:border-ink-300'
          }`}
        >
          <MarketplaceChip id={id} />
          <p className="mt-3 text-xs text-ink-500">Título até {MARKETPLACE_PROFILES[id].title.maxLength.value} caracteres*</p>
        </button>
      ))}
    </div>
  );
}

export function NewListingPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { meta } = useAuth();
  const [phase, setPhase] = useState<Phase>('input');
  const [step, setStep] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [extraction, setExtraction] = useState<{ ok: boolean; reason?: string; notes?: string[] } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceId>('mercado_livre');
  const [audience, setAudience] = useState('');
  const autoRan = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Libera as prévias da memória só ao sair da página (cada remoção libera a sua).
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const accepted = [...list].filter((f) => /^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (accepted.length < list.length) toast('error', 'Alguns arquivos não são fotos e foram ignorados.');
    setPhotos((cur) => {
      const room = MAX_PHOTOS - cur.length;
      if (accepted.length > room) toast('error', `Use até ${MAX_PHOTOS} fotos por produto.`);
      return [
        ...cur,
        ...accepted.slice(0, Math.max(0, room)).map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })),
      ];
    });
  }

  /** fotos → rascunho → envio → leitura pela IA → anúncio. Sem IA, cai na revisão manual com as fotos já salvas. */
  async function runPhotos() {
    if (photos.length === 0) return;
    setError(null);
    setPhase('analyzing');
    let created: Product | null = null;
    const uploaded: Asset[] = [];
    try {
      setStep('Preparando…');
      created = (await api.post<{ product: Product }>('/api/products/photo-draft', {})).product;
      setParams({ product: created.id }, { replace: true });
      for (const [i, p] of photos.entries()) {
        setStep(`Enviando foto ${i + 1} de ${photos.length}…`);
        const form = new FormData();
        let blob: Blob = p.file;
        try {
          blob = await compressPhoto(p.file);
        } catch {
          // formato que o navegador não decodifica (ex.: HEIC em alguns aparelhos): envia o original
        }
        form.append('file', blob, `foto-${i + 1}.jpg`);
        uploaded.push((await api.post<{ asset: Asset }>(`/api/products/${created.id}/images/upload`, form)).asset);
      }
      setStep('A IA está olhando as fotos…');
      const read = await api.post<{ product: Product; assets: Asset[] }>(`/api/products/${created.id}/read-photos`, {
        hint: hint.trim() || undefined,
        marketplace,
      });
      setStep('Escrevendo título e descrição…');
      setPhase('generating');
      const r = await api.post<ListingDetail>('/api/listings', { productId: read.product.id, marketplace, audience: audience || undefined });
      navigate(`/app/anuncios/${r.listing.id}`);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (created && uploaded.length > 0 && err && ['vision_not_configured', 'not_a_product', 'ai_refused', 'ai_error', 'ai_auth'].includes(err.code)) {
        // Fotos já estão salvas: o vendedor completa os dados e gera do mesmo jeito.
        setProduct(created);
        setAssets(uploaded);
        setDraft({ ...toDraft(created.data), title: hint.trim() });
        setExtraction({ ok: false, reason: err.message });
        setPhase('review');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setError(err?.message ?? 'Não foi possível processar as fotos. Tente de novo.');
      setPhase('input');
    }
  }

  // ?product= abre a revisão de um produto existente (ex.: "Criar outro" na tela do anúncio).
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const pid = params.get('product');
    if (!pid) return;
    setPhase('analyzing');
    setStep('Carregando o produto…');
    Promise.all([api.get<{ product: Product }>(`/api/products/${pid}`), api.get<{ assets: Asset[] }>(`/api/products/${pid}/assets`)])
      .then(([p, a]) => {
        setProduct(p.product);
        setDraft(toDraft(p.product.data));
        setAssets(a.assets);
        setExtraction(p.product.status === 'failed' ? { ok: false, reason: p.product.failureReason ?? undefined } : { ok: true });
        setPhase('review');
      })
      .catch(() => setPhase('input'));
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
    let blob: Blob = file;
    try {
      blob = await compressPhoto(file);
    } catch {
      // envia o original
    }
    form.append('file', blob, 'foto.jpg');
    try {
      const r = await api.post<{ asset: Asset }>(`/api/products/${product.id}/images/upload`, form);
      setAssets((a) => [...a, r.asset]);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Falha no envio.');
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void runPhotos();
  };
  const busy = phase === 'analyzing' || phase === 'generating';

  return (
    <>
      <PageHeader title="Novo anúncio" subtitle="Envie fotos do produto → a IA identifica o produto → título, descrição e fotos prontas para venda." />

      {(phase === 'input' || (busy && !draft)) && (
        <form onSubmit={submit} className="space-y-6">
          <section className="card p-6 sm:p-8">
            <span className="label">Fotos do produto</span>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) addFiles(e.dataTransfer.files);
              }}
              className="grid grid-cols-3 gap-3 sm:grid-cols-6"
            >
              {photos.map((p, i) => (
                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-ink-200 bg-white">
                  <img src={p.preview} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-violet-brand px-2 py-0.5 text-[10px] font-semibold text-white">Principal</span>}
                  {!busy && (
                    <button
                      type="button"
                      aria-label="Remover foto"
                      onClick={() => {
                        URL.revokeObjectURL(p.preview);
                        setPhotos((cur) => cur.filter((x) => x.id !== p.id));
                      }}
                      className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-ink-700 shadow"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-300 bg-white text-ink-500 transition hover:border-violet-brand hover:text-violet-brand ${
                    photos.length === 0 ? 'col-span-3 h-40 sm:col-span-6' : 'aspect-square'
                  }`}
                >
                  <Camera className="size-6" />
                  <span className="text-sm font-semibold">{photos.length === 0 ? 'Tirar ou escolher fotos' : 'Adicionar'}</span>
                  {photos.length === 0 && <span className="px-4 text-center text-xs">Até {MAX_PHOTOS} fotos. A primeira vira a foto principal.</span>}
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <p className="mt-3 text-xs text-ink-500">
              Dica: fotografe o produto inteiro, com boa luz, num fundo liso. Mostre etiqueta ou embalagem se quiser que a IA leia marca e
              especificações.
            </p>

            <div className="mt-6">
              <label className="label" htmlFor="hint">
                O que é o produto? (opcional)
              </label>
              <input
                id="hint"
                className="input"
                value={hint}
                maxLength={300}
                disabled={busy}
                onChange={(e) => setHint(e.target.value)}
                placeholder="Ex.: garrafa térmica 500 ml, nova, cor preta"
              />
              <p className="mt-1 text-[11px] text-ink-500">Ajuda a IA. O que você escrever aqui entra como informação sua, não como algo visto na foto.</p>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold">Canal de destino</h2>
            <p className="mb-4 text-xs text-ink-500">Título, descrição e tamanho das fotos seguem as regras do canal.</p>
            <MarketplacePicker value={marketplace} onChange={setMarketplace} />
          </section>

          {meta && !meta.vision && (
            <Notice tone="warning">
              A leitura de fotos por IA ainda não está ativada neste servidor. Você pode enviar as fotos mesmo assim: elas são guardadas e
              você preenche nome e detalhes na próxima tela.
            </Notice>
          )}
          {error && <Notice tone="error">{error}</Notice>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-violet-brand hover:underline" onClick={startManual} disabled={busy}>
              <PenLine className="size-4" /> Prefiro digitar os dados
            </button>
            <button className="btn-primary px-6 py-3" disabled={busy || photos.length === 0}>
              {busy ? <Spinner /> : <Sparkles className="size-4" />}
              {busy ? step : 'Gerar meu anúncio'}
              {!busy && <ArrowRight className="size-4" />}
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
                    <strong>A IA não leu as fotos.</strong> {extraction.reason} Suas fotos foram guardadas; informe os dados abaixo e gere o
                    anúncio.
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
                    {product?.method === 'photo' ? 'Lido das suas fotos' : product?.sourceDomain ? `Origem: ${product.sourceDomain}` : 'Informado por você'} · Corrija o que estiver errado.
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
                        accept="image/*"
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
              <div className="mt-4">
                <MarketplacePicker value={marketplace} onChange={setMarketplace} />
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
                  setDraft(null);
                  setPhotos([]);
                  setParams({}, { replace: true });
                }}
              >
                Começar de novo
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
