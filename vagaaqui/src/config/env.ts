/** Leitura centralizada de variáveis de ambiente. Nenhuma chave secreta é necessária no MVP. */
function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : fallback;
}

export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '',
  mapCenter: {
    lat: num(import.meta.env.VITE_MAP_CENTER_LAT as string | undefined, -20.329),
    lon: num(import.meta.env.VITE_MAP_CENTER_LON as string | undefined, -40.292),
  },
  useBrowserGps: import.meta.env.VITE_USE_BROWSER_GPS === 'true',
};
