import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireOrg } from "@/lib/auth/session";
import { hasPermission } from "@/lib/domain/permissions";
import { aiConfigured } from "@/lib/env";
import { NewMissionForm } from "./form";

export const metadata = { title: "Nova missão" };

export default async function NewMissionPage() {
  const ctx = await requireOrg();
  if (!hasPermission(ctx.role, "missions:write")) redirect("/missions?err=Seu%20papel%20n%C3%A3o%20permite%20criar%20miss%C3%B5es");
  return (
    <>
      <PageHeader title="Nova missão" description="Nada é executado antes de você revisar e aprovar o plano." />
      <Card className="max-w-2xl p-6"><NewMissionForm aiAvailable={aiConfigured()} /></Card>
    </>
  );
}
