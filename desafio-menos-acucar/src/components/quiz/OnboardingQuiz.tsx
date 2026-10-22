"use client";

import { ArrowLeft, ArrowRight, Check, CloudCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ProgressBar } from "@/components/ui/Progress";
import { QUIZ_QUESTIONS } from "@/domain/quiz";
import type { QuizAnswers } from "@/domain/types";
import { toLocalDateKey } from "@/domain/progress";
import { clearQuizDraft, loadQuizDraft, saveQuizDraft, type QuizDraft } from "@/services/quizDraft";
import type { Backend } from "@/services";
import { quizAnswersSchema, quizStepSchemas } from "@/validation/schemas";
import { OptionGroup } from "./OptionGroup";

interface Props {
  userId: string;
  backend: Backend;
  /** Respostas atuais, quando a pessoa está refazendo o questionário. */
  initial: QuizAnswers | null;
  onDone: (answers: QuizAnswers) => void | Promise<void>;
}

const TOTAL = QUIZ_QUESTIONS.length;

function readValue(draft: QuizDraft, id: keyof QuizAnswers): string[] {
  const v = draft[id];
  if (v === undefined) return [];
  return Array.isArray(v) ? [...v] : [v];
}

export function OnboardingQuiz({ userId, backend, initial, onDone }: Props) {
  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Carrega rascunho salvo (ou as respostas atuais, se estiver refazendo).
  useEffect(() => {
    const saved = loadQuizDraft(userId);
    if (saved && saved.step > 0) {
      setDraft({ ...saved, step: Math.min(saved.step, TOTAL - 1) });
      setResumed(true);
    } else {
      setDraft({ ...(initial ?? {}), step: 0 });
    }
  }, [userId, initial]);

  // Salva a cada mudança.
  useEffect(() => {
    if (draft) setStorageOk(saveQuizDraft(userId, draft));
  }, [draft, userId]);

  // Move o foco para a pergunta nova (leitores de tela anunciam a troca de tela).
  useEffect(() => {
    if (!draft) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [draft?.step]);

  if (!draft) return null;

  const question = QUIZ_QUESTIONS[draft.step]!;
  const value = readValue(draft, question.id);
  const multiple = question.kind === "multi";
  const isLast = draft.step === TOTAL - 1;
  const errorId = `erro-${question.id}`;

  function setValue(next: string[]) {
    setError(null);
    setDraft((d) => (d ? { ...d, [question.id]: multiple ? next : next[0] } : d));
  }

  function validateCurrent(): boolean {
    const schema = quizStepSchemas[question.id];
    const res = schema.safeParse(multiple ? value : value[0]);
    if (!res.success) {
      setError(res.error.issues[0]?.message ?? "Responda para continuar.");
      return false;
    }
    return true;
  }

  async function next() {
    if (!draft || !validateCurrent()) return;
    if (!isLast) {
      setDraft({ ...draft, step: draft.step + 1 });
      return;
    }
    const parsed = quizAnswersSchema.safeParse(draft);
    if (!parsed.success) {
      // Alguma resposta anterior ficou inválida: volta para ela.
      const firstBad = QUIZ_QUESTIONS.findIndex((q) => parsed.error.issues.some((i) => i.path[0] === q.id));
      setDraft({ ...draft, step: Math.max(0, firstBad) });
      setError(parsed.error.issues[0]?.message ?? "Revise esta resposta.");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    const res = await backend.saveQuiz(parsed.data, toLocalDateKey(new Date()));
    if (!res.ok) {
      setSubmitError(res.error);
      setSaving(false);
      return;
    }
    clearQuizDraft(userId);
    await onDone(parsed.data);
  }

  function back() {
    setError(null);
    setDraft((d) => (d && d.step > 0 ? { ...d, step: d.step - 1 } : d));
  }

  return (
    <form
      className="flex min-h-full flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void next();
      }}
      noValidate
    >
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-forest">
            Pergunta {draft.step + 1} de {TOTAL}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            {storageOk ? (
              <>
                <CloudCheck className="size-3.5" aria-hidden /> Respostas salvas
              </>
            ) : (
              "Não foi possível salvar o rascunho neste navegador"
            )}
          </span>
        </div>
        <ProgressBar value={((draft.step + (value.length ? 1 : 0)) / TOTAL) * 100} label={`Progresso do questionário: pergunta ${draft.step + 1} de ${TOTAL}`} tone="fresh" />
      </div>

      {resumed && draft.step > 0 && (
        <Notice tone="info" className="mb-6">
          Retomamos de onde você parou.
        </Notice>
      )}

      <div key={question.id} className="animate-rise flex-1">
        <h1 ref={headingRef} id={`titulo-${question.id}`} tabIndex={-1} className="font-display text-[1.75rem] leading-tight font-semibold text-forest outline-none sm:text-3xl">
          {question.title}
        </h1>
        <p id={`desc-${question.id}`} className="mt-2 leading-relaxed text-muted">
          {question.description}
          {multiple && question.max < question.options.length && (
            <span className="ml-1 font-semibold text-ink">
              ({value.length} de {question.max})
            </span>
          )}
        </p>

        <div className="mt-6">
          <OptionGroup
            name={question.id}
            labelledBy={`titulo-${question.id}`}
            describedBy={error ? `desc-${question.id} ${errorId}` : `desc-${question.id}`}
            options={question.options}
            multiple={multiple}
            max={multiple ? question.max : undefined}
            value={value}
            onChange={setValue}
            invalid={Boolean(error)}
          />
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {submitError && (
          <Notice tone="error" className="mt-4">
            {submitError}
          </Notice>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-8 flex gap-3 border-t border-line bg-paper/95 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        {draft.step > 0 && (
          <Button variant="secondary" size="lg" onClick={back} icon={<ArrowLeft className="size-4" aria-hidden />} disabled={saving}>
            Voltar
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" loading={saving} icon={isLast ? <Check className="size-4" aria-hidden /> : undefined}>
          {isLast ? "Ver meu plano" : "Continuar"}
          {!isLast && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
    </form>
  );
}
