/**
 * QUALITY ENGINE — primeira barreira antes da validação humana.
 *
 *   AI TRANSLATION → QUALITY CHECK → HUMAN VALIDATION → APPROVED SIGN SEQUENCE
 *
 * Ele NÃO aprova nada sozinho. Calcula uma confiança, lista problemas
 * objetivos e sugere o status. HUMAN_VERIFIED e PUBLISHED só são atingidos
 * por ação de um revisor humano (Estúdio de Validação).
 */
import type { ContextFrame, QualityReport, SignRepresentation } from './types';
import { LEXICON } from '@/avatar/signEngine';

export function checkQuality(rep: SignRepresentation, ctx: ContextFrame, timing: { speedFactor: number; overflow: number }): QualityReport {
  const warnings: QualityReport['warnings'] = [];
  let confidence = 0.92;

  const unknown = rep.tokens.filter((t) => t.kind !== 'fingerspell' && !LEXICON[t.gloss]);
  if (unknown.length) {
    confidence -= 0.25;
    warnings.push({ code: 'UNKNOWN_SIGN', message: `Sem animação no léxico: ${unknown.map((t) => t.gloss).join(', ')}` });
  }
  const spelled = rep.tokens.filter((t) => t.kind === 'fingerspell');
  if (spelled.length && rep.origin === 'rule-based') {
    confidence -= 0.08 * spelled.length;
    warnings.push({ code: 'FINGERSPELL_FALLBACK', message: `Soletrado por falta de sinal: ${spelled.map((t) => t.letters).join(', ')}` });
  }
  const approx = rep.tokens.filter((t) => LEXICON[t.gloss] && !LEXICON[t.gloss].validated);
  if (approx.length || spelled.length) {
    confidence -= 0.12;
    warnings.push({ code: 'UNVALIDATED_LEXICON', message: 'Sinais do léxico de demonstração ainda não validados por intérpretes/pessoas surdas.' });
  }
  if (timing.speedFactor > 1.35) {
    confidence -= 0.1;
    warnings.push({ code: 'FAST_PACE', message: `Ritmo ${timing.speedFactor.toFixed(2)}× mais rápido que o natural para caber no tempo da fala.` });
  }
  if (timing.overflow > 0.6) {
    warnings.push({ code: 'LAG', message: `Interpretação termina ${timing.overflow.toFixed(1)} s depois da fala.` });
  }
  if (ctx.speaker.confidence < 0.7 && rep.roleShift) {
    confidence -= 0.1;
    warnings.push({ code: 'SPEAKER_UNCERTAIN', message: 'Falante identificado com baixa confiança.' });
  }
  if (ctx.emotion.confidence < 0.55) {
    confidence -= 0.05;
    warnings.push({ code: 'EMOTION_UNCERTAIN', message: 'Emoção inferida com poucas evidências.' });
  }
  confidence = Math.max(0.05, Math.min(0.99, confidence));
  return {
    confidence,
    warnings,
    suggestedStatus: warnings.length === 0 && confidence >= 0.85 ? 'AI_GENERATED' : 'REVIEW_REQUIRED',
  };
}
