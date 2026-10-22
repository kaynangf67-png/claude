import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-4">
        <Logo />
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted hover:text-forest">
          <ArrowLeft className="size-4" aria-hidden /> Voltar
        </Link>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-forest">{title}</h1>
        <p className="mt-2 text-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">{footer}</div>
      </main>
    </div>
  );
}
