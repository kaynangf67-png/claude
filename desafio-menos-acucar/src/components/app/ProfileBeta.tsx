"use client";

import { CircleCheck, Clock, Send } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Checkbox, TextArea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import type { ChallengeView } from "@/domain/challengeView";
import { CONTACT_TOPICS, FEEDBACK_STAGES, FEEDBACK_TEXT_MAX, isStageOpen } from "@/domain/feedback";
import type { UserData } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import type { Backend } from "@/services";
import { contactSchema, fieldErrors } from "@/validation/schemas";

const OPENS_ON: Record<keyof typeof FEEDBACK_STAGES, string> = {
  inicial: "depois do questionário",
  dia7: "no Dia 7",
  dia21: "no Dia 21",
};

export function BetaAccessCard({ data, backend }: { data: UserData; backend: Backend }) {
  return (
    <Card className="grid gap-2 p-5 text-sm leading-relaxed">
      {backend.mode === "demo" ? (
        <p>
          <strong>Modo demonstração.</strong> Nenhum pagamento foi processado. Seus dados ficam só neste navegador e podem ser perdidos se você
          limpar os dados do site.
        </p>
      ) : data.access.active ? (
        <>
          <p>
            <strong>Primeira Turma · acesso gratuito.</strong> Você participa do beta do Desafio Menos Açúcar. Nenhum pagamento foi feito nem é
            necessário.
          </p>
          <p className="text-muted">
            É uma versão inicial: algumas partes ainda vão mudar, e sua opinião ajuda a decidir o quê.
          </p>
        </>
      ) : (
        <p>
          <strong>Sem acesso ativo.</strong> Esta conta não tem acesso ao desafio no momento.
        </p>
      )}
    </Card>
  );
}

export function MarketingConsent({ data, backend, refresh }: { data: UserData; backend: Backend; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle(v: boolean) {
    setBusy(true);
    setError(null);
    const res = await backend.setMarketingConsent(v);
    if (!res.ok) setError(res.error);
    await refresh();
    setBusy(false);
  }
  return (
    <section aria-labelledby="comunicacoes">
      <SectionTitle id="comunicacoes" title="Comunicações" />
      <Card className={cn("p-5", busy && "opacity-70")}>
        <Checkbox
          name="marketing"
          checked={data.profile.marketingOptIn}
          onChange={(v) => void toggle(v)}
          label={
            <>
              Quero receber por e-mail novidades sobre versões futuras do desafio.
              <span className="mt-1 block text-xs text-muted">Opcional. Ligar ou desligar não muda nada na sua participação.</span>
            </>
          }
        />
        {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      </Card>
    </section>
  );
}

export function SurveysCard({ data, view }: { data: UserData; view: ChallengeView }) {
  return (
    <section aria-labelledby="pesquisas">
      <SectionTitle id="pesquisas" title="Pesquisas da Primeira Turma" />
      <Card className="divide-y divide-line">
        {(Object.keys(FEEDBACK_STAGES) as (keyof typeof FEEDBACK_STAGES)[]).map((s) => {
          const done = data.feedback.find((f) => f.stage === s);
          const open = isStageOpen(s, view.unlockedDay, view.completedCount);
          return (
            <div key={s} className="flex items-center gap-3 px-4 py-3.5">
              {done ? <CircleCheck className="size-5 shrink-0 text-forest" aria-hidden /> : <Clock className="size-5 shrink-0 text-muted" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{FEEDBACK_STAGES[s].title}</p>
                <p className="text-xs text-muted">
                  {done ? `Respondida em ${formatDateShort(done.createdAt)}` : open ? "Disponível" : `Abre ${OPENS_ON[s]}`}
                </p>
              </div>
              {!done && open && (
                <ButtonLink href={`/feedback/${s}`} size="sm" variant="secondary">
                  Responder
                </ButtonLink>
              )}
            </div>
          );
        })}
      </Card>
    </section>
  );
}

export function ContactForm({ backend, refresh }: { backend: Backend; refresh: () => Promise<void> }) {
  const [assunto, setAssunto] = useState("sugestao");
  const [mensagem, setMensagem] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse({ assunto, mensagem });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    const res = await backend.submitFeedback("geral", parsed.data);
    setBusy(false);
    if (!res.ok) return setErrors({ _form: res.error });
    setSent(true);
    setMensagem("");
    await refresh();
  }

  return (
    <section aria-labelledby="contato" id="contato" className="scroll-mt-20">
      <SectionTitle id="contato-titulo" title="Fale com a gente" />
      <Card className="p-5">
        {sent ? (
          <div role="status" className="grid gap-3">
            <p className="flex items-center gap-2 font-semibold text-forest">
              <CircleCheck className="size-5" aria-hidden /> Mensagem enviada. Obrigado!
            </p>
            <p className="text-sm text-muted">O fundador lê todas as mensagens. Pedidos sobre seus dados são respondidos pelo e-mail da sua conta.</p>
            <Button variant="secondary" size="sm" className="w-fit" onClick={() => setSent(false)}>
              Enviar outra
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">Assunto</legend>
              <div className="flex flex-wrap gap-2">
                {CONTACT_TOPICS.map((t) => (
                  <label
                    key={t.value}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold transition-colors",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest has-[:focus-visible]:ring-offset-2",
                      assunto === t.value ? "border-forest bg-fresh-50 text-forest-900" : "border-line text-ink hover:border-forest/35",
                    )}
                  >
                    <input type="radio" name="assunto" value={t.value} checked={assunto === t.value} onChange={() => setAssunto(t.value)} className="sr-only" />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <TextArea
              label="Mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              maxLength={FEEDBACK_TEXT_MAX}
              error={errors.mensagem}
              hint={assunto === "privacidade" ? "Diga se quer acesso, correção ou exclusão dos seus dados." : "Sugestões, problemas, dúvidas: tudo ajuda."}
            />
            {errors._form && <Notice tone="error">{errors._form}</Notice>}
            <Button type="submit" loading={busy} className="w-fit" icon={<Send className="size-4" aria-hidden />}>
              Enviar mensagem
            </Button>
            <p className="text-xs text-muted">
              Veja como tratamos seus dados no{" "}
              <Link href="/privacidade" className="font-semibold text-forest underline">
                aviso de privacidade
              </Link>
              .
            </p>
          </form>
        )}
      </Card>
    </section>
  );
}
