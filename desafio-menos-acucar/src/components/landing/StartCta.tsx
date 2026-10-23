"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/app/SessionProvider";
import { ButtonLink } from "@/components/ui/Button";

/** CTA que sabe se a pessoa já tem conta neste navegador/sessão. */
export function StartCta({
  size = "lg",
  className,
  label = "Participar da Primeira Turma",
  variant = "primary",
}: {
  size?: "md" | "lg" | "sm";
  className?: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const { status, data } = useSession();
  const logged = status === "authenticated" && data;
  const href = logged ? (data.profile.onboardingCompletedAt ? "/inicio" : "/onboarding") : "/criar-conta";
  return (
    <ButtonLink href={href} size={size} variant={variant} className={className} icon={<ArrowRight className="size-4" aria-hidden />}>
      {logged ? "Continuar meu desafio" : label}
    </ButtonLink>
  );
}

export function HeaderAuthLink() {
  const { status } = useSession();
  if (status === "authenticated") return null;
  return (
    <Link href="/entrar" className="inline-flex rounded-md px-3 py-2 text-sm font-semibold text-forest hover:bg-forest/[0.06]">
      Entrar
    </Link>
  );
}
