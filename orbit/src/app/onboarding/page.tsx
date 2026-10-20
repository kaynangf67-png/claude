import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getOrgContext, requireUser } from "@/lib/auth/session";
import { OrgForm } from "./form";

export const metadata = { title: "Criar organização" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireUser();
  if (await getOrgContext()) redirect("/dashboard");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mb-8"><Logo /></div>
      <div className="card w-full max-w-md p-6">
        <h1 className="text-lg font-semibold">Crie sua organização</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Missões, dados, políticas e auditoria ficam isolados por organização. Você será o proprietário e poderá convidar sua equipe depois.
        </p>
        <OrgForm />
      </div>
    </div>
  );
}
