import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useServices } from '@/contexts/services';
import type { DateRange } from '@/services/analytics';
import type { Bucket } from '@/services/data/types';
import { PlanLimitError } from '@/services/plans';

export const qk = {
  profile: ['profile'] as const,
  products: ['products'] as const,
  videos: ['videos'] as const,
  lives: ['lives'] as const,
  posts: ['posts'] as const,
  schedules: ['schedules'] as const,
  automations: ['automations'] as const,
  analytics: (r: DateRange) => ['analytics', r.from, r.to] as const,
  notifications: ['notifications'] as const,
  integration: ['integration'] as const,
  aiHistory: ['ai-history'] as const,
  file: (bucket: Bucket, path: string | null) => ['file', bucket, path] as const,
};

export function useProfile() {
  const s = useServices();
  return useQuery({ queryKey: qk.profile, queryFn: () => s.account.getProfile() });
}

/** Plano atual (default "free" enquanto carrega). */
export function usePlan() {
  return useProfile().data?.plan ?? 'free';
}

export function useProducts() {
  const s = useServices();
  return useQuery({ queryKey: qk.products, queryFn: () => s.products.list() });
}

export function useVideos() {
  const s = useServices();
  return useQuery({ queryKey: qk.videos, queryFn: () => s.videos.list() });
}

export function useLives() {
  const s = useServices();
  return useQuery({ queryKey: qk.lives, queryFn: () => s.lives.list() });
}

export function usePosts() {
  const s = useServices();
  return useQuery({ queryKey: qk.posts, queryFn: () => s.posts.list() });
}

export function useSchedules() {
  const s = useServices();
  return useQuery({ queryKey: qk.schedules, queryFn: () => s.lives.listSchedules() });
}

export function useAutomations() {
  const s = useServices();
  return useQuery({ queryKey: qk.automations, queryFn: () => s.lives.listAutomations() });
}

export function useAnalytics(range: DateRange) {
  const s = useServices();
  return useQuery({ queryKey: qk.analytics(range), queryFn: () => s.analytics.list(range), placeholderData: (prev) => prev });
}

export function useNotifications() {
  const s = useServices();
  return useQuery({ queryKey: qk.notifications, queryFn: () => s.account.listNotifications(20) });
}

export function useIntegration() {
  const s = useServices();
  return useQuery({ queryKey: qk.integration, queryFn: () => s.account.getIntegration() });
}

export function useFileUrl(bucket: Bucket, path: string | null | undefined) {
  const s = useServices();
  return useQuery({
    queryKey: qk.file(bucket, path ?? null),
    queryFn: () => (path ? s.ctx.storage.resolveUrl(bucket, path) : Promise.resolve(null)),
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000, // URLs assinadas valem 1h
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof PlanLimitError) return err.message;
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return err instanceof Error ? err.message : 'Algo deu errado.';
}

/**
 * Mutation padrão: mostra toast de erro/sucesso e invalida as chaves afetadas.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { invalidate?: readonly (readonly unknown[])[]; success?: string | ((r: TResult) => string); onSuccess?: (r: TResult) => void } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await Promise.all(
        [...(opts.invalidate ?? []), qk.notifications].map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(result) : opts.success);
      opts.onSuccess?.(result);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export const ALL_DATA_KEYS = [qk.products, qk.videos, qk.lives, qk.posts, qk.schedules, qk.automations, ['analytics'], qk.notifications, qk.integration, qk.profile] as const;
