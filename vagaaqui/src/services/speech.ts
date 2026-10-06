/** Instruções por voz para o motorista não precisar olhar para a tela. */
let lastText = '';
let lastAt = 0;

export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const now = Date.now();
  if (text === lastText && now - lastAt < 8000) return;
  lastText = text;
  lastAt = now;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch {
    /* síntese de voz indisponível */
  }
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
