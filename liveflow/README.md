# LiveFlow

> Transforme seus vídeos em uma operação inteligente de Lives.

Plataforma web para **vender no TikTok Shop sem aparecer**: organize produtos e vídeos, programe **publicações de vídeos curtos sem rosto** (mãos, unboxing, antes/depois, comparativo, POV, narração) com legenda e produto prontos, e acompanhe o que vende — com IA para roteiros e um copiloto que conhece seus números. Lives com apresentador real continuam suportadas. Feita para uso pessoal, com arquitetura pronta para virar SaaS.

### Publicação assistida (por quê)

- A **Content Posting API** oficial do TikTok só publica em modo privado (`SELF_ONLY`) enquanto o app não passa pela **auditoria** do TikTok, e limita a poucos usuários por dia.
- O **link de produto (cestinha)** é adicionado no app do TikTok ao postar; não encontramos suporte a isso na API de publicação.

Por isso o fluxo é: o LiveFlow prepara (vídeo, legenda, hashtags, produto), programa e **avisa na hora**; você posta pelo app (≈1 min) e cola o link do vídeo para registrar. `TikTokService.publishVideo()` já existe na interface para quando o app for auditado.

## ⚠️ Leia antes de usar: o que o LiveFlow faz (e não faz)

- **O LiveFlow não transmite lives e não publica sozinho no TikTok.** Não existe API pública oficial para criar ou iniciar uma LIVE no TikTok/TikTok Shop. O app organiza, agenda e mede — a execução da live é sua.
- **As regras de LIVE do TikTok Shop restringem conteúdo pré-gravado apresentado como ao vivo** (áudio pré-gravado, vídeo em loop, falta de interação em tempo real). Isso pode gerar desmonetização, perda de recomendação e penalidades na conta. Use os vídeos como roteiro, apoio ou conteúdo de vídeo curto — não como substituto de uma live.
- A integração com o TikTok é uma **camada abstrata com implementação MOCK** (`src/services/tiktok`). Nada de scraping, automação de navegador, endpoints não documentados ou armazenamento de senha.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 39 testes (recorrência, analytics, validação, publicações, legendas, CSV/importação, regras de domínio, IA local)
npm run build
```

Sem variáveis de ambiente o app roda em **modo demonstração**: autenticação local, dados no `localStorage` e arquivos no IndexedDB do navegador. Na tela de login, **“Entrar com conta de demonstração”** ou crie uma conta → no onboarding, **“Prefiro explorar com dados de demonstração”** (ou em *Configurações → Dados*).

> O modo demonstração **não é seguro** (tudo fica no navegador) e simula o plano Pro. É para testar o produto, não para dados reais.

## Usando com Supabase (modo real)

1. Crie um projeto no Supabase.
2. Aplique as migrations: `supabase db push` (ou cole, em ordem, os arquivos de `supabase/migrations/` no SQL Editor).
3. Em *Authentication → URL Configuration*, adicione `http://localhost:5173` e sua URL de produção, incluindo `/redefinir-senha`.
4. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. (Opcional, IA generativa) `supabase secrets set ANTHROPIC_API_KEY=...`, `supabase functions deploy ai-generate` e `VITE_AI_MODE=remote`.

A anon key é pública por design: quem protege os dados é o **RLS**. Nunca coloque a `service_role` ou chaves de IA/pagamento em variáveis `VITE_*`.

## Arquitetura

