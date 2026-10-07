import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useServices } from '@/contexts/services';
import { seedDemoData } from '@/services/demo/seed';
import { ALL_DATA_KEYS, errorMessage } from './queries';

export function useDemoSeed() {
  const services = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await seedDemoData(services.ctx.repo);
      await services.lives.sync();
      return result;
    },
    onSuccess: async (r) => {
      await Promise.all(ALL_DATA_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: key })));
      toast.success(`Dados de demonstração carregados: ${r.products} produtos, ${r.videos} vídeos e ${r.lives} lives.`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
