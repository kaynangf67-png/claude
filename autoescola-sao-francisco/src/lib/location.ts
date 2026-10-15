import { site } from '../config/site';

const a = site.address;

export const addressLine = a.street;
export const addressRegion = [a.neighborhood, `${a.city}\u00a0—\u00a0${a.state}`].filter(Boolean).join(', ');
export const fullAddress = [a.street, a.neighborhood, `${a.city} - ${a.state}`, a.postalCode].filter(Boolean).join(', ');

const query = encodeURIComponent(`${site.name}, ${fullAddress}`);

/** Link para abrir no Google Maps (ficha oficial, se configurada; senão, busca pelo endereço). */
export const mapsUrl = a.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${query}`;

/** Mapa incorporado sem chave de API. */
export const mapsEmbedUrl = `https://maps.google.com/maps?q=${query}&z=16&output=embed`;

export const instagramUrl = site.instagram
  ? `https://www.instagram.com/${site.instagram.replace('@', '')}/`
  : '';
