/**
 * Lê duração e captura um frame como thumbnail, 100% no navegador.
 * Vídeos com codec não suportado pelo browser (ex.: HEVC em alguns desktops)
 * retornam duração 0 e sem thumbnail — o processamento externo cobriria isso.
 */
export function extractVideoMeta(file: File): Promise<{ durationSeconds: number; thumbnail: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    let duration = 0;
    const done = (thumbnail: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve({ durationSeconds: Number.isFinite(duration) ? duration : 0, thumbnail });
    };
    const timer = setTimeout(() => done(null), 8000);

    video.onloadedmetadata = () => {
      duration = video.duration;
      video.currentTime = Math.min(1, duration / 3 || 0);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      try {
        const w = 480;
        const h = Math.round((video.videoHeight / video.videoWidth) * w) || 270;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => done(blob), 'image/jpeg', 0.8);
      } catch {
        done(null);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
  });
}
