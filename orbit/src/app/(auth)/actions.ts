"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/db/clients";
import { env, supabaseConfigured } from "@/lib/env";
import type { ActionState } from "@/components/ui/client";

const email = z.email("Informe um e-mail válido").max(200);
const password = z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72);

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

function notConfigured(): ActionState {
  return { ok: false, message: "A autenticação não está configurada neste servidor. Veja /setup." };
}

export async function signInAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  if (!supabaseConfigured()) return notConfigured();
  const parsed = z.object({ email, password: z.string().min(1, "Informe a senha") }).safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const db = await createUserClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, message: error.code === "email_not_confirmed" ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos." };
  }
  redirect(safeNext(fd.get("next")));
}

export async function signUpAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  if (!supabaseConfigured()) return notConfigured();
  const parsed = z
    .object({ full_name: z.string().trim().min(2, "Informe seu nome").max(120), email, password })
    .safeParse({ full_name: fd.get("full_name"), email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const db = await createUserClient();
  const { data, error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: `${env().NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding` },
  });
  if (error) return { ok: false, message: error.code === "user_already_exists" ? "Já existe uma conta com este e-mail." : `Não foi possível criar a conta: ${error.message}` };
  if (!data.session) return { ok: true, message: "Conta criada. Enviamos um link de confirmação para o seu e-mail." };
  redirect("/onboarding");
}

export async function requestPasswordResetAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  if (!supabaseConfigured()) return notConfigured();
  const parsed = email.safeParse(fd.get("email"));
  if (!parsed.success) return { ok: false, fieldErrors: { email: ["Informe um e-mail válido"] } };
  const db = await createUserClient();
  await db.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${env().NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password` });
  // Same answer whether or not the account exists.
  return { ok: true, message: "Se houver uma conta com este e-mail, você receberá um link para redefinir a senha." };
}

export async function updatePasswordAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  if (!supabaseConfigured()) return notConfigured();
  const parsed = password.safeParse(fd.get("password"));
  if (!parsed.success) return { ok: false, fieldErrors: { password: [parsed.error.issues[0]!.message] } };
  const db = await createUserClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return { ok: false, message: "O link expirou. Solicite uma nova redefinição." };
  const { error } = await db.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, message: `Não foi possível alterar a senha: ${error.message}` };
  redirect("/dashboard");
}

export async function signOutAction() {
  if (supabaseConfigured()) {
    const db = await createUserClient();
    await db.auth.signOut();
  }
  redirect("/login");
}
