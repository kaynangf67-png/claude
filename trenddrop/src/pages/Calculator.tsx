import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator as CalcIcon, Save, Trash2 } from 'lucide-react';
import { calculateProfit, priceForMargin, type ProfitInput } from '@shared/analysis';
import { MARKETPLACE_LABEL, type Marketplace } from '@shared/types';
import { cn } from '@/lib/cn';
import { dateTime, money, pct } from '@/lib/format';
import { useCatalog, useDeleteSimulation, useProduct, useSaveFees, useSaveSimulation, useSimulations } from '@/state/hooks';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, Notice, PageHeader, Select, Skeleton } from '@/components/ui';

type Form = Record<keyof ProfitInput, string>;
const EMPTY: Form = { supplierCost: '', salePrice: '', commissionPct: '', fixedFee: '', extraFeesPct: '', shipping: '', otherCosts: '', taxPct: '' };
const num = (s: string) => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const str = (n: number | null | undefined) => (n == null ? '' : String(n));

export default function CalculatorPage() {
  const [params] = useSearchParams();
  const catalog = useCatalog();
  const sims = useSimulations();
  const saveSim = useSaveSimulation();
  const delSim = useDeleteSimulation();
  const saveFees = useSaveFees();
  const [productId, setProductId] = useState(params.get('produto') ?? '');
  const linked = useProduct(productId || undefined);
  const [marketplace, setMarketplace] = useState<Marketplace>('mercadolivre');
  const [f, setF] = useState<Form>(EMPTY);
  const [name, setName] = useState('');

  const feeProfile = catalog.fees?.[marketplace];
  const loadedSim = useRef<Form | null>(null);

  // Aplica tarifas do marketplace ao trocar de marketplace (ou os valores de uma simulação carregada).
  useEffect(() => {
    if (loadedSim.current) {
      const sim = loadedSim.current;
      loadedSim.current = null;
      setF(sim);
      return;
    }
    const fp = catalog.fees?.[marketplace];
    setF((s) => ({
      ...s,
      commissionPct: str(fp?.commissionPct),
      fixedFee: str(fp?.fixedFee),
      extraFeesPct: str(fp?.extraFeesPct),
      shipping: str(fp?.shipping),
      otherCosts: str(fp?.otherCosts),
      taxPct: str(fp?.taxPct),
    }));
  }, [marketplace, catalog.fees]);

  // Preenche a partir do produto escolhido.
  useEffect(() => {
    const p = linked.data;
    if (!p) return;
    if (p.marketplace !== 'manual') setMarketplace(p.marketplace);
    setF((s) => ({ ...s, supplierCost: str(p.supplierCost), salePrice: str(p.price) }));
    setName(p.name.slice(0, 80));
  }, [linked.data]);

  const input: ProfitInput = useMemo(
    () => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, num(v)])) as unknown as ProfitInput,
    [f],
  );
  const r = calculateProfit(input);
  const target = catalog.settings?.targetMarginPct ?? 25;
  const targetPrice = priceForMargin(input, target);
  const ready = input.salePrice > 0;

  const field = (k: keyof ProfitInput, label: string, opts: { prefix?: string; suffix?: string; hint?: string } = {}) => (
    <div>
      <Label htmlFor={`c-${k}`} hint={opts.hint}>{label}</Label>
      <Input id={`c-${k}`} inputMode="decimal" placeholder="0" prefix={opts.prefix} suffix={opts.suffix} value={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} />
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow="Dropshipping" title="Calculadora de lucro" description="Lucro = preço de venda − custo do fornecedor − taxas − frete pago pelo vendedor − outros custos. Margem = lucro ÷ preço × 100." />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Dados da venda" icon={<CalcIcon className="h-4 w-4 text-brand-2" />} />
          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="c-prod">Produto (opcional)</Label>
                <Select id="c-prod" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Simulação livre</option>
                  {linked.data && !catalog.data?.some((p) => p.id === linked.data!.id) && <option value={linked.data.id}>{linked.data.name}</option>}
                  {catalog.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="c-mp">Marketplace</Label>
                <Select id="c-mp" value={marketplace} onChange={(e) => setMarketplace(e.target.value as Marketplace)}>
                  {(['mercadolivre', 'shopee', 'tiktok', 'manual'] as Marketplace[]).map((m) => <option key={m} value={m}>{MARKETPLACE_LABEL[m]}</option>)}
                </Select>
              </div>
            </div>

            {!feeProfile && (
              <Notice tone="amber">
                Nenhuma tarifa salva para {MARKETPLACE_LABEL[marketplace]}. Tarifas mudam por categoria, tipo de anúncio e faixa de preço — preencha com os valores vigentes da sua conta e clique em “Salvar como padrão”.
              </Notice>
            )}
            {feeProfile?.notes && <p className="-mt-2 text-xs text-ink-3">Observação das tarifas: {feeProfile.notes}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              {field('supplierCost', 'Custo do produto no DropSeller', { prefix: 'R$' })}
              {field('salePrice', 'Preço de venda', { prefix: 'R$' })}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Tarifas e custos — {MARKETPLACE_LABEL[marketplace]}</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={saveFees.isPending}
                  onClick={() =>
                    saveFees.mutate({
                      m: marketplace,
                      fee: { commissionPct: input.commissionPct, fixedFee: input.fixedFee, extraFeesPct: input.extraFeesPct, shipping: input.shipping, otherCosts: input.otherCosts, taxPct: input.taxPct, notes: feeProfile?.notes },
                    })
                  }
                >
                  <Save className="h-3.5 w-3.5" /> Salvar como padrão
                </Button>
              </div>
              <p className="mb-3 text-[11px] text-ink-3">Custos extras: embalagem, anúncios, brindes. Impostos: só se aplicáveis ao seu regime.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {field('commissionPct', 'Comissão do marketplace', { suffix: '%' })}
                {field('fixedFee', 'Tarifa fixa por venda', { prefix: 'R$' })}
                {field('extraFeesPct', 'Tarifas adicionais', { suffix: '%' })}
                {field('shipping', 'Frete pago pelo vendedor', { prefix: 'R$' })}
                {field('otherCosts', 'Custos extras', { prefix: 'R$' })}
                {field('taxPct', 'Impostos', { suffix: '%' })}
              </div>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Resultado" subtitle="Atualiza automaticamente" />
          <div className="p-4 sm:p-5">
            {!ready ? (
              <EmptyState title="Informe o preço de venda" description="Os resultados aparecem conforme você preenche." />
            ) : (
              <>
                <div className={cn('rounded-xl border p-4', r.profit >= 0 ? 'border-brand/30 bg-brand/5' : 'border-down/30 bg-down/5')}>
                  <div className="text-xs text-ink-3">Lucro líquido estimado</div>
                  <div className={cn('text-3xl font-semibold tabular', r.profit >= 0 ? 'text-up' : 'text-down')}>{money(r.profit)}</div>
                  <div className="mt-1 text-sm text-ink-2">Margem: <strong className="tabular">{pct(r.marginPct)}</strong></div>
                </div>
                <dl className="mt-4 divide-y divide-line text-sm">
                  <Row k="Receita da venda" v={money(r.revenue)} />
                  <Row k="Taxas do marketplace" v={money(r.fees)} />
                  <Row k="Impostos" v={money(r.taxes)} />
                  <Row k="Taxas totais (taxas + impostos)" v={money(r.fees + r.taxes)} />
                  <Row k="Custo total" v={money(r.totalCost)} />
                  <Row k="Preço mínimo sem prejuízo" v={r.breakEvenPrice == null ? 'impossível com estes percentuais' : money(r.breakEvenPrice)} strong />
                  <Row k={`Preço para margem de ${target}%`} v={targetPrice == null ? '—' : money(targetPrice)} />
                </dl>
                <div className="mt-4 flex gap-2">
                  <Input aria-label="Nome da simulação" placeholder="Nome da simulação" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                  <Button
                    variant="primary"
                    loading={saveSim.isPending}
                    onClick={() =>
                      saveSim.mutate({ name: name.trim() || `Simulação ${new Date().toLocaleString('pt-BR')}`, marketplace, productId: productId || null, inputs: input, results: r })
                    }
                  >
                    <Save className="h-4 w-4" /> Salvar
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Simulações salvas" subtitle="Compare cenários lado a lado" />
        {sims.isLoading ? (
          <div className="p-4"><Skeleton className="h-24" /></div>
        ) : !sims.data?.length ? (
          <EmptyState title="Nenhuma simulação salva" description="Salve cenários com preços ou tarifas diferentes para comparar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-[11px] tracking-wide text-ink-3 uppercase">
                  <th className="px-4 py-2.5 font-medium">Simulação</th>
                  <th className="px-3 py-2.5 font-medium">Marketplace</th>
                  <th className="px-3 py-2.5 text-right font-medium">Custo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Preço</th>
                  <th className="px-3 py-2.5 text-right font-medium">Taxas</th>
                  <th className="px-3 py-2.5 text-right font-medium">Lucro</th>
                  <th className="px-3 py-2.5 text-right font-medium">Margem</th>
                  <th className="px-3 py-2.5 text-right font-medium">Preço mínimo</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sims.data.map((s) => {
                  const best = Math.max(...sims.data!.map((x) => x.results.profit));
                  return (
                    <tr key={s.id} className="hover:bg-surface-2">
                      <td className="px-4 py-2.5">
                        <button
                          className="text-left text-ink hover:text-brand-2"
                          onClick={() => {
                            const form = Object.fromEntries(Object.entries(s.inputs).map(([k, v]) => [k, String(v)])) as Form;
                            if (s.marketplace === marketplace) setF(form);
                            else {
                              loadedSim.current = form;
                              setMarketplace(s.marketplace);
                            }
                            setName(s.name);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          title="Carregar na calculadora"
                        >
                          {s.name}
                        </button>
                        <div className="text-[11px] text-ink-3">{dateTime(s.createdAt)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-2">{MARKETPLACE_LABEL[s.marketplace]}</td>
                      <td className="px-3 py-2.5 text-right tabular">{money(s.inputs.supplierCost)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{money(s.inputs.salePrice)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{money(s.results.fees + s.results.taxes)}</td>
                      <td className={cn('px-3 py-2.5 text-right font-semibold tabular', s.results.profit >= 0 ? 'text-up' : 'text-down')}>
                        {money(s.results.profit)} {s.results.profit === best && sims.data!.length > 1 && <Badge tone="green" className="ml-1">melhor</Badge>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">{pct(s.results.marginPct)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{money(s.results.breakEvenPrice)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button size="icon" variant="ghost" aria-label="Excluir simulação" onClick={() => delSim.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-ink-3">{k}</dt>
      <dd className={cn('text-right tabular', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{v}</dd>
    </div>
  );
}
