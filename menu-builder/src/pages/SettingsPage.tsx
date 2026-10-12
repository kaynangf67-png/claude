import { CheckCircle2, CircleDashed, Database, KeyRound, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, CardHeader, Notice } from '@/components/ui';
import { env, isSupabaseConfigured } from '@/lib/env';

function Step({ done, title, children }: { done: boolean | null; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 px-5 py-4">
      {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-label="configurado" /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-ink-faint" aria-label="pendente" />}
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 space-y-1.5 text-ink-soft [&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-canvas [&_pre]:p-3 [&_pre]:text-[12px]">{children}</div>
      </div>
    </li>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" description="Estado das integrações e o que falta configurar." />
      <div className="mx-auto max-w-4xl space-y-5 px-4 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3 px-4 py-4">
            <Database className="size-5 text-accent" aria-hidden="true" />
            <div><p className="text-[13px] text-ink-soft">Banco e login</p>{isSupabaseConfigured ? <Badge tone="ok">Supabase conectado</Badge> : <Badge tone="warn">Modo demonstração</Badge>}</div>
          </Card>
          <Card className="flex items-center gap-3 px-4 py-4">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            <div><p className="text-[13px] text-ink-soft">Extração por IA</p>{isSupabaseConfigured ? <Badge>Verificada ao analisar</Badge> : <Badge tone="warn">Indisponível</Badge>}</div>
          </Card>
          <Card className="flex items-center gap-3 px-4 py-4">
            <KeyRound className="size-5 text-accent" aria-hidden="true" />
            <div><p className="text-[13px] text-ink-soft">URL pública</p><Badge>{env.publicBaseUrl ?? 'domínio atual'}</Badge></div>
          </Card>
        </div>

        {!isSupabaseConfigured && (
          <Notice tone="warn" title="Você está no modo demonstração">
            Os projetos ficam salvos só neste navegador, o link público só abre aqui e a extração por IA está desativada. Nada é enviado a servidores.
          </Notice>
        )}

        <Card>
          <CardHeader title="Como ativar as integrações" description="Passo a passo completo no README do projeto (menu-builder/README.md)." />
          <ol className="divide-y divide-line">
            <Step done={isSupabaseConfigured} title="1. Criar o projeto Supabase e aplicar o banco">
              <p>Crie um projeto em supabase.com e rode a migration:</p>
              <pre>supabase link --project-ref SEU_REF{'\n'}supabase db push</pre>
              <p>Ela cria as tabelas, as regras de acesso (RLS), a função pública do cardápio e os buckets de imagens.</p>
            </Step>
            <Step done={isSupabaseConfigured} title="2. Configurar o frontend">
              <p>Em <code>.env.local</code> (ou nas variáveis da Vercel):</p>
              <pre>VITE_SUPABASE_URL=https://SEU_REF.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=chave-anon-publica{'\n'}VITE_PUBLIC_BASE_URL=https://cardapios.seudominio.com.br</pre>
              <p>A chave <em>anon</em> é pública por natureza; a segurança vem do RLS. Nunca use a chave <em>service_role</em> no frontend.</p>
            </Step>
            <Step done={null} title="3. Publicar a função de IA e definir a chave">
              <pre>supabase secrets set ANTHROPIC_API_KEY=sk-ant-...{'\n'}supabase functions deploy extract-menu</pre>
              <p>Opcional: <code>AI_MODEL</code> (padrão <code>claude-opus-5-5</code>) e <code>AI_DAILY_IMAGE_LIMIT</code> (padrão 60 imagens por usuário a cada 24 h).</p>
            </Step>
            <Step done={null} title="4. Restringir o cadastro à equipe">
              <p>No painel do Supabase, em Authentication, desative o cadastro aberto depois de criar as contas da equipe. Nesta versão não há planos nem cobrança.</p>
            </Step>
          </ol>
        </Card>
      </div>
    </>
  );
}
