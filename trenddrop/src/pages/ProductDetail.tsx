import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BellPlus, Calculator, CheckCircle2, ExternalLink, Gauge, Info, Radar, Trash2, TriangleAlert } from 'lucide-react';
import { COMPETITION_LABEL, median, SCORE_WEIGHTS, salesMetric } from '@shared/analysis';
import { METRIC_LABEL } from '@shared/types';
import { cn } from '@/lib/cn';
import { dateTime, money, pct, relative, ageDays } from '@/lib/format';
import type { AlertType } from '@/data/types';
import { ALERT_LABEL } from '@/data/types';
import { enrich, useCatalog, useDeleteProduct, useEnsureSaved, useProduct, useSaveAlert, windowed, type EnrichedProduct } from '@/state/hooks';
import { PriceChart, TrendArea } from '@/components/charts';
import { MonitorButton } from '@/components/live';
import { CompetitionBadge, FavoriteButton, GrowthBadge, MarketplaceBadge, MetricChip, ProductImage, QualityBadge, ScoreRing, SupplierActions } from '@/components/product';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Input, Label, Modal, Notice, Segmented, Select, Skeleton } from '@/components/ui';

export default function ProductDetail() {
  const { id = '' } = useParams();
  const decoded = decodeURIComponent(id);
  const product = useProduct(decoded);
  const catalog = useCatalog();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');

  if (product.isLoading || catalog.isLoading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  if (product.error) return <ErrorState error={product.error} onRetry={() => product.refetch()} />;
  if (!product.data)
    return (
      <Card>
        <EmptyState title="Produto não encontrado" description="Ele pode ter sido removido, ou era um resultado de busca que não foi salvo." action={<Link to="/em-alta"><Button>Ver produtos</Button></Link>} />
      </Card>
    );

  const p: EnrichedProduct = enrich(product.data, catalog.fees, catalog.settings?.targetMarginPct ?? 25, catalog.favorites);
  const { trend, growth } = windowed(p, Number(days));
  const insight = p.insight;
  const sim = median(p.similarPrices);
  const sale = salesMetric(p);
  const { positives, risks } = assess(p, growth, sim);

  return (
    <div className="animate-fade-in">
      <BackButton />

      {p.quality === 'demo' && <Notice tone="amber" className="mb-4"><strong>Produto de demonstração:</strong> todos os números desta página são fictícios.</Notice>}
      {p.transient && <Notice tone="blue" className="mb-4">Resultado de busca ao vivo. Clique em <strong>Monitorar</strong> para guardar e acompanhar o histórico de preços.</Notice>}

      {/* Cabeçalho */}
      <Card className="overflow-hidden">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-4 sm:flex-row">
            <ProductImage p={p} className="h-36 w-36 shrink-0 self-center sm:self-start" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <MarketplaceBadge m={p.marketplace} />
                <QualityBadge q={p.quality} />
                {p.category && <Badge>{p.category}</Badge>}
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{p.name}</h1>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div>
                  <div className="text-[11px] text-ink-3">Preço atual</div>
                  <div className="text-2xl font-semibold tabular">{money(p.price)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-ink-3">Crescimento ({days} dias)</div>
                  <GrowthBadge value={growth} className="text-base" />
                </div>
                <div>
                  <div className="text-[11px] text-ink-3">Lucro estimado</div>
                  <div className={cn('text-base font-semibold tabular', insight.profit ? (insight.profit.profit >= 0 ? 'text-up' : 'text-down') : 'text-ink-3')}>
                    {insight.profit ? `${money(insight.profit.profit)} (${pct(insight.profit.marginPct)})` : '—'}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-3">
                Fonte: {p.sourceName}
                {p.sourceUrl && <> · <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand-2 hover:underline">ver na origem <ExternalLink className="h-3 w-3" /></a></>}
                {' '}· Última atualização: {dateTime(p.updatedAt)} ({relative(p.updatedAt)})
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {p.transient && <MonitorButton product={p} />}
                <FavoriteButton product={p} favorite={p.favorite} className="border border-line" />
                <Link to={`/calculadora?produto=${encodeURIComponent(p.id)}`}><Button size="sm"><Calculator className="h-3.5 w-3.5" /> Simular lucro</Button></Link>
                <Link to={`/radar?termos=${encodeURIComponent(p.trendTerm ?? p.name.split(' ').slice(0, 4).join(' '))}`}><Button size="sm" variant="ghost"><Radar className="h-3.5 w-3.5" /> Radar</Button></Link>
                {!p.transient && <QuickAlert p={p} />}
                {!p.transient && !p.shared && <DeleteButton id={p.id} />}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
            <h2 className="mb-3 text-sm font-semibold">Fornecedor</h2>
            <SupplierActions product={p} />
            <div className="mt-3 border-t border-brand/15 pt-3 text-xs text-ink-2">
              Custo no DropSeller: <strong className="text-ink tabular">{money(p.supplierCost)}</strong>
              {p.supplierCost == null && <span className="text-ink-3"> — informe em “Link” para calcular margem.</span>}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Tendência */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Tendência de interesse"
            subtitle={p.trendTerm ? `Termo: “${p.trendTerm}” · Google Trends (índice relativo, não vendas)` : 'Nenhum termo do Google Trends vinculado'}
            action={<Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7d' }, { value: '30', label: '30d' }, { value: '90', label: '90d' }]} />}
          />
          <div className="p-3 sm:p-4">
            {trend.length >= 2 ? (
              <TrendArea points={trend} />
            ) : (
              <EmptyState
                title="Sem série de tendência"
                description="Abra o Radar, pesquise o termo que o consumidor usaria e vincule a série a este produto."
                action={<Link to={`/radar?termos=${encodeURIComponent(p.name.split(' ').slice(0, 4).join(' '))}`}><Button size="sm"><Radar className="h-3.5 w-3.5" /> Abrir no Radar</Button></Link>}
              />
            )}
          </div>
        </Card>

        {/* Indicador */}
        <Card>
          <CardHeader title="Indicador de oportunidade" icon={<Gauge className="h-4 w-4 text-brand-2" />} subtitle="0–100 · metodologia transparente" />
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <ScoreRing score={insight.score.score} size={76} />
              <div>
                <div className="text-lg font-semibold">{insight.score.label}</div>
                <div className="text-xs text-ink-3">Cobertura dos dados: {insight.score.coverage}%</div>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {insight.score.components.map((c) => (
                <li key={c.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2">{c.label} <span className="text-ink-3">(peso {SCORE_WEIGHTS[c.key]})</span></span>
                    <span className="tabular text-ink">{c.value == null ? 'sem dado' : `${Math.round(c.value * 100)}%`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={cn('h-full rounded-full', c.value == null ? '' : 'bg-brand')} style={{ width: `${(c.value ?? 0) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-3">{c.explanation}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex gap-1.5 text-[11px] text-ink-3"><Info className="h-3.5 w-3.5 shrink-0" /> Componentes sem dado são excluídos e os pesos restantes são redistribuídos. O indicador ordena oportunidades; não é previsão nem garantia de vendas.</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Indicadores de demanda e vendas */}
        <Card>
          <CardHeader title="Indicadores de demanda e vendas" subtitle="Cada número com seu tipo e origem" />
          <div className="p-4 sm:p-5">
            {p.metrics.length === 0 ? (
              <p className="text-sm text-ink-3">A fonte não forneceu indicadores de venda ou popularidade para este produto.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">{p.metrics.map((m, i) => <MetricChip key={i} m={m} />)}</div>
            )}
            <ul className="mt-3 space-y-1 text-[11px] text-ink-3">
              {p.metrics.map((m, i) => <li key={i}>• {METRIC_LABEL[m.kind]}: {m.detail ?? '—'}{m.period ? ` (${m.period})` : ''}</li>)}
            </ul>
            {!sale && <p className="mt-3 text-xs text-warn">Sem dado de venda verificável — não trate popularidade como venda confirmada.</p>}
          </div>
        </Card>

        {/* Preço */}
        <Card>
          <CardHeader title="Histórico de preços" subtitle={`${p.priceHistory.length} registro(s)`} />
          <div className="p-3 sm:p-4">
            {p.priceHistory.length >= 2 ? <PriceChart points={p.priceHistory} /> : <p className="p-2 text-sm text-ink-3">O histórico se forma a cada atualização (monitoramento e sincronização diária). Ainda há {p.priceHistory.length} registro.</p>}
          </div>
        </Card>

        {/* Concorrência e semelhantes */}
        <Card>
          <CardHeader title="Concorrência e preços semelhantes" />
          <div className="space-y-4 p-4 sm:p-5">
            <div>
              <CompetitionBadge level={p.competition?.level} />
              <p className="mt-1.5 text-xs text-ink-3">{p.competition?.method ?? 'Não estimada: a fonte não informa o total de anúncios para este termo.'}</p>
            </div>
            {p.similarPrices.length ? (
              <div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Mínimo" value={money(Math.min(...p.similarPrices))} />
                  <MiniStat label="Mediana" value={money(sim)} />
                  <MiniStat label="Máximo" value={money(Math.max(...p.similarPrices))} />
                </div>
                {p.price != null && sim != null && (
                  <p className="mt-2 text-xs text-ink-3">Este anúncio está {pct(((p.price - sim) / sim) * 100, true)} em relação à mediana de {p.similarPrices.length} anúncios semelhantes.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-ink-3">Sem preços de anúncios semelhantes carregados.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Preço sugerido */}
        <Card>
          <CardHeader title="Sugestão de preço de venda" subtitle={`Margem alvo de ${catalog.settings?.targetMarginPct ?? 25}% (ajuste em Configurações)`} />
          <div className="p-4 sm:p-5">
            {insight.suggestedPrice == null ? (
              <p className="text-sm text-ink-3">Informe o custo no fornecedor e as tarifas do {p.marketplace === 'mercadolivre' ? 'Mercado Livre' : 'marketplace'} (Configurações) para calcular.</p>
            ) : (
              <>
                <div className="text-3xl font-semibold text-brand-2 tabular">{money(insight.suggestedPrice)}</div>
                <p className="mt-1 text-xs text-ink-3">Preço mínimo sem prejuízo: <strong className="text-ink">{money(insight.breakEvenPrice)}</strong></p>
                {sim != null && (
                  <p className={cn('mt-2 text-xs', insight.suggestedPrice > sim * 1.15 ? 'text-warn' : 'text-ink-3')}>
                    {insight.suggestedPrice > sim * 1.15
                      ? `Atenção: ${pct(((insight.suggestedPrice - sim) / sim) * 100, true)} acima da mediana do mercado (${money(sim)}). A margem alvo pode não ser competitiva.`
                      : `Compatível com a mediana do mercado (${money(sim)}).`}
                  </p>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Avaliação */}
        <Card className="lg:col-span-2">
          <CardHeader title="Avaliação da oportunidade" subtitle="Regras explícitas sobre os dados disponíveis" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-up"><CheckCircle2 className="h-4 w-4" /> Pontos positivos</h4>
              {positives.length ? <ul className="space-y-1.5 text-sm text-ink-2">{positives.map((x) => <li key={x}>• {x}</li>)}</ul> : <p className="text-sm text-ink-3">Nenhum ponto positivo identificado com os dados atuais.</p>}
            </div>
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-warn"><TriangleAlert className="h-4 w-4" /> Riscos e lacunas</h4>
              {risks.length ? <ul className="space-y-1.5 text-sm text-ink-2">{risks.map((x) => <li key={x}>• {x}</li>)}</ul> : <p className="text-sm text-ink-3">Nenhum risco identificado pelas regras — ainda assim, valide o fornecedor antes de anunciar.</p>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="mb-4 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-2 py-1.5">
      <div className="text-[10px] text-ink-3">{label}</div>
      <div className="text-xs font-semibold tabular">{value}</div>
    </div>
  );
}

export function assess(p: EnrichedProduct, growth: number | null, sim: number | null) {
  const positives: string[] = [];
  const risks: string[] = [];
  const m = p.insight.profit?.marginPct;
  if (growth != null && growth >= 10) positives.push(`Interesse de pesquisa em alta (${pct(growth, true)}).`);
  if (growth != null && growth < 0) risks.push(`Interesse de pesquisa em queda (${pct(growth, true)}).`);
  if (growth == null) risks.push('Sem série de tendência: crescimento da procura desconhecido.');
  if (m != null && m >= 25) positives.push(`Margem estimada saudável (${pct(m)}).`);
  if (m != null && m < 15) risks.push(`Margem estimada baixa (${pct(m)}) — pouco espaço para anúncios e devoluções.`);
  if (m == null) risks.push('Margem não calculada: falta custo no fornecedor ou tarifas.');
  if (p.competition?.level === 'baixa') positives.push('Concorrência estimada baixa.');
  if (p.competition?.level === 'alta') risks.push(`Concorrência estimada alta (${COMPETITION_LABEL.alta.toLowerCase()}): disputa por preço.`);
  if (p.quality === 'oficial') positives.push('Dados de fonte oficial.');
  if (p.quality === 'manual') risks.push('Dados informados manualmente — confirme na fonte.');
  if (p.quality === 'demo') risks.push('Dados fictícios de demonstração.');
  if (salesMetric(p)) positives.push(`Há dado de venda verificável (${METRIC_LABEL[salesMetric(p)!.kind].toLowerCase()}).`);
  else risks.push('Sem dado de venda verificável.');
  if (p.price != null && sim != null && p.price < sim * 0.9) positives.push('Preço abaixo da mediana de anúncios semelhantes.');
  if (p.price != null && sim != null && p.price > sim * 1.15) risks.push('Preço acima da mediana de anúncios semelhantes.');
  if (ageDays(p.updatedAt) > 7) risks.push(`Dados desatualizados (${relative(p.updatedAt)}).`);
  if (!p.supplierUrl) risks.push('Produto ainda não localizado no DropSeller.');
  return { positives, risks };
}

function QuickAlert({ p }: { p: EnrichedProduct }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AlertType>('interest_increase');
  const [threshold, setThreshold] = useState('20');
  const save = useSaveAlert();
  const ensure = useEnsureSaved();
  const unit = { interest_increase: '% de crescimento', margin_reached: '% de margem', price_change: '% de variação', new_opportunity: 'pontos' }[type];
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><BellPlus className="h-3.5 w-3.5" /> Alerta</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Criar alerta para este produto"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={save.isPending}
              onClick={async () => {
                const saved = await ensure(p);
                await save.mutateAsync({ type, productId: saved.id, category: null, threshold: Number(threshold.replace(',', '.')) || 0, active: true });
                setOpen(false);
              }}
            >
              Criar alerta
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="qa-type">Tipo</Label>
            <Select id="qa-type" value={type} onChange={(e) => setType(e.target.value as AlertType)}>
              {(['interest_increase', 'margin_reached', 'price_change'] as AlertType[]).map((t) => <option key={t} value={t}>{ALERT_LABEL[t]}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="qa-th">Limite ({unit})</Label>
            <Input id="qa-th" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <p className="text-xs text-ink-3">Os alertas são avaliados no painel sempre que os dados são carregados (sem e-mail ou push).</p>
        </div>
      </Modal>
    </>
  );
}

function DeleteButton({ id }: { id: string }) {
  const del = useDeleteProduct();
  const navigate = useNavigate();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-down hover:text-down"
      loading={del.isPending}
      onClick={async () => {
        if (!confirm('Remover este produto do seu catálogo?')) return;
        await del.mutateAsync(id);
        navigate('/em-alta');
      }}
    >
      <Trash2 className="h-3.5 w-3.5" /> Remover
    </Button>
  );
}
