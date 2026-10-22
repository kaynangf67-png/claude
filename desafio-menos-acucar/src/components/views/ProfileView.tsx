"use client";

import { FastForward, LogOut, Pencil, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useChallenge } from "@/components/app/useChallenge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { optionLabel } from "@/domain/quiz";
import { fieldErrors, profileUpdateSchema } from "@/validation/schemas";

export function ProfileView() {
  const { data, backend, refresh, view } = useChallenge();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!data || !backend || !view) return null;

  const q = data.quiz;
  const editing = name !== null;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!backend) return;
    const parsed = profileUpdateSchema.safeParse({ displayName: name });
    if (!parsed.success) {
      setNameError(fieldErrors(parsed.error).displayName ?? "Nome inválido.");
      return;
    }
    setBusy("name");
    const res = await backend.updateDisplayName(parsed.data.displayName);
    setBusy(null);
    if (!res.ok) return setNameError(res.error);
    setName(null);
    setNameError(null);
    setSaved(true);
    await refresh();
  }

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setBusy(key);
    setError(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) return setError(res.error ?? "Algo deu errado.");
    await refresh();
    after?.();
  }

  async function signOut() {
    if (!backend) return;
    setBusy("out");
    await backend.signOut();
    // Recarrega a página para limpar todo o estado em memória da sessão.
    window.location.assign("/");
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-forest">Perfil</h1>
      </header>

      {error && <Notice tone="error">{error}</Notice>}

      <section aria-labelledby="conta">
        <SectionTitle id="conta" title="Conta" />
        <Card className="p-5">
          {editing ? (
            <form onSubmit={saveName} noValidate className="grid gap-3">
              <TextField label="Nome" value={name ?? ""} onChange={(e) => setName(e.target.value)} error={nameError ?? undefined} autoFocus />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={busy === "name"}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => (setName(null), setNameError(null))}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Nome</p>
                <p className="font-semibold">{data.profile.displayName}</p>
                <p className="mt-3 text-xs text-muted">E-mail</p>
                <p className="font-semibold break-all">{data.profile.email}</p>
              </div>
              {!data.profile.isSample && (
                <Button variant="ghost" size="sm" onClick={() => (setName(data.profile.displayName), setSaved(false))} icon={<Pencil className="size-4" aria-hidden />}>
                  Editar
                </Button>
              )}
            </div>
          )}
          {saved && !editing && (
            <p role="status" className="mt-3 text-sm text-forest">
              Nome atualizado.
            </p>
          )}
        </Card>
      </section>

      <section aria-labelledby="acesso">
        <SectionTitle id="acesso" title="Acesso" />
        <Card className="p-5 text-sm leading-relaxed">
          {backend.mode === "demo" ? (
            <p>
              <strong>Modo demonstração.</strong> Nenhum pagamento foi processado. Seus dados ficam só neste navegador e podem ser perdidos se você
              limpar os dados do site.
            </p>
          ) : (
            <p>
              <strong>Acesso de desenvolvimento.</strong> A cobrança ainda não está ativa nesta versão, então nenhum pagamento foi feito ou é
              necessário por enquanto.
            </p>
          )}
        </Card>
      </section>

      <section aria-labelledby="respostas">
        <SectionTitle id="respostas" title="Suas respostas" />
        <Card className="p-5">
          {q ? (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Objetivo</dt>
                <dd className="font-semibold">{optionLabel("goal", q.goal)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Quando a vontade aparece</dt>
                <dd className="font-semibold">{q.moments.map((m) => optionLabel("moments", m)).join(" · ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Maior dificuldade</dt>
                <dd className="font-semibold">{optionLabel("difficulty", q.difficulty)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Tempo por dia</dt>
                <dd className="font-semibold">{optionLabel("dailyTime", q.dailyTime)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted">Você ainda não respondeu o questionário.</p>
          )}
          <ButtonLink href="/onboarding?refazer=1" variant="secondary" size="sm" className="mt-4">
            Refazer questionário
          </ButtonLink>
          <p className="mt-2 text-xs text-muted">Refazer muda as dicas e a ordem do guia. Seu progresso continua o mesmo.</p>
        </Card>
      </section>

      {backend.demoTools && (
        <section aria-labelledby="demo">
          <SectionTitle id="demo" title="Ferramentas de demonstração" />
          <Card className="p-5">
            <p className="text-sm text-muted">
              Só existem no modo demonstração, para testar o desafio sem esperar 21 dias. Hoje você está no dia {view.calendarDay} do calendário.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              loading={busy === "advance"}
              onClick={() => run("advance", () => backend.demoTools!.advanceOneDay())}
              icon={<FastForward className="size-4" aria-hidden />}
            >
              Simular a passagem de um dia
            </Button>
          </Card>
        </section>
      )}

      <section aria-labelledby="zona">
        <SectionTitle id="zona" title="Recomeçar ou sair" />
        <Card className="grid gap-4 p-5">
          {confirmReset ? (
            <div className="grid gap-3">
              <Notice tone="error" title="Recomeçar do zero?">
                Isso apaga suas missões concluídas, reflexões, estratégias salvas e respostas do questionário. Não dá para desfazer.
              </Notice>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  loading={busy === "reset"}
                  onClick={() => run("reset", () => backend.resetChallenge(), () => router.push("/onboarding"))}
                >
                  Sim, apagar e recomeçar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" size="sm" className="w-fit" onClick={() => setConfirmReset(true)} icon={<RotateCcw className="size-4" aria-hidden />}>
              Recomeçar o desafio
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-fit" loading={busy === "out"} onClick={signOut} icon={<LogOut className="size-4" aria-hidden />}>
            Sair da conta
          </Button>
        </Card>
      </section>
    </div>
  );
}
