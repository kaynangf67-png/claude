import type { OverpassElement, OverpassResponse } from './compact';

/**
 * Resposta sintética NO FORMATO do Overpass (out body geom), usada em testes
 * automatizados do importador. NÃO são dados reais do OpenStreetMap.
 */
export const FIXTURE_CENTER: [number, number] = [-20.329, -40.292];

const M_LAT = 110_574;
const M_LON = 111_320 * Math.cos((FIXTURE_CENTER[0] * Math.PI) / 180);
const toGeom = (x: number, z: number) => ({ lat: FIXTURE_CENTER[0] - z / M_LAT, lon: FIXTURE_CENTER[1] + x / M_LON });

export function buildOverpassFixture(): OverpassResponse {
  const elements: OverpassElement[] = [];
  const nodeIds = new Map<string, number>();
  let nextNode = 1000;
  const node = (x: number, z: number) => {
    const key = `${Math.round(x * 10)}:${Math.round(z * 10)}`;
    if (!nodeIds.has(key)) nodeIds.set(key, nextNode++);
    return nodeIds.get(key)!;
  };
  let nextWay = 1;
  const way = (pts: [number, number][], tags: Record<string, string>) => {
    elements.push({
      type: 'way',
      id: nextWay++,
      nodes: pts.map(([x, z]) => node(x, z)),
      geometry: pts.map(([x, z]) => toGeom(x, z)),
      tags,
    });
  };
  const ring = (cx: number, cz: number, w: number, d: number): [number, number][] => [
    [cx - w / 2, cz - d / 2],
    [cx + w / 2, cz - d / 2],
    [cx + w / 2, cz + d / 2],
    [cx - w / 2, cz + d / 2],
    [cx - w / 2, cz - d / 2],
  ];

  const xs = [-300, -150, 0, 150, 300];
  const zs = [-300, -150, 0, 150, 300];
  const curveZ = (x: number) => 380 + 30 * Math.sin(x / 90);

  // ruas leste-oeste (mão dupla)
  zs.forEach((z, j) => way(xs.map((x) => [x, z]), { highway: j === 2 ? 'secondary' : 'residential', name: `Rua Horizontal ${j + 1}` }));
  // ruas norte-sul: x=150 mão única para o norte; x=-150 com oneway=-1 (nós norte→sul, sentido sul→norte)
  xs.forEach((x, i) => {
    const pts: [number, number][] = [...zs.map((z) => [x, z] as [number, number]), [x, curveZ(x)]];
    if (x === 150) way(pts.slice().reverse(), { highway: 'residential', name: 'Rua Mão Única', oneway: 'yes' });
    else if (x === -150) way(pts, { highway: 'residential', name: 'Rua Contramão', oneway: '-1' });
    else way(pts, { highway: i === 2 ? 'primary' : 'residential', name: `Rua Vertical ${i + 1}`, lanes: i === 2 ? '4' : '2' });
  });
  // avenida curva na orla, passando pelos fins das ruas norte-sul
  const curve: [number, number][] = [];
  for (let x = -300; x <= 300; x += 15) curve.push([x, curveZ(x)]);
  way(curve, { highway: 'tertiary', name: 'Avenida Beira-Mar' });
  // via privada (deve ser ignorada)
  way([[0, -300], [0, -360]], { highway: 'residential', access: 'private', name: 'Condomínio' });

  // prédios: um por quarteirão (alguns com andares/altura, outros sem)
  let b = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const cx = xs[i] + 75;
      const cz = zs[j] + 75;
      if (i === 1 && j === 1) continue; // parque
      if (i === 2 && j === 2) continue; // estacionamento
      const tags: Record<string, string> = { building: b % 3 === 0 ? 'apartments' : 'yes' };
      if (b % 2 === 0) tags['building:levels'] = String(4 + (b % 9));
      if (b % 5 === 0) tags.height = '42';
      way(ring(cx, cz, 70, 50), tags);
      b++;
    }
  }
  // prédio como relação multipolígono
  const outer = ring(-225, -225, 40, 40);
  elements.push({
    type: 'relation',
    id: 900,
    tags: { type: 'multipolygon', building: 'office', 'building:levels': '12' },
    members: [{ type: 'way', ref: 9001, role: 'outer', geometry: outer.map(([x, z]) => toGeom(x, z)) }],
  });

  way(ring(-75, -75, 120, 120), { leisure: 'park', name: 'Parque Teste' });
  way(ring(225, 225, 120, 120), { amenity: 'parking', name: 'Estacionamento Teste', capacity: '90', fee: 'yes' });
  way(ring(0, 450, 700, 60), { natural: 'beach', name: 'Praia Teste' });
  way([[-400, 490], [0, 495], [400, 490]], { natural: 'coastline' });

  const poi = (x: number, z: number, tags: Record<string, string>) =>
    elements.push({ type: 'node', id: nextNode++, ...toGeom(x, z), tags });
  poi(80, 80, { amenity: 'hospital', name: 'Hospital Teste' });
  poi(-80, 200, { shop: 'mall', name: 'Shopping Teste' });
  poi(200, -80, { amenity: 'restaurant', name: 'Restaurante Teste' });
  for (let k = 0; k < 20; k++) poi(60 + (k % 5) * 8, -60 - Math.floor(k / 5) * 8, { shop: 'clothes' });

  return { elements, osm3s: { timestamp_osm_base: '2026-10-01T00:00:00Z' } };
}
