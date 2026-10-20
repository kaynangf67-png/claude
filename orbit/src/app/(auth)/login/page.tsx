import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="text-lg font-semibold">Entrar no ORBIT</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Acesse sua organização.</p>
      {error ? <p role="alert" className="mb-4 text-sm text-red-300">O link de acesso é inválido ou expirou.</p> : null}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted">
        Não tem conta? <Link href="/signup" className="text-accent hover:underline">Criar conta</Link>
      </p>
    </>
  );
}
