import type { QuizAnswers } from "@/domain/types";
import { quizDraftSchema } from "@/validation/schemas";

// Rascunho do quiz salvo a cada resposta, por usuário, para retomar de onde parou.
// Fica no navegador nos dois modos; as respostas finais vão para o backend.

export type QuizDraft = Partial<QuizAnswers> & { step: number };

const key = (userId: string) => `dma:quiz-draft:${userId}`;

export function loadQuizDraft(userId: string): QuizDraft | null {
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = quizDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveQuizDraft(userId: string, draft: QuizDraft): boolean {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearQuizDraft(userId: string) {
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    /* sem armazenamento: nada a limpar */
  }
}
