import { professional, WHATSAPP_NUMBER } from '../config/site';

/**
 * JSON-LD (Schema.org/Dentist) apenas com dados verificados:
 * nome, registro, endereço, telefone, e-mail, Instagram e mapa.
 * Sem nota, sem especialidade, sem horários não confirmados.
 */
export function buildStructuredData(): Record<string, unknown> {
  const p = professional;
  const a = p.address;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: p.brandName,
    alternateName: p.fullName,
    description: `${p.profession} · ${p.cro}`,
    telephone: `+${WHATSAPP_NUMBER}`,
    email: p.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: a.street,
      addressLocality: `${a.neighborhood}, ${a.city}`,
      addressRegion: a.state,
      addressCountry: 'BR',
      ...(a.postalCode ? { postalCode: a.postalCode } : {}),
    },
    hasMap: a.mapsUrl,
    sameAs: [p.instagramUrl],
    founder: {
      '@type': 'Person',
      name: p.fullName,
      jobTitle: p.profession,
      identifier: p.cro,
    },
  };
  if (p.siteUrl) {
    data.url = `${p.siteUrl}/`;
    data.image = `${p.siteUrl}/og-image.jpg`;
  }
  return data;
}
