import Link from "next/link";
import type { Metadata } from "next";
import { ForgotForm } from "../forms";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-lg font-semibold">Redefinir senha</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Enviaremos um link para o seu e-mail.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="text-accent hover:underline">Voltar ao login</Link></p>
    </>
  );
}
