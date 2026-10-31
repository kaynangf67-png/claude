import { brand } from '../config/site';

/**
 * JSON-LD BeautySalon só com dados confirmados.
 * Sem aggregateRating: o Google não exibe notas autodeclaradas de
 * empresas locais e a nota vem de terceiros (Casamentos.com.br).
 * Sem openingHours: horários não informados.
 */
export function buildStructuredData(siteUrl = brand.siteUrl) {
  const url = siteUrl ? `${siteUrl}/` : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    name: brand.name,
    ...(url ? { url, '@id': `${url}#salao`, image: `${siteUrl}/og-image.jpg` } : {}),
    telephone: '+55 27 99814-7768',
    address: {
      '@type': 'PostalAddress',
      streetAddress: brand.address.street,
      addressLocality: brand.address.city,
      addressRegion: brand.address.state,
      postalCode: brand.address.postalCode,
      addressCountry: 'BR',
    },
    areaServed: `${brand.address.city} — ${brand.address.state}`,
    sameAs: [brand.instagramUrl, brand.casamentos.url],
  };
}
