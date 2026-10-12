import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, CheckCircle2, ChevronDown, Copy, ImageIcon, Loader2, Plus, Save, Trash2, X,
} from 'lucide-react';
import { Badge, Button, Card, Dialog, EmptyState, IconButton, Input, Notice, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { getRepository } from '@/data';
import { canApprove, hasConfirmedPrice } from '@/domain/rules';
import type { Category, Product, Variation } from '@/domain/types';
import { cn, formatBRL, parsePriceInput, priceInputValue } from '@/lib/format';
import { useProject } from './ProjectLayout';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
const AUTOSAVE_MS = 1500;
const now = () => new Date().toISOString();

function move<T extends { sortOrder: number }>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy.map((item, i) => ({ ...item, sortOrder: i }));
}

export function EditorStep() {
  const { bundle, setBundle, updateProject } = useProject();
  const repo = getRepository();
  const toast = useToast();
  const projectId = bundle.project.id;

  const [categories, setCategories] = useState<Category[]>(bundle.categories);
  const [products, setProducts] = useState<Product[]>(bundle.products);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState('');
  const [onlyReview, setOnlyReview] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [imageFor, setImageFor] = useState<Product | null>(null);
  const version = useRef(0);

  const pendingCount = products.filter((p) => p.reviewRequired).length;

  const save = useCallback(async () => {
    const v = version.current;
    setSaveState('saving');
    try {
      await repo.saveMenu(projectId, categories, products);
      if (v !== version.current) return; // houve nova edição durante o salvamento: o próximo ciclo salva.
      setBundle((b) => ({ ...b, categories, products }));
      setSaveState('saved');
      setSaveError('');
      // Status acompanha o conteúdo: aprovado deixa de valer se surgir pendência.
      const status = bundle.project.status;
      const ok = canApprove({ project: bundle.project, categories, products });
      if (status === 'approved' && !ok) await updateProject({ status: 'awaiting_review' });
      if ((status === 'setup' || status === 'awaiting_analysis') && products.length > 0) await updateProject({ status: 'awaiting_review' });
    } catch (e) {
      setSaveState('error');
      setSaveError((e as Error).message);
    }
  }, [repo, projectId, categories, products, setBundle, bundle.project, updateProject]);

  // Salvamento automático com atraso; qualquer edição reinicia o contador.
  useEffect(() => {
    if (saveState !== 'dirty') return;
    const t = setTimeout(save, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [saveState, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving' || saveState === 'error') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const touch = () => {
    version.current++;
    setSaveState('dirty');
  };
  const editCategories = (fn: (c: Category[]) => Category[]) => {
    setCategories(fn);
    touch();
  };
  const editProducts = (fn: (p: Product[]) => Product[]) => {
    setProducts(fn);
    touch();
  };
  const updateProduct = (id: string, patch: Partial<Product>) => editProducts((list) => list.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p)));

  function addCategory() {
    const id = crypto.randomUUID();
    editCategories((list) => [...list, { id, projectId, name: 'Nova categoria', sortOrder: list.length }]);
    setTimeout(() => document.getElementById(`cat-name-${id}`)?.focus(), 50);
  }

  function addProduct(categoryId: string) {
    const id = crypto.randomUUID();
    const inCategory = products.filter((p) => p.categoryId === categoryId).length;
    editProducts((list) => [
      ...list,
      {
        id, projectId, categoryId, name: '', description: '', price: null, variations: [], imageUrl: null, available: true,
        sortOrder: inCategory, sourceReference: 'manual', confidence: null, reviewRequired: false, reviewNotes: [], createdAt: now(), updatedAt: now(),
      },
    ]);
    setExpanded(id);
    setOnlyReview(false);
  }

  function moveProduct(product: Product, delta: -1 | 1) {
    editProducts((list) => {
      const siblings = list.filter((p) => p.categoryId === product.categoryId).sort((a, b) => a.sortOrder - b.sortOrder);
      const moved = move(siblings, siblings.findIndex((p) => p.id === product.id), delta);
      const byId = new Map(moved.map((p) => [p.id, p]));
      return list.map((p) => byId.get(p.id) ?? p);
    });
  }

  function duplicateProduct(product: Product) {
    const copy: Product = { ...product, id: crypto.randomUUID(), name: `${product.name} (cópia)`, sortOrder: product.sortOrder + 0.5, createdAt: now(), updatedAt: now() };
    editProducts((list) => {
      const next = [...list, copy];
      const siblings = next.filter((p) => p.categoryId === product.categoryId).sort((a, b) => a.sortOrder - b.sortOrder).map((p, i) => ({ ...p, sortOrder: i }));
      const byId = new Map(siblings.map((p) => [p.id, p]));
      return next.map((p) => byId.get(p.id) ?? p);
    });
    setExpanded(copy.id);
  }

  function removeCategory(category: Category) {
    editProducts((list) => list.filter((p) => p.categoryId !== category.id));
    editCategories((list) => list.filter((c) => c.id !== category.id).map((c, i) => ({ ...c, sortOrder: i })));
    setDeleteCategory(null);
  }

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder), [categories]);
  const publicImages = bundle.assets.filter((a) => a.purpose !== 'menu_page' && a.purpose !== 'other' && a.fileUrl);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-canvas/95 px-4 py-2.5 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0">
        <SaveIndicator state={saveState} />
        {saveState === 'error' && (
          <Button size="sm" variant="primary" onClick={save}>Tentar novamente</Button>
        )}
        {(saveState === 'dirty') && (
          <Button size="sm" icon={<Save className="size-3.5" aria-hidden="true" />} onClick={save}>Salvar agora</Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className={cn('flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 text-[13px] ring-1', pendingCount ? 'bg-warn-soft text-warn ring-warn/25' : 'text-ink-soft ring-line-strong')}>
            <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} className="accent-[var(--color-warn)]" />
            Só itens para revisar ({pendingCount})
          </label>
          <Button size="sm" icon={<Plus className="size-3.5" aria-hidden="true" />} onClick={addCategory}>Categoria</Button>
        </div>
      </div>
      {saveState === 'error' && <Notice tone="danger" title="Não foi possível salvar">{saveError}</Notice>}

      {pendingCount > 0 && !onlyReview && (
        <Notice tone="warn" icon={<AlertTriangle className="size-4" aria-hidden="true" />} title={`${pendingCount} item(ns) precisam de revisão`}>
          Itens marcados não aparecem no cardápio público. Abra cada um, confira nome e preço com a foto original e clique em <strong>Marcar como revisado</strong>.
        </Notice>
      )}

      {sortedCategories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Plus className="size-5" aria-hidden="true" />}
            title="Cardápio vazio"
            description="Crie uma categoria para começar a cadastrar produtos, ou extraia os itens das fotos com IA."
            action={<div className="flex gap-2"><Button variant="primary" onClick={addCategory}>Criar categoria</Button><Link to="../extracao" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium ring-1 ring-line-strong">Extrair com IA</Link></div>}
          />
        </Card>
      ) : (
        sortedCategories.map((category, ci) => {
          const items = products.filter((p) => p.categoryId === category.id).sort((a, b) => a.sortOrder - b.sortOrder);
          const shown = onlyReview ? items.filter((p) => p.reviewRequired) : items;
          if (onlyReview && shown.length === 0) return null;
          return (
            <Card key={category.id}>
              <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
                <Input
                  id={`cat-name-${category.id}`}
                  aria-label="Nome da categoria"
                  value={category.name}
                  maxLength={80}
                  onChange={(e) => editCategories((list) => list.map((c) => (c.id === category.id ? { ...c, name: e.target.value } : c)))}
                  className={cn('h-9 max-w-sm font-semibold', !category.name.trim() && 'ring-danger')}
                />
                <span className="hidden text-[13px] text-ink-faint sm:inline">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                <div className="ml-auto flex items-center">
                  <IconButton label="Mover categoria para cima" disabled={ci === 0} onClick={() => editCategories((l) => move([...l].sort((a, b) => a.sortOrder - b.sortOrder), ci, -1))}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton label="Mover categoria para baixo" disabled={ci === sortedCategories.length - 1} onClick={() => editCategories((l) => move([...l].sort((a, b) => a.sortOrder - b.sortOrder), ci, 1))}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton label="Excluir categoria" onClick={() => (items.length ? setDeleteCategory(category) : removeCategory(category))}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {shown.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    index={items.indexOf(product)}
                    total={items.length}
                    categories={sortedCategories}
                    expanded={expanded === product.id}
                    onToggle={() => setExpanded((e) => (e === product.id ? null : product.id))}
                    onChange={(patch) => updateProduct(product.id, patch)}
                    onMove={(d) => moveProduct(product, d)}
                    onDuplicate={() => duplicateProduct(product)}
                    onDelete={() => editProducts((list) => list.filter((p) => p.id !== product.id))}
                    onPickImage={() => setImageFor(product)}
                    onReviewed={() => toast('success', `“${product.name}” revisado.`)}
                  />
                ))}
              </ul>
              {!onlyReview && (
                <div className="px-4 py-2.5">
                  <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" aria-hidden="true" />} onClick={() => addProduct(category.id)}>Adicionar produto</Button>
                </div>
              )}
            </Card>
          );
        })
      )}

      <Dialog
        open={deleteCategory !== null}
        onClose={() => setDeleteCategory(null)}
        title="Excluir categoria?"
        footer={<><Button onClick={() => setDeleteCategory(null)}>Cancelar</Button><Button variant="danger" onClick={() => deleteCategory && removeCategory(deleteCategory)}>Excluir categoria e produtos</Button></>}
      >
        <p className="text-sm text-ink-soft">
          “{deleteCategory?.name}” tem {products.filter((p) => p.categoryId === deleteCategory?.id).length} produto(s), que também serão excluídos. Para manter os produtos, mova-os antes para outra categoria (abra o produto e troque a categoria).
        </p>
      </Dialog>

      <Dialog open={imageFor !== null} onClose={() => setImageFor(null)} title="Imagem do produto" wide>
        {publicImages.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Nenhuma foto de prato enviada. Envie fotos reais na etapa <Link to="../materiais" className="font-medium text-accent underline">Materiais</Link> com a finalidade “Foto de prato/produto”.
            Páginas do cardápio não podem ser usadas como foto de produto.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <li>
              <button type="button" onClick={() => { if (imageFor) updateProduct(imageFor.id, { imageUrl: null }); setImageFor(null); }} className="grid aspect-square w-full place-items-center rounded-lg text-[13px] text-ink-soft ring-1 ring-line hover:ring-accent">
                Sem imagem
              </button>
            </li>
            {publicImages.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => { if (imageFor) updateProduct(imageFor.id, { imageUrl: a.fileUrl }); setImageFor(null); }}
                  className={cn('block aspect-square w-full overflow-hidden rounded-lg ring-2', imageFor?.imageUrl === a.fileUrl ? 'ring-accent' : 'ring-transparent hover:ring-line-strong')}
                  aria-label={`Usar ${a.originalFilename}`}
                >
                  <img src={a.fileUrl} alt="" className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    saved: { icon: <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />, text: 'Todas as alterações salvas' },
    dirty: { icon: <span className="size-2 rounded-full bg-warn" aria-hidden="true" />, text: 'Alterações não salvas' },
    saving: { icon: <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />, text: 'Salvando…' },
    error: { icon: <AlertTriangle className="size-4 text-danger" aria-hidden="true" />, text: 'Erro ao salvar' },
  }[state];
  return (
    <span className="flex items-center gap-2 text-[13px] font-medium text-ink-soft" role="status" aria-live="polite">
      {map.icon} {map.text}
    </span>
  );
}

