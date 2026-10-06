import { academia, activities, amenities, openingHours, WHATSAPP_NUMBER } from '../config/academia';

const isPending = (s: string) => /\[.*\]/.test(s);

/** Converte '06:00–11:00 / 16:00–21:00' em OpeningHoursSpecification. */
function hoursSpec() {
  if (openingHours.some((d) => isPending(d.hours))) return undefined;
  const specs: Record<string, unknown>[] = [];
  for (const d of openingHours) {
    for (const range of d.hours.split('/')) {
      const m = range.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
      if (m) specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: d.schemaDay, opens: m[1], closes: m[2] });
    }
  }
  return specs.length ? specs : undefined;
}

/**
 * JSON-LD Schema.org. HealthClub é subtipo de SportsActivityLocation e de LocalBusiness.
 * A nota do Google NÃO entra aqui de propósito: o Google não aceita aggregateRating
 * "autodeclarado" de empresas locais no próprio site e pode aplicar ação manual.
 */
export function buildStructuredData(siteUrl: string): Record<string, unknown> {
  const a = academia.address;
  const sameAs = [
    academia.instagram && `https://www.instagram.com/${academia.instagram}/`,
    academia.facebookUrl,
  ].filter(Boolean);

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HealthClub',
    '@id': siteUrl ? `${siteUrl}/#academia` : undefined,
    name: academia.name,
    alternateName: academia.alternateName,
    description:
      `Academia em Jacaraípe, Serra/ES, com ${activities.map((x) => x.name).join(', ')}.`,
    url: siteUrl ? `${siteUrl}/` : undefined,
    image: siteUrl ? `${siteUrl}/og-image.jpg` : undefined,
    telephone: academia.phone.e164,
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${a.street} - ${a.neighborhood}`,
      addressLocality: a.city,
      addressRegion: a.state,
      postalCode: a.postalCode,
      addressCountry: 'BR',
    },
    hasMap: academia.mapsUrl,
    areaServed: [a.district, a.city],
    sport: activities.map((x) => x.name),
    amenityFeature: amenities.map((x) => ({
      '@type': 'LocationFeatureSpecification',
      name: x.name,
      value: true,
    })),
    openingHoursSpecification: hoursSpec(),
    sameAs: sameAs.length ? sameAs : undefined,
  };
  if (academia.geo) {
    data.geo = { '@type': 'GeoCoordinates', latitude: academia.geo.lat, longitude: academia.geo.lng };
  }
  if (/^55\d{10,11}$/.test(WHATSAPP_NUMBER)) {
    data.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: `+${WHATSAPP_NUMBER}`,
      availableLanguage: 'Portuguese',
    };
  }
  return JSON.parse(JSON.stringify(data));
}

export { isPending };
