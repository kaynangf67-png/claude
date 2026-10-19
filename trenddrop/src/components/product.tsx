import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowUpRight, Copy, ExternalLink, Heart, Minus, Package, PencilLine, Search, ShieldCheck, Store } from 'lucide-react';
import { buildSupplierSearchUrl, COMPETITION_LABEL, isHttpUrl, salesMetric } from '@shared/analysis';
import { MARKETPLACE_LABEL, METRIC_LABEL, QUALITY_LABEL, type CompetitionLevel, type DataQuality, type Marketplace, type Metric, type Product, type TrendPoint } from '@shared/types';
import { cn } from '@/lib/cn';
import { money, number, pct, relative } from '@/lib/format';
import { useEnsureSaved, useSetSupplier, useSettings, useToggleFavorite, windowed, type EnrichedProduct } from '@/state/hooks';
import { Badge, Button, Card, Input, Label, Modal, Notice } from './ui';

const MP_STYLE: Record<Marketplace, string> = {
  mercadolivre: 'bg-yellow-300/10 text-yellow-200 border-yellow-300/25',
  shopee: 'bg-orange-400/10 text-orange-300 border-orange-400/25',
  tiktok: 'bg-pink-400/10 text-pink-300 border-pink-400/25',
  manual: 'bg-surface-3 text-ink-2 border-line-strong',
};

export function MarketplaceBadge({ m }: { m: Marketplace }) {
  return <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', MP_STYLE[m])}>{MARKETPLACE_LABEL[m]}</span>;
}

export function QualityBadge({ q }: { q: DataQuality }) {
  const tone = { oficial: 'green', terceiro: 'blue', manual: 'neutral', demo: 'amber' } as const;
  return (
    <Badge tone={tone[q]} title={QUALITY_LABEL[q]}>
      {q === 'oficial' && <ShieldCheck className="h-3 w-3" />}
      {QUALITY_LABEL[q]}
    </Badge>
  );
}

export function GrowthBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={cn('text-xs text-ink-3', className)}>sem tendência</span>;
  const Icon = value > 2 ? ArrowUpRight : value < -2 ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold tabular', value > 2 ? 'text-up' : value < -2 ? 'text-down' : 'text-ink-2', className)}>
      <Icon className="h-3.5 w-3.5" />
      {pct(value, true)}
    </span>
  );
}

export function CompetitionBadge({ level, title }: { level: CompetitionLevel | null | undefined; title?: string }) {
  if (!level) return <Badge title="Concorrência não estimada">Concorrência ?</Badge>;
  const tone = { baixa: 'green', media: 'amber', alta: 'red' } as const;
  return (
    <Badge tone={tone[level]} title={title}>
      Concorrência {COMPETITION_LABEL[level].toLowerCase()}
    </Badge>
  );
}

export function metricText(m: Metric) {
  if (m.kind === 'ranking_mais_vendidos') return `#${m.value}`;
  if (m.kind === 'avaliacao') return m.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return number(m.value);
}

/** Mostra o indicador com o TIPO explícito — nunca chama visualização de venda. */
export function MetricChip({ m }: { m: Metric }) {
  const isSales = m.kind === 'vendas_oficiais' || m.kind === 'vendas_informadas' || m.kind === 'ranking_mais_vendidos';
  return (
    <div className={cn('rounded-lg border px-2.5 py-1.5', isSales ? 'border-brand/25 bg-brand/5' : 'border-line bg-surface-2')} title={m.detail}>
      <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">{METRIC_LABEL[m.kind]}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold text-ink tabular">{metricText(m)}</span>
        <span className={cn('text-[10px]', m.official ? 'text-brand-2' : 'text-warn')}>{m.official ? 'oficial' : 'não oficial'}</span>
      </div>
    </div>
  );
}

export function ScoreRing({ score, size = 44 }: { score: number | null; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const v = score ?? 0;
  const color = score == null ? 'var(--color-ink-3)' : v >= 75 ? 'var(--color-brand-2)' : v >= 55 ? '#a3e635' : v >= 35 ? 'var(--color-warn)' : 'var(--color-down)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Indicador de oportunidade (0–100). Não é garantia de vendas.">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line-strong)" strokeWidth="4" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="transition-all duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular" style={{ color }}>
        {score ?? '—'}
      </span>
    </div>
  );
}

