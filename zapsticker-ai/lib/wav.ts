/** Codifica amostras mono/estéreo (Float32 −1…1) em WAV PCM 16 bits. */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numCh = channels.length;
  const length = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numCh; c++) {
      let v = channels[c][i];
      if (v > 1) v = 1;
      else if (v < -1) v = -1;
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return buffer;
}

/** Reduz um sinal a N picos (0…1) para desenhar a forma de onda. */
export function computePeaks(samples: Float32Array, buckets: number): number[] {
  const peaks: number[] = new Array(buckets).fill(0);
  if (samples.length === 0 || buckets <= 0) return peaks;
  const size = samples.length / buckets;
  let max = 0;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size);
    const end = Math.min(samples.length, Math.floor((b + 1) * size));
    let p = 0;
    for (let i = start; i < end; i++) {
      const a = Math.abs(samples[i]);
      if (a > p) p = a;
    }
    peaks[b] = p;
    if (p > max) max = p;
  }
  return max > 0 ? peaks.map((p) => p / max) : peaks;
}
