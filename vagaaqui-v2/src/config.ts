import type { LonLat } from './lib/geo';

/** Toda configuração externa vem de variáveis de ambiente (nenhuma chave no código). */
const env = import.meta.env;

const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  /** centro usado quando o GPS não está disponível (padrão: Vitória-ES) */
  defaultCenter: [num(env.VITE_DEFAULT_LON, -40.2976), num(env.VITE_DEFAULT_LAT, -20.3155)] as LonLat,
  mapStyleUrl: (env.VITE_MAP_STYLE_URL as string | undefined) || 'https://tiles.openfreemap.org/styles/dark',
  overpassUrls: ((env.VITE_OVERPASS_URLS as string | undefined) || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  geocoderUrl: (env.VITE_GEOCODER_URL as string | undefined) || 'https://photon.komoot.io/api/',
  /** chave da OpenRouteService (opcional) — sem ela o tempo de viagem é estimado */
  orsKey: (env.VITE_ORS_KEY as string | undefined) || '',
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined) || '',
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) || '',
  /** link de checkout da assinatura (Asaas / Mercado Pago / Stripe). Vazio = lista de espera */
  checkoutUrl: (env.VITE_CHECKOUT_URL as string | undefined) || '',
  proPriceLabel: (env.VITE_PRO_PRICE as string | undefined) || 'R$ 9,90/mês',
};

export const hasBackend = () => Boolean(config.supabaseUrl && config.supabaseAnonKey);
