import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, CircleSlash, ExternalLink, FlaskConical, KeyRound, RotateCcw, Save, Store } from 'lucide-react';
import { buildSupplierSearchUrl, type FeeProfile } from '@shared/analysis';
import { MARKETPLACE_LABEL, type IntegrationStatus, type Marketplace } from '@shared/types';
import { isSupabaseConfigured } from '@/lib/env';
import { useApp } from '@/state/app';
import { useFees, useIntegrationStatus, useSaveFees, useSaveSettings, useSettings } from '@/state/hooks';
import { Badge, Button, Card, CardHeader, ErrorState, Input, Label, Notice, PageHeader, Skeleton, Toggle } from '@/components/ui';

export default function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Conta e fontes" title="Configurações e integrações" description="Status das fontes de dados, fornecedor DropSeller, tarifas por marketplace e modo de uso." />
      <div className="space-y-4">
        <Integrations />
        <SupplierSettings />
        <FeeSettings />
        <ModeSettings />
      </div>
    </div>
  );
}

function StateBadge({ s }: { s: IntegrationStatus['state'] }) {
  if (s === 'conectada') return <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Conectada</Badge>;
  if (s === 'pendente') return <Badge tone="amber"><CircleDashed className="h-3 w-3" /> Pendente</Badge>;
  return <Badge><CircleSlash className="h-3 w-3" /> Indisponível</Badge>;
}

