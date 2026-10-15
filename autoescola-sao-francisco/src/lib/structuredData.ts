import { site, WHATSAPP_NUMBER } from '../config/site';
import { instagramUrl } from './location';

/**
 * JSON-LD (Schema.org/DrivingSchool) publicado só quando os dados
 * mínimos estão confirmados. Melhor nenhum dado estruturado do que um incompleto.
 */
export function buildStructuredData(): Record<string, unknown> | null {
  const a = site.address;
  const telephone = /^55\d{10,11}$/.test(WHATSAPP_NUMBER)
    ? `+${WHATSAPP_NUMBER}`
    : site.phoneDisplay
      ? `+55 ${site.phoneDisplay}`
      : '';
  if (!a.street || !a.city || !telephone || !site.siteUrl) return null;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'DrivingSchool',
    name: site.name,
    url: site.siteUrl,
    image: `${site.siteUrl}/og-image.jpg`,
    telephone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: a.street,
      addressLocality: a.city,
      addressRegion: a.state,
      postalCode: a.postalCode || undefined,
      addressCountry: 'BR',
    },
  };
  if (a.mapsUrl) data.hasMap = a.mapsUrl;
  if (instagramUrl) data.sameAs = [instagramUrl];
  return data;
}