export function ProductImage({ p, className }: { p: Pick<Product, 'imageUrl' | 'name'>; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (p.imageUrl && !failed)
    return <img src={p.imageUrl} alt={p.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn('rounded-lg bg-white object-contain', className)} />;
  return (
    <div className={cn('flex items-center justify-center rounded-lg border border-line bg-gradient-to-br from-surface-3 to-surface-2 text-ink-3', className)} aria-label="Sem imagem">
      <Package className="h-1/3 w-1/3" />
    </div>
  );
}

export function Sparkline({ points, className, height = 36 }: { points: TrendPoint[]; className?: string; height?: number }) {
  if (points.length < 2) return <div className={cn('flex items-center text-[11px] text-ink-3', className)} style={{ height }}>sem série de tendência</div>;
  const w = 120;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value));
  const span = Math.max(1, max - min);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, height - 3 - ((p.value - min) / span) * (height - 6)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = points.at(-1)!.value >= points[0].value;
  const color = up ? 'var(--color-up)' : 'var(--color-down)';
  const id = `sg${Math.round(points[0].value * 1000 + points.length)}${up ? 'u' : 'd'}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Fornecedor (DropSeller)
// ---------------------------------------------------------------------------

export function SupplierModal({ product, open, onClose }: { product: Product; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(product.supplierUrl ?? '');
  const [cost, setCost] = useState(product.supplierCost?.toString() ?? '');
  const setSupplier = useSetSupplier();
  const ensure = useEnsureSaved();
  const navigate = useNavigate();
  const urlError = url && !isHttpUrl(url) ? 'Informe um endereço completo, começando com https://' : null;
  const costNum = cost.trim() === '' ? null : Number(cost.replace(',', '.'));
  const costError = costNum != null && (!Number.isFinite(costNum) || costNum < 0) ? 'Custo inválido.' : null;

  async function save() {
    if (urlError || costError) return;
    const saved = await ensure(product);
    await setSupplier.mutateAsync({ productId: saved.id, info: { url: url.trim() || null, cost: costNum } });
    onClose();
    if (saved.id !== product.id) navigate(`/produto/${saved.id}`, { replace: true });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fornecedor DropSeller"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={setSupplier.isPending} disabled={Boolean(urlError || costError)}>
            Salvar
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-3">
        Cole o endereço da página deste produto no DropSeller depois de confirmar que é o mesmo item. O custo é usado para calcular margem e oportunidade.
      </p>
      <div className="space-y-4">
        <div>
          <Label htmlFor="sup-url">Link do produto no DropSeller</Label>
          <Input id="sup-url" type="url" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          {urlError && <p className="mt-1 text-xs text-down">{urlError}</p>}
        </div>
        <div>
          <Label htmlFor="sup-cost">Custo no fornecedor</Label>
          <Input id="sup-cost" inputMode="decimal" prefix="R$" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} />
          {costError && <p className="mt-1 text-xs text-down">{costError}</p>}
        </div>
      </div>
    </Modal>
  );
}

export function SupplierActions({ product, compact }: { product: Product; compact?: boolean }) {
  const settings = useSettings();
  const [editing, setEditing] = useState(false);
  const direct = isHttpUrl(product.supplierUrl) ? product.supplierUrl! : null;
  const searchUrl = buildSupplierSearchUrl(settings.data?.dropsellerSearchUrl, product.name);

  function open() {
    if (direct) return window.open(direct, '_blank', 'noopener,noreferrer');
    if (searchUrl) {
      toast.info('Produto ainda não localizado no DropSeller', { description: 'Abrindo a pesquisa pelo nome. Confirme o item e salve o link.' });
      return window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
    toast.warning('Produto ainda não localizado no DropSeller', { description: 'Cadastre o link do produto ou configure a URL de pesquisa em Configurações.' });
    setEditing(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(product.name);
      toast.success('Nome copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o nome manualmente.');
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', compact ? '' : 'sm:max-w-md')}>
      <Button variant="supplier" size={compact ? 'md' : 'lg'} className="w-full justify-center" onClick={open}>
        {direct ? <Store className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        Encontrar no DropSeller
        <ExternalLink className="h-3.5 w-3.5 opacity-70" />
      </Button>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" className="flex-1 justify-center" onClick={copy}>
          <Copy className="h-3.5 w-3.5" /> Copiar nome do produto
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title="Cadastrar ou editar link do DropSeller" aria-label="Editar link do DropSeller">
          <PencilLine className="h-3.5 w-3.5" />
          {!compact && 'Link'}
        </Button>
      </div>
      <p className={cn('text-[11px]', direct ? 'text-brand-2' : 'text-ink-3')}>
        {direct ? 'Link direto cadastrado.' : searchUrl ? 'Não localizado ainda — o botão pesquisa pelo nome.' : 'Não localizado no DropSeller.'}
      </p>
      {editing && <SupplierModal product={product} open={editing} onClose={() => setEditing(false)} />}
    </div>
  );
}

export function FavoriteButton({ product, favorite, className }: { product: Product; favorite: boolean; className?: string }) {
  const toggle = useToggleFavorite();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ product, on: !favorite });
      }}
      disabled={toggle.isPending}
      aria-pressed={favorite}
      aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      className={cn('rounded-lg p-2 transition-colors cursor-pointer', favorite ? 'text-rose-400 hover:bg-rose-400/10' : 'text-ink-3 hover:bg-surface-3 hover:text-ink', className)}
    >
      <Heart className={cn('h-4 w-4', favorite && 'fill-current')} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cartão de produto
// ---------------------------------------------------------------------------

export function ProductCard({ p, days = 30, extra }: { p: EnrichedProduct; days?: number | null; extra?: ReactNode }) {
  const { trend, growth } = windowed(p, days);
  const sale = salesMetric(p);
  const other = p.metrics.find((m) => m !== sale && m.kind !== 'avaliacao');
  const profit = p.insight.profit;
  return (
    <Card className="group flex flex-col overflow-hidden transition-colors hover:border-line-strong animate-fade-in">
      <Link to={`/produto/${encodeURIComponent(p.id)}`} className="flex flex-1 flex-col p-4">
        <div className="flex gap-3">
          <ProductImage p={p} className="h-16 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <MarketplaceBadge m={p.marketplace} />
              {p.quality === 'demo' && <Badge tone="amber">Demo</Badge>}
            </div>
            <h3 className="line-clamp-2 text-sm leading-snug font-medium text-ink group-hover:text-brand-2">{p.name}</h3>
            <p className="mt-0.5 truncate text-xs text-ink-3">{p.category ?? 'Sem categoria'}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ScoreRing score={p.insight.score.score} />
            <FavoriteButton product={p} favorite={p.favorite} className="-mr-1" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-ink-3">Preço</div>
            <div className="font-semibold text-ink tabular">{money(p.price)}</div>
          </div>
          <div>
            <div className="text-ink-3">Lucro est.</div>
            <div className={cn('font-semibold tabular', profit ? (profit.profit >= 0 ? 'text-up' : 'text-down') : 'text-ink-3')} title={profit ? `Margem ${pct(profit.marginPct)}` : 'Informe custo e tarifas'}>
              {profit ? money(profit.profit) : '—'}
            </div>
          </div>
          <div>
            <div className="text-ink-3">Tendência</div>
            <GrowthBadge value={growth} />
          </div>
        </div>

        <Sparkline points={trend} className="mt-3" />

        <div className="mt-3 flex flex-wrap gap-1">
          {sale && (
            <Badge tone="green" title={sale.detail}>
              {METRIC_LABEL[sale.kind]}: {metricText(sale)}
            </Badge>
          )}
          {other && (
            <Badge tone="violet" title={`${other.detail ?? ''} — não é venda`}>
              {METRIC_LABEL[other.kind]}: {metricText(other)}
            </Badge>
          )}
          <CompetitionBadge level={p.competition?.level} title={p.competition?.method} />
        </div>
        <p className="mt-2 text-[11px] text-ink-3">
          {p.sourceName} · atualizado {relative(p.updatedAt)}
        </p>
      </Link>
      <div className="border-t border-line bg-surface-2/60 p-3">
        <SupplierActions product={p} compact />
        {extra}
      </div>
    </Card>
  );
}

export function DataNote({ children }: { children: ReactNode }) {
  return <Notice tone="blue">{children}</Notice>;
}
