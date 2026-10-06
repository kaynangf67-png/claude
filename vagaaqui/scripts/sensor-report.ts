/**
 * Resume um log exportado pelo sensor de câmera e gera um CSV para conferência manual.
 *
 *   npm run sensor-report -- vagaaqui-sensor-....json
 *
 * Para medir a precisão: abra o CSV, e para cada observação anote se a vaga
 * (lat/lon da posição do carro + horário) estava mesmo livre/ocupada — pelo
 * vídeo gravado em paralelo ou de memória do trajeto. Precisão = acertos / total.
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface Frame {
  t: number;
  pose: { lat: number; lon: number; source: string; accuracy: number | null };
  detections: { c: string; s: number; forward: number | null; lateral: number | null; curbside: boolean }[];
  observations: { spotId: string; kind: string; trust: number; frames: number; ratio: number; at: number }[];
}

const file = process.argv[2];
if (!file) {
  console.error('Uso: npm run sensor-report -- arquivo-do-sensor.json');
  process.exit(1);
}
const log = JSON.parse(readFileSync(file, 'utf8')) as { camera: Record<string, number>; frames: Frame[] };
const frames = log.frames;
if (!frames.length) {
  console.log('Log vazio.');
  process.exit(0);
}
const haversine = (a: Frame['pose'], b: Frame['pose']) => {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
let distance = 0;
for (let i = 1; i < frames.length; i++) distance += haversine(frames[i - 1].pose, frames[i].pose);
const seconds = (frames[frames.length - 1].t - frames[0].t) / 1000;
const dets = frames.flatMap((f) => f.detections);
const obs = frames.flatMap((f) => f.observations.map((o) => ({ ...o, pose: f.pose })));
const gpsFrames = frames.filter((f) => f.pose.source === 'gps').length;

console.log(`Duração: ${seconds.toFixed(0)} s · ${frames.length} quadros (${(frames.length / Math.max(1, seconds)).toFixed(1)} por s)`);
console.log(`Percurso: ${distance.toFixed(0)} m · quadros com GPS real: ${gpsFrames}/${frames.length}`);
console.log(`Calibração: ${JSON.stringify(log.camera)}`);
console.log(`Detecções: ${dets.length} (${(dets.length / frames.length).toFixed(2)} por quadro) · junto ao meio-fio: ${dets.filter((d) => d.curbside).length}`);
console.log(`Observações: ${obs.length} · ocupadas: ${obs.filter((o) => o.kind === 'occupied').length} · livres: ${obs.filter((o) => o.kind === 'available').length}`);

const csv = [
  'horario,vaga,observado,peso,quadros,fracao_ocupado,lat_carro,lon_carro,fonte_posicao,real_livre_ou_ocupada',
  ...obs.map((o) =>
    [new Date(o.at).toISOString(), o.spotId, o.kind === 'occupied' ? 'ocupada' : 'livre', o.trust.toFixed(2), o.frames, o.ratio.toFixed(2), o.pose.lat, o.pose.lon, o.pose.source, ''].join(','),
  ),
].join('\n');
const out = file.replace(/\.json$/, '') + '-observacoes.csv';
writeFileSync(out, csv);
console.log(`CSV para conferência: ${out} (preencha a última coluna)`);
