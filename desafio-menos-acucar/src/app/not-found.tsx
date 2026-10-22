import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-6 px-6">
      <Logo />
      <div>
        <p className="text-sm font-semibold text-muted">Erro 404</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-forest">Página não encontrada</h1>
        <p className="mt-2 text-muted">O endereço pode ter mudado ou não existe mais.</p>
      </div>
      <ButtonLink href="/">Voltar para o início</ButtonLink>
    </main>
  );
}
