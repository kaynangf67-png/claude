import type { Metadata } from "next";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "Nova senha" };

export default function ResetPage() {
  return (
    <>
      <h1 className="text-lg font-semibold">Definir nova senha</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Escolha uma senha nova para sua conta.</p>
      <ResetForm />
    </>
  );
}
