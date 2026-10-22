import { Award, BookmarkCheck, Check, CircleCheck, Lock, NotebookPen, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ActivityItem } from "@/domain/challengeView";
import type { LevelInfo } from "@/domain/progress";
import type { UnlockedAchievement } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateShort, formatNumber } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";

export function XpCard({ xp, level }: { xp: number; level: LevelInfo }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Sparkles className="size-3.5 text-fresh" aria-hidden /> XP total
      </p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink tabular-nums">{formatNumber(xp)}</p>
      <ProgressBar
        value={level.percentToNext}
        tone="fresh"
        className="mt-3 h-1.5"
        label={level.next ? `Progresso até o nível ${level.next.name}` : "Nível máximo alcançado"}
      />
      <p className="mt-2 text-xs text-muted">
        Nível {level.current.level} · <span className="font-semibold text-ink">{level.current.name}</span>
        {level.next ? ` · faltam ${formatNumber(level.xpToNext)} XP para ${level.next.name}` : " · nível máximo"}
      </p>
    </Card>
  );
}

export function AchievementBadge({ a, compact }: { a: UnlockedAchievement; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3", a.unlocked ? "border-fresh/40 bg-fresh-50" : "border-line bg-white")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", a.unlocked ? "bg-forest text-paper" : "bg-sand text-muted")}>
        {a.unlocked ? <Award className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", a.unlocked ? "text-forest-900" : "text-ink")}>
          {a.title}
          <span className="sr-only">{a.unlocked ? " (conquistada)" : " (ainda não conquistada)"}</span>
        </p>
        {!compact && <p className="text-xs leading-snug text-muted">{a.description}</p>}
        {a.unlocked && a.unlockedAt && !compact && <p className="mt-0.5 text-[0.6875rem] text-muted">Em {formatDateShort(a.unlockedAt)}</p>}
      </div>
    </div>
  );
}

export function ActivityList({ items, limit }: { items: ActivityItem[]; limit?: number }) {
  const list = limit ? items.slice(0, limit) : items;
  if (list.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <NotebookPen className="size-6 text-muted" aria-hidden />
        <p className="font-semibold text-ink">Nada por aqui ainda</p>
        <p className="max-w-xs text-sm text-muted">Quando você concluir uma missão ou salvar uma estratégia, ela aparece aqui.</p>
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-line">
      {list.map((it) =>
        it.kind === "mission" ? (
          <Link key={`m-${it.mission.day}`} href={`/desafio/${it.mission.day}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper/60">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fresh-100 text-forest">
              <CircleCheck className="size-[1.125rem]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                Dia {it.mission.day} · {it.mission.title}
              </span>
              <span className="block text-xs text-muted">
                {formatDateShort(it.at)}
                {it.hasReflection && " · com reflexão"}
              </span>
            </span>
            <span className="text-xs font-semibold text-forest tabular-nums">+{it.xp} XP</span>
          </Link>
        ) : (
          <Link key={`s-${it.item.id}`} href="/progresso#estrategias" className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper/60">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sand text-forest">
              <BookmarkCheck className="size-[1.125rem]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">Estratégia salva: {it.item.title}</span>
              <span className="block text-xs text-muted">{formatDateShort(it.at)}</span>
            </span>
          </Link>
        ),
      )}
    </Card>
  );
}

export function DayDot({ day, status, current }: { day: number; status: "concluida" | "disponivel" | "bloqueada"; current?: boolean }) {
  const label = `Dia ${day}: ${status === "concluida" ? "concluído" : status === "disponivel" ? "disponível" : "ainda não liberado"}`;
  const cls = cn(
    "grid aspect-square place-items-center rounded-lg text-sm font-semibold transition-colors",
    status === "concluida" && "bg-fresh text-white hover:bg-[#4b9a6b]",
    status === "disponivel" && "border border-forest/45 bg-white text-forest hover:bg-fresh-50",
    status === "bloqueada" && "bg-sand text-muted/70",
    current && "ring-2 ring-forest ring-offset-2 ring-offset-paper",
  );
  const content = status === "concluida" ? <Check className="size-4" strokeWidth={3} aria-hidden /> : status === "bloqueada" ? <Lock className="size-3.5" aria-hidden /> : day;
  if (status === "bloqueada") {
    return (
      <span className={cls} aria-label={label} role="img">
        {content}
      </span>
    );
  }
  return (
    <Link href={`/desafio/${day}`} className={cls} aria-label={label}>
      {content}
    </Link>
  );
}
