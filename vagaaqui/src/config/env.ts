/** Leitura centralizada de variáveis de ambiente. Nenhuma chave secreta é necessária no MVP. */
function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : fallback;
}

// fora do Vite (scripts Node) import.meta.env não existe
const vars: Record<string, string | undefined> = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};

export const env = {
  apiUrl: (vars.VITE_API_URL as string | undefined)?.trim() || '',
  mapCenter: {
    lat: num(vars.VITE_MAP_CENTER_LAT as string | undefined, -20.329),
    lon: num(vars.VITE_MAP_CENTER_LON as string | undefined, -40.292),
  },
  /** 'osm' (padrão): ruas reais do OpenStreetMap; 'procedural': cidade fictícia de demonstração */
  mapSource: ((vars.VITE_MAP_SOURCE as string | undefined) === 'procedural' ? 'procedural' : 'osm') as 'osm' | 'procedural',
  /** raio (m) da área baixada do OpenStreetMap */
  osmRadius: num(vars.VITE_OSM_RADIUS_M as string | undefined, 650),
  useBrowserGps: vars.VITE_USE_BROWSER_GPS === 'true',
};
