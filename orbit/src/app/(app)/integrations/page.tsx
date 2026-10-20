import { Mail, Plug } from "lucide-react";
import { Alert, Badge, Card, CardHeader, KeyValue, Mono, PageHeader } from "@/components/ui/primitives";
import { ConfirmForm, SubmitButton } from "@/components/ui/client";
import { Button } from "@/components/ui/button";
import { PageMessage, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { hasPermission } from "@/lib/domain/permissions";
import { gmailConfigured } from "@/lib/env";
import { GMAIL_SCOPES } from "@/lib/integrations/gmail";
import { formatDateTime } from "@/lib/utils";
import { disconnectGmailAction } from "../actions";

export const metadata = { title: "Integrações" };

export default async function IntegrationsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const db = await createUserClient();
  const { data: gmail } = await db.from("integrations").select("status, account_email, scopes, connected_at, last_success_at, last_error").eq("org_id", ctx.orgId).eq("provider", "gmail").maybeSingle().throwOnError();
  const canManage = hasPermission(ctx.role, "integrations:manage");
  const serverReady = gmailConfigured();
  const connected = gmail?.status === "connected" && serverReady;

  return (
    <>
      <PageHeader title="Integrações" description="Conectores com serviços externos. Credenciais são obtidas por OAuth, criptografadas no servidor e nunca chegam ao navegador." />
      <PageMessage params={sp} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><Mail className="h-4 w-4 text-accent" aria-hidden />Gmail</span>}
            description="Rascunhos e envio de e-mails"
            action={!serverReady ? <Badge tone="warning">Não configurado</Badge> : connected ? <Badge tone="success">Conectado</Badge> : gmail?.status === "error" ? <Badge tone="danger">Erro</Badge> : <Badge>Desconectado</Badge>}
          />
          <div className="space-y-4 p-5">
            {!serverReady ? (
              <Alert tone="warning" title="Indisponível neste servidor">
                Defina <Mono>GOOGLE_CLIENT_ID</Mono>, <Mono>GOOGLE_CLIENT_SECRET</Mono> e <Mono>ORBIT_ENCRYPTION_KEY</Mono>. Enquanto isso, as ferramentas de e-mail ficam bloqueadas na revisão de planos.
              </Alert>
            ) : null}
            <KeyValue items={[
              ["Conta", gmail?.account_email ?? "—"],
              ["Conectado em", formatDateTime(gmail?.connected_at)],
              ["Última execução bem-sucedida", formatDateTime(gmail?.last_success_at)],
              ["Último erro", gmail?.last_error ?? "—"],
            ]} />
            <div>
              <p className="text-xs text-subtle">Permissões solicitadas</p>
              <ul className="mt-1 space-y-1 text-sm text-fg/90">
                <li><Mono>gmail.compose</Mono> criar rascunhos e enviar mensagens (o ORBIT não lê sua caixa de entrada)</li>
                <li><Mono>openid email</Mono> identificar a conta conectada</li>
              </ul>
              <p className="mt-2 text-xs text-subtle">Escopos: {GMAIL_SCOPES.join(", ")}</p>
            </div>
            <div className="text-sm text-muted">
              <p>Ferramentas que usam esta integração:</p>
              <ul className="mt-1 list-inside list-disc"><li>Criar rascunho: automática por padrão, nada é enviado.</li><li>Enviar e-mail: sempre exige aprovação e só para domínios liberados nas políticas.</li></ul>
            </div>
            {canManage && serverReady ? (
              <div className="flex gap-2 border-t border-border pt-4">
                <form action="/api/integrations/gmail/start" method="post">
                  <SubmitButton variant={connected ? "secondary" : "primary"}>{connected ? "Reconectar" : "Conectar Gmail"}</SubmitButton>
                </form>
                {gmail && gmail.status !== "disconnected" ? (
                  <ConfirmForm action={disconnectGmailAction} title="Desconectar o Gmail?" description="As credenciais serão revogadas e apagadas. Tarefas de e-mail pendentes falharão até uma nova conexão." confirmLabel="Desconectar" trigger={<Button type="button" variant="danger">Desconectar</Button>} />
                ) : null}
              </div>
            ) : !canManage ? <p className="text-xs text-subtle">Somente administradores gerenciam integrações.</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Plug className="h-4 w-4 text-subtle" aria-hidden />Outros conectores</span>} />
          <p className="p-5 text-sm text-muted">
            Novos conectores entram pelo registro de ferramentas do servidor (<Mono>src/lib/tools</Mono>), cada um com schema de entrada, permissão, risco, política de aprovação e estratégia de verificação. Nenhum outro conector está disponível nesta versão.
          </p>
        </Card>
      </div>
    </>
  );
}
