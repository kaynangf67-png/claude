import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { isHttpUrl } from '@shared/analysis';
import { MARKETPLACE_LABEL, METRIC_LABEL, type CompetitionLevel, type Marketplace, type Metric, type MetricKind } from '@shared/types';
import { useApp, useRepo } from '@/state/app';
import { Button, Input, Label, Modal, Notice, Select } from './ui';

const KINDS: MetricKind[] = ['visualizacoes', 'curtidas', 'vendas_informadas', 'ranking_mais_vendidos', 'buscas', 'avaliacao', 'estimativa'];

/** Cadastro manual com fonte obrigatória — usado principalmente para TikTok Shop. */
export function ManualProductModal({ open, onClose, defaultMarketplace = 'tiktok' }: { open: boolean; onClose: () => void; defaultMarketplace?: Marketplace }) {
  const repo = useRepo();
  const { mode } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: '',
    marketplace: defaultMarketplace,
    category: '',
    price: '',
    sourceName: defaultMarketplace === 'tiktok' ? 'TikTok Creative Center (observação manual)' : '',
    sourceUrl: '',
    imageUrl: '',
    trendTerm: '',
    competition: '' as CompetitionLevel | '',
  });
  const [metrics, setMetrics] = useState<{ kind: MetricKind; value: string; period: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const up = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const errors: string[] = [];
  if (!f.name.trim()) errors.push('Informe o nome do produto.');
  if (!f.sourceName.trim()) errors.push('Informe a fonte do dado.');
  if (f.sourceUrl && !isHttpUrl(f.sourceUrl)) errors.push('Link da fonte inválido.');
  if (f.imageUrl && !isHttpUrl(f.imageUrl)) errors.push('Link da imagem inválido.');
  const price = f.price.trim() ? Number(f.price.replace(',', '.')) : null;
  if (price != null && (!Number.isFinite(price) || price < 0)) errors.push('Preço inválido.');

  async function save() {
    if (errors.length) return toast.error(errors[0]);
    setSaving(true);
    try {
      const ms: Metric[] = metrics
        .filter((m) => m.value.trim())
        .map((m) => ({ kind: m.kind, value: Number(m.value.replace(',', '.')), period: m.period || undefined, detail: `informado manualmente — fonte: ${f.sourceName}`, official: false }));
      const p = await repo.createManualProduct({
        name: f.name.trim(),
        marketplace: f.marketplace,
        category: f.category.trim() || null,
        price,
        sourceName: f.sourceName.trim(),
        sourceUrl: f.sourceUrl.trim() || null,
        imageUrl: f.imageUrl.trim() || null,
        externalId: null,
        metrics: ms,
        trendTerm: f.trendTerm.trim() || null,
        trend: [],
        growthPct: null,
        competition: f.competition ? { level: f.competition, method: 'Estimativa manual do usuário.' } : null,
        similarPrices: [],
        quality: 'manual',
      });
      await qc.invalidateQueries({ queryKey: [mode, 'products'] });
      toast.success('Produto cadastrado.');
      onClose();
      navigate(`/produto/${p.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Cadastrar produto manualmente"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>Salvar produto</Button>
        </>
      }
    >
      <Notice tone="amber" className="mb-4">
        Registre apenas o que você observou numa fonte identificável. Visualizações e curtidas são popularidade — não vendas.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="m-name">Nome do produto *</Label>
          <Input id="m-name" value={f.name} onChange={(e) => up('name', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="m-mp">Marketplace</Label>
          <Select id="m-mp" value={f.marketplace} onChange={(e) => up('marketplace', e.target.value)}>
            {(['tiktok', 'mercadolivre', 'shopee', 'manual'] as Marketplace[]).map((m) => <option key={m} value={m}>{MARKETPLACE_LABEL[m]}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="m-cat">Categoria</Label>
          <Input id="m-cat" value={f.category} onChange={(e) => up('category', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="m-price">Preço observado</Label>
          <Input id="m-price" inputMode="decimal" prefix="R$" value={f.price} onChange={(e) => up('price', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="m-comp">Concorrência (sua estimativa)</Label>
          <Select id="m-comp" value={f.competition} onChange={(e) => up('competition', e.target.value)}>
            <option value="">Não estimada</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="m-src">Fonte do dado *</Label>
          <Input id="m-src" value={f.sourceName} onChange={(e) => up('sourceName', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="m-srcurl">Link da fonte</Label>
          <Input id="m-srcurl" type="url" placeholder="https://…" value={f.sourceUrl} onChange={(e) => up('sourceUrl', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="m-img">Link da imagem</Label>
          <Input id="m-img" type="url" placeholder="https://…" value={f.imageUrl} onChange={(e) => up('imageUrl', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="m-term" hint="(para o Google Trends)">Termo de pesquisa</Label>
          <Input id="m-term" placeholder="ex.: escova removedora de pelos" value={f.trendTerm} onChange={(e) => up('trendTerm', e.target.value)} />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-2">Indicadores observados</span>
          <Button size="sm" variant="ghost" onClick={() => setMetrics((m) => [...m, { kind: 'visualizacoes', value: '', period: '' }])} disabled={metrics.length >= 5}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
        {metrics.length === 0 && <p className="text-xs text-ink-3">Nenhum indicador. Adicione apenas números que você viu na fonte.</p>}
        <div className="space-y-2">
          {metrics.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2 sm:grid-cols-[1fr_7rem_8rem_auto]">
              <Select aria-label="Tipo" value={m.kind} onChange={(e) => setMetrics((ms) => ms.map((x, j) => (j === i ? { ...x, kind: e.target.value as MetricKind } : x)))}>
                {KINDS.map((k) => <option key={k} value={k}>{METRIC_LABEL[k]}</option>)}
              </Select>
              <Input aria-label="Valor" inputMode="decimal" placeholder="valor" value={m.value} onChange={(e) => setMetrics((ms) => ms.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <Input aria-label="Período" className="hidden sm:block" placeholder="período" value={m.period} onChange={(e) => setMetrics((ms) => ms.map((x, j) => (j === i ? { ...x, period: e.target.value } : x)))} />
              <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setMetrics((ms) => ms.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
