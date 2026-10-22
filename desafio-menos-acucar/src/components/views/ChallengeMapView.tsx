"use client";

import { ChevronRight, CircleCheck, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { useChallenge } from "@/components/app/useChallenge";
import { DayDot } from "@/components/app/widgets";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { CATEGORY_LABELS, CHALLENGE_DAYS, MISSIONS, WEEK_THEMES } from "@/domain/missions";
import { dayStatus } from "@/domain/progress";
import { cn } from "@/lib/cn";

export function ChallengeMapView() {
  const { data, view } = useChallenge();
  if (!data || !view) return null;

  return (
    <div className="grid grid-cols-1 gap-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-forest">Seu desafio</h1>
        <p className="mt-1 text-muted">Uma missão nova por dia. As anteriores ficam disponíveis para você fazer quando puder.</p>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold text-ink">
              {view.completedCount} de {CHALLENGE_DAYS} missões
            </span>
            <span className="text-muted">{view.percent}%</span>
          </div>
          <ProgressBar value={view.percent} label="Progresso do desafio" />
        </div>
      </header>

      <Card className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {MISSIONS.map((m) => (
            <DayDot key={m.day} day={m.day} status={dayStatus(m.day, data.completions, view.unlockedDay)} current={m.day === view.nextDay} />
          ))}
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-fresh" aria-hidden /> Concluída
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-forest/45 bg-white" aria-hidden /> Disponível
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-sand" aria-hidden /> Libera nos próximos dias
          </li>
        </ul>
      </Card>

      {([1, 2, 3] as const).map((w) => (
        <section key={w} aria-labelledby={`semana-${w}`}>
          <div className="mb-3">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Semana {w}</p>
            <h2 id={`semana-${w}`} className="font-display text-xl font-semibold text-ink">
              {WEEK_THEMES[w].title}
              <span className="ml-2 font-sans text-sm font-normal text-muted">{WEEK_THEMES[w].description}</span>
            </h2>
          </div>
          <Card className="divide-y divide-line">
            {MISSIONS.filter((m) => m.week === w).map((m) => {
              const status = dayStatus(m.day, data.completions, view.unlockedDay);
              const locked = status === "bloqueada";
              const inner = (
                <>
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold",
                      status === "concluida" ? "bg-fresh-100 text-forest" : locked ? "bg-sand text-muted" : "bg-forest text-paper",
                    )}
                  >
                    {status === "concluida" ? <CircleCheck className="size-5" aria-hidden /> : locked ? <Lock className="size-4" aria-hidden /> : m.day}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted">
                      Dia {m.day} · {CATEGORY_LABELS[m.category]}
                    </span>
                    <span className={cn("block font-semibold", locked ? "text-muted" : "text-ink")}>{m.title}</span>
                    {!locked && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <Clock className="size-3" aria-hidden /> {m.minutes} min
                        {status === "concluida" && " · concluída"}
                        {m.day === view.nextDay && <span className="ml-1 font-semibold text-forest">· próxima</span>}
                      </span>
                    )}
                  </span>
                  {!locked && <ChevronRight className="size-4 text-muted" aria-hidden />}
                </>
              );
              return locked ? (
                <div key={m.day} className="flex items-center gap-3 px-4 py-3.5" aria-label={`Dia ${m.day}: ${m.title}, libera em ${m.day - view.unlockedDay} dia(s)`}>
                  {inner}
                </div>
              ) : (
                <Link key={m.day} href={`/desafio/${m.day}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper/60">
                  {inner}
                </Link>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
