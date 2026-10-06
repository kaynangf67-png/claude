import { describe, expect, it } from 'vitest';
import { buildSegments, nearestSegment, parkingSides, type OverpassElement } from './osm';

// duas ruas em cruz + uma terceira que cruza a primeira: a rua A deve virar 2 trechos
const g = (lon: number, lat: number) => ({ lon, lat });
const elements: OverpassElement[] = [
  { type: 'way', id: 1, nodes: [10, 11, 12, 13], geometry: [g(-40.3, -20.3), g(-40.299, -20.3), g(-40.298, -20.3), g(-40.297, -20.3)], tags: { highway: 'residential', name: 'Rua A' } },
  { type: 'way', id: 2, nodes: [20, 12, 21], geometry: [g(-40.298, -20.301), g(-40.298, -20.3), g(-40.298, -20.299)], tags: { highway: 'secondary', name: 'Av. B', 'parking:both': 'no' } },
  { type: 'way', id: 3, nodes: [30, 31], geometry: [g(-40.2, -20.2), g(-40.2001, -20.2)], tags: { highway: 'residential' } },
  { type: 'way', id: 4, nodes: [40, 41], geometry: [g(-40.3, -20.31), g(-40.29, -20.31)], tags: { highway: 'footway' } },
  { type: 'way', id: 5, center: { lat: -20.3005, lon: -40.2985 }, tags: { amenity: 'parking', name: 'Estac. Centro', fee: 'yes', capacity: '80' } },
  { type: 'node', id: 6, lat: -20.3, lon: -40.3, tags: { amenity: 'parking', access: 'private' } },
];

describe('ruas do OpenStreetMap → trechos', () => {
  const { segments, lots } = buildSegments(elements);

  it('quebra a via nos cruzamentos e mantém IDs estáveis', () => {
    const a = segments.filter((s) => s.name === 'Rua A');
    expect(a.map((s) => s.id)).toEqual(['1-0', '1-1']);
    expect(a[0].lengthM).toBeGreaterThan(150);
  });

  it('respeita proibição de estacionar nos dois lados', () => {
    const b = segments.filter((s) => s.name === 'Av. B');
    expect(b.length).toBe(2);
    expect(b.every((s) => s.noParking && s.capacity === 0)).toBe(true);
    expect(b[0].profile).toBe('mixed'); // avenida sem comércio por perto
  });

  it('descarta trechos curtos demais e vias que não são de carro', () => {
    expect(segments.some((s) => s.id.startsWith('3-'))).toBe(false);
    expect(segments.some((s) => s.id.startsWith('4-'))).toBe(false);
  });

  it('estacionamentos públicos viram plano B; privados são ignorados', () => {
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ name: 'Estac. Centro', fee: 'yes', capacity: 80 });
  });

  it('acha o trecho mais próximo de um ponto', () => {
    expect(nearestSegment(segments, [-40.2995, -20.30005], 30)?.id).toBe('1-0');
    expect(nearestSegment(segments, [-40.2995, -20.31], 30)).toBeNull();
  });

  it('lados de estacionamento pelas tags', () => {
    expect(parkingSides({ highway: 'residential' })).toBe(2);
    expect(parkingSides({ highway: 'residential', 'parking:left': 'no' })).toBe(1);
    expect(parkingSides({ highway: 'residential', 'parking:lane:both': 'no_stopping' })).toBe(0);
  });
});

describe('perfil da rua', () => {
  it('rua "residential" cheia de comércio vira comercial', async () => {
    const { profileOf } = await import('./osm');
    expect(profileOf('residential', 0)).toBe('residential');
    expect(profileOf('residential', 2)).toBe('mixed');
    expect(profileOf('residential', 6)).toBe('commercial');
    expect(profileOf('secondary', 0)).toBe('mixed');
  });
  it('conta lojas perto do trecho', () => {
    const shops: OverpassElement[] = Array.from({ length: 5 }, (_, i) => ({ type: 'node' as const, id: 500 + i, lat: -20.30002, lon: -40.2995 + i * 0.0001 }));
    const { segments } = buildSegments([...elements, ...shops]);
    expect(segments.find((s) => s.id === '1-0')!.profile).toBe('commercial');
    expect(segments.find((s) => s.id === '1-1')!.profile).not.toBe('commercial');
  });
});
