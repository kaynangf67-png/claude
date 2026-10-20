import { Logo } from "@/components/brand";
import { supabaseConfigured } from "@/lib/env";
import { Alert } from "@/components/ui/primitives";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8"><Logo /></div>
      <div className="w-full max-w-sm">
        {!supabaseConfigured() ? (
          <div className="mb-4">
            <Alert tone="warning" title="Autenticação não configurada">
              Defina as variáveis do Supabase para habilitar o login. <Link className="underline" href="/setup">Ver instruções</Link>.
            </Alert>
          </div>
        ) : null}
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
