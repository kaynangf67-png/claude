import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "../forms";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-lg font-semibold">Criar conta</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Você criará sua organização no próximo passo.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta? <Link href="/login" className="text-accent hover:underline">Entrar</Link>
      </p>
    </>
  );
}
