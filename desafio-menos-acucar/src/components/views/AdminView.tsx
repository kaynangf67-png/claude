"use client";

import { Lock, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useChallenge } from "@/components/app/useChallenge";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { CONTACT_TOPICS, FEEDBACK_STAGES, type FeedbackStage } from "@/domain/feedback";
import { optionLabel } from "@/domain/quiz";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import type { AdminFeedbackRow, AdminMetrics } from "@/services/backend";

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

const CHOICE_LABELS: Record<string, string> = Object.fromEntries(
  [...Object.values(FEEDBACK_STAGES).flatMap((s) => s.questions.flatMap((q) => q.options ?? [])), ...CONTACT_TOPICS].map((o) => [o.value, o.label]),
);
const QUESTION_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(FEEDBACK_STAGES).flatMap((s) => s.questions.map((q) => [q.key, q.label])),
);
const STAGE_LABELS: Record<FeedbackStage, string> = { inicial: "Inicial", dia7: "Dia 7", dia21: "Dia 21", geral: "Mensagens" };

export function AdminView() {
  const { backend } = useChallenge();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [rows, setRows] = useState<AdminFeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedbackStage | null>(null);

  const load = useCallback(async () => {
    if (!backend) return;
    setLoading(true);
    const [m, f] = await Promise.all([backend.adminMetrics(), backend.adminFeedback(null)]);
    if (!m.ok) setError(m.error);
    else if (!f.ok) setError(f.error);
    else {
      setMetrics(m.data);
      setRows(f.data);
      setError(null);
    }
    setLoading(false);
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !metrics && !error) return <PageLoading label="Carregando métricas…" />;
  if (error || !metrics) {
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <Lock className="size-6 text-muted" aria-hidden />
        <h1 className="text-lg font-semibold">Painel do fundador</h1>
        <p className="text-muted">{error ?? "Não foi possível carregar."}</p>
      </Card>
    );
  }

  const m = metrics;
  const funnel: { label: string; hint: string; n: number }[] = [
    { label: "Cadastrados", hint: "criaram conta", n: m.registered },
    { label: "Iniciaram", hint: "concluíram o questionário", n: m.started },
    { label: "Fizeram 1+ missão", hint: "concluíram pelo menos uma", n: m.completed_one },
    { label: "Voltaram", hint: "missões em 2 ou mais dias diferentes", n: m.returned },
    { label: "Chegaram ao Dia 7", hint: "concluíram a missão do Dia 7", n: m.reached_day7 },
    { label: "Concluíram", hint: "fizeram as 21 missões", n: m.completed_21 },
  ];
  const maxDay = Math.max(1, ...m.by_day.map((d) => d.completed));
  const visible = filter ? rows.filter((r) => r.stage === filter) : rows;
  const sortedEntries = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-leaf">Primeira Turma</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forest">Painel do fundador</h1>
          <p className="mt-1 text-sm text-muted">
            Dados reais do banco, atualizados em {new Date(m.generated_at).toLocaleString("pt-BR")}. Administradores não entram nas contagens.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading} icon={<RotateCcw className="size-4" aria-hidden />}>
          Atualizar
        </Button>
      </header>

      {m.registered === 0 && (
        <Card className="p-5 text-sm text-muted">Ainda não há participantes cadastrados. Os números aparecem assim que alguém se inscrever.</Card>
      )}

      <section aria-labelledby="funil">
        <SectionTitle id="funil" title="Participação" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {funnel.map((f, i) => (
            <Card key={f.label} className="p-4">
              <p className="text-xs font-semibold text-muted">{f.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{f.n}</p>
              <p className="mt-1 text-xs text-muted">
                {f.hint}
                {i > 0 && ` · ${pct(f.n, m.registered)} dos cadastrados`}
              </p>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {m.marketing_opt_in} de {m.registered} aceitaram receber novidades por e-mail.
        </p>
      </section>

      <section aria-labelledby="por-dia">
        <SectionTitle id="por-dia" title="Conclusões por missão" />
        <Card className="p-4">
          <ol className="grid gap-1.5">
            {m.by_day.map((d) => (
              <li key={d.day} className="grid grid-cols-[3.25rem_1fr_4.5rem] items-center gap-2 text-sm">
                <span className="text-muted">Dia {d.day}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-sand" aria-hidden>
                  <span className="block h-full rounded-full bg-forest" style={{ width: `${(d.completed / maxDay) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">
                  {d.completed} <span className="text-xs text-muted">({pct(d.completed, m.started)})</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">Percentual sobre quem iniciou o desafio ({m.started}).</p>
        </Card>
      </section>

      <section aria-labelledby="pesquisas-adm">
        <SectionTitle id="pesquisas-adm" title="Pesquisas respondidas" />
        <div className="grid gap-3 sm:grid-cols-4">
          {(["inicial", "dia7", "dia21"] as const).map((s) => (
            <Card key={s} className="p-4">
              <p className="text-xs font-semibold text-muted">{STAGE_LABELS[s]}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {m.feedback[s].submitted}
                <span className="text-sm font-semibold text-muted"> / {m.feedback[s].eligible}</span>
              </p>
              <p className="text-xs text-muted">{pct(m.feedback[s].submitted, m.feedback[s].eligible)} de quem já podia responder</p>
            </Card>
          ))}
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted">Mensagens</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{m.feedback.geral.submitted}</p>
            <p className="text-xs text-muted">pelo “Fale com a gente”</p>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Distribution title="Maior dificuldade (questionário inicial)" entries={sortedEntries(m.difficulties).map(([k, n]) => [optionLabel("difficulty", k), n])} />
        <Distribution title="Objetivo principal" entries={sortedEntries(m.goals).map(([k, n]) => [optionLabel("goal", k), n])} />
        <Distribution title="Pagaria por uma versão melhorada? (Dia 21)" entries={sortedEntries(m.would_pay).map(([k, n]) => [CHOICE_LABELS[k] ?? k, n])} />
        <Distribution title="Recomendaria? (Dia 21)" entries={sortedEntries(m.would_recommend).map(([k, n]) => [CHOICE_LABELS[k] ?? k, n])} />
        <Distribution title="Facilidade de uso (Dia 7)" entries={sortedEntries(m.ease_day7).map(([k, n]) => [CHOICE_LABELS[k] ?? k, n])} />
      </div>

      <section aria-labelledby="respostas-adm">
        <SectionTitle id="respostas-adm" title="Respostas individuais" />
        <div role="group" aria-label="Filtrar por etapa" className="mb-3 flex flex-wrap gap-2">
          {([null, "inicial", "dia7", "dia21", "geral"] as const).map((s) => (
            <button
              key={s ?? "todas"}
              type="button"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
              className={cn(
                "h-9 rounded-lg border px-3 text-sm font-semibold",
                filter === s ? "border-forest bg-forest text-paper" : "border-line bg-white text-ink hover:border-forest/35",
              )}
            >
              {s ? STAGE_LABELS[s] : "Todas"}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <Card className="p-5 text-sm text-muted">Nenhuma resposta nesta etapa ainda.</Card>
        ) : (
          <div className="grid gap-3">
            {visible.map((r) => (
              <Card key={r.id} className="p-4">
                <p className="text-xs text-muted">
                  {r.first_name} · {STAGE_LABELS[r.stage]} · {formatDateShort(r.created_at)}
                </p>
                {Object.keys(r.answers).length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Enviou sem responder nenhuma pergunta.</p>
                ) : (
                  <dl className="mt-2 grid gap-2 text-sm">
                    {Object.entries(r.answers).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-semibold text-muted">{QUESTION_LABELS[k] ?? (k === "assunto" ? "Assunto" : k === "mensagem" ? "Mensagem" : k)}</dt>
                        <dd className="whitespace-pre-wrap text-ink">{CHOICE_LABELS[v] ?? v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Só o primeiro nome aparece aqui. Não compartilhe respostas fora da equipe do produto.</p>
      </section>
    </div>
  );
}

function Distribution({ title, entries }: { title: string; entries: [string, number][] }) {
  const total = entries.reduce((a, [, n]) => a + n, 0);
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted">Sem respostas ainda.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {entries.map(([label, n]) => (
            <li key={label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span>{label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {n} · {pct(n, total)}
                </span>
              </div>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sand" aria-hidden>
                <span className="block h-full rounded-full bg-fresh" style={{ width: `${(n / total) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
