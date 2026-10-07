import type { ObjectDetector } from '@mediapipe/tasks-vision';
import { env } from '../../config/env';
import type { Detection } from './curbVision';

export interface VehicleDetector {
  backend: 'GPU' | 'CPU';
  detect(video: HTMLVideoElement, timestampMs: number): Detection[];
  close(): void;
}

const VEHICLES = ['car', 'truck', 'bus', 'motorcycle'];

/**
 * Detector de veículos que roda 100% no aparelho (MediaPipe + EfficientDet-Lite0).
 * Nenhuma imagem sai do celular: só as posições estimadas dos carros.
 * Carregado sob demanda (o pacote e o modelo só baixam ao abrir o sensor).
 */
export async function createVehicleDetector(): Promise<VehicleDetector> {
  const vision = await import('@mediapipe/tasks-vision');
  const wasmBase = env.mediapipeWasmUrl || `${location.origin}${import.meta.env.BASE_URL}mediapipe-wasm`;
  const fileset = await vision.FilesetResolver.forVisionTasks(wasmBase);
  let detector: ObjectDetector | null = null;
  let backend: 'GPU' | 'CPU' = 'CPU';
  // Padrão CPU (XNNPACK): previsível e rápido o bastante para ~5 quadros/s.
  // O backend de GPU falhou em silêncio (zero detecções) em GPU emulada nos testes;
  // pode ser ativado com localStorage 'vagaaqui.detector.delegate' = 'GPU'.
  let forced: string | null = null;
  try {
    forced = localStorage.getItem('vagaaqui.detector.delegate');
  } catch {
    /* sem storage */
  }
  const delegates = forced === 'GPU' ? (['GPU', 'CPU'] as const) : (['CPU'] as const);
  for (const delegate of delegates) {
    try {
      detector = await vision.ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: env.detectorModelUrl, delegate },
        runningMode: 'VIDEO',
        scoreThreshold: 0.35,
        maxResults: 25,
        categoryAllowlist: VEHICLES,
      });
      backend = delegate;
      break;
    } catch (err) {
      if (delegate === 'CPU') throw err;
    }
  }
  const det = detector!;
  return {
    backend,
    detect(video, ts) {
      const result = det.detectForVideo(video, ts);
      return result.detections.flatMap((d) => {
        const box = d.boundingBox;
        const cat = d.categories[0];
        if (!box || !cat) return [];
        return [{ category: cat.categoryName, score: cat.score, x: box.originX, y: box.originY, w: box.width, h: box.height }];
      });
    },
    close() {
      det.close();
    },
  };
}
