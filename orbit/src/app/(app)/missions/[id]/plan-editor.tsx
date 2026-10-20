"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/client";
import type { MissionPlan } from "@/lib/domain/types";
import { savePlanAction } from "../../actions";

interface ToolOption {
  id: string;
  name: string;
  description: string;
  example: Record<string, unknown>;
}

interface DraftTask {
  key: string;
  title: string;
  description: string;
  tool: string;
  paramsText: string;
  depends: string;
  expected_outcome: string;
}

function toDraft(plan: MissionPlan | null, tools: ToolOption[]): DraftTask[] {
  if (plan?.tasks.length) {
    return plan.tasks.map((t) => ({ key: t.key, title: t.title, description: t.description, tool: t.tool, paramsText: JSON.stringify(t.params, null, 2), depends: t.depends_on.join(", "), expected_outcome: t.expected_outcome }));
  }
  const tool = tools[0]!;
  return [{ key: "t1", title: "", description: "", tool: tool.id, paramsText: JSON.stringify(tool.example, null, 2), depends: "", expected_outcome: "" }];
}

export function PlanEditor({ missionId, objective, plan, tools }: { missionId: string; objective: string; plan: MissionPlan | null; tools: ToolOption[] }) {
  const [state, action, pending] = useActionState(savePlanAction, null);
  const [summary, setSummary] = useState(plan?.summary ?? "");
  const [criteria, setCriteria] = useState((plan?.success_criteria ?? []).join("\n"));
  const [tasks, setTasks] = useState<DraftTask[]>(() => toDraft(plan, tools));

  const { json, error } = useMemo(() => {
    try {
      const out: MissionPlan = {
        objective,
        summary,
        required_integrations: plan?.required_integrations ?? [],
        assumptions: plan?.assumptions ?? [],
        risks: plan?.risks ?? [],
        success_criteria: criteria.split("\n").map((s) => s.trim()).filter(Boolean),
        tasks: tasks.map((t) => ({
          key: t.key,
          title: t.title,
          description: t.description,
          agent_role: "operator",
          tool: t.tool,
          params: JSON.parse(t.paramsText || "{}"),
          depends_on: t.depends.split(/[\s,]+/).filter(Boolean),
          expected_outcome: t.expected_outcome,
          risk_hint: "low",
          approval_hint: false,
        })),
      };
      return { json: JSON.stringify(out), error: null as string | null };
    } catch {
      return { json: "", error: "Há parâmetros com JSON inválido." };
    }
  }, [objective, summary, criteria, tasks, plan]);

  const update = (i: number, patch: Partial<DraftTask>) => setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const nextKey = () => {
    let n = tasks.length + 1;
    while (tasks.some((t) => t.key === `t${n}`)) n++;
    return `t${n}`;
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        // Submit manually: React's automatic post-action form reset would
        // desynchronise the controlled selects from editor state.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="mission_id" value={missionId} />
      <input type="hidden" name="plan" value={json} />
      <div>
        <label htmlFor="summary" className="label">Resumo do plano</label>
        <textarea id="summary" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} className="input" maxLength={4000} />
      </div>
      <ol className="space-y-4">
        {tasks.map((t, i) => {
          const tool = tools.find((x) => x.id === t.tool);
          return (
            <li key={i} className="rounded-lg border border-border bg-surface-2/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs text-accent">{t.key}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTasks((ts) => ts.filter((_, j) => j !== i))} disabled={tasks.length === 1} aria-label={`Remover tarefa ${t.key}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor={`title-${i}`}>Título</label>
                  <input id={`title-${i}`} className="input" value={t.title} onChange={(e) => update(i, { title: e.target.value })} maxLength={140} />
                </div>
                <div>
                  <label className="label" htmlFor={`tool-${i}`}>Ferramenta</label>
                  <select
                    id={`tool-${i}`}
                    className="input"
                    value={t.tool}
                    onChange={(e) => {
                      const nt = tools.find((x) => x.id === e.target.value);
                      update(i, { tool: e.target.value, paramsText: JSON.stringify(nt?.example ?? {}, null, 2) });
                    }}
                  >
                    {tools.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  {tool ? <p className="hint">{tool.description}</p> : null}
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor={`params-${i}`}>Parâmetros (JSON)</label>
                  <textarea id={`params-${i}`} rows={5} className="input font-mono text-xs" value={t.paramsText} onChange={(e) => update(i, { paramsText: e.target.value })} spellCheck={false} />
                </div>
                <div>
                  <label className="label" htmlFor={`deps-${i}`}>Depende de</label>
                  <input id={`deps-${i}`} className="input" value={t.depends} onChange={(e) => update(i, { depends: e.target.value })} placeholder="t1, t2" />
                </div>
                <div>
                  <label className="label" htmlFor={`exp-${i}`}>Resultado esperado</label>
                  <input id={`exp-${i}`} className="input" value={t.expected_outcome} onChange={(e) => update(i, { expected_outcome: e.target.value })} maxLength={1000} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button type="button" variant="secondary" size="sm" disabled={tasks.length >= 12} onClick={() => setTasks((ts) => [...ts, { key: nextKey(), title: "", description: "", tool: tools[0]!.id, paramsText: JSON.stringify(tools[0]!.example, null, 2), depends: "", expected_outcome: "" }])}>
        <Plus className="h-4 w-4" aria-hidden /> Adicionar tarefa
      </Button>
      <div>
        <label htmlFor="criteria" className="label">Critérios de sucesso (um por linha)</label>
        <textarea id="criteria" rows={3} value={criteria} onChange={(e) => setCriteria(e.target.value)} className="input" />
      </div>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <FormMessage state={state} />
      <Button type="submit" disabled={Boolean(error) || pending} aria-busy={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Validando…" : "Salvar e validar plano"}
      </Button>
    </form>
  );
}
