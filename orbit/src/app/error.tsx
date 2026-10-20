"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="mt-1 max-w-md text-sm text-muted">Não foi possível carregar esta página. O erro foi registrado no servidor.</p>
      <div className="mt-6"><Button variant="secondary" onClick={reset}>Tentar novamente</Button></div>
    </div>
  );
}
