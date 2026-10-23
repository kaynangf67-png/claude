"use client";

import { ArrowLeft, CircleCheck, Lock, Send } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useChallenge } from "@/components/app/useChallenge";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { compactAnswers, FEEDBACK_STAGES, FEEDBACK_TEXT_MAX, isStageOpen, type FeedbackQuestion, type FeedbackStageDef } from "@/domain/feedback";
import { cn } from "@/lib/cn";
import { feedbackAnswersSchema } from "@/validation/schemas";
import { dismissFeedbackPrompt } from "@/components/app/FeedbackPrompt";

export function FeedbackView({ stage }: { stage: keyof typeof FEEDBACK_STAGES }) {
  const { data, view } = useChallenge();
  // Fica aqui (e não no formulário) porque, ao salvar, os dados recarregam e o formulário sai da tela.
  const [sent, setSent] = useState(false);
  if (!data || !view) return null;
  const def = FEEDBACK_STAGES[stage];
  const answered = data.feedback.some((f) => f.stage === stage);
  const open = isStageOpen(stage, view.unlockedDay, view.completedCount);

  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-1 gap-6">
      <Link href="/inicio" className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-muted hover:text-forest">
        <ArrowLeft className="size-4" aria-hidden /> Início
      </Link>
      <header>
        <Badge tone="green">Pesquisa da Primeira Turma</Badge>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-forest">{def.title}</h1>
        <p className="mt-2 leading-relaxed text-muted">{def.intro}</p>
      </header>
      {sent ? (
        <Card className="animate-pop flex flex-col items-start gap-3 p-6" aria-live="polite">
          <CircleCheck className="size-6 text-forest" aria-hidden />
          <p className="font-semibold">Respostas enviadas. Obrigado por ajudar a construir o desafio.</p>
          <ButtonLink href="/inicio">Voltar ao início</ButtonLink>
        </Card>
      ) : answered ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <CircleCheck className="size-6 text-forest" aria-hidden />
          <p className="font-semibold">Você já respondeu esta pesquisa. Obrigado!</p>
          <ButtonLink href="/inicio" variant="secondary">
            Voltar ao início
          </ButtonLink>
        </Card>
      ) : !open ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <Lock className="size-6 text-muted" aria-hidden />
          <p className="font-semibold">Esta pesquisa ainda não foi liberada.</p>
          <p className="text-sm text-muted">Ela aparece no seu painel no momento certo do desafio.</p>
        </Card>
      ) : (
        <FeedbackForm def={def} onSent={() => setSent(true)} />
      )}
    </div>
  );
}

function FeedbackForm({ def, onSent }: { def: FeedbackStageDef; onSent: () => void }) {
  const { backend, refresh } = useChallenge();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!backend) return;
    const payload = compactAnswers(answers);
    const parsed = feedbackAnswersSchema.safeParse(payload);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revise suas respostas.");
    setBusy(true);
    setError(null);
    const res = await backend.submitFeedback(def.stage, parsed.data);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onSent();
    window.scrollTo({ top: 0, behavior: "smooth" });
    await refresh();
  }

  const set = (k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v }));

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {def.questions.map((q) => (
        <QuestionField key={q.key} q={q} value={answers[q.key] ?? ""} onChange={(v) => set(q.key, v)} />
      ))}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-2 sm:flex sm:flex-row-reverse sm:justify-start">
        <Button type="submit" size="lg" loading={busy} icon={<Send className="size-4" aria-hidden />}>
          Enviar respostas
        </Button>
        <ButtonLink
          href="/inicio"
          variant="ghost"
          size="lg"
          onClick={() => dismissFeedbackPrompt(def.stage)}
        >
          Pular por agora
        </ButtonLink>
      </div>
      <p className="text-xs text-muted">Todas as perguntas são opcionais. Evite escrever dados de saúde ou informações de outras pessoas.</p>
    </form>
  );
}

export function QuestionField({ q, value, onChange }: { q: FeedbackQuestion; value: string; onChange: (v: string) => void }) {
  if (q.kind === "text") {
    return (
      <TextArea
        label={q.label}
        hint="Opcional"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={FEEDBACK_TEXT_MAX}
        placeholder={q.placeholder ?? "Escreva com suas palavras…"}
        className="[&_textarea]:min-h-24"
      />
    );
  }
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">
        {q.label} <span className="font-normal text-muted">(opcional)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {q.options!.map((o) => {
          const selected = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest has-[:focus-visible]:ring-offset-2",
                selected ? "border-forest bg-fresh-50 text-forest-900" : "border-line bg-white text-ink hover:border-forest/35",
              )}
            >
              <input
                type="radio"
                name={q.key}
                value={o.value}
                checked={selected}
                // Clicar de novo na opção marcada desmarca: a pergunta continua opcional.
                onClick={() => selected && onChange("")}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
