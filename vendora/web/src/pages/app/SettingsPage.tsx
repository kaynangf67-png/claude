import { ExternalLink } from 'lucide-react';
import type { MarketplaceId, ProfileOverrides } from '@vendora/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketplaceChip, Notice, PageHeader, Skeleton, Spinner } from '../../components/ui';
import { api, ApiError, type MarketplaceInfo } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';

const FIELDS: Array<{ key: keyof ProfileOverrides; label: string; unit: string; step?: number }> = [
  { key: 'titleMaxLength', label: 'Título — máximo', unit: 'caracteres' },
  { key: 'descriptionMaxLength', label: 'Descrição — máximo', unit: 'caracteres' },
  { key: 'imageMinSize', label: 'Imagem — lado mínimo', unit: 'px' },
  { key: 'imageRecommendedSize', label: 'Imagem — tamanho recomendado', unit: 'px' },
  { key: 'imageMaxFileSizeMB', label: 'Imagem — tamanho do arquivo', unit: 'MB', step: 0.5 },
];

function MarketplaceRules({ info, onSaved }: { info: MarketplaceInfo; onSaved: () => void }) {
  const toast = useToast();
  const p = info.profile;
  const defaults: Record<keyof ProfileOverrides, { value: number; verified: boolean; note?: string }> = {
    titleMaxLength: p.title.maxLength,
    descriptionMaxLength: p.description.maxLength,
    imageMinSize: p.images.minWidth,
    imageRecommendedSize: p.images.recommendedSize,
    imageMaxFileSizeMB: p.images.maxFileSizeMB,
  };
  const [values, setValues] = useState<ProfileOverrides>(info.overrides);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && !Number.isNaN(v)));
      await api.put(`/api/settings/marketplaces/${p.id}`, clean);
      toast('success', `Limites do ${p.name} salvos.`);
      onSaved();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <MarketplaceChip id={p.id as MarketplaceId} />
        <span className="text-xs text-ink-500">Revisado em {new Date(p.lastReviewed).toLocaleDateString('pt-BR')}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const d = defaults[f.key];
          return (
            <div key={f.key}>
              <label className="label" htmlFor={`${p.id}-${f.key}`}>
                {f.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${p.id}-${f.key}`}
                  type="number"
                  step={f.step ?? 1}
                  className="input"
                  placeholder={String(d.value)}
                  value={values[f.key] ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))
                  }
                />
                <span className="shrink-0 text-xs text-ink-500">{f.unit}</span>
              </div>
              <p className="mt-1 text-[11px] text-ink-500">
                Padrão: {d.value} · {d.verified ? 'documentação oficial' : 'não verificado oficialmente'}
                {d.note ? ` — ${d.note}` : ''}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ul className="space-y-1 text-xs">
          {p.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-ink-500 hover:text-violet-brand">
                <ExternalLink className="size-3" /> {s.label} {s.official ? '(oficial)' : ''}
              </a>
            </li>
          ))}
        </ul>
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy && <Spinner />} Salvar limites
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<MarketplaceInfo[] | null>(null);
  const load = () => api.get<{ marketplaces: MarketplaceInfo[] }>('/api/marketplaces').then((r) => setItems(r.marketplaces));
  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  async function deleteAccount() {
    if (!confirm('Excluir sua conta apaga todos os anúncios, versões, imagens e conexões. Esta ação não pode ser desfeita. Continuar?')) return;
    try {
      await api.del('/api/account');
      await logout().catch(() => {});
      navigate('/');
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Falha ao excluir a conta.');
    }
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle="Ajuste os limites de cada canal conforme as regras vigentes da sua categoria." />
      <div className="mb-6">
        <Notice tone="warning">
          As regras dos marketplaces mudam e variam por categoria e país. Valores marcados como “não verificado oficialmente” vieram de fontes
          de terceiros que divergem entre si — confira no painel do vendedor e ajuste aqui.
        </Notice>
      </div>
      <div className="space-y-4">
        {items === null
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)
          : items.map((info) => <MarketplaceRules key={info.profile.id} info={info} onSaved={load} />)}
      </div>
      <section className="card mt-10 p-6">
        <h2 className="text-base font-semibold">Dados e conta</h2>
        <p className="mt-1 text-sm text-ink-500">
          Imagens de análises que não viraram anúncio são apagadas automaticamente após o período de retenção configurado no servidor.
        </p>
        <button className="btn-danger mt-4" onClick={deleteAccount}>
          Excluir minha conta e dados
        </button>
      </section>
    </>
  );
}
