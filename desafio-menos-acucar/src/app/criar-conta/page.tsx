import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/app/AuthShell";
import { SignUpForm } from "@/components/app/AuthForms";
import { DemoModeNotice } from "@/components/app/DemoModeNotice";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Entre na Primeira Turma"
      subtitle="Acesso gratuito aos 21 dias, em troca da sua opinião. Crie sua conta para salvar o progresso; depois, um questionário rápido personaliza as missões."
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
