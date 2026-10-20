import { useCallback, useEffect, useState } from 'react';

/** Carrega dados assíncronos com estados de carregamento e erro. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  // Ao trocar as dependências, o dado anterior não vale mais: evita um render com dado velho.
  const [prevRun, setPrevRun] = useState(() => run);
  if (prevRun !== run) {
    setPrevRun(() => run);
    setLoading(true);
  }

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await run());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}
