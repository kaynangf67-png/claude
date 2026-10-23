"use client";

import { Eye, EyeOff, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { fieldErrors, signInSchema, signUpSchema } from "@/validation/schemas";
import { useSession } from "./SessionProvider";

/** Só aceita caminhos internos, para o parâmetro ?voltar= não virar open redirect. */
function safeReturnPath(fallback: string): string {
  const v = new URLSearchParams(window.location.search).get("voltar");
  return v && v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}

function PasswordField({ error, autoComplete, value, onChange, hint }: { error?: string; autoComplete: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextField
        label="Senha"
        name="password"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        hint={hint}
        className="[&_input]:pr-12"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-[2.05rem] right-1.5 grid size-9 place-items-center rounded-md text-muted hover:text-forest"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

export function SignUpForm() {
  const { backend, refresh } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!backend) return;
    const parsed = signUpSchema.safeParse({ ...form, acceptTerms, marketingOptIn });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await backend.signUp(parsed.data);
    if (!res.ok) {
      setErrors({ _form: res.error });
      setBusy(false);
      return;
    }
    if (res.data.needsEmailConfirmation) {
      setSentTo(parsed.data.email);
      setBusy(false);
      return;
    }
    await refresh();
    router.push("/onboarding");
  }

  if (sentTo) {
    return (
      <div className="rounded-card border border-line bg-white p-6 text-center">
        <MailCheck className="mx-auto size-8 text-forest" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">Confira seu e-mail</h2>
        <p className="mt-2 text-muted">
          Enviamos um link de confirmação para <strong className="text-ink">{sentTo}</strong>. Depois de confirmar, você volta direto para o
          questionário inicial.
        </p>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {errors._form && <Notice tone="error">{errors._form}</Notice>}
      <TextField
        label="Como podemos te chamar?"
        name="displayName"
        autoComplete="given-name"
        value={form.displayName}
        onChange={(e) => set("displayName")(e.target.value)}
        error={errors.displayName}
        placeholder="Seu primeiro nome"
      />
      <TextField
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={form.email}
        onChange={(e) => set("email")(e.target.value)}
        error={errors.email}
        placeholder="voce@email.com"
      />
      <PasswordField autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="Pelo menos 8 caracteres." />
      <fieldset className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <legend className="sr-only">Consentimentos</legend>
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
              . Entendo que o desafio é educativo e não substitui orientação profissional. <span className="text-muted">(obrigatório)</span>
            </>
          }
        />
        <Checkbox
          name="marketingOptIn"
          checked={marketingOptIn}
          onChange={setMarketingOptIn}
          label={
            <>
              Quero receber por e-mail novidades sobre versões futuras do desafio. <span className="text-muted">(opcional, não muda nada na sua participação)</span>
            </>
          }
        />
      </fieldset>
      <Button type="submit" size="lg" loading={busy} disabled={!backend} className="mt-1 w-full">
        Entrar na Primeira Turma
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted">
        Pedimos só nome e e-mail. Nada de telefone, peso ou dados de saúde.
      </p>
    </form>
  );
}

export function SignInForm({ notice }: { notice?: string }) {
  const { backend, refresh } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!backend) return;
    const parsed = signInSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await backend.signIn(parsed.data);
    if (!res.ok) {
      setErrors({ _form: res.error });
      setBusy(false);
      return;
    }
    await refresh();
    router.push(safeReturnPath("/inicio"));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {notice && !errors._form && <Notice tone="info">{notice}</Notice>}
      {errors._form && <Notice tone="error">{errors._form}</Notice>}
      <TextField
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        error={errors.email}
        placeholder="voce@email.com"
      />
      <PasswordField autoComplete="current-password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} error={errors.password} />
      <Button type="submit" size="lg" loading={busy} disabled={!backend} className="mt-1 w-full">
        Entrar
      </Button>
    </form>
  );
}
