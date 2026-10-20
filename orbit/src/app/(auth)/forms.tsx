"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/client";
import { requestPasswordResetAction, signInAction, signUpAction, updatePasswordAction } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className="label">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        <FieldError state={state} name="email" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label">Senha</label>
          <Link href="/forgot-password" className="mb-1.5 text-xs text-accent hover:underline">Esqueci a senha</Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        <FieldError state={state} name="password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signUpAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="full_name" className="label">Nome</label>
        <input id="full_name" name="full_name" autoComplete="name" required className="input" />
        <FieldError state={state} name="full_name" />
      </div>
      <div>
        <label htmlFor="email" className="label">E-mail de trabalho</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        <FieldError state={state} name="email" />
      </div>
      <div>
        <label htmlFor="password" className="label">Senha</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        <p className="hint">Mínimo de 8 caracteres.</p>
        <FieldError state={state} name="password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Criando…">Criar conta</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordResetAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="label">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        <FieldError state={state} name="email" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Enviando…">Enviar link</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(updatePasswordAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="password" className="label">Nova senha</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        <FieldError state={state} name="password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  );
}
