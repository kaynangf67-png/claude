"use client";

import { ArrowRight, BookmarkPlus, FileText, NotebookPen } from "lucide-react";
import Link from "next/link";
import { SaveStrategyButton } from "@/components/app/SaveStrategyButton";
import { useChallenge } from "@/components/app/useChallenge";
import { AchievementBadge, XpCard } from "@/components/app/widgets";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { getGuideItem } from "@/domain/guide";
import { CHALLENGE_DAYS, getMission } from "@/domain/missions";
import { LEVELS } from "@/domain/progress";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";

export function ProgressView() {
  const { data, view } = useChallenge();
  if (!data || !view) return null;

  const reflections = [...data.completions].filter((c) => c.reflection).sort((a, b) => a.day - b.day);
  const unlockedCount = view.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="grid grid-cols-1 gap-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-forest">Seu progresso</h1>
        <p className="mt-1 text-muted">Tudo o que você já fez. Aqui só entra o que conta a favor.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted">Missões concluídas</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
            {view.completedCount}
            <span className="text-base font-semibold text-muted"> / {CHALLENGE_DAYS}</span>
          </p>
          <ProgressBar value={view.percent} label="Missões concluídas" className="mt-3 h-1.5" />
          <p className="mt-2 text-xs text-muted">
            {reflections.length} {reflections.length === 1 ? "reflexão escrita" : "reflexões escritas"} · {data.strategies.length}{" "}
            {data.strategies.length === 1 ? "estratégia salva" : "estratégias salvas"}
          </p>
        </Card>
        <XpCard xp={view.xp} level={view.level} />
      </div>

      <section aria-labelledby="niveis">
        <SectionTitle id="niveis" title="Níveis" />
        <Card className="p-4">
          <ol className="flex flex-wrap gap-2">
            {LEVELS.map((l) => {
              const reached = view.xp >= l.minXp;
              const current = l.level === view.level.current.level;
              return (
                <li
                  key={l.level}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    current ? "bg-forest font-semibold text-paper" : reached ? "bg-fresh-100 text-forest-900" : "bg-sand text-muted",
                  )}
                >
                  {l.name}
                  <span className={cn("ml-1.5 text-xs", current ? "text-paper/70" : "text-muted")}>{l.minXp} XP</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted">Cada missão vale 100 XP, uma reflexão escrita vale +20 e cada estratégia salva vale +10 (até 10).</p>
        </Card>
      </section>

      <section aria-labelledby="conquistas-titulo" id="conquistas" className="scroll-mt-20">
        <SectionTitle id="conquistas-titulo" title={`Conquistas · ${unlockedCount} de ${view.achievements.length}`} />
        <div className="grid gap-2.5 sm:grid-cols-2">
          {view.achievements.map((a) => (
            <AchievementBadge key={a.id} a={a} />
          ))}
        </div>
      </section>

      <section aria-labelledby="estrategias-titulo" id="estrategias" className="scroll-mt-20">
        <SectionTitle id="estrategias-titulo" title="Estratégias salvas" />
        {data.strategies.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <BookmarkPlus className="size-6 text-muted" aria-hidden />
            <p className="font-semibold text-ink">Nenhuma estratégia salva ainda</p>
            <p className="max-w-xs text-sm text-muted">Salve as ideias que fizerem sentido para você. Elas formam seu plano no fim do desafio.</p>
            <ButtonLink href="/guia" variant="secondary" size="sm" className="mt-2">
              Explorar o guia
            </ButtonLink>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {data.strategies.map((s) => {
              const item = getGuideItem(s.strategyId);
              if (!item) return null;
              return (
                <div key={s.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{item.howTo}</p>
                    <p className="mt-1 text-xs text-muted">Salva em {formatDateShort(s.savedAt)}</p>
                  </div>
                  <SaveStrategyButton strategyId={item.id} title={item.title} />
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <section aria-labelledby="diario">
        <SectionTitle id="diario" title="Suas reflexões" />
        {reflections.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <NotebookPen className="size-6 text-muted" aria-hidden />
            <p className="font-semibold text-ink">Seu diário está em branco</p>
            <p className="max-w-xs text-sm text-muted">Ao concluir uma missão, você pode escrever uma reflexão curta. Ela aparece aqui.</p>
          </Card>
        ) : (
          <div className="grid gap-2.5">
            {reflections.map((c) => {
              const m = getMission(c.day);
              return (
                <Card key={c.id} className="p-4">
                  <Link href={`/desafio/${c.day}`} className="text-xs font-semibold text-muted hover:text-forest">
                    Dia {c.day} · {m?.title} · {formatDateShort(c.completedAt)}
                  </Link>
                  <p className="mt-1.5 leading-relaxed text-ink">“{c.reflection}”</p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
        <FileText className="size-6 shrink-0 text-forest" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold text-ink">Relatório final</p>
          <p className="text-sm text-muted">
            {view.finished
              ? "Pronto para você: um resumo dos seus 21 dias e do seu plano."
              : `Fica disponível quando você concluir as 21 missões. Faltam ${CHALLENGE_DAYS - view.completedCount}.`}
          </p>
        </div>
        <ButtonLink href="/relatorio" variant="secondary" size="sm" icon={<ArrowRight className="size-4" aria-hidden />}>
          {view.finished ? "Abrir" : "Ver prévia"}
        </ButtonLink>
      </Card>
    </div>
  );
}
