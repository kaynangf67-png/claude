"use client";

import { ArrowRight, CalendarCheck2, Clock, Lightbulb, PartyPopper } from "lucide-react";
import Link from "next/link";
import { FeedbackPrompt } from "@/components/app/FeedbackPrompt";
import { useChallenge } from "@/components/app/useChallenge";
import { AchievementBadge, ActivityList, XpCard } from "@/components/app/widgets";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/Progress";
import { CHALLENGE_DAYS } from "@/domain/missions";
import { difficultyTip, prefersQuickVersion } from "@/domain/personalization";
import { formatWeekday, greeting } from "@/lib/format";

export function DashboardView() {
  const { data, view } = useChallenge();
  if (!data || !view) return null;

  const firstName = data.profile.displayName.split(" ")[0];
  const unlocked = view.achievements.filter((a) => a.unlocked).sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""));
  const nextLocked = view.achievements.find((a) => !a.unlocked);
  const preview = [...unlocked.slice(0, nextLocked ? 2 : 3), ...(nextLocked ? [nextLocked] : [])];
  const quick = view.nextMission ? prefersQuickVersion(data.quiz, view.nextMission) : false;
  const periodOver = view.calendarDay > CHALLENGE_DAYS;

  return (
    <div className="grid grid-cols-1 gap-8">
      <header className="animate-rise">
        <p className="text-sm text-muted">{formatWeekday(new Date())}</p>
        <h1 className="font-display mt-0.5 text-3xl font-semibold tracking-tight text-forest">
          {greeting(new Date())}, {firstName}
        </h1>
      </header>

      {/* Cartão principal: dia atual + missão */}
      <section aria-labelledby="missao-hoje" className="animate-rise overflow-hidden rounded-card bg-forest text-paper shadow-raised [animation-delay:60ms]">
        <div className="flex items-center gap-5 p-5 sm:p-6">
          <ProgressRing value={view.percent} size={92} stroke={8} label={`${view.completedCount} de ${CHALLENGE_DAYS} missões concluídas`}>
            <span className="text-center leading-none">
              <span className="block text-2xl font-bold tabular-nums">{view.completedCount}</span>
              <span className="text-[0.6875rem] text-paper/70">de {CHALLENGE_DAYS}</span>
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-paper/65 uppercase">
              {periodOver ? "Período de 21 dias encerrado" : `Dia ${view.calendarDay} de ${CHALLENGE_DAYS}`}
            </p>
            <p className="mt-1 text-sm text-paper/80">
              {view.percent}% do desafio concluído
            </p>
          </div>
        </div>

        <div className="border-t border-paper/15 bg-forest-900/40 p-5 sm:p-6">
          {view.finished ? (
            <div>
              <PartyPopper className="size-6 text-fresh" aria-hidden />
              <h2 id="missao-hoje" className="font-display mt-2 text-2xl font-semibold">
                Você concluiu as 21 missões.
              </h2>
              <p className="mt-1 text-paper/75">Seu relatório final está pronto, com as estratégias que você quer manter.</p>
              <ButtonLink href="/relatorio" variant="secondary" size="lg" className="mt-5 w-full border-transparent sm:w-auto" icon={<ArrowRight className="size-4" aria-hidden />}>
                Ver relatório final
              </ButtonLink>
            </div>
          ) : view.nextMission ? (
            <div>
              <p className="text-xs font-semibold tracking-wider text-leaf-light uppercase">
                {view.nextMission.day < view.unlockedDay ? `Missão pendente · Dia ${view.nextMission.day}` : "Missão de hoje"}
              </p>
              <h2 id="missao-hoje" className="font-display mt-1 text-2xl leading-snug font-semibold">
                {view.nextMission.title}
              </h2>
              <p className="mt-1.5 leading-relaxed text-paper/75">{quick ? view.nextMission.quickVersion : view.nextMission.summary}</p>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-paper/70">
                <Clock className="size-4" aria-hidden />
                {quick ? "Versão rápida sugerida para você" : `Cerca de ${view.nextMission.minutes} min · versão rápida disponível`}
              </p>
              <ButtonLink
                href={`/desafio/${view.nextMission.day}`}
                variant="secondary"
                size="lg"
                className="mt-5 w-full border-transparent sm:w-auto"
                icon={<ArrowRight className="size-4" aria-hidden />}
              >
                Continuar desafio
              </ButtonLink>
            </div>
          ) : (
            <div>
              <CalendarCheck2 className="size-6 text-fresh" aria-hidden />
              <h2 id="missao-hoje" className="font-display mt-2 text-2xl font-semibold">
                Missão de hoje concluída
              </h2>
              <p className="mt-1 text-paper/75">A próxima missão é liberada amanhã. Enquanto isso, que tal explorar o guia?</p>
              <ButtonLink href="/guia" variant="secondary" size="lg" className="mt-5 w-full border-transparent sm:w-auto" icon={<ArrowRight className="size-4" aria-hidden />}>
                Abrir o guia
              </ButtonLink>
            </div>
          )}
        </div>
      </section>

      <FeedbackPrompt data={data} unlockedDay={view.unlockedDay} completedCount={view.completedCount} />

      <div className="grid gap-3 sm:grid-cols-2">
        <XpCard xp={view.xp} level={view.level} />
        {data.quiz && (
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Lightbulb className="size-3.5 text-fresh" aria-hidden /> Dica para você
            </p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink">{difficultyTip(data.quiz.difficulty)}</p>
          </Card>
        )}
      </div>

      <section aria-labelledby="conquistas">
        <SectionTitle
          id="conquistas"
          title="Conquistas"
          action={
            <Link href="/progresso#conquistas" className="text-sm font-semibold text-forest hover:underline">
              Ver todas
            </Link>
          }
        />
        {preview.length > 0 ? (
          <div className="grid gap-2.5 sm:grid-cols-3">
            {preview.map((a) => (
              <AchievementBadge key={a.id} a={a} />
            ))}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="atividade">
        <SectionTitle id="atividade" title="Atividade recente" />
        <ActivityList items={view.activity} limit={5} />
      </section>
    </div>
  );
}
