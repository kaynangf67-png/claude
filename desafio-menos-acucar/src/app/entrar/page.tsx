import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/app/AuthShell";
import { SignInForm } from "@/components/app/AuthForms";
import { DemoModeNotice } from "@/components/app/DemoModeNotice";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <AuthShell
      title="Bem-vindo(a) de volta"
      subtitle="Entre para continuar de onde parou."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href="/criar-conta" className="font-semibold text-forest hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <DemoModeNotice />
      <SignInForm
        // O Supabase confirma o e-mail antes de redirecionar. Se a troca do código falhou
        // (link aberto em outro navegador ou já usado), a conta quase sempre já está confirmada.
        notice={erro === "confirmacao" ? "Seu e-mail provavelmente já foi confirmado. Entre com seu e-mail e senha para continuar." : undefined}
      />
    </AuthShell>
  );
}
