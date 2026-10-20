import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-1 text-sm text-muted">O recurso não existe ou pertence a outra organização.</p>
      <div className="mt-6"><LinkButton href="/dashboard" variant="secondary">Voltar ao painel</LinkButton></div>
    </div>
  );
}
