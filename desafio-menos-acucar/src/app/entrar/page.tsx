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
      <SignInForm initialError={erro === "confirmacao" ? "Não foi possível confirmar seu e-mail. O link pode ter expirado: tente entrar ou crie a conta novamente." : undefined} />
    </AuthShell>
  );
}
