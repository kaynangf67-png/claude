import { clinic, WHATSAPP_NUMBER } from '../config/clinic';

/**
 * Gera o JSON-LD (Schema.org/Dentist) somente quando os dados
 * mínimos estão preenchidos. Sem endereço e telefone, nada é
 * publicado — melhor nenhum dado estruturado do que um incompleto.
 */
export function buildStructuredData(): Record<string, unknown> | null {
  const a = clinic.address;
  const hasAddress = a.street && a.city && a.state;
  const hasWhatsApp = /^55\d{10,11}$/.test(WHATSAPP_NUMBER);
  if (!hasAddress || !hasWhatsApp || !clinic.siteUrl) return null;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: clinic.name,
    url: clinic.siteUrl,
    image: `${clinic.siteUrl}/og-image.jpg`,
    telephone: `+${WHATSAPP_NUMBER}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: [a.street, a.complement].filter(Boolean).join(', '),
      addressLocality: a.city,
      addressRegion: a.state,
      postalCode: a.postalCode || undefined,
      addressCountry: 'BR',
    },
  };
  if (a.mapsUrl) data.hasMap = a.mapsUrl;
  if (clinic.instagram) data.sameAs = [`https://www.instagram.com/${clinic.instagram.replace('@', '')}`];
  return data;
}
