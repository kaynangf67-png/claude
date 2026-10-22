"use client";

import { RotateCcw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { PageLoading } from "@/components/ui/Spinner";
import type { UserData } from "@/domain/types";
import { useSession } from "./SessionProvider";

/**
 * Guarda de navegação no cliente. É conveniência de UX, não segurança:
 * no modo Supabase quem protege os dados é o RLS (e o proxy redireciona antes).
 */
export function RequireSession({ children, needsOnboarding = true }: { children: (data: UserData) => ReactNode; needsOnboarding?: boolean }) {
  const { status, data, error, refresh } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const mustOnboard = status === "authenticated" && needsOnboarding && !data?.profile.onboardingCompletedAt;

  useEffect(() => {
    if (status === "anonymous") router.replace(`/entrar?voltar=${encodeURIComponent(pathname)}`);
    else if (mustOnboard) router.replace("/onboarding");
  }, [status, mustOnboard, router, pathname]);

  if (status === "error") {
    return (
      <div role="alert" className="mx-auto flex min-h-[50vh] max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-semibold text-ink">Não foi possível carregar seus dados</p>
        <p className="text-sm text-muted">{error}</p>
        <Button variant="secondary" onClick={() => void refresh()} icon={<RotateCcw className="size-4" aria-hidden />}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (status !== "authenticated" || !data || mustOnboard) return <PageLoading />;
  return <>{children(data)}</>;
}