function priceSummary(p: Product): string {
  if (p.variations.length) return p.variations.map((v) => `${v.label || '?'} ${v.price === null ? '—' : formatBRL(v.price)}`).join(' · ');
  return p.price === null ? 'Sem preço' : formatBRL(p.price);
}

interface RowProps {
  product: Product;
  index: number;
  total: number;
  categories: Category[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Product>) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPickImage: () => void;
  onReviewed: () => void;
}

function ProductRow({ product: p, index, total, categories, expanded, onToggle, onChange, onMove, onDuplicate, onDelete, onPickImage, onReviewed }: RowProps) {
  const [reviewError, setReviewError] = useState('');
  const missingPrice = !hasConfirmedPrice(p);
  const lowConfidence = p.confidence !== null && p.confidence < 0.85;

  function markReviewed() {
    if (!p.name.trim()) return setReviewError('Informe o nome do produto.');
    if (missingPrice) return setReviewError(p.variations.length ? 'Preencha o nome e o preço de cada variação.' : 'Informe o preço confirmado.');
    setReviewError('');
    onChange({ reviewRequired: false });
    onReviewed();
  }

  return (
    <li className={cn(p.reviewRequired && 'bg-warn-soft/40')}>
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button type="button" onClick={onPickImage} className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-canvas text-ink-faint ring-1 ring-line hover:ring-accent" aria-label={`Escolher imagem de ${p.name || 'produto'}`}>
          {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-full object-cover" /> : <ImageIcon className="size-4" aria-hidden="true" />}
        </button>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
          <span className={cn('block truncate text-sm font-medium', !p.name && 'text-ink-faint italic')}>{p.name || 'Produto sem nome'}</span>
          <span className={cn('tabular block truncate text-[13px]', missingPrice ? 'text-danger' : 'text-ink-soft')}>{priceSummary(p)}</span>
        </button>
        <div className="hidden flex-wrap justify-end gap-1 sm:flex">
          {p.reviewRequired && <Badge tone="warn">Revisar</Badge>}
          {!p.available && <Badge>Indisponível</Badge>}
          {lowConfidence && <Badge tone="danger">Confiança {Math.round(p.confidence! * 100)}%</Badge>}
        </div>
        <div className="flex items-center">
          <IconButton label="Mover para cima" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="size-4" aria-hidden="true" /></IconButton>
          <IconButton label="Mover para baixo" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="size-4" aria-hidden="true" /></IconButton>
          <IconButton label={expanded ? 'Fechar edição' : 'Editar produto'} onClick={onToggle}>
            <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      {p.reviewRequired && !expanded && (
        <p className="-mt-1 px-4 pb-2.5 pl-[4.5rem] text-[12px] text-warn sm:hidden">Precisa de revisão</p>
      )}

      {expanded && (
        <div className="space-y-4 border-t border-line bg-canvas/60 px-4 py-4">
          {p.reviewRequired && (
            <Notice tone="warn" title="Por que revisar">
              <ul className="list-disc space-y-0.5 pl-4">{(p.reviewNotes.length ? p.reviewNotes : ['Confira os dados com o material original.']).map((n) => <li key={n}>{n}</li>)}</ul>
            </Notice>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Nome <span className="text-danger">*</span></span>
              <Input value={p.name} maxLength={120} onChange={(e) => onChange({ name: e.target.value })} aria-invalid={!p.name.trim() ? true : undefined} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Categoria</span>
              <Select value={p.categoryId} onChange={(e) => onChange({ categoryId: e.target.value, sortOrder: 9999 })}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name || 'Sem nome'}</option>)}
              </Select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1.5 block font-medium">Descrição <span className="text-xs font-normal text-ink-faint">(só o que o restaurante confirmou)</span></span>
              <Textarea value={p.description} maxLength={600} rows={2} onChange={(e) => onChange({ description: e.target.value })} />
            </label>
          </div>

          <PriceEditor product={p} onChange={onChange} />

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={p.available} onChange={(e) => onChange({ available: e.target.checked })} className="size-4 accent-[var(--color-accent)]" />
              Disponível
            </label>
            <span className="text-[13px] text-ink-faint">
              Origem: {p.sourceReference}
              {p.confidence !== null && ` · confiança da leitura ${Math.round(p.confidence * 100)}%`}
            </span>
          </div>

          {reviewError && <Notice tone="danger">{reviewError}</Notice>}
          <div className="flex flex-wrap items-center gap-2">
            {p.reviewRequired ? (
              <Button size="sm" variant="primary" icon={<Check className="size-3.5" aria-hidden="true" />} onClick={markReviewed}>Marcar como revisado</Button>
            ) : (
              <Button size="sm" onClick={() => onChange({ reviewRequired: true, reviewNotes: [...p.reviewNotes.filter((n) => n !== 'Marcado manualmente para revisão.'), 'Marcado manualmente para revisão.'] })}>
                Marcar para revisão
              </Button>
            )}
            <Button size="sm" icon={<ImageIcon className="size-3.5" aria-hidden="true" />} onClick={onPickImage}>{p.imageUrl ? 'Trocar imagem' : 'Escolher imagem'}</Button>
            <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" aria-hidden="true" />} onClick={onDuplicate}>Duplicar</Button>
            <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" aria-hidden="true" />} onClick={onDelete} className="ml-auto">Excluir</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function PriceInput({ value, onCommit, label }: { value: number | null; onCommit: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(priceInputValue(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(priceInputValue(value)), [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-faint">R$</span>
      <Input
        aria-label={label}
        inputMode="decimal"
        placeholder="0,00"
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const parsed = parsePriceInput(text);
          if (Number.isNaN(parsed)) return setInvalid(true);
          setInvalid(false);
          onCommit(parsed);
        }}
        className="tabular pl-9"
      />
      {invalid && <p className="mt-1 text-[12px] text-danger">Valor inválido. Use o formato 32,90.</p>}
    </div>
  );
}

