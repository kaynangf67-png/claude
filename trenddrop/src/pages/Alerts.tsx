import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, Plus, Trash2 } from 'lucide-react';
import { ALERT_LABEL, type Alert, type AlertType } from '@/data/types';
import { dateTime, relative } from '@/lib/format';
import { useAlertEvents, useAlerts, useCatalog, useDeleteAlert, useMarkEventsRead, useSaveAlert } from '@/state/hooks';
import { useCategories } from '@/components/filters';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, Modal, Notice, PageHeader, Select, Skeleton, Toggle } from '@/components/ui';

const UNIT: Record<AlertType, string> = { interest_increase: '% de crescimento', margin_reached: '% de margem', price_change: '% de variação', new_opportunity: 'pontos (0–100)' };

export default function Alerts() {
  const alerts = useAlerts();
  const events = useAlertEvents();
  const catalog = useCatalog();
  const save = useSaveAlert();
  const del = useDeleteAlert();
  const markRead = useMarkEventsRead();
  const [open, setOpen] = useState(false);
  const unread = events.data?.filter((e) => !e.read).length ?? 0;
  const name = (id: string | null) => (id ? (catalog.data?.find((p) => p.id === id)?.name ?? 'Produto removido') : null);

  return (
    <div>
      <PageHeader
        eyebrow="Monitoramento"
        title="Alertas"
        description="Regras avaliadas dentro do painel sempre que os dados são carregados. Cada alerta dispara no máximo uma vez a cada 24 horas."
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo alerta</Button>}
      />
      <Notice tone="blue" className="mb-4">Não há envio por e-mail, push ou WhatsApp configurado: as notificações aparecem aqui e no sino do topo.</Notice>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Regras" subtitle={`${alerts.data?.length ?? 0} alerta(s)`} icon={<Bell className="h-4 w-4 text-brand-2" />} />
          {alerts.isLoading ? (
            <div className="p-4"><Skeleton className="h-24" /></div>
          ) : !alerts.data?.length ? (
            <EmptyState title="Nenhum alerta criado" description="Crie alertas de aumento de interesse, margem atingida, mudança de preço ou nova oportunidade em uma categoria." />
          ) : (
            <ul className="divide-y divide-line">
              {alerts.data.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={a.active ? 'green' : 'neutral'}>{ALERT_LABEL[a.type]}</Badge>
                      <span className="text-xs text-ink-3">≥ {a.threshold} {UNIT[a.type]}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-ink">
                      {a.productId ? <Link to={`/produto/${a.productId}`} className="hover:text-brand-2">{name(a.productId)}</Link> : a.category ? `Categoria: ${a.category}` : 'Todas as categorias'}
                    </p>
                    <p className="text-[11px] text-ink-3">{a.lastTriggeredAt ? `Último disparo ${relative(a.lastTriggeredAt)}` : 'Ainda não disparou'}</p>
                  </div>
                  <Toggle checked={a.active} onChange={(v) => save.mutate({ ...a, active: v })} label={<span className="sr-only">Ativo</span>} />
                  <Button size="icon" variant="ghost" aria-label="Excluir alerta" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Notificações"
            subtitle={unread ? `${unread} não lida(s)` : 'Tudo lido'}
            action={unread > 0 && <Button size="sm" variant="ghost" onClick={() => markRead.mutate()}><CheckCheck className="h-3.5 w-3.5" /> Marcar como lidas</Button>}
          />
          {events.isLoading ? (
            <div className="p-4"><Skeleton className="h-24" /></div>
          ) : !events.data?.length ? (
            <EmptyState icon={<BellOff className="h-5 w-5" />} title="Nenhuma notificação" description="Quando uma regra for atendida, ela aparece aqui." />
          ) : (
            <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
              {events.data.map((e) => (
                <li key={e.id} className="flex gap-3 px-4 py-3 sm:px-5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.read ? 'bg-line-strong' : 'bg-brand shadow-[0_0_6px_rgba(34,197,94,.8)]'}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{e.productId ? <Link to={`/produto/${e.productId}`} className="hover:text-brand-2">{e.message}</Link> : e.message}</p>
                    <p className="text-[11px] text-ink-3">{dateTime(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {open && <AlertForm onClose={() => setOpen(false)} />}
    </div>
  );
}

function AlertForm({ onClose }: { onClose: () => void }) {
  const catalog = useCatalog();
  const save = useSaveAlert();
  const categories = useCategories(catalog.data);
  const [type, setType] = useState<AlertType>('interest_increase');
  const [productId, setProductId] = useState('');
  const [category, setCategory] = useState('');
  const [threshold, setThreshold] = useState('20');
  const needsProduct = type !== 'new_opportunity';
  const th = Number(threshold.replace(',', '.'));
  const valid = Number.isFinite(th) && th >= 0 && (!needsProduct || productId);

  async function submit() {
    const a: Omit<Alert, 'id' | 'createdAt' | 'lastTriggeredAt'> = { type, productId: needsProduct ? productId : null, category: needsProduct ? null : category || null, threshold: th, active: true };
    await save.mutateAsync(a);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Novo alerta" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={submit} disabled={!valid} loading={save.isPending}>Criar alerta</Button></>}>
      <div className="space-y-3">
        <div>
          <Label htmlFor="a-type">Tipo</Label>
          <Select id="a-type" value={type} onChange={(e) => { const t = e.target.value as AlertType; setType(t); setThreshold(t === 'new_opportunity' ? '60' : t === 'margin_reached' ? '25' : t === 'price_change' ? '10' : '20'); }}>
            {(Object.keys(ALERT_LABEL) as AlertType[]).map((t) => <option key={t} value={t}>{ALERT_LABEL[t]}</option>)}
          </Select>
        </div>
        {needsProduct ? (
          <div>
            <Label htmlFor="a-prod">Produto</Label>
            <Select id="a-prod" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Escolha um produto monitorado</option>
              {catalog.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        ) : (
          <div>
            <Label htmlFor="a-cat">Categoria</Label>
            <Select id="a-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Qualquer categoria</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="a-th">Limite ({UNIT[type]})</Label>
          <Input id="a-th" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          <p className="mt-1 text-[11px] text-ink-3">
            {type === 'interest_increase' && 'Dispara quando o crescimento do interesse (Google Trends) atingir o limite.'}
            {type === 'margin_reached' && 'Dispara quando a margem estimada atingir o limite (precisa de custo e tarifas).'}
            {type === 'price_change' && 'Dispara quando o preço variar (para mais ou menos) pelo menos este percentual entre as duas últimas leituras.'}
            {type === 'new_opportunity' && 'Dispara quando um produto da categoria, atualizado após a criação do alerta, atingir este indicador de oportunidade.'}
          </p>
        </div>
      </div>
    </Modal>
  );
}