```
src/
  types/            tipos de domínio (espelham o schema SQL)
  lib/              utilitários puros: formatação, validação (zod), env, supabase client, metadados de vídeo
  services/
    data/           DataRepository (interface) + DemoRepository (localStorage) + SupabaseRepository
    storage/        FileStorage: IndexedDB (demo) / Supabase Storage com URLs assinadas
    auth/           AuthService: local (demo) / Supabase Auth
    domain/         REGRAS DE NEGÓCIO: produtos, vídeos, lives/automações, IA, conta
    tiktok/         TikTokService (interface) + MockTikTokService
    ai/             AIProvider: gerador local (templates + dados) / remoto (Edge Function)
    recurrence.ts   expansão de recorrência (diária, seg–sex, dias específicos, intervalo)
    analytics.ts    agregações: totais, CTR, conversão, ROI, séries diárias, rankings
    plans.ts        planos Free/Pro/Premium e contrato BillingProvider
    demo/seed.ts    dados fictícios determinísticos
    backend.ts      único ponto que escolhe demo vs Supabase
  hooks/            React Query (cache, invalidação, toasts)
  contexts/         Auth e Services
  layouts/          AppLayout (sidebar desktop / bottom-nav mobile), AuthLayout
  components/ui/    primitivos no estilo shadcn/ui (Radix + CVA + Tailwind)
  components/app/   componentes de produto (status, mídia, formulários, ações)
  pages/            telas (lazy-loaded)
supabase/
  migrations/       schema, índices, RLS, triggers, storage
  functions/        ai-generate (Claude API; chave só no servidor)
```

Componentes não falam com o banco: chamam `services.*` (domínio), que usam `DataRepository`. Trocar de backend é trocar o repositório, não reescrever telas.

### Modelo de dados

`profiles` (1:1 com `auth.users` — não duplicamos uma tabela `users`), `products`, `videos`, `posts` (publicações de vídeo curto, com formato, legenda, hashtags, horário e link publicado), `live_schedules` (regra de recorrência), `automations` (ativa/pausa uma agenda), `lives` (cada ocorrência), `analytics` (métricas diárias por produto/vídeo/live), `notifications` (também “Atividade recente”), `ai_generations`, `integrations` (metadados) + `integration_secrets` (tokens, inacessível ao browser), `plan_limits` e `subscriptions` (SaaS).

### Segurança

- **RLS** em todas as tabelas (`auth.uid() = user_id`), validado contra Postgres real: leitura/escrita cruzada bloqueada.
- **Trigger de mesmo dono**: impede apontar `product_id`/`video_id` de outro usuário.
- **Limites de plano aplicados no banco** (`enforce_plan_limit`) — a UI só avisa antes.
- `profiles.plan` só muda via `service_role` (webhook de pagamento), nunca pelo client.
- **Storage**: caminho `{user_id}/arquivo`; `video-files` e `thumbnails` privados (URL assinada de 1h); limites de tamanho e MIME por bucket.
- Validação com zod + sanitização de texto; CHECKs no banco (URL `http(s)`, faixas numéricas, tamanhos).
- Markdown da IA renderizado como elementos React (sem `dangerouslySetInnerHTML`).

### Automações

Uma automação mantém lives materializadas para os próximos **30 dias**. Hoje a extensão desse horizonte e a sincronização de status rodam **quando o app é aberto** (`lives.sync()`). Para produção, mova isso para um job no servidor (pg_cron + Edge Function) — senão, se ninguém abrir o app, a agenda para de ser estendida.

## Limitações conhecidas / próximos passos

- Upload de vídeo usa upload simples; para arquivos grandes, trocar por upload resumável (TUS) no Supabase.
- Notificações são in-app; o lembrete "hora de postar" só aparece com o app aberto. E-mail/push exigem Edge Function + provedor — é o próximo passo para a publicação assistida funcionar no dia a dia.
- **Importar vendas (CSV)** em *Analytics → Importar vendas*: mapeamento de colunas (sugerido pelo cabeçalho), números BR ("R$ 1.234,56"), CSV do Excel em Windows-1252, casamento de produtos por SKU/nome, vínculo com publicações pelo link do vídeo e reimportação sem duplicar. Arquivos .xlsx precisam ser salvos como CSV antes. Integração direta exigiria acesso ao TikTok Shop Partner API.
- Pagamentos: contrato `BillingProvider` e tabela `subscriptions` prontos; checkout/webhook ainda não implementados.
- O cálculo de “Taxa de conversão” usa pedidos ÷ cliques; ROI = (comissão − custo) ÷ custo, e só aparece se houver custo registrado.