function Integrations() {
  const status = useIntegrationStatus();
  return (
    <Card>
      <CardHeader title="Integrações" subtitle="Chaves e tokens ficam só no servidor (variáveis de ambiente). Esta tela mostra apenas se estão configurados." icon={<KeyRound className="h-4 w-4 text-brand-2" />} action={<Button size="sm" variant="ghost" onClick={() => status.refetch()} loading={status.isFetching}>Verificar</Button>} />
      <div className="p-4 sm:p-5">
        {status.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
        ) : status.error ? (
          <ErrorState error={status.error} onRetry={() => status.refetch()} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {status.data!.integrations.map((i) => (
              <div key={i.id} className="flex flex-col rounded-xl border border-line bg-surface-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">{i.name}</h4>
                    <p className="text-[11px] text-ink-3">{i.provider}</p>
                  </div>
                  <StateBadge s={i.state} />
                </div>
                <p className="mt-2 text-xs text-ink-2">{i.message}</p>
                {i.requires.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {i.requires.map((r) => <code key={r} className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-2">{r}</code>)}
                  </div>
                )}
                <details className="mt-2 text-xs text-ink-3">
                  <summary className="cursor-pointer hover:text-ink-2">Dados e limitações</summary>
                  <ul className="mt-1.5 space-y-0.5">{i.dataAvailable.map((d) => <li key={d}>✓ {d}</li>)}</ul>
                  <ul className="mt-1.5 space-y-0.5 text-warn/90">{i.limitations.map((d) => <li key={d}>! {d}</li>)}</ul>
                </details>
                {i.docsUrl && (
                  <a href={i.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 pt-3 text-xs text-brand-2 hover:underline">
                    Documentação <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function SupplierSettings() {
  const settings = useSettings();
  const save = useSaveSettings();
  const [url, setUrl] = useState('');
  const [margin, setMargin] = useState('25');
  useEffect(() => {
    if (settings.data) {
      setUrl(settings.data.dropsellerSearchUrl ?? '');
      setMargin(String(settings.data.targetMarginPct));
    }
  }, [settings.data]);
  const preview = buildSupplierSearchUrl(url, 'seladora a vácuo');
  const urlError = url && !preview ? 'Use um endereço completo (https://…) contendo {q} no lugar do termo pesquisado.' : null;
  const m = Number(margin.replace(',', '.'));
  const marginError = !Number.isFinite(m) || m < 0 || m > 90 ? 'Entre 0 e 90.' : null;

  return (
    <Card>
      <CardHeader title="Fornecedor DropSeller" subtitle="Usado pelo botão “Encontrar no DropSeller” quando o produto ainda não tem link direto" icon={<Store className="h-4 w-4 text-brand-2" />} />
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Label htmlFor="ds-url">URL de pesquisa do DropSeller</Label>
          <Input id="ds-url" type="url" placeholder="https://endereco-do-dropseller/busca?q={q}" value={url} onChange={(e) => setUrl(e.target.value)} />
          {urlError ? (
            <p className="mt-1 text-xs text-down">{urlError}</p>
          ) : (
            <p className="mt-1 text-xs text-ink-3">
              Faça uma busca qualquer no site do DropSeller, copie o endereço da página de resultados e troque o termo por <code className="text-ink-2">{'{q}'}</code>. Não preenchemos este endereço por você: não há URL pública documentada que possamos confirmar.
            </p>
          )}
          {preview && (
            <a href={preview} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-brand-2 hover:underline">
              Testar com “seladora a vácuo” <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div>
          <Label htmlFor="ds-margin">Margem alvo para sugestão de preço</Label>
          <Input id="ds-margin" inputMode="decimal" suffix="%" value={margin} onChange={(e) => setMargin(e.target.value)} />
          {marginError && <p className="mt-1 text-xs text-down">{marginError}</p>}
        </div>
        <div className="lg:col-span-3">
          <Button variant="primary" disabled={Boolean(urlError || marginError)} loading={save.isPending} onClick={() => save.mutate({ dropsellerSearchUrl: url.trim() || null, targetMarginPct: m })}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </div>
      </div>
    </Card>
  );
}

const FEE_FIELDS: { k: keyof FeeProfile; label: string; unit: '%' | 'R$' }[] = [
  { k: 'commissionPct', label: 'Comissão', unit: '%' },
  { k: 'fixedFee', label: 'Tarifa fixa', unit: 'R$' },
  { k: 'extraFeesPct', label: 'Tarifas adic.', unit: '%' },
  { k: 'shipping', label: 'Frete vendedor', unit: 'R$' },
  { k: 'otherCosts', label: 'Custos extras', unit: 'R$' },
  { k: 'taxPct', label: 'Impostos', unit: '%' },
];

function FeeSettings() {
  const fees = useFees();
  return (
    <Card>
      <CardHeader title="Tarifas por marketplace" subtitle="Usadas no cálculo de lucro, margem e indicador de oportunidade" />
      <div className="p-4 sm:p-5">
        <Notice tone="amber" className="mb-4">
          Tarifas não são universais: variam por categoria, tipo de anúncio, faixa de preço, programa de frete e mudam com o tempo. Preencha com os valores da sua conta conforme a tabela vigente de cada marketplace.
        </Notice>
        {fees.isLoading ? <Skeleton className="h-40" /> : (
          <div className="space-y-3">
            {(['mercadolivre', 'shopee', 'tiktok', 'manual'] as Marketplace[]).map((m) => <FeeRow key={m} m={m} initial={fees.data?.[m]} />)}
          </div>
        )}
      </div>
    </Card>
  );
}

function FeeRow({ m, initial }: { m: Marketplace; initial?: FeeProfile & { notes?: string } }) {
  const save = useSaveFees();
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => {
    setV(Object.fromEntries([...FEE_FIELDS.map((f) => [f.k, initial ? String(initial[f.k]) : '']), ['notes', initial?.notes ?? '']]));
  }, [initial]);
  const n = (s: string | undefined) => {
    const x = Number(String(s ?? '').replace(',', '.'));
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{MARKETPLACE_LABEL[m]}</span>
        {!initial && <Badge tone="amber">não configurado</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {FEE_FIELDS.map((f) => (
          <div key={f.k}>
            <Label htmlFor={`fee-${m}-${f.k}`}>{f.label}</Label>
            <Input id={`fee-${m}-${f.k}`} inputMode="decimal" placeholder="0" prefix={f.unit === 'R$' ? 'R$' : undefined} suffix={f.unit === '%' ? '%' : undefined} value={v[f.k] ?? ''} onChange={(e) => setV((s) => ({ ...s, [f.k]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input aria-label="Observações" placeholder="Observações (ex.: anúncio clássico, categoria Casa)" value={v.notes ?? ''} onChange={(e) => setV((s) => ({ ...s, notes: e.target.value }))} maxLength={500} />
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              m,
              fee: { commissionPct: Math.min(100, n(v.commissionPct)), fixedFee: n(v.fixedFee), extraFeesPct: Math.min(100, n(v.extraFeesPct)), shipping: n(v.shipping), otherCosts: n(v.otherCosts), taxPct: Math.min(100, n(v.taxPct)), notes: v.notes },
            })
          }
        >
          <Save className="h-4 w-4" /> Salvar
        </Button>
      </div>
    </div>
  );
}

function ModeSettings() {
  const { mode, demo, setDemo, resetDemo, session, signOut } = useApp();
  return (
    <Card>
      <CardHeader title="Modo de uso e conta" />
      <div className="space-y-4 p-4 sm:p-5">
        <Toggle id="demo" checked={demo} onChange={setDemo} label={<span className="flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-warn" /> Modo demonstração (dados fictícios, separados dos seus dados reais)</span>} />
        {demo && <Button size="sm" variant="ghost" onClick={resetDemo}><RotateCcw className="h-3.5 w-3.5" /> Restaurar dados da demonstração</Button>}
        {!isSupabaseConfigured ? (
          <Notice tone="blue">
            <strong>Modo local:</strong> sem <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>, não há login e os dados ficam apenas neste navegador. Configure o Supabase (veja o README) para ter conta, favoritos, alertas e simulações protegidos por usuário.
          </Notice>
        ) : (
          mode !== 'demo' && session && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-3 text-sm">
              <span>Conectado como <strong>{session.user.email}</strong></span>
              <Button size="sm" variant="ghost" onClick={signOut}>Sair</Button>
            </div>
          )
        )}
      </div>
    </Card>
  );
}
