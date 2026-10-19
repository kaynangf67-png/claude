import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApp } from './app';
import { evaluateAlerts } from './alertEngine';
import { useAlerts, useCatalog } from './hooks';

/** Roda a avaliação de alertas quando catálogo ou alertas mudam. */
export function useAlertRunner() {
  const { repo, mode } = useApp();
  const qc = useQueryClient();
  const catalog = useCatalog();
  const alerts = useAlerts();
  const running = useRef(false);

  useEffect(() => {
    if (!repo || !catalog.data || !alerts.data || running.current) return;
    const hits = evaluateAlerts(alerts.data, catalog.data);
    if (!hits.length) return;
    running.current = true;
    (async () => {
      const now = new Date().toISOString();
      for (const h of hits) {
        await repo.addAlertEvent({ alertId: h.alert.id, productId: h.productId, message: h.message });
        await repo.markAlertTriggered(h.alert.id, now);
      }
      toast(`${hits.length} alerta(s) disparado(s)`, { description: hits[0].message });
      await qc.invalidateQueries({ queryKey: [mode, 'alerts'] });
      await qc.invalidateQueries({ queryKey: [mode, 'alert-events'] });
    })()
      .catch(() => undefined)
      .finally(() => (running.current = false));
  }, [repo, mode, qc, catalog.data, alerts.data]);
}
