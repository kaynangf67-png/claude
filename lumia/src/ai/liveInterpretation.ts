/**
 * LIVE INTERPRETATION — arquitetura do modo ao vivo.
 *
 *   MIC / VIDEO → SPEECH TO TEXT → SCENE ANALYSIS → CONTEXT ENGINE
 *              → LIBRAS ENGINE → AVATAR → REAL-TIME INTERPRETATION
 *
 * O que funciona HOJE (de verdade):
 *   MIC → SPEECH TO TEXT usa a Web Speech API do navegador (SpeechRecognition),
 *   quando disponível (Chrome/Edge; o reconhecimento é feito pelo serviço do
 *   próprio navegador). Cada frase final passa pelo motor de REGRAS de Libras
 *   e vira uma linha do tempo que o avatar sinaliza.
 *
 * TODO: FUTURE AI INTEGRATION
 *   - SCENE ANALYSIS ao vivo (câmera/tela) → multimodalAnalyzer em streaming;
 *   - ASR próprio em streaming com baixa latência e diarização;
 *   - tradução contextual por modelo (em vez de regras);
 *   - fila de latência: mostrar legenda imediatamente e sinalizar com atraso
 *     controlado (~1–2 s), como intérpretes humanos.
 */
import type { Emotion } from './types';
import { interpretSentence } from './interpretationPipeline';

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

export function speechRecognitionSupported(): boolean {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export interface LiveCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string, result: ReturnType<typeof interpretSentence>) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}

export class MicrophoneLiveSession {
  private rec: InstanceType<SpeechRecognitionCtor> | null = null;
  private stopped = false;

  constructor(private cb: LiveCallbacks, private emotion: Emotion | undefined = undefined) {}

  start(lang = 'pt-BR') {
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      this.cb.onError('Este navegador não oferece reconhecimento de fala (Web Speech API). Use Chrome ou Edge no computador.');
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) this.cb.onFinal(text, interpretSentence(text, { emotion: this.emotion }));
        else this.cb.onInterim(text);
      }
    };
    rec.onerror = (e) => this.cb.onError(e.error === 'not-allowed' ? 'Permissão de microfone negada.' : `Reconhecimento de fala: ${e.error}`);
    rec.onend = () => {
      if (!this.stopped) {
        try {
          rec.start();
          return;
        } catch {
          /* encerra */
        }
      }
      this.cb.onEnd();
    };
    this.rec = rec;
    this.stopped = false;
    rec.start();
  }

  stop() {
    this.stopped = true;
    this.rec?.stop();
  }
}
