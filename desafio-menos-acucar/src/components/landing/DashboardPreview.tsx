import { Check, Clock, Flame, Lock, Sparkles } from "lucide-react";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";

/**
 * Ilustração estática da interface do painel. Os números são de exemplo e estão
 * rotulados como tal — não representam resultados de usuários reais.
 */
export function DashboardPreview() {
  const days = Array.from({ length: 21 }, (_, i) => i + 1);
  const done = new Set([1, 2, 4, 5]);
  return (
    <figure className="relative mx-auto w-full max-w-[380px]">
      <div className="rounded-[1.75rem] border border-line bg-paper p-2.5 shadow-raised">
        <div className="overflow-hidden rounded-[1.25rem] border border-line/70 bg-paper" aria-hidden="true">
          <div className="flex items-center justify-between px-4 pt-4">
            <div>
              <p className="text-xs text-muted">Boa tarde,</p>
              <p className="font-display text-xl font-semibold text-forest">Visitante</p>
            </div>
            <span className="rounded-md bg-amber-50 px-2 py-1 text-[0.6875rem] font-semibold text-[#6b4510]">Dados de exemplo</span>
          </div>

          <div className="mx-4 mt-4 flex items-center gap-4 rounded-xl bg-forest p-4 text-paper">
            <ProgressRing value={19} size={72} stroke={7} label="">
              <span className="text-center leading-none">
                <span className="block text-lg font-bold">6</span>
                <span className="text-[0.625rem] text-paper/70">de 21</span>
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold tracking-wider text-paper/70 uppercase">Missão de hoje</p>
              <p className="font-display mt-0.5 text-lg leading-snug">A regra dos 10 minutos</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-paper/75">
                <Clock className="size-3.5" /> 10 min · versão rápida em 2 min
              </p>
            </div>
          </div>

          <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-line bg-white p-3">
              <p className="flex items-center gap-1 text-[0.6875rem] text-muted">
                <Sparkles className="size-3.5 text-fresh" /> XP
              </p>
              <p className="mt-1 text-base font-bold">460</p>
              <ProgressBar value={40} label="" tone="fresh" className="mt-2 h-1.5" />
            </div>
            <div className="rounded-xl border border-line bg-white p-3">
              <p className="flex items-center gap-1 text-[0.6875rem] text-muted">
                <Flame className="size-3.5 text-fresh" /> Nível
              </p>
              <p className="mt-1 text-base font-bold">Broto</p>
              <p className="mt-1.5 text-[0.6875rem] text-muted">240 XP para Raiz</p>
            </div>
          </div>

          <div className="mx-4 mt-3 mb-4 rounded-xl border border-line bg-white p-3">
            <p className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">Seu caminho</p>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {days.map((d) => (
                <span
                  key={d}
                  className={
                    done.has(d)
                      ? "grid aspect-square place-items-center rounded-md bg-fresh text-white"
                      : d <= 6
                        ? "grid aspect-square place-items-center rounded-md border border-forest/40 text-[0.625rem] font-semibold text-forest"
                        : "grid aspect-square place-items-center rounded-md bg-sand text-muted/60"
                  }
                >
                  {done.has(d) ? <Check className="size-3" strokeWidth={3} /> : d <= 6 ? d : <Lock className="size-2.5" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">Ilustração da interface com dados de exemplo.</figcaption>
    </figure>
  );
}
