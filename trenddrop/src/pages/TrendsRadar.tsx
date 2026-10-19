import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellPlus, Link2, MapPin, Plus, Radar, TrendingDown, TrendingUp, X } from 'lucide-react';
import { TREND_PERIOD_LABEL, type TrendPeriod } from '@shared/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateTime, pct } from '@/lib/format';
import { demoTrends } from '@/data/demo';
import { useApp } from '@/state/app';
import { useCatalog, useSaveAlert, useSaveProduct } from '@/state/hooks';
import { MultiTrendChart, SERIES_COLORS } from '@/components/charts';
import { IntegrationError } from '@/components/live';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Modal, Notice, PageHeader, Segmented, Select, Skeleton } from '@/components/ui';

const SUGGESTIONS = ['mini liquidificador portátil', 'seladora a vácuo', 'acessórios para pets', 'garrafa térmica', 'luminária de lua'];
const UFS: [string, string][] = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'], ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'],
  ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
  ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'],
  ['SC', 'Santa Catarina'], ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
];
const ALERT_GROWTH = 20;

export default function TrendsRadar() {
  const { mode } = useApp();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('termos') ?? '').split('|').map((t) => t.trim()).filter(Boolean).slice(0, 5);
  const [terms, setTerms] = useState<string[]>(initial);
  const [draft, setDraft] = useState('');
  const [period, setPeriod] = useState<TrendPeriod>('90d');
  const [geo, setGeo] = useState('BR');
  const [linkTerm, setLinkTerm] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['trends', mode === 'demo', terms, period, geo],
    queryFn: () => (mode === 'demo' ? Promise.resolve(demoTrends(terms, period)) : api.trends(terms, period, true, geo)),
    enabled: terms.length > 0,
    retry: 0,
    staleTime: 30 * 60_000,
  });

  function sync(next: string[]) {
    setTerms(next);
    setParams(next.length ? { termos: next.join('|') } : {}, { replace: true });
  }
  function add(e?: FormEvent, value = draft) {
    e?.preventDefault();
    const t = value.trim().replace(/[,|]/g, ' ');
    if (!t) return;
    if (terms.length >= 5) return toast.warning('Compare no máximo 5 termos.');
    if (terms.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    sync([...terms, t]);
    setDraft('');
  }

  const data = query.data;
  const isDemo = mode === 'demo';
  const rising = data?.series.filter((s) => (s.growthPct ?? 0) >= ALERT_GROWTH) ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={isDemo ? 'Demonstração · séries fictícias' : 'Google Trends · Brasil'}
        title="Radar de Tendências"
        description="Compare o interesse de pesquisa de até cinco produtos. O índice 0–100 do Google Trends é relativo ao maior ponto do gráfico — mede interesse, não quantidade de vendas."
      />

      <Card className="p-4 sm:p-5">
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Termo" placeholder="Digite um produto e pressione Enter" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} className="flex-1" />
          <Button type="submit" variant="primary" disabled={!draft.trim() || terms.length >= 5}><Plus className="h-4 w-4" /> Adicionar termo</Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {terms.map((t, i) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 py-1 pr-1 pl-3 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
              {t}
              <button onClick={() => sync(terms.filter((x) => x !== t))} className="rounded-full p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label={`Remover ${t}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          {terms.length === 0 && <span className="text-xs text-ink-3">Sugestões:</span>}
          {terms.length < 5 &&
            SUGGESTIONS.filter((s) => !terms.includes(s)).slice(0, terms.length ? 2 : 5).map((s) => (
              <button key={s} onClick={() => add(undefined, s)} className="rounded-full border border-dashed border-line-strong px-3 py-1 text-xs text-ink-3 hover:border-brand/50 hover:text-brand-2">+ {s}</button>
            ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Segmented value={period} onChange={setPeriod} options={(['7d', '30d', '90d', '12m'] as TrendPeriod[]).map((p) => ({ value: p, label: TREND_PERIOD_LABEL[p].replace('Últimos ', '') }))} />
          <Select aria-label="Região" className="h-9 sm:w-56" value={geo} onChange={(e) => setGeo(e.target.value)} disabled={isDemo}>
            <option value="BR">Brasil (todos os estados)</option>
            {UFS.map(([uf, name]) => <option key={uf} value={`BR-${uf}`}>{name}</option>)}
          </Select>
        </div>
      </Card>

      {isDemo && <Notice tone="amber" className="mt-4"><strong>Demonstração:</strong> as curvas abaixo são fictícias. Saia da demonstração e configure a SerpApi para ver dados reais do Google Trends.</Notice>}

      {terms.length === 0 ? (
        <Card className="mt-4"><EmptyState icon={<Radar className="h-5 w-5" />} title="Adicione termos para analisar" description="Use os nomes que o consumidor pesquisaria, ex.: “seladora a vácuo” em vez do nome técnico do anúncio." /></Card>
      ) : query.isLoading ? (
        <div className="mt-4 space-y-4"><Skeleton className="h-80" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div></div>
      ) : query.error ? (
        <div className="mt-4"><IntegrationError error={query.error} onRetry={() => query.refetch()} /></div>
      ) : data ? (
        <>
          {rising.length > 0 && (
            <Notice tone="green" icon={<TrendingUp className="h-4 w-4 text-brand-2" />} className="mt-4">
              <strong className="text-ink">Alerta de interesse em alta:</strong> {rising.map((s) => `${s.term} (${pct(s.growthPct, true)})`).join(', ')} — crescimento ≥ {ALERT_GROWTH}% no período.
            </Notice>
          )}
          <Card className="mt-4">
            <CardHeader
              title="Interesse ao longo do tempo"
              subtitle={`${TREND_PERIOD_LABEL[period]} · ${geo === 'BR' ? 'Brasil' : UFS.find(([u]) => `BR-${u}` === geo)?.[1]} · ${isDemo ? 'dados fictícios' : `fonte: Google Trends via SerpApi · consultado em ${dateTime(data.fetchedAt)}`}`}
            />
            <div className="p-3 sm:p-4">
              {data.series.every((s) => s.points.length === 0) ? <EmptyState title="Sem dados suficientes" description="O Google Trends não tem volume de pesquisa suficiente para estes termos no período/região." /> : <MultiTrendChart series={data.series.map((s) => ({ name: s.term, points: s.points }))} height={320} />}
            </div>
          </Card>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {data.series.map((s, i) => (
              <Card key={s.term} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                  <span className="truncate text-sm font-medium">{s.term}</span>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[11px] text-ink-3">Crescimento</div>
                    <div className={cn('flex items-center gap-1 text-lg font-semibold tabular', (s.growthPct ?? 0) > 2 ? 'text-up' : (s.growthPct ?? 0) < -2 ? 'text-down' : 'text-ink')}>
                      {(s.growthPct ?? 0) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {pct(s.growthPct, true)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-ink-3">Média</div>
                    <div className="text-lg font-semibold tabular">{s.average ?? '—'}</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="mt-3 w-full justify-center" onClick={() => setLinkTerm(s.term)} disabled={isDemo || !s.points.length}>
                  <Link2 className="h-3.5 w-3.5" /> Vincular a um produto
                </Button>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={`Interesse por estado — “${terms[0]}”`} subtitle="Relativo ao estado com maior interesse (100)" icon={<MapPin className="h-4 w-4 text-brand-2" />} />
              <div className="p-4 sm:p-5">
                {data.regions.length === 0 ? (
                  <p className="text-sm text-ink-3">{geo !== 'BR' ? 'Detalhamento por estado disponível apenas na visão Brasil.' : 'Sem dados por região para este termo.'}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.regions.slice(0, 12).map((r) => (
                      <li key={r.code} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2 text-xs">
                        <span className="truncate text-ink-2">{r.name}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-gradient-to-r from-brand/60 to-brand-2" style={{ width: `${r.value}%` }} /></span>
                        <span className="text-right text-ink tabular">{r.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title={`Consultas relacionadas — “${terms[0]}”`} subtitle="Em ascensão e principais" />
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                {(['rising', 'top'] as const).map((k) => (
                  <div key={k}>
                    <h4 className="mb-2 text-xs font-semibold text-ink-2">{k === 'rising' ? 'Em ascensão' : 'Principais'}</h4>
                    {data.related.filter((r) => r.kind === k).length === 0 ? (
                      <p className="text-xs text-ink-3">Sem dados.</p>
                    ) : (
                      <ul className="space-y-1">
                        {data.related.filter((r) => r.kind === k).slice(0, 10).map((r) => (
                          <li key={r.query} className="flex items-center justify-between gap-2 text-xs">
                            <button className="truncate text-left text-ink-2 hover:text-brand-2" onClick={() => add(undefined, r.query)} title="Adicionar à comparação">{r.query}</button>
                            <Badge tone={k === 'rising' ? 'green' : 'neutral'}>{r.value}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <p className="mt-4 text-xs text-ink-3">
            Limitações: valores relativos (0–100) dentro desta consulta; mudar termos, período ou região reescala tudo. Estados e consultas relacionadas referem-se ao primeiro termo. Dados com até ~2 dias de atraso podem aparecer.
          </p>
        </>
      ) : null}

      {linkTerm && data && <LinkModal term={linkTerm} series={data.series.find((s) => s.term === linkTerm)!} onClose={() => setLinkTerm(null)} />}
    </div>
  );
}

function LinkModal({ term, series, onClose }: { term: string; series: { points: { date: string; value: number }[]; growthPct: number | null }; onClose: () => void }) {
  const catalog = useCatalog();
  const save = useSaveProduct();
  const saveAlert = useSaveAlert();
  const [id, setId] = useState('');
  const [alert, setAlert] = useState(true);
  const products = useMemo(() => (catalog.data ?? []).filter((p) => p.quality !== 'demo'), [catalog.data]);

  async function go() {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const saved = await save.mutateAsync({ ...p, trendTerm: term, trend: series.points.map((x) => ({ date: x.date.slice(0, 10), value: x.value })), growthPct: series.growthPct, updatedAt: new Date().toISOString() });
    if (alert) await saveAlert.mutateAsync({ type: 'interest_increase', productId: saved.id, category: null, threshold: ALERT_GROWTH, active: true });
    toast.success(`Termo vinculado a “${p.name}”.`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Vincular “${term}” a um produto`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={go} disabled={!id} loading={save.isPending}>Vincular</Button></>}
    >
      <p className="mb-3 text-sm text-ink-3">A série atual passa a ser a tendência do produto e alimenta o crescimento e o indicador de oportunidade.</p>
      {products.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum produto monitorado. Monitore um produto em Mercado Livre, Shopee ou TikTok Shop primeiro.</p>
      ) : (
        <Select aria-label="Produto" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Escolha o produto</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={alert} onChange={(e) => setAlert(e.target.checked)} className="accent-brand" />
        <BellPlus className="h-4 w-4" /> Criar alerta quando o interesse crescer {ALERT_GROWTH}% ou mais
      </label>
    </Modal>
  );
}
