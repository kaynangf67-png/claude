import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/app/AuthShell";
import { SignUpForm } from "@/components/app/AuthForms";
import { DemoModeNotice } from "@/components/app/DemoModeNotice";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Comece seu desafio"
      subtitle="Crie sua conta para salvar seu progresso. Depois, um questionário rápido personaliza as missões."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/entrar" className="font-semibold text-forest hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <DemoModeNotice />
      <SignUpForm />
    </AuthShell>
  );
}
