import { useRef, useState, type FormEvent } from 'react';
import { Bell, CheckCircle2, CreditCard, Database, Link2, Loader2, Lock, ShieldCheck, SlidersHorizontal, Unplug, User } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app/page';
import { useConfirm } from '@/components/app/confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Avatar, Progress, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useAuth } from '@/contexts/auth';
import { useServices } from '@/contexts/services';
import { qk, useAction, useFileUrl, useIntegration, useLives, usePosts, useProducts, useProfile, useVideos } from '@/hooks/queries';
import { useDemoSeed } from '@/hooks/use-demo-seed';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import { backendMode } from '@/services/backend';
import { PLANS } from '@/services/plans';
import { getTikTokService } from '@/services/tiktok';
import type { UserPreferences } from '@/types/domain';

function ProfileTab() {
  const services = useServices();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const { data: avatar } = useFileUrl('avatars', profile?.avatar_url);
  const [name, setName] = useState(profile?.full_name ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useAction((patch: { full_name?: string; avatar_url?: string | null }) => services.account.updateProfile(profile!.id, patch), { invalidate: [qk.profile], success: 'Perfil atualizado' });
  const upload = useAction(async (file: File) => {
    const path = await services.account.uploadAvatar(file);
    return services.account.updateProfile(profile!.id, { avatar_url: path });
  }, { invalidate: [qk.profile], success: 'Avatar atualizado' });

  if (!profile) return <Loader2 className="size-5 animate-spin" />;
  return (
    <Card>
      <CardHeader><div><CardTitle>Perfil</CardTitle><CardDescription>Como você aparece no LiveFlow.</CardDescription></div></CardHeader>
      <CardContent>
        <form
          className="grid max-w-md gap-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!name.trim()) return toast.error('Informe seu nome.');
            save.mutate({ full_name: name });
          }}
        >
          <div className="flex items-center gap-4">
            <Avatar src={avatar} name={profile.full_name || user?.email || ''} className="size-16 text-base" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={upload.isPending}>Trocar avatar</Button>
              {profile.avatar_url && <Button type="button" variant="ghost" size="sm" onClick={() => save.mutate({ avatar_url: null })}>Remover</Button>}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          </div>
          <Field label="Nome" htmlFor="pf-name"><Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
          <Field label="E-mail" htmlFor="pf-email" hint="O e-mail é gerenciado pela autenticação."><Input id="pf-email" value={user?.email ?? ''} disabled /></Field>
          <Button type="submit" className="w-fit" loading={save.isPending}>Salvar</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function IntegrationsTab() {
  const services = useServices();
  const { data: integration, isLoading } = useIntegration();
  const tiktok = getTikTokService();
  const connected = integration?.status === 'connected';
  const connect = useAction(() => services.account.connectTikTok(), { invalidate: [qk.integration], success: 'Conta conectada (simulação)' });
  const disconnect = useAction(() => services.account.disconnectTikTok(), { invalidate: [qk.integration], success: 'Conta desconectada' });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background"><Link2 className="size-5" /></span>
            <div><CardTitle>TikTok / TikTok Shop</CardTitle><CardDescription>Conexão via OAuth oficial. O LiveFlow nunca pede nem guarda sua senha.</CardDescription></div>
          </div>
          {tiktok.mode === 'mock' && <Badge tone="warning">Simulado</Badge>}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {isLoading ? <Loader2 className="size-5 animate-spin" /> : connected ? <CheckCircle2 className="size-5 text-success" /> : <Unplug className="size-5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{connected ? `Conectado como ${integration?.account_name}` : 'Não conectado'}</p>
                <p className="text-xs text-muted-foreground">{connected && integration?.connected_at ? `Desde ${formatDateTime(integration.connected_at)}` : 'Conecte para importar produtos e métricas quando a integração oficial estiver ativa.'}</p>
              </div>
            </div>
            {connected ? (
              <Button variant="outline" onClick={() => disconnect.mutate(undefined)} loading={disconnect.isPending}>Desconectar</Button>
            ) : (
              <Button onClick={() => connect.mutate(undefined)} loading={connect.isPending}>Conectar conta</Button>
            )}
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium">Capacidades da integração</p>
            <ul className="grid gap-1.5 text-sm">
              {tiktok.capabilities().map((c) => (
                <li key={c.capability} className="flex items-start gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.capability}()</code>
                  <span className="text-muted-foreground">{c.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreferencesForm({ section }: { section: 'notifications' | 'preferences' }) {
  const services = useServices();
  const { data: profile } = useProfile();
  const { theme, toggle } = useTheme();
  const save = useAction((prefs: UserPreferences) => services.account.updateProfile(profile!.id, { preferences: prefs }), { invalidate: [qk.profile], success: 'Preferências salvas' });
  if (!profile) return null;
  const prefs = profile.preferences ?? {};
  const update = (patch: Partial<UserPreferences>) => save.mutate({ ...prefs, ...patch });

  if (section === 'notifications') {
    const items: { key: keyof UserPreferences; label: string; desc: string }[] = [
      { key: 'notifyBeforeLive', label: 'Lembrete antes da live', desc: 'Aviso 15 minutos antes de cada live programada.' },
      { key: 'notifyErrors', label: 'Erros e falhas', desc: 'Quando uma live ou automação falhar.' },
      { key: 'notifyDailySummary', label: 'Resumo diário', desc: 'Resultados do dia anterior, toda manhã.' },
    ];
    return (
      <Card>
        <CardHeader><div><CardTitle>Notificações</CardTitle><CardDescription>Escolha o que você quer receber. (Entrega por e-mail/push requer backend — ver README.)</CardDescription></div></CardHeader>
        <CardContent className="grid divide-y">
          {items.map((i) => (
            <label key={i.key} className="flex cursor-pointer items-center justify-between gap-4 py-3.5 first:pt-0">
              <div><p className="text-sm font-medium">{i.label}</p><p className="text-xs text-muted-foreground">{i.desc}</p></div>
              <Switch checked={Boolean(prefs[i.key])} onCheckedChange={(v) => update({ [i.key]: v })} />
            </label>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><div><CardTitle>Preferências</CardTitle><CardDescription>Padrões usados ao criar lives.</CardDescription></div></CardHeader>
      <CardContent className="grid max-w-md gap-4">
        <Field label="Duração padrão das lives" htmlFor="pr-dur">
          <NativeSelect id="pr-dur" value={String(prefs.defaultLiveDuration ?? 60)} onChange={(e) => update({ defaultLiveDuration: Number(e.target.value) })}>
            {[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} minutos</option>)}
          </NativeSelect>
        </Field>
        <Field label="Fuso horário" htmlFor="pr-tz" hint="Detectado do navegador. Horários são exibidos neste fuso.">
          <Input id="pr-tz" value={Intl.DateTimeFormat().resolvedOptions().timeZone} disabled />
        </Field>
        <label className="flex items-center justify-between gap-4">
          <div><p className="text-sm font-medium">Tema escuro</p><p className="text-xs text-muted-foreground">Salvo neste navegador.</p></div>
          <Switch checked={theme === 'dark'} onCheckedChange={toggle} />
        </label>
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  const { auth } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const change = useAction(() => auth.updatePassword(pw), { success: 'Senha alterada', onSuccess: () => { setPw(''); setPw2(''); } });
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><div><CardTitle>Alterar senha</CardTitle></div></CardHeader>
        <CardContent>
          <form
            className="grid max-w-md gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pw.length < 8) return toast.error('A senha precisa ter ao menos 8 caracteres.');
              if (pw !== pw2) return toast.error('As senhas não conferem.');
              change.mutate(undefined);
            }}
          >
            <Field label="Nova senha" htmlFor="sc-pw"><Input id="sc-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <Field label="Confirmar" htmlFor="sc-pw2"><Input id="sc-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
            <Button type="submit" className="w-fit" loading={change.isPending}>Atualizar senha</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Como seus dados são protegidos</CardTitle></div></CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground">
            {[
              'Row Level Security no banco: cada usuário só acessa os próprios registros.',
              'Arquivos de vídeo e thumbnails em buckets privados, com URLs assinadas temporárias.',
              'Tokens de integrações ficam no servidor, inacessíveis pelo navegador.',
              'Chaves de API (IA, pagamentos) existem apenas nas Edge Functions.',
            ].map((t) => <li key={t} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />{t}</li>)}
          </ul>
          {backendMode === 'demo' && <p className="mt-4 rounded-lg bg-warning/10 p-3 text-xs">Modo demonstração: os dados ficam somente neste navegador e a autenticação é local. Configure o Supabase para segurança real.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanTab() {
  const { data: profile } = useProfile();
  const products = useProducts();
  const videos = useVideos();
  const lives = useLives();
  const posts = usePosts();
  const plan = PLANS[profile?.plan ?? 'free'];
  const month = new Date().toISOString().slice(0, 7);
  const usage = [
    { label: 'Produtos', used: (products.data ?? []).filter((p) => p.status !== 'archived').length, limit: plan.limits.products },
    { label: 'Vídeos', used: (videos.data ?? []).filter((v) => v.status !== 'archived').length, limit: plan.limits.videos },
    { label: 'Publicações neste mês', used: (posts.data ?? []).filter((p) => (p.scheduled_at ?? p.created_at).startsWith(month)).length, limit: plan.limits.postsPerMonth },
    { label: 'Lives neste mês', used: (lives.data ?? []).filter((l) => l.starts_at.startsWith(month)).length, limit: plan.limits.livesPerMonth },
  ];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div><CardTitle>Plano {plan.name}</CardTitle><CardDescription>Uso atual dos limites.</CardDescription></div>
          <Badge tone="primary">{plan.name}</Badge>
        </CardHeader>
        <CardContent className="grid max-w-lg gap-4">
          {usage.map((u) => (
            <div key={u.label}>
              <div className="mb-1.5 flex justify-between text-sm"><span>{u.label}</span><span className="tabular text-muted-foreground">{u.used} / {u.limit ?? '∞'}</span></div>
              <Progress value={u.limit ? (u.used / u.limit) * 100 : 4} indicatorClassName={u.limit && u.used >= u.limit ? 'bg-destructive' : undefined} />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-3">
        {Object.values(PLANS).map((p) => (
          <Card key={p.tier} className={p.tier === plan.tier ? 'ring-2 ring-primary' : ''}>
            <CardContent className="pt-4 sm:pt-5">
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold">{p.priceMonthly ? `R$ ${p.priceMonthly}` : 'Grátis'}<span className="text-sm font-normal text-muted-foreground">{p.priceMonthly ? '/mês' : ''}</span></p>
              <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
                <li>{p.limits.products ?? 'Ilimitados'} produtos</li>
                <li>{p.limits.videos ?? 'Ilimitados'} vídeos</li>
                <li>{p.limits.postsPerMonth ?? 'Ilimitadas'} publicações/mês</li>
                <li>{p.limits.livesPerMonth ?? 'Ilimitadas'} lives/mês</li>
                <li>{p.limits.aiGenerationsPerMonth} gerações de IA/mês</li>
                <li>Analytics de {p.limits.analyticsHistoryDays} dias</li>
              </ul>
              <Button className="mt-4 w-full" variant={p.tier === plan.tier ? 'outline' : 'default'} disabled onClick={() => undefined}>
                {p.tier === plan.tier ? 'Plano atual' : 'Em breve'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Pagamentos (Stripe/Mercado Pago) ainda não estão ativos. A arquitetura já prevê checkout e webhooks via Edge Functions.</p>
    </div>
  );
}

function DataTab() {
  const seed = useDemoSeed();
  const [confirm, confirmNode] = useConfirm();
  return (
    <Card>
      <CardHeader><div><CardTitle>Dados de demonstração</CardTitle><CardDescription>Preenche a conta com produtos, vídeos, publicações, lives e 90 dias de métricas fictícias.</CardDescription></div></CardHeader>
      <CardContent>
        <Button
          onClick={async () => {
            if (await confirm({ title: 'Usar dados de demonstração?', description: 'Seus produtos, vídeos, lives, automações e métricas atuais serão SUBSTITUÍDOS por dados fictícios.', confirmLabel: 'Substituir e carregar', destructive: true }))
              seed.mutate();
          }}
          loading={seed.isPending}
        >
          <Database /> Usar dados de demonstração
        </Button>
        {confirmNode}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="animate-in">
      <PageHeader title="Configurações" description="Conta, integrações e preferências." />
      <Tabs defaultValue="profile" className="grid gap-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto scrollbar-none sm:w-fit">
          <TabsTrigger value="profile"><User /> Perfil</TabsTrigger>
          <TabsTrigger value="integrations"><Link2 /> Integrações</TabsTrigger>
          <TabsTrigger value="notifications"><Bell /> Notificações</TabsTrigger>
          <TabsTrigger value="preferences"><SlidersHorizontal /> Preferências</TabsTrigger>
          <TabsTrigger value="security"><Lock /> Segurança</TabsTrigger>
          <TabsTrigger value="plan"><CreditCard /> Plano</TabsTrigger>
          <TabsTrigger value="data"><Database /> Dados</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
        <TabsContent value="notifications"><PreferencesForm section="notifications" /></TabsContent>
        <TabsContent value="preferences"><PreferencesForm section="preferences" /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="plan"><PlanTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
      </Tabs>
    </div>
  );
}
