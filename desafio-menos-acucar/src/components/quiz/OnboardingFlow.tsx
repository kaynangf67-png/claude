"use client";

import { ArrowRight, Clock, Lightbulb, MapPin, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireSession } from "@/components/app/RequireSession";
import { useSession } from "@/components/app/SessionProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { getMission } from "@/domain/missions";
import { welcomeSummary } from "@/domain/personalization";
import type { QuizAnswers } from "@/domain/types";
import { OnboardingQuiz } from "./OnboardingQuiz";

export function OnboardingFlow() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-xl items-center px-4">
        <Logo compact />
      </header>
      <main id="conteudo" className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-2 pb-6">
        <RequireSession needsOnboarding={false}>{(data) => <OnboardingContent userId={data.profile.id} name={data.profile.displayName} quiz={data.quiz} completed={Boolean(data.profile.onboardingCompletedAt)} />}</RequireSession>
      </main>
    </div>
  );
}

function OnboardingContent({ userId, name, quiz, completed }: { userId: string; name: string; quiz: QuizAnswers | null; completed: boolean }) {
  const { backend, refresh } = useSession();
  const router = useRouter();
  const [finished, setFinished] = useState<QuizAnswers | null>(null);
  const [redo, setRedo] = useState<boolean | null>(null);

  useEffect(() => {
    setRedo(new URLSearchParams(window.location.search).get("refazer") === "1");
  }, []);

  // Já fez o onboarding e não pediu para refazer: vai para o painel.
  useEffect(() => {
    if (redo === false && completed && !finished) router.replace("/inicio");
  }, [redo, completed, finished, router]);

  if (finished) return <Welcome name={name} answers={finished} isRedo={Boolean(redo)} />;
  if (!backend || redo === null || (completed && !redo)) return null;

  return (
    <OnboardingQuiz
      backend={backend}
      userId={userId}
      initial={quiz}
      onDone={async (answers) => {
        setFinished(answers);
        await refresh();
      }}
    />
  );
}

function Welcome({ name, answers, isRedo }: { name: string; answers: QuizAnswers; isRedo: boolean }) {
  const s = welcomeSummary(answers);
  const day1 = getMission(1)!;
  return (
    <section className="animate-rise" aria-labelledby="boas-vindas">
      <p className="text-sm font-semibold text-leaf">{isRedo ? "Respostas atualizadas" : "Tudo pronto"}</p>
      <h1 id="boas-vindas" className="font-display mt-1 text-[2rem] leading-tight font-semibold text-forest">
        {isRedo ? `Certo, ${name}. Ajustamos suas dicas.` : `Seu desafio começa hoje, ${name}.`}
      </h1>
      <p className="mt-3 leading-relaxed text-muted">Com base nas suas respostas, montamos o foco destes 21 dias.</p>

      <ul className="mt-7 grid gap-3">
        <li className="flex gap-3 rounded-card border border-line bg-white p-4">
          <Target className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink">Seu foco</p>
            <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-muted">Vamos {s.focus}.</p>
          </div>
        </li>
        <li className="flex gap-3 rounded-card border border-line bg-white p-4">
          <MapPin className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink">Momentos para observar</p>
            <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-muted">{s.moments.join(" · ")}</p>
          </div>
        </li>
        <li className="flex gap-3 rounded-card border border-line bg-white p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink">Uma dica para começar</p>
            <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-muted">{s.tip}</p>
          </div>
        </li>
        <li className="flex gap-3 rounded-card border border-line bg-white p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink">Seu ritmo</p>
            <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-muted">{s.pace}</p>
          </div>
        </li>
      </ul>

      <div className="mt-8 grid gap-3">
        {isRedo ? (
          <ButtonLink href="/inicio" size="lg" icon={<ArrowRight className="size-4" aria-hidden />}>
            Voltar para o início
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href="/desafio/1" size="lg" icon={<ArrowRight className="size-4" aria-hidden />}>
              Começar o Dia 1: {day1.title}
            </ButtonLink>
            <ButtonLink href="/feedback/inicial" variant="secondary" size="lg">
              Antes, responder 3 perguntas rápidas (opcional)
            </ButtonLink>
            <ButtonLink href="/inicio" variant="ghost" size="lg">
              Ver meu painel primeiro
            </ButtonLink>
          </>
        )}
      </div>
    </section>
  );
}
