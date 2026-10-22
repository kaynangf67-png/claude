"use client";

import { ArrowLeft, ArrowRight, Award, CircleCheck, Clock, Lock, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { SaveStrategyButton } from "@/components/app/SaveStrategyButton";
import { useChallenge } from "@/components/app/useChallenge";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { buildChallengeView } from "@/domain/challengeView";
import { getGuideItem } from "@/domain/guide";
import { CATEGORY_LABELS, getMission } from "@/domain/missions";
import { prefersQuickVersion } from "@/domain/personalization";
import { addDays, dayStatus, xpForCompletion } from "@/domain/progress";
import type { Achievement, Mission, MissionFeeling, UserData } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateLong } from "@/lib/format";
import { fieldErrors, missionCompletionSchema } from "@/validation/schemas";

const FEELINGS: { value: MissionFeeling; label: string }[] = [
  { value: "facil", label: "Foi tranquilo" },
  { value: "ok", label: "Deu para fazer" },
  { value: "desafiador", label: "Foi desafiador" },
];

interface Celebration {
  xp: number;
  levelUp: string | null;
  achievements: Achievement[];
  nextDay: number | null;
}

export function MissionView({ day }: { day: number }) {
  const { data, view, today, backend, refresh } = useChallenge();
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const mission = getMission(day);
  if (!data || !view || !mission || !backend) return null;

  const status = dayStatus(day, data.completions, view.unlockedDay);
  const completion = view.completionByDay.get(day);

  return (
    <article className="grid grid-cols-1 gap-6">
      <Link href="/desafio" className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-muted hover:text-forest">
        <ArrowLeft className="size-4" aria-hidden /> Desafio
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="forest">Dia {mission.day}</Badge>
          <Badge>{CATEGORY_LABELS[mission.category]}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Clock className="size-3.5" aria-hidden /> Cerca de {mission.minutes} min
          </span>
        </div>
        <h1 className="font-display mt-3 text-[2rem] leading-tight font-semibold tracking-tight text-forest">{mission.title}</h1>
        <p className="mt-2 text-lg leading-relaxed text-muted">{mission.summary}</p>
      </header>

      {status === "bloqueada" ? (
        <LockedState mission={mission} unlockedDay={view.unlockedDay} startedOn={data.profile.challengeStartedOn} />
      ) : celebration ? (
        <CelebrationPanel c={celebration} />
      ) : (
        <>
          <MissionBody mission={mission} data={data} />
          {completion ? (
            <Card className="p-5">
              <p className="flex items-center gap-2 font-semibold text-forest">
                <CircleCheck className="size-5" aria-hidden /> Concluída em {formatDateLong(completion.completedAt)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {FEELINGS.find((f) => f.value === completion.feeling)?.label} · +{xpForCompletion(completion)} XP
              </p>
              {completion.reflection && (
                <blockquote className="mt-4 border-l-2 border-fresh pl-4 leading-relaxed text-ink">
                  <p className="mb-1 text-xs font-semibold text-muted">{mission.reflectionPrompt}</p>“{completion.reflection}”
                </blockquote>
              )}
            </Card>
          ) : (
            <CompletionForm
              mission={mission}
              onComplete={async (input) => {
                const res = await backend.completeMission({ day, ...input }, today);
                if (!res.ok) return res.error;
                const before = view;
                const after = buildChallengeView({ ...data, completions: [...data.completions, res.data] }, today);
                const beforeIds = new Set(before.achievements.filter((a) => a.unlocked).map((a) => a.id));
                setCelebration({
                  xp: after.xp - before.xp,
                  levelUp: after.level.current.level > before.level.current.level ? after.level.current.name : null,
                  achievements: after.achievements.filter((a) => a.unlocked && !beforeIds.has(a.id)),
                  nextDay: after.nextDay,
                });
                window.scrollTo({ top: 0, behavior: "smooth" });
                await refresh();
                return null;
              }}
            />
          )}
        </>
      )}
    </article>
  );
}

function LockedState({ mission, unlockedDay, startedOn }: { mission: Mission; unlockedDay: number; startedOn: string | null }) {
  const daysLeft = mission.day - unlockedDay;
  return (
    <Card className="flex flex-col items-start gap-3 p-6">
      <span className="grid size-11 place-items-center rounded-lg bg-sand text-muted">
        <Lock className="size-5" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-ink">Esta missão ainda não foi liberada</h2>
      <p className="text-muted">
        Ela abre {daysLeft === 1 ? "amanhã" : `em ${daysLeft} dias`}
        {startedOn ? `, em ${formatDateLong(addDays(startedOn, mission.day - 1))}` : ""}. Uma missão por dia ajuda o hábito a se assentar.
      </p>
      <ButtonLink href="/desafio" variant="secondary">
        Ver missões disponíveis
      </ButtonLink>
    </Card>
  );
}

function MissionBody({ mission, data }: { mission: Mission; data: UserData }) {
  const [quick, setQuick] = useState(() => prefersQuickVersion(data.quiz, mission));
  const strategy = mission.strategyId ? getGuideItem(mission.strategyId) : undefined;

  return (
    <>
      <section aria-labelledby="por-que" className="rounded-card bg-sand/60 p-5">
        <h2 id="por-que" className="text-sm font-semibold text-forest">
          Por que essa missão
        </h2>
        <p className="mt-1.5 leading-relaxed text-ink">{mission.why}</p>
      </section>

      <section aria-labelledby="como-fazer">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="como-fazer" className="text-lg font-semibold text-ink">
            Como fazer
          </h2>
          <div role="group" aria-label="Versão da missão" className="inline-flex rounded-lg border border-line bg-white p-1">
            {[
              { v: false, label: "Completa" },
              { v: true, label: "Rápida" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={quick === o.v}
                onClick={() => setQuick(o.v)}
                className={cn("h-8 rounded-md px-3 text-sm font-semibold transition-colors", quick === o.v ? "bg-forest text-paper" : "text-muted hover:text-ink")}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {quick ? (
          <Card className="p-5">
            <p className="text-xs font-semibold text-muted">Versão rápida · poucos minutos</p>
            <p className="mt-1.5 text-[1.0625rem] leading-relaxed text-ink">{mission.quickVersion}</p>
          </Card>
        ) : (
          <ol className="grid gap-2.5">
            {mission.steps.map((s, i) => (
              <li key={i} className="flex gap-3.5 rounded-card border border-line bg-white p-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fresh-100 text-sm font-bold text-forest">{i + 1}</span>
                <span className="pt-0.5 leading-relaxed text-ink">{s}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {strategy && <StrategyCard id={strategy.id} title={strategy.title} howTo={strategy.howTo}/>}
    </>
  );
}

function StrategyCard({ id, title, howTo }: { id: string; title: string; howTo: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold text-muted">Estratégia relacionada</p>
      <p className="mt-1 font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{howTo}</p>
      <SaveStrategyButton strategyId={id} title={title} className="mt-4" />
    </Card>
  );
}

function CompletionForm({ mission, onComplete }: { mission: Mission; onComplete: (input: { feeling: MissionFeeling; reflection: string | null }) => Promise<string | null> }) {
  const [feeling, setFeeling] = useState<MissionFeeling | null>(null);
  const [reflection, setReflection] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = missionCompletionSchema.safeParse({ day: mission.day, feeling: feeling ?? undefined, reflection });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const err = await onComplete({ feeling: parsed.data.feeling, reflection: parsed.data.reflection });
    if (err) {
      setErrors({ _form: err });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-card border border-forest/25 bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold text-ink">Concluir a missão</h2>
      <p className="mt-1 text-sm text-muted">Fez a versão completa ou a rápida? As duas valem.</p>

      <fieldset className="mt-5" aria-describedby={errors.feeling ? "erro-sentimento" : undefined}>
        <legend className="mb-2 text-sm font-semibold text-ink">Como foi?</legend>
        <div className="grid grid-cols-3 gap-2">
          {FEELINGS.map((f) => (
            <label
              key={f.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-sm font-semibold transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest has-[:focus-visible]:ring-offset-2",
                feeling === f.value ? "border-forest bg-fresh-50 text-forest-900" : "border-line text-ink hover:border-forest/35",
              )}
            >
              <input type="radio" name="feeling" value={f.value} checked={feeling === f.value} onChange={() => setFeeling(f.value)} className="sr-only" />
              {f.label}
            </label>
          ))}
        </div>
        {errors.feeling && (
          <p id="erro-sentimento" className="mt-2 text-sm text-danger">
            {errors.feeling}
          </p>
        )}
      </fieldset>

      <TextArea
        className="mt-5"
        label={mission.reflectionPrompt}
        hint="Opcional · escrever uma reflexão vale +20 XP"
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        maxLength={600}
        error={errors.reflection}
        placeholder="Escreva com suas palavras…"
      />

      {errors._form && <Notice tone="error" className="mt-4">{errors._form}</Notice>}

      <Button type="submit" size="lg" loading={busy} className="mt-5 w-full" icon={<CircleCheck className="size-4" aria-hidden />}>
        Concluir missão
      </Button>
    </form>
  );
}

function CelebrationPanel({ c }: { c: Celebration }) {
  return (
    <section aria-live="polite" className="animate-pop rounded-card border border-fresh/40 bg-fresh-50 p-6 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-forest text-paper">
        <Sparkles className="size-6" aria-hidden />
      </span>
      <h2 className="font-display mt-4 text-2xl font-semibold text-forest">Missão concluída</h2>
      <p className="mt-1 text-3xl font-bold text-forest tabular-nums">+{c.xp} XP</p>
      <p className="mx-auto mt-2 max-w-sm text-muted">Cada missão é um passo. O que importa é o caminho, não a perfeição.</p>

      {(c.levelUp || c.achievements.length > 0) && (
        <ul className="mx-auto mt-6 grid max-w-sm gap-2 text-left">
          {c.levelUp && (
            <li className="flex items-center gap-3 rounded-lg bg-white p-3">
              <TrendingUp className="size-5 shrink-0 text-forest" aria-hidden />
              <span className="text-sm">
                Novo nível: <strong>{c.levelUp}</strong>
              </span>
            </li>
          )}
          {c.achievements.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg bg-white p-3">
              <Award className="size-5 shrink-0 text-forest" aria-hidden />
              <span className="text-sm">
                Conquista: <strong>{a.title}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-7 grid gap-2 sm:flex sm:justify-center">
        {c.nextDay ? (
          <ButtonLink href={`/desafio/${c.nextDay}`} size="lg" icon={<ArrowRight className="size-4" aria-hidden />}>
            Ir para o Dia {c.nextDay}
          </ButtonLink>
        ) : null}
        <ButtonLink href="/inicio" variant={c.nextDay ? "secondary" : "primary"} size="lg">
          Voltar ao início
        </ButtonLink>
      </div>
    </section>
  );
}
