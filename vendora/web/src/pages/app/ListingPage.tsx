import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BookmarkCheck,
  Download,
  FileJson,
  FileText,
  FolderArchive,
  ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ListingContent, RuleIssue } from '@vendora/shared';
import { validateListingText } from '@vendora/shared/marketplaces';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CopyButton, FieldStatusBadge, MarketplaceChip, Notice, Skeleton, Spinner } from '../../components/ui';
import { ImageEditor } from '../../features/editor/ImageEditor';
import { api, ApiError, type Asset, type ListingDetail } from '../../lib/api';
import { FIELD_LABELS, formatBytes, formatDate, formatPrice } from '../../lib/format';
import { useToast } from '../../lib/toast';

const TABS = [
  { id: 'original', label: 'Produto original' },
  { id: 'title', label: 'Título' },
  { id: 'description', label: 'Descrição' },
  { id: 'specs', label: 'Ficha técnica' },
  { id: 'images', label: 'Imagens' },
  { id: 'preview', label: 'Prévia do anúncio' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const SOURCE_LABEL = { ai: 'Gerado por IA', basic: 'Gerador básico (sem IA)', user: 'Editado por você' } as const;

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={`text-xs tabular-nums ${value > max ? 'font-semibold text-red-400' : 'text-ink-500'}`}>{value}/{max}</span>;
}

export function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<ListingDetail | null>(null);
  const [content, setContent] = useState<ListingContent | null>(null);
  const [tab, setTab] = useState<Tab>('title');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [imageIssues, setImageIssues] = useState<Record<string, RuleIssue[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = useCallback((d: ListingDetail) => {
    setData(d);
    setContent(d.listing.content);
  }, []);

  useEffect(() => {
    api
      .get<ListingDetail>(`/api/listings/${id}`)
      .then(apply)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Falha ao carregar.'));
  }, [id, apply]);

  const dirty = useMemo(() => !!data && !!content && JSON.stringify(content) !== JSON.stringify(data.listing.content), [data, content]);
  const liveIssues = useMemo(() => (data && content ? validateListingText(data.rules, content) : []), [data, content]);

  useEffect(() => {
    if (!data || tab !== 'images') return;
    for (const a of data.assets)
      if (!imageIssues[a.id])
        api
          .get<{ issues: RuleIssue[] }>(`/api/assets/${a.id}/validate?marketplace=${data.listing.marketplace}`)
          .then((r) => setImageIssues((m) => ({ ...m, [a.id]: r.issues })))
          .catch(() => {});
  }, [data, tab, imageIssues]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function run(key: string, fn: () => Promise<ListingDetail | void>, success?: string) {
    setBusy(key);
    try {
      const r = await fn();
      if (r) apply(r);
      if (success) toast('success', success);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Algo deu errado.');
    } finally {
      setBusy(null);
    }
  }

  const saveEdits = () => run('save-edit', () => api.put<ListingDetail>(`/api/listings/${id}/content`, { content }), 'Edição salva como nova versão.');
  const regenerate = (part: 'title' | 'description') => {
    if (dirty && !confirm('Há edições não salvas. Regenerar descarta as edições deste campo. Continuar?')) return;
    return run(`regen-${part}`, async () => {
      if (dirty) await api.put(`/api/listings/${id}/content`, { content });
      return api.post<ListingDetail>(`/api/listings/${id}/regenerate`, { part });
    });
  };
  const refreshAssets = async () => {
    const r = await api.get<{ assets: Asset[] }>(`/api/products/${data!.product.id}/assets`);
    setData((d) => (d ? { ...d, assets: r.assets } : d));
  };

  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!data || !content)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-12" />
        <Skeleton className="h-80" />
      </div>
    );

  const { listing, rules, product, assets } = data;
  const p = product.data;
  const main = assets.find((a) => a.isMain) ?? assets.find((a) => a.kind === 'edited' && !a.promotional) ?? assets[0];
  const set = (patch: Partial<ListingContent>) => setContent({ ...content, ...patch });
  const exportUrl = (format: string) => `/api/listings/${id}/export?format=${format}`;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <MarketplaceChip id={listing.marketplace} />
            <span className="rounded-full border border-ink-200 bg-surface px-2.5 py-0.5 text-xs text-ink-700">
              {SOURCE_LABEL[listing.source]}
              {listing.source === 'ai' && listing.model ? ` · ${listing.model}` : ''}
            </span>
            <span className="text-xs text-ink-500">
              v{listing.currentVersion} · {formatDate(listing.updatedAt)}
            </span>
          </div>
          <h1 className="truncate text-xl font-bold sm:text-2xl">{content.title || 'Sem título'}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            className="btn-secondary"
            disabled={busy === 'save'}
            onClick={() => run('save', async () => {
              if (dirty) await api.put(`/api/listings/${id}/content`, { content });
              return api.post<ListingDetail>(`/api/listings/${id}/save`);
            }, 'Salvo no histórico.')}
          >
            {busy === 'save' ? <Spinner /> : <BookmarkCheck className="size-4" />}
            {listing.status === 'draft' ? 'Salvar no histórico' : 'Salvo'}
          </button>
          <details className="relative">
            <summary className="btn-primary cursor-pointer list-none">
              <Download className="size-4" /> Exportar
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-ink-200 bg-surface p-1.5 shadow-[var(--shadow-lift)]">
              {dirty && <p className="px-3 py-2 text-[11px] text-amber-300">Salve as edições antes de exportar.</p>}
              <a className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" href={exportUrl('zip')} download>
                <FolderArchive className="size-4" /> Pacote ZIP (texto + imagens)
              </a>
              <a className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" href={exportUrl('txt')} download>
                <FileText className="size-4" /> Texto (.txt)
              </a>
              <a className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" href={exportUrl('json')} download>
                <FileJson className="size-4" /> Dados (.json)
              </a>
            </div>
          </details>
          <Link to={`/app/novo?product=${product.id}`} className="btn-secondary">
            <Plus className="size-4" /> Criar outro
          </Link>
        </div>
      </div>

      {dirty && (
        <div className="sticky top-16 z-20 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-surface/95 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur lg:top-4">
          <span className="text-sm">Você tem edições não salvas.</span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setContent(listing.content)}>
              Descartar
            </button>
            <button className="btn-primary" onClick={saveEdits} disabled={busy === 'save-edit'}>
              {busy === 'save-edit' && <Spinner />} Salvar edição
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-ink-200/70 bg-surface p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition ${tab === t.id ? 'text-ink-950' : 'text-ink-500 hover:text-ink-900'}`}
              >
                {tab === t.id && <motion.span layoutId="tab" className="absolute inset-0 rounded-xl bg-ink-100" transition={{ type: 'spring', duration: 0.35 }} />}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="card p-6">
              {tab === 'original' && (
                <div className="space-y-5">
                  {product.sourceUrl && (
                    <p className="text-sm">
                      <span className="text-ink-500">Origem: </span>
                      <a href={product.sourceUrl} target="_blank" rel="noreferrer noopener" className="break-all text-accent hover:underline">
                        {product.sourceUrl}
                      </a>
                      <span className="text-ink-500"> · método: {product.method}</span>
                    </p>
                  )}
                  <dl className="divide-y divide-ink-100">
                    {(['title', 'brand', 'model', 'gtin', 'sku', 'price'] as const).map((f) => (
                      <div key={f} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                        <dt className="w-36 shrink-0 text-xs font-semibold text-ink-500 uppercase">{FIELD_LABELS[f]}</dt>
                        <dd className="flex-1 text-sm">{f === 'price' ? formatPrice(p.price) ?? '—' : (p[f] ?? '—')}</dd>
                        <FieldStatusBadge status={product.fieldStatus[f]} />
                      </div>
                    ))}
                  </dl>
                  {p.description && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="label mb-0">Descrição original</span>
                        <FieldStatusBadge status={product.fieldStatus.description} />
                      </div>
                      <p className="text-sm whitespace-pre-line text-ink-700">{p.description}</p>
                    </div>
                  )}
                  <Link to={`/app/novo?product=${product.id}`} className="btn-secondary">
                    <Pencil className="size-4" /> Corrigir dados de origem
                  </Link>
                </div>
              )}

              {tab === 'title' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="label mb-0" htmlFor="title">
                      Título para {listing.marketplace === 'mercado_livre' ? 'o Mercado Livre' : listing.marketplace === 'shopee' ? 'a Shopee' : 'o TikTok Shop'}
                    </label>
                    <Counter value={content.title.length} max={rules.titleMax} />
                  </div>
                  <textarea id="title" rows={2} className="input text-base font-medium" value={content.title} onChange={(e) => set({ title: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={content.title} label="Copiar título" />
                    <button className="btn-secondary" onClick={() => regenerate('title')} disabled={!!busy}>
                      {busy === 'regen-title' ? <Spinner /> : <RefreshCw className="size-4" />} Regenerar título
                    </button>
                  </div>
                  <div>
                    <span className="label">Palavras-chave sugeridas</span>
                    <input
                      className="input"
                      value={content.keywords.join(', ')}
                      onChange={(e) => set({ keywords: e.target.value.split(',').map((k) => k.trimStart()) })}
                    />
                    <p className="mt-1 text-[11px] text-ink-500">Separe por vírgula. Até {rules.keywordsMax}.</p>
                  </div>
                  {content.category && (
                    <p className="text-sm">
                      <span className="text-ink-500">Categoria sugerida: </span>
                      <strong>{content.category.name}</strong>{' '}
                      <span className="text-xs text-ink-500">(confiança {content.category.confidence} — {content.category.basis})</span>
                    </p>
                  )}
                </div>
              )}

              {tab === 'description' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="label mb-0" htmlFor="desc">
                      Descrição
                    </label>
                    <Counter value={content.description.length} max={rules.descriptionMax} />
                  </div>
                  <textarea id="desc" rows={14} className="input leading-relaxed" value={content.description} onChange={(e) => set({ description: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={content.description} label="Copiar descrição" />
                    <button className="btn-secondary" onClick={() => regenerate('description')} disabled={!!busy}>
                      {busy === 'regen-description' ? <Spinner /> : <RefreshCw className="size-4" />} Regenerar descrição
                    </button>
                  </div>
                  {content.highlights.length > 0 && (
                    <div>
                      <span className="label">Destaques</span>
                      <ul className="space-y-2">
                        {content.highlights.map((h, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span
                              className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                h.kind === 'fact' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-violet-400/30 bg-violet-400/10 text-violet-200'
                              }`}
                              title={h.basis}
                            >
                              {h.kind === 'fact' ? 'Fato' : 'Sugestão de marketing'}
                            </span>
                            <span>{h.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tab === 'specs' && (
                <div className="space-y-3">
                  <p className="text-xs text-ink-500">Somente especificações presentes nos dados de origem. Adicione ou corrija o que faltar.</p>
                  {content.specifications.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input"
                        value={s.name}
                        aria-label="Nome"
                        onChange={(e) => set({ specifications: content.specifications.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                      />
                      <input
                        className="input"
                        value={s.value}
                        aria-label="Valor"
                        onChange={(e) => set({ specifications: content.specifications.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                      />
                      <button className="btn-ghost px-2" aria-label="Remover" onClick={() => set({ specifications: content.specifications.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button className="btn-ghost text-accent" onClick={() => set({ specifications: [...content.specifications, { name: '', value: '' }] })}>
                    <Plus className="size-4" /> Adicionar linha
                  </button>
                  <CopyButton text={content.specifications.map((s) => `${s.name}: ${s.value}`).join('\n')} label="Copiar ficha técnica" />
                </div>
              )}

              {tab === 'images' && (
                <div className="space-y-5">
                  <Notice>
                    As fotos originais ficam preservadas. Cada edição gera uma cópia. Requisitos de {rules.imageMinSize}px mínimo,{' '}
                    {rules.imageRecommendedSize}px recomendado, {rules.imageFormats.join('/').toUpperCase()}, até {rules.imageMaxFileSizeMB} MB.
                  </Notice>
                  {assets.length === 0 && <p className="text-sm text-ink-500">Nenhuma imagem ainda. Envie a foto real do produto.</p>}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {assets.map((a) => {
                      const issues = imageIssues[a.id];
                      const hasError = issues?.some((i) => i.level === 'error');
                      return (
                        <div key={a.id} className={`overflow-hidden rounded-2xl border ${a.isMain ? 'border-accent ring-4 ring-accent/10' : 'border-ink-200'}`}>
                          <div className="relative aspect-square bg-[repeating-conic-gradient(#232220_0_25%,#2c2b29_0_50%)] bg-[length:16px_16px]">
                            <img src={a.url} alt={a.kind === 'original' ? 'Foto original' : 'Cópia editada'} className="h-full w-full object-contain" loading="lazy" />
                            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                              <span className="rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-semibold">{a.kind === 'original' ? 'Original' : 'Editada'}</span>
                              {a.promotional && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Promocional</span>}
                              {a.isMain && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">Principal</span>}
                            </div>
                          </div>
                          <div className="space-y-2 p-3">
                            <p className="text-[11px] text-ink-500">
                              {a.width}×{a.height}px · {a.mimeType.split('/')[1]?.toUpperCase()} · {formatBytes(a.sizeBytes)}
                            </p>
                            {issues && (
                              <p className={`text-[11px] ${hasError ? 'text-red-300' : issues.length ? 'text-amber-300' : 'text-emerald-300'}`}>
                                {issues.length === 0 ? 'Atende às regras do canal.' : issues.map((i) => i.message).join(' ')}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1">
                              <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setEditing(a)}>
                                <Pencil className="size-3.5" /> Editar
                              </button>
                              <a className="btn-ghost px-2 py-1.5 text-xs" href={`${a.url}&download=1`} download>
                                <Download className="size-3.5" /> Baixar
                              </a>
                              {!a.isMain && !a.promotional && (
                                <button
                                  className="btn-ghost px-2 py-1.5 text-xs"
                                  onClick={() => run('main', async () => {
                                    await api.post(`/api/assets/${a.id}/main`);
                                    await refreshAssets();
                                  })}
                                >
                                  <Star className="size-3.5" /> Principal
                                </button>
                              )}
                              {a.kind === 'edited' && (
                                <button
                                  className="btn-ghost px-2 py-1.5 text-xs text-red-300"
                                  onClick={() => run('del', async () => {
                                    await api.del(`/api/assets/${a.id}`);
                                    await refreshAssets();
                                  })}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed border-ink-300 text-ink-500 transition hover:border-accent hover:text-accent">
                      <span className="flex flex-col items-center gap-2 text-sm">
                        <Upload className="size-5" /> Enviar foto do produto
                        <span className="text-[11px]">JPG, PNG ou WEBP</span>
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          const form = new FormData();
                          form.append('file', f);
                          void run('upload', async () => {
                            await api.post(`/api/products/${product.id}/images/upload`, form);
                            await refreshAssets();
                          }, 'Foto enviada.');
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {tab === 'preview' && (
                <div>
                  <p className="mb-4 text-xs text-ink-500">Prévia ilustrativa para revisão — não reproduz a página real do marketplace.</p>
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-ink-200 bg-surface">
                      {main ? <img src={main.url} alt="Imagem principal" className="h-full w-full object-contain" /> : <ImageIcon className="size-10 text-ink-300" />}
                    </div>
                    <div>
                      <MarketplaceChip id={listing.marketplace} />
                      <h2 className="mt-3 text-xl leading-snug font-semibold">{content.title}</h2>
                      <p className="mt-3 font-display text-3xl font-bold">{formatPrice(p.price) ?? <span className="text-base text-ink-500">Preço a definir</span>}</p>
                      {content.highlights.length > 0 && (
                        <ul className="mt-4 space-y-1.5 text-sm text-ink-700">
                          {content.highlights.slice(0, 5).map((h, i) => (
                            <li key={i}>• {h.text}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {content.specifications.length > 0 && (
                    <table className="mt-8 w-full overflow-hidden rounded-xl text-sm">
                      <tbody>
                        {content.specifications.map((s, i) => (
                          <tr key={i} className={i % 2 ? 'bg-surface' : 'bg-ink-50'}>
                            <th className="w-1/3 px-4 py-2 text-left font-medium text-ink-500">{s.name}</th>
                            <td className="px-4 py-2">{s.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="mt-8">
                    <h3 className="mb-2 text-base font-semibold">Descrição</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-line text-ink-700">{content.description}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="space-y-4">
          {(liveIssues.length > 0 || listing.warnings.length > 0) && (
            <div className="card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4 text-amber-400" /> Revise antes de publicar
              </h3>
              <ul className="space-y-2 text-xs text-ink-700">
                {liveIssues.map((i, k) => (
                  <li key={`l${k}`} className={i.level === 'error' ? 'text-red-300' : ''}>
                    • {i.message}
                  </li>
                ))}
                {listing.warnings
                  .filter((w) => !liveIssues.some((i) => i.message === w.message))
                  .filter((w) => w.field === 'claims' || w.field === 'specifications' || w.field === 'title')
                  .map((w, k) => (
                    <li key={`w${k}`}>• {w.message}</li>
                  ))}
              </ul>
            </div>
          )}
          {content.missingInfo.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold">Confirme estas informações</h3>
              <ul className="space-y-2 text-xs">
                {content.missingInfo.map((m, i) => (
                  <li key={i}>
                    <strong className="font-semibold text-ink-900">{m.field}</strong>
                    <span className="text-ink-500"> — {m.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold">Versões</h3>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto text-xs">
              {listing.versions.map((v) => (
                <li key={v.version} className="flex items-center justify-between gap-2">
                  <span className={v.version === listing.currentVersion ? 'font-semibold' : 'text-ink-500'}>
                    v{v.version} · {SOURCE_LABEL[v.source as keyof typeof SOURCE_LABEL] ?? v.source} · {formatDate(v.createdAt)}
                  </span>
                  {v.version !== listing.currentVersion && (
                    <button
                      className="font-semibold text-accent hover:underline"
                      onClick={() => run('restore', () => api.post<ListingDetail>(`/api/listings/${id}/versions/${v.version}/restore`), `Versão ${v.version} restaurada.`)}
                    >
                      Restaurar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5 text-xs text-ink-500">
            <p className="font-semibold text-ink-900">Publicação</p>
            <p className="mt-1">
              Exporte o anúncio (texto e fotos) e publique pelo painel do vendedor do canal.
            </p>
          </div>
        </aside>
      </div>

      {editing && (
        <ImageEditor
          asset={editing}
          rules={rules}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refreshAssets();
          }}
        />
      )}
    </>
  );
}
