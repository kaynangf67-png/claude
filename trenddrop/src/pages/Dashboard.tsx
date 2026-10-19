import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Boxes, Crown, Flame, FlaskConical, Gauge, Radar, Rocket, Shield, Sparkles, Store, TrendingUp, Wallet } from 'lucide-react';
import { hasSalesData, salesMetric } from '@shared/analysis';
import { METRIC_LABEL } from '@shared/types';
import { money, pct } from '@/lib/format';
import { useApp } from '@/state/app';
import { useCatalog, useIntegrationStatus, windowed, type EnrichedProduct } from '@/state/hooks';
import { MultiTrendChart } from '@/components/charts';
import { RankList, StatCard } from '@/components/lists';
import { GrowthBadge, metricText } from '@/components/product';
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Segmented, Skeleton } from '@/components/ui';

type Win = '1' | '7' | '30';
const WIN_LABEL: Record<Win, string> = { '1': 'Hoje', '7': '7 dias', '30': '30 dias' };

export default function Dashboard() {
  const { setDemo, mode } = useApp();
  const catalog = useCatalog();
  const status = useIntegrationStatus();
  const [win, setWin] = useState<Win>('7');
  const days = Number(win);

  const items = useMemo(
    () => (catalog.data ?? []).map((p) => ({ ...p, growthPct: windowed(p, days).growth }) as EnrichedProduct),
    [catalog.data, days],
  );

  const withGrowth = items.filter((p) => p.growthPct != null);
  const rising = withGrowth.filter((p) => p.growthPct! >= 10);
  const opportunities = items.filter((p) => (p.insight.score.score ?? 0) >= 55);
  const margins = items.map((p) => p.insight.profit?.marginPct).filter((m): m is number => m != null);
  const avgMargin = margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : null;

  const avgRecent = (p: EnrichedProduct) => {
    const t = p.trend.slice(-Math.max(days, 3));
    return t.length ? t.reduce((s, x) => s + x.value, 0) / t.length : -1;
  };
  const hotNow = [...items].filter((p) => p.trend.length).sort((a, b) => avgRecent(b) - avgRecent(a)).slice(0, 5);
  const topGrowth = [...withGrowth].sort((a, b) => b.growthPct! - a.growthPct!).slice(0, 5);
  const best = items.filter(hasSalesData).sort((a, b) => rankValue(a) - rankValue(b)).slice(0, 5);
  const profit = items.filter((p) => p.insight.profit).sort((a, b) => b.insight.profit!.profit - a.insight.profit!.profit).slice(0, 5);
  const lowComp = items.filter((p) => p.competition?.level === 'baixa').sort((a, b) => (b.insight.score.score ?? 0) - (a.insight.score.score ?? 0)).slice(0, 5);
  const viral = items
    .filter((p) => p.metrics.some((m) => m.kind === 'visualizacoes' || m.kind === 'curtidas'))
    .sort((a, b) => social(b) - social(a))
    .slice(0, 5);
  const fresh = opportunities
    .filter((p) => Date.now() - new Date(p.updatedAt).getTime() < 7 * 86_400_000)
    .sort((a, b) => (b.insight.score.score ?? 0) - (a.insight.score.score ?? 0))
    .slice(0, 5);
  const chartSeries = topGrowth.slice(0, 5).map((p) => ({ name: shorten(p.name), points: windowed(p, Math.max(days, 7)).trend }));

  const loaded = !catalog.isLoading && !catalog.error;
  const empty = loaded && items.length === 0;
  const notLoaded = 'Ainda não carregado';

  return (
    <div>
      <PageHeader
        eyebrow="Painel de inteligência"
        title="Oportunidades de produto no Brasil"
        description="Procura crescente, margem positiva e concorrência administrável — com a origem de cada número identificada."
        actions={<Segmented value={win} onChange={setWin} options={(['1', '7', '30'] as Win[]).map((v) => ({ value: v, label: WIN_LABEL[v] }))} />}
      />

      {catalog.error ? <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} className="mb-6" /> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Produtos monitorados" icon={<Boxes className="h-4 w-4" />} value={catalog.isLoading ? <Skeleton className="h-8 w-16" /> : empty ? '—' : items.length} hint={empty ? notLoaded : 'no seu catálogo'} />
        <StatCard
          label="Tendências em crescimento"
          icon={<TrendingUp className="h-4 w-4" />}
          value={catalog.isLoading ? <Skeleton className="h-8 w-16" /> : withGrowth.length ? rising.length : '—'}
          hint={withGrowth.length ? `≥ +10% · ${WIN_LABEL[win].toLowerCase()}` : 'Sem séries de tendência carregadas'}
        />
        <StatCard
          accent
          label="Oportunidades encontradas"
          icon={<Rocket className="h-4 w-4" />}
          value={catalog.isLoading ? <Skeleton className="h-8 w-16" /> : empty ? '—' : opportunities.length}
          hint={empty ? notLoaded : 'indicador ≥ 55 (não é garantia)'}
        />
        <StatCard
          label="Margem média estimada"
          icon={<Wallet className="h-4 w-4" />}
          value={catalog.isLoading ? <Skeleton className="h-8 w-20" /> : avgMargin == null ? '—' : pct(avgMargin)}
          hint={avgMargin == null ? 'Informe custo no fornecedor e tarifas' : `${margins.length} produto(s) com custo informado`}
        />
      </div>

      {empty ? (
        <Card className="mt-6">
          <EmptyState
            icon={<Radar className="h-5 w-5" />}
            title="Nenhum produto monitorado ainda"
            description={
              <>
                Pesquise nos marketplaces e clique em <strong>Monitorar</strong>, ou analise termos no Radar. Nada é inventado: os indicadores aparecem conforme os dados são carregados das fontes conectadas.
              </>
            }
            action={
              <>
                <Link to="/mercado-livre"><Button variant="primary"><Store className="h-4 w-4" /> Pesquisar no Mercado Livre</Button></Link>
                <Link to="/radar"><Button><Radar className="h-4 w-4" /> Abrir Radar de Tendências</Button></Link>
                {mode !== 'demo' && <Button variant="ghost" onClick={() => setDemo(true)}><FlaskConical className="h-4 w-4" /> Ver demonstração</Button>}
              </>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Curvas de interesse — maiores crescimentos" subtitle="Índice 0–100 do Google Trends: interesse relativo de pesquisa, não vendas." icon={<Activity className="h-4 w-4 text-brand-2" />} />
              <div className="p-3 sm:p-4">
                {catalog.isLoading ? <Skeleton className="h-[280px]" /> : chartSeries.length ? <MultiTrendChart series={chartSeries} /> : <EmptyState title="Sem séries de tendência" description="Vincule um termo do Google Trends aos produtos (página de detalhes) para ver as curvas." />}
              </div>
            </Card>
            <RankList
              title="Em alta no momento"
              subtitle={`Maior interesse médio · ${WIN_LABEL[win].toLowerCase()}`}
              icon={<Flame className="h-4 w-4 text-orange-400" />}
              items={hotNow}
              loading={catalog.isLoading}
              value={(p) => <GrowthBadge value={p.growthPct} />}
              empty="Sem séries de tendência carregadas."
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RankList title="Maior crescimento de interesse" icon={<TrendingUp className="h-4 w-4 text-brand-2" />} items={topGrowth} loading={catalog.isLoading} value={(p) => <GrowthBadge value={p.growthPct} />} empty="Sem tendências calculadas." />
            <RankList
              title="Mais vendidos"
              subtitle="Somente com dado de venda ou ranking verificável"
              icon={<Crown className="h-4 w-4 text-yellow-300" />}
              items={best}
              loading={catalog.isLoading}
              value={(p) => {
                const m = salesMetric(p)!;
                return (
                  <span className="flex flex-col text-xs leading-tight" title={`${METRIC_LABEL[m.kind]} — ${m.detail ?? ''}`}>
                    <span className="font-semibold text-ink tabular">{metricText(m)}</span>
                    <span className="text-[10px] text-ink-3">{m.kind === 'ranking_mais_vendidos' ? 'no ranking' : 'vendas'}</span>
                  </span>
                );
              }}
              empty="Nenhuma fonte com dados de venda verificáveis carregada."
              action={<Link to="/mais-vendidos" className="text-xs text-brand-2 hover:underline">ver todos</Link>}
            />
            <RankList title="Potencial de lucro" subtitle="Lucro líquido estimado por venda" icon={<Wallet className="h-4 w-4 text-brand-2" />} items={profit} loading={catalog.isLoading} value={(p) => <span className="text-xs font-semibold text-up tabular">{money(p.insight.profit!.profit)}</span>} empty="Informe custo no DropSeller e configure as tarifas para estimar lucro." />
            <RankList title="Baixa concorrência estimada" icon={<Shield className="h-4 w-4 text-info" />} items={lowComp} loading={catalog.isLoading} value={(p) => <span className="text-xs text-ink-2 tabular">{p.competition?.sample?.toLocaleString('pt-BR') ?? '—'} anúncios</span>} empty="Nenhum produto com concorrência baixa estimada." />
            <RankList
              title="Virais nas redes sociais"
              subtitle="Visualizações/curtidas — popularidade, não vendas"
              icon={<Sparkles className="h-4 w-4 text-pink-400" />}
              items={viral}
              loading={catalog.isLoading}
              value={(p) => {
                const m = p.metrics.find((x) => x.kind === 'visualizacoes') ?? p.metrics.find((x) => x.kind === 'curtidas')!;
                return <span className="text-xs text-ink-2 tabular">{metricText(m)} {m.kind === 'visualizacoes' ? 'views' : 'curtidas'}</span>;
              }}
              empty="Nenhum produto com métricas sociais (cadastre em TikTok Shop)."
            />
            <RankList title="Novas oportunidades" subtitle="Indicador ≥ 55, atualizadas nos últimos 7 dias" icon={<Gauge className="h-4 w-4 text-brand-2" />} items={fresh} loading={catalog.isLoading} value={(p) => <span className="text-xs text-ink-3">{p.insight.score.label}</span>} empty="Nenhuma oportunidade nova nos últimos 7 dias." />
          </div>
        </>
      )}

      <Card className="mt-4">
        <CardHeader title="Fontes de dados" subtitle="Status das integrações no servidor" action={<Link to="/configuracoes" className="text-xs text-brand-2 hover:underline">configurar</Link>} />
        <div className="grid gap-px overflow-hidden rounded-b-xl bg-line sm:grid-cols-3 xl:grid-cols-6">
          {status.isLoading
            ? Array.from({ length: 6 }, (_, i) => <div key={i} className="bg-surface p-3"><Skeleton className="h-10" /></div>)
            : status.error
              ? <div className="bg-surface p-4 text-sm text-ink-3 sm:col-span-3 xl:col-span-6">Backend indisponível: {(status.error as Error).message}</div>
              : status.data?.integrations.map((i) => (
                  <div key={i.id} className="bg-surface p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
                      <span className={`h-1.5 w-1.5 rounded-full ${i.state === 'conectada' ? 'bg-brand' : i.state === 'pendente' ? 'bg-warn' : 'bg-ink-3'}`} />
                      {i.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-3 capitalize">{i.state === 'indisponivel' ? 'indisponível' : i.state}</div>
                  </div>
                ))}
        </div>
      </Card>
    </div>
  );
}

function rankValue(p: EnrichedProduct) {
  const m = salesMetric(p);
  if (!m) return 1e9;
  // ranking: menor é melhor; vendas: maior é melhor
  return m.kind === 'ranking_mais_vendidos' ? m.value : -m.value + 1e6;
}
function social(p: EnrichedProduct) {
  return p.metrics.filter((m) => m.kind === 'visualizacoes' || m.kind === 'curtidas').reduce((s, m) => s + m.value, 0);
}
function shorten(s: string) {
  return s.length > 26 ? `${s.slice(0, 24)}…` : s;
}
