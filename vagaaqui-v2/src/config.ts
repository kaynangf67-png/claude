import type { LonLat } from './lib/geo';

/** Toda configuração externa vem de variáveis de ambiente (nenhuma chave no código). */
const env = import.meta.env;

const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  /** centro usado quando o GPS não está disponível (padrão: Vitória-ES) */
  defaultCenter: [num(env.VITE_DEFAULT_LON, -40.2976), num(env.VITE_DEFAULT_LAT, -20.3155)] as LonLat,
  /** estilos do mapa de fundo por tema (MapLibre) */
  mapStyleLight: (env.VITE_MAP_STYLE_LIGHT as string | undefined) || 'https://tiles.openfreemap.org/styles/positron',
  mapStyleDark: (env.VITE_MAP_STYLE_DARK as string | undefined) || 'https://tiles.openfreemap.org/styles/dark',
  /** servidor de rotas OSRM (navegação dentro do app). O público é só para testes — em produção, hospede o seu. */
  routerUrl: (env.VITE_ROUTER_URL as string | undefined) || 'https://router.project-osrm.org',
  overpassUrls: ((env.VITE_OVERPASS_URLS as string | undefined) || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter')
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
