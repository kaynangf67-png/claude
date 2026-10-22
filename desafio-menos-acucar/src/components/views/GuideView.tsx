"use client";

import { Clock, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { SaveStrategyButton } from "@/components/app/SaveStrategyButton";
import { useChallenge } from "@/components/app/useChallenge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { COST_LABELS, GUIDE_CATEGORY_LABELS, GUIDE_ITEMS, rankGuide } from "@/domain/guide";
import type { AlternativePreference } from "@/domain/types";
import { cn } from "@/lib/cn";

type Filter = "todas" | AlternativePreference;

export function GuideView() {
  const { data } = useChallenge();
  const [filter, setFilter] = useState<Filter>("todas");
  const ranked = useMemo(() => rankGuide(GUIDE_ITEMS, data?.quiz ?? null), [data?.quiz]);
  if (!data) return null;

  const items = filter === "todas" ? ranked : ranked.filter((g) => g.category === filter);
  const filters: Filter[] = ["todas", ...(Object.keys(GUIDE_CATEGORY_LABELS) as AlternativePreference[])];

  return (
    <div className="grid grid-cols-1 gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-forest">Guia de alternativas</h1>
        <p className="mt-1 leading-relaxed text-muted">
          Ideias práticas para testar. {data.quiz ? "A ordem leva em conta suas respostas do questionário." : ""} Nenhuma é obrigatória: fique com o que
          funcionar para você.
        </p>
      </header>

      <div role="group" aria-label="Filtrar por tipo" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "h-9 shrink-0 rounded-lg border px-3.5 text-sm font-semibold transition-colors",
              filter === f ? "border-forest bg-forest text-paper" : "border-line bg-white text-ink hover:border-forest/35",
            )}
          >
            {f === "todas" ? "Todas" : GUIDE_CATEGORY_LABELS[f]}
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {items.length} itens
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((g) => (
          <li key={g.id}>
            <Card className="flex h-full flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">{GUIDE_CATEGORY_LABELS[g.category]}</Badge>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Clock className="size-3.5" aria-hidden /> {g.minutes} min
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Wallet className="size-3.5" aria-hidden /> {COST_LABELS[g.cost]}
                </span>
              </div>
              <h2 className="mt-3 font-semibold text-ink">{g.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{g.description}</p>
              <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink">
                <span className="font-semibold">Como fazer: </span>
                {g.howTo}
              </p>
              <SaveStrategyButton strategyId={g.id} title={g.title} className="mt-auto pt-4" />
            </Card>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-muted">
        Conteúdo educativo. Se você tem alguma condição de saúde, restrição ou alergia alimentar, adapte as sugestões com orientação profissional.
      </p>
    </div>
  );
}
