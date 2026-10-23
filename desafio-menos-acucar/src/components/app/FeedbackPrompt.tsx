"use client";

import { MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { pendingStage, FEEDBACK_STAGES, type FeedbackStage } from "@/domain/feedback";
import type { UserData } from "@/domain/types";

const KEY = "dma:feedback-dismissed";

/** "Agora não" só esconde o convite neste navegador; a pesquisa continua disponível no Perfil. */
export function dismissFeedbackPrompt(stage: FeedbackStage) {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
    if (!list.includes(stage)) window.localStorage.setItem(KEY, JSON.stringify([...list, stage]));
  } catch {
    /* sem armazenamento: o convite simplesmente volta a aparecer */
  }
}

function dismissed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function FeedbackPrompt({ data, unlockedDay, completedCount }: { data: UserData; unlockedDay: number; completedCount: number }) {
  const [hidden, setHidden] = useState<string[] | null>(null);
  useEffect(() => setHidden(dismissed()), []);
  const stage = pendingStage(
    data.feedback.map((f) => f.stage),
    unlockedDay,
    completedCount,
  );
  if (!stage || hidden === null || hidden.includes(stage)) return null;
  const def = FEEDBACK_STAGES[stage];
  const copy =
    stage === "inicial"
      ? "Conte em 3 perguntas o que você espera do desafio."
      : stage === "dia7"
        ? "Conte o que está funcionando e o que não está."
        : "Sua opinião ajuda a definir a próxima versão.";

  return (
    <section aria-labelledby="convite-feedback" className="rounded-card border border-fresh/40 bg-fresh-50 p-5">
      <div className="flex gap-3">
        <MessageSquareText className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="convite-feedback" className="font-semibold text-forest-900">
            {def.title}
          </h2>
          <p className="mt-0.5 text-sm text-ink">{copy} Leva 1 ou 2 minutos e todas as perguntas são opcionais.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href={`/feedback/${stage}`} size="sm">
              Responder
            </ButtonLink>
            <button
              type="button"
              className="min-h-9 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest/[0.06]"
              onClick={() => {
                dismissFeedbackPrompt(stage);
                setHidden((h) => [...(h ?? []), stage]);
              }}
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
