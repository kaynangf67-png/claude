/**
 * Baixa as ruas reais do OpenStreetMap e grava um snapshot em public/osm/area.json.
 * O app passa a usar esse arquivo em vez de baixar do Overpass a cada aparelho.
 *
 *   npm run import-osm                                  # centro do .env / padrão
 *   npm run import-osm -- --lat -20.32 --lon -40.29 --radius 800
 *   npm run import-osm -- --from-file export.json       # resposta do Overpass salva manualmente
 *
 * Dados © colaboradores do OpenStreetMap (ODbL). Mantenha a atribuição no app.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildOverpassQuery, fetchOverpass } from '../src/world/osm/overpass';
import { overpassToCompact, type OverpassResponse } from '../src/world/osm/compact';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function envValue(key: string) {
  for (const file of ['.env.local', '.env']) {
    try {
      const m = readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (m && m[1].trim()) return m[1].trim();
    } catch {
      /* arquivo ausente */
    }
  }
  return process.env[key];
}

const lat = Number(arg('lat') ?? envValue('VITE_MAP_CENTER_LAT') ?? -20.329);
const lon = Number(arg('lon') ?? envValue('VITE_MAP_CENTER_LON') ?? -40.292);
const radius = Number(arg('radius') ?? envValue('VITE_OSM_RADIUS_M') ?? 650);
const out = resolve(arg('out') ?? 'public/osm/area.json');
const fromFile = arg('from-file');

async function main() {
  let raw: OverpassResponse;
  if (fromFile) {
    raw = JSON.parse(readFileSync(fromFile, 'utf8')) as OverpassResponse;
    console.log(`Lendo ${fromFile} (${raw.elements.length} elementos)`);
  } else {
    console.log(`Baixando OpenStreetMap: centro ${lat}, ${lon} · raio ${radius} m`);
    raw = await fetchOverpass([lat, lon], radius, 120_000);
  }
  const data = overpassToCompact(raw, [lat, lon], radius);
  if (!data.roads.length) throw new Error('Nenhuma via encontrada. Confira o centro/raio.');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data));
  const kb = Math.round(JSON.stringify(data).length / 1024);
  console.log(
    `OK → ${out} (${kb} kB): ${data.roads.length} vias, ${data.buildings.length} prédios, ` +
      `${data.areas.length} áreas, ${data.pois.length} pontos de interesse. Dados de ${data.fetchedAt}.`,
  );
}

if (process.argv.includes('--print-query')) {
  console.log(buildOverpassQuery([lat, lon], radius));
} else {
  main().catch((err) => {
    console.error(`Falhou: ${err instanceof Error ? err.message : err}`);
    console.error('Sem acesso ao Overpass? Rode com --print-query, execute a consulta em https://overpass-turbo.eu,');
    console.error('exporte como JSON "raw" e use: npm run import-osm -- --from-file arquivo.json');
    process.exit(1);
  });
}
