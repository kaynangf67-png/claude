"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { Notice } from "@/components/ui/Notice";
import { fieldErrors, consentSchema } from "@/validation/schemas";
import { useSession } from "./SessionProvider";

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-1 py-8">
      <Logo compact />
      {children}
    </div>
  );
}

async function signOutAndLeave(signOut: () => Promise<void>) {
  await signOut();
  window.location.assign("/");
}

/** Contas criadas antes do aviso de privacidade aceitam aqui antes de continuar. */
export function ConsentGate() {
  const { backend, refresh } = useSession();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!backend) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = consentSchema.safeParse({ acceptTerms, marketingOptIn });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await backend!.acceptTerms(parsed.data.marketingOptIn);
    if (!res.ok) {
      setErrors({ _form: res.error });
      setBusy(false);
      return;
    }
    await refresh();
  }

  return (
    <GateShell>
      <div>
        <h1 className="font-display text-3xl font-semibold text-forest">Antes de continuar</h1>
        <p className="mt-2 text-muted">Atualizamos o aviso de privacidade para a Primeira Turma. Leia e confirme para seguir com o desafio.</p>
      </div>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {errors._form && <Notice tone="error">{errors._form}</Notice>}
        <div className="grid gap-3 rounded-lg border border-line bg-white p-4">
          <Checkbox
            name="acceptTerms"
            checked={acceptTerms}
            onChange={setAcceptTerms}
            error={errors.acceptTerms}
            label={
              <>
                Tenho 18 anos ou mais e li o{" "}
                <Link href="/privacidade" target="_blank" className="font-semibold text-forest underline underline-offset-2">
                  aviso de privacidade
                </Link>
                . Entendo que o desafio é educativo e não substitui orientação profissional.
              </>
            }
          />
          <Checkbox
            name="marketingOptIn"
            checked={marketingOptIn}
            onChange={setMarketingOptIn}
            label={<>Quero receber novidades sobre versões futuras (opcional).</>}
          />
        </div>
        <Button type="submit" size="lg" loading={busy} icon={<ShieldCheck className="size-4" aria-hidden />}>
          Confirmar e continuar
        </Button>
        <Button variant="ghost" onClick={() => void signOutAndLeave(() => backend.signOut())} icon={<LogOut className="size-4" aria-hidden />}>
          Sair
        </Button>
      </form>
    </GateShell>
  );
}

/** Conta sem acesso ativo (ex.: inscrições da Primeira Turma encerradas). */
export function NoAccess() {
  const { backend } = useSession();
  return (
    <GateShell>
      <div>
        <h1 className="font-display text-3xl font-semibold text-forest">Inscrições encerradas</h1>
        <p className="mt-2 leading-relaxed text-muted">
          Sua conta foi criada, mas as vagas gratuitas da Primeira Turma já foram preenchidas, então o desafio não está liberado para ela. Nada foi
          cobrado. Quando abrirmos uma nova turma, avisaremos quem pediu para receber novidades.
        </p>
      </div>
      {backend && (
        <Button variant="secondary" onClick={() => void signOutAndLeave(() => backend.signOut())} icon={<LogOut className="size-4" aria-hidden />}>
          Sair
        </Button>
      )}
    </GateShell>
  );
}
