import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { growthFromSeries, productInsight, type FeeProfile, type ProductInsight } from '@shared/analysis';
import type { Marketplace, Product } from '@shared/types';
import { api } from '@/lib/api';
import type { Alert, Repository, Simulation, SupplierInfo, UserSettings } from '@/data/types';
import { useApp, useRepo } from './app';
import { transientProduct } from './transient';

export interface EnrichedProduct extends Product {
  insight: ProductInsight;
  favorite: boolean;
}

const keys = {
  products: ['products'] as const,
  favorites: ['favorites'] as const,
  fees: ['fees'] as const,
  settings: ['settings'] as const,
  alerts: ['alerts'] as const,
  events: ['alert-events'] as const,
  sims: ['simulations'] as const,
};

function useRepoQuery<T>(key: readonly unknown[], fn: (r: Repository) => Promise<T>) {
  const { repo, mode } = useApp();
  return useQuery({ queryKey: [mode, ...key], queryFn: () => fn(repo!), enabled: Boolean(repo) });
}

export const useProducts = () => useRepoQuery(keys.products, (r) => r.listProducts());
export const useFavorites = () => useRepoQuery(keys.favorites, (r) => r.listFavorites());
export const useFees = () => useRepoQuery(keys.fees, (r) => r.getFees());
export const useSettings = () => useRepoQuery(keys.settings, (r) => r.getSettings());
export const useAlerts = () => useRepoQuery(keys.alerts, (r) => r.listAlerts());
export const useAlertEvents = () => useRepoQuery(keys.events, (r) => r.listAlertEvents());
export const useSimulations = () => useRepoQuery(keys.sims, (r) => r.listSimulations());

export function feeFor(fees: Partial<Record<Marketplace, FeeProfile>> | undefined, m: Marketplace): FeeProfile | null {
  return fees?.[m] ?? null;
}

export function enrich(p: Product, fees: Partial<Record<Marketplace, FeeProfile>> | undefined, targetMargin: number, favorites: string[] = []): EnrichedProduct {
  return { ...p, insight: productInsight(p, feeFor(fees, p.marketplace), targetMargin), favorite: favorites.includes(p.id) };
}

/** Catálogo com indicadores calculados (margem, oportunidade, favorito). */
export function useCatalog() {
  const products = useProducts();
  const fees = useFees();
  const settings = useSettings();
  const favs = useFavorites();
  const target = settings.data?.targetMarginPct ?? 25;
  const data = products.data?.map((p) => enrich(p, fees.data, target, favs.data ?? []));
  return {
    data,
    isLoading: products.isLoading || fees.isLoading || settings.isLoading,
    error: products.error ?? fees.error ?? settings.error,
    refetch: products.refetch,
    fees: fees.data,
    settings: settings.data,
    favorites: favs.data ?? [],
  };
}

export function useProduct(id: string | undefined) {
  const { repo, mode } = useApp();
  return useQuery({
    queryKey: [mode, 'product', id],
    enabled: Boolean(repo && id),
    queryFn: async () => (await repo!.getProduct(id!)) ?? transientProduct(id!),
  });
}

/** Série de tendência recortada para a janela (dias) e crescimento recalculado. */
export function windowed(p: Product, days: number | null) {
  if (days === 1) {
    // "Hoje": último ponto contra a média dos 7 anteriores.
    const last = p.trend.at(-1);
    const prev = p.trend.slice(-8, -1);
    const base = prev.length ? prev.reduce((s, x) => s + x.value, 0) / prev.length : 0;
    const growth = last && base > 0 ? Math.round(((last.value - base) / base) * 1000) / 10 : null;
    return { trend: p.trend.slice(-8), growth };
  }
  const trend = days ? p.trend.slice(-days) : p.trend;
  const growth = trend.length >= 3 ? growthFromSeries(trend) : (p.growthPct ?? null);
  return { trend, growth };
}

function useInvalidate() {
  const qc = useQueryClient();
  const { mode } = useApp();
  return (...ks: (readonly string[])[]) => Promise.all(ks.map((k) => qc.invalidateQueries({ queryKey: [mode, ...k] })));
}

function onError(e: unknown) {
  toast.error((e as Error).message || 'Não foi possível concluir a operação.');
}

export function useSaveProduct() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (p: Product) => repo.saveProduct(p),
    onSuccess: () => inv(keys.products, ['product']),
    onError,
  });
}

/** Garante que o produto está salvo (resultados ao vivo precisam ser salvos antes de favoritar/vincular). */
export function useEnsureSaved() {
  const save = useSaveProduct();
  return async (p: Product) => (p.transient ? save.mutateAsync(p) : p);
}

export function useDeleteProduct() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => repo.deleteProduct(id), onSuccess: () => inv(keys.products, keys.favorites), onError });
}

export function useSetSupplier() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ productId, info }: { productId: string; info: SupplierInfo }) => repo.setSupplier(productId, info),
    onSuccess: () => {
      toast.success('Dados do fornecedor salvos.');
      return inv(keys.products, ['product']);
    },
    onError,
  });
}

export function useToggleFavorite() {
  const repo = useRepo();
  const inv = useInvalidate();
  const ensure = useEnsureSaved();
  return useMutation({
    mutationFn: async ({ product, on }: { product: Product; on: boolean }) => {
      const saved = await ensure(product);
      await repo.setFavorite(saved.id, on);
      return { saved, on };
    },
    onSuccess: ({ on }) => {
      toast.success(on ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
      return inv(keys.favorites, keys.products);
    },
    onError,
  });
}

export function useSaveAlert() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (a: Omit<Alert, 'id' | 'createdAt' | 'lastTriggeredAt'> & { id?: string }) => repo.saveAlert(a),
    onSuccess: () => {
      toast.success('Alerta salvo.');
      return inv(keys.alerts);
    },
    onError,
  });
}

export function useDeleteAlert() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => repo.deleteAlert(id), onSuccess: () => inv(keys.alerts, keys.events), onError });
}

export function useMarkEventsRead() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({ mutationFn: () => repo.markEventsRead(), onSuccess: () => inv(keys.events), onError });
}

export function useSaveSimulation() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (s: Omit<Simulation, 'id' | 'createdAt'>) => repo.saveSimulation(s),
    onSuccess: () => {
      toast.success('Simulação salva.');
      return inv(keys.sims);
    },
    onError,
  });
}

export function useDeleteSimulation() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => repo.deleteSimulation(id), onSuccess: () => inv(keys.sims), onError });
}

export function useSaveFees() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ m, fee }: { m: Marketplace; fee: FeeProfile & { notes?: string } }) => repo.saveFees(m, fee),
    onSuccess: () => {
      toast.success('Tarifas salvas.');
      return inv(keys.fees, keys.products);
    },
    onError,
  });
}

export function useSaveSettings() {
  const repo = useRepo();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (s: UserSettings) => repo.saveSettings(s),
    onSuccess: () => {
      toast.success('Configurações salvas.');
      return inv(keys.settings);
    },
    onError,
  });
}

export function useIntegrationStatus() {
  return useQuery({ queryKey: ['integration-status'], queryFn: api.status, staleTime: 5 * 60_000, retry: 0 });
}
