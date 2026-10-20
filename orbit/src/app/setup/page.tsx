import { Logo } from "@/components/brand";
import { Badge, Card, CardHeader, Mono } from "@/components/ui/primitives";
import { aiConfigured, encryptionConfigured, gmailConfigured, supabaseConfigured, env } from "@/lib/env";

export const metadata = { title: "Configuração" };
export const dynamic = "force-dynamic";

function Row({ ok, name, vars, note }: { ok: boolean; name: string; vars: string[]; note: string }) {
  return (
    <li className="flex flex-col gap-2 border-b border-border px-5 py-4 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="mt-0.5 text-xs text-muted">{note}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{vars.map((v) => <Mono key={v}>{v}</Mono>)}</div>
      </div>
      <Badge tone={ok ? "success" : "warning"}>{ok ? "Configurado" : "Não configurado"}</Badge>
    </li>
  );
}

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">Configuração do servidor</h1>
      <p className="mt-2 text-sm text-muted">
        O ORBIT não simula serviços ausentes. Cada recurso abaixo fica indisponível até que suas variáveis de ambiente sejam definidas. Nenhum valor secreto é exibido nesta página.
      </p>
      <Card className="mt-8">
        <CardHeader title="Serviços" description={`URL da aplicação: ${env().NEXT_PUBLIC_APP_URL}`} />
        <ul>
          <Row ok={supabaseConfigured()} name="Supabase (autenticação e banco)" vars={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]} note="Obrigatório. Aplique as migrations de supabase/migrations antes do primeiro uso." />
          <Row ok={aiConfigured()} name="Provedor de IA (Anthropic)" vars={["ANTHROPIC_API_KEY", "ORBIT_AI_MODEL"]} note="Opcional. Sem ele, planos são montados manualmente e a classificação fica indisponível." />
          <Row ok={encryptionConfigured()} name="Criptografia de credenciais" vars={["ORBIT_ENCRYPTION_KEY"]} note="32 bytes em base64 (ex.: openssl rand -base64 32). Necessária para integrações." />
          <Row ok={gmailConfigured()} name="Gmail (OAuth do Google)" vars={["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]} note="Opcional. Habilita rascunhos e envio de e-mails com aprovação." />
          <Row ok={Boolean(env().CRON_SECRET)} name="Execução em segundo plano" vars={["CRON_SECRET"]} note="Opcional. Protege /api/cron/tick, que retoma missões interrompidas." />
        </ul>
      </Card>
      <p className="mt-6 text-sm text-muted">Instruções completas em <Mono>orbit/README.md</Mono>.</p>
    </div>
  );
}