function PriceEditor({ product: p, onChange }: { product: Product; onChange: (patch: Partial<Product>) => void }) {
  const hasVariations = p.variations.length > 0;
  const setVariation = (i: number, patch: Partial<Variation>) => onChange({ variations: p.variations.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  return (
    <fieldset className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-medium">Preço</legend>
        <label className="flex items-center gap-2 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            checked={hasVariations}
            onChange={(e) =>
              onChange(e.target.checked ? { variations: [{ label: '', price: p.price }], price: null } : { variations: [], price: p.variations[0]?.price ?? null })
            }
            className="accent-[var(--color-accent)]"
          />
          Tem tamanhos ou variações
        </label>
      </div>
      {hasVariations ? (
        <div className="space-y-2">
          {p.variations.map((v, i) => (
            <div key={i} className="flex items-start gap-2">
              <Input aria-label={`Nome da variação ${i + 1}`} placeholder="Ex.: Grande" value={v.label} maxLength={40} onChange={(e) => setVariation(i, { label: e.target.value })} className="min-w-0 flex-1 sm:max-w-56" />
              <div className="w-32 shrink-0"><PriceInput label={`Preço da variação ${v.label || i + 1}`} value={v.price} onCommit={(price) => setVariation(i, { price })} /></div>
              <IconButton label="Remover variação" className="mt-1" onClick={() => onChange(p.variations.length === 1 ? { variations: [], price: v.price } : { variations: p.variations.filter((_, j) => j !== i) })}>
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" aria-hidden="true" />} onClick={() => onChange({ variations: [...p.variations, { label: '', price: null }] })}>Variação</Button>
        </div>
      ) : (
        <div className="w-40"><PriceInput label="Preço" value={p.price} onCommit={(price) => onChange({ price })} /></div>
      )}
    </fieldset>
  );
}
