"use client";

import { ArrowLeft, Lock, Printer } from "lucide-react";
import Link from "next/link";
import { useChallenge } from "@/components/app/useChallenge";
import { AchievementBadge } from "@/components/app/widgets";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { getGuideItem } from "@/domain/guide";
import { CHALLENGE_DAYS } from "@/domain/missions";
import { goalFocus } from "@/domain/personalization";
import { formatDateLong } from "@/lib/format";

const FEELING_LABELS = { facil: "Tranquilas", ok: "Deu para fazer", desafiador: "Desafiadoras" } as const;

export function ReportView() {
  const { data, view } = useChallenge();
  if (!data || !view) return null;

  const available = view.finished || view.calendarDay > CHALLENGE_DAYS;

  if (!available) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <BackLink />
        <Card className="flex flex-col items-start gap-3 p-6">
          <span className="grid size-11 place-items-center rounded-lg bg-sand text-muted">
            <Lock className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-2xl font-semibold text-forest">Relatório final</h1>
          <p className="text-muted">
            O relatório fica pronto quando você concluir as 21 missões ou quando o período de 21 dias terminar. Ele vai reunir seu ponto de
            partida, suas reflexões, como as missões foram para você e as estratégias que quer manter.
          </p>
          <div className="w-full">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-semibold">
                {view.completedCount} de {CHALLENGE_DAYS} missões
              </span>
              <span className="text-muted">{view.percent}%</span>
            </div>
            <ProgressBar value={view.percent} label="Missões concluídas" />
          </div>
          <ButtonLink href="/desafio" className="mt-2">
            Continuar o desafio
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const byDay = view.completionByDay;
  const first = byDay.get(1);
  const last = byDay.get(21);
  const feelings = data.completions.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.feeling]: (acc[c.feeling] ?? 0) + 1 }), {});
  const reflections = data.completions.filter((c) => c.reflection).length;
  const unlocked = view.achievements.filter((a) => a.unlocked);

  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="flex items-center justify-between print:hidden">
        <BackLink />
        <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden />}>
          Imprimir ou salvar PDF
        </Button>
      </div>

      <header>
        <p className="text-sm font-semibold text-leaf">Relatório final</p>
        <h1 className="font-display mt-1 text-3xl leading-tight font-semibold text-forest">Seus 21 dias, {data.profile.displayName.split(" ")[0]}</h1>
        {data.profile.challengeStartedOn && <p className="mt-1 text-muted">Desafio iniciado em {formatDateLong(data.profile.challengeStartedOn)}.</p>}
        {data.profile.isSample && <p className="mt-2 text-sm font-semibold text-[#6b4510]">Dados de exemplo.</p>}
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Missões", value: `${view.completedCount}/${CHALLENGE_DAYS}` },
          { label: "Reflexões", value: String(reflections) },
          { label: "XP", value: String(view.xp) },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      {data.quiz && (
        <section aria-labelledby="foco">
          <SectionTitle id="foco" title="Seu foco" />
          <Card className="p-5 leading-relaxed">Você começou com o objetivo de {goalFocus(data.quiz.goal)}.</Card>
        </section>
      )}

      <section aria-labelledby="caminho">
        <SectionTitle id="caminho" title="Do Dia 1 ao Dia 21" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-xs font-semibold text-muted">No Dia 1 você escreveu</p>
            <p className="mt-1.5 leading-relaxed">{first?.reflection ? `“${first.reflection}”` : "Sem reflexão registrada."}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold text-muted">No Dia 21 você escreveu</p>
            <p className="mt-1.5 leading-relaxed">{last?.reflection ? `“${last.reflection}”` : "Sem reflexão registrada."}</p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="como-foi">
        <SectionTitle id="como-foi" title="Como as missões foram para você" />
        <Card className="grid gap-3 p-5">
          {(Object.keys(FEELING_LABELS) as (keyof typeof FEELING_LABELS)[]).map((f) => {
            const n = feelings[f] ?? 0;
            const pct = view.completedCount ? Math.round((n / view.completedCount) * 100) : 0;
            return (
              <div key={f}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{FEELING_LABELS[f]}</span>
                  <span className="text-muted tabular-nums">{n}</span>
                </div>
                <ProgressBar value={pct} label={`${FEELING_LABELS[f]}: ${n} missões`} tone="fresh" className="h-1.5" />
              </div>
            );
          })}
        </Card>
      </section>

      <section aria-labelledby="plano">
        <SectionTitle id="plano" title="Seu plano para continuar" />
        {data.strategies.length ? (
          <Card className="divide-y divide-line">
            {data.strategies.map((s) => {
              const g = getGuideItem(s.strategyId);
              return g ? (
                <div key={s.id} className="px-5 py-4">
                  <p className="font-semibold">{g.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{g.howTo}</p>
                </div>
              ) : null;
            })}
          </Card>
        ) : (
          <Card className="p-5 text-muted">
            Você não salvou estratégias.{" "}
            <Link href="/guia" className="font-semibold text-forest hover:underline">
              Escolha algumas no guia
            </Link>{" "}
            para montar seu plano.
          </Card>
        )}
      </section>

      {unlocked.length > 0 && (
        <section aria-labelledby="conquistas-relatorio">
          <SectionTitle id="conquistas-relatorio" title="Conquistas" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {unlocked.map((a) => (
              <AchievementBadge key={a.id} a={a} compact />
            ))}
          </div>
        </section>
      )}

      <p className="text-sm leading-relaxed text-muted">
        O desafio termina, mas o que você aprendeu sobre a sua rotina continua valendo. Volte às suas estratégias sempre que precisar.
      </p>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/progresso" className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-muted hover:text-forest">
      <ArrowLeft className="size-4" aria-hidden /> Progresso
    </Link>
  );
}
