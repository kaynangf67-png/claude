# Pele em Foco

Produto digital educativo em português: **e-book** sobre acne, pele oleosa e rotina básica + **app web** com contas, rotina, diário e biblioteca (bônus de **30 dias** para quem compra) + **página de vendas** com checkout na Cakto.

> Conteúdo educativo. O app não faz diagnóstico, não indica tratamento e não garante resultado.

## Estado atual (leia primeiro)

| Parte | Situação |
|---|---|
| App, telas e regras no navegador | Pronto. Testado em modo demonstração (unitário + ponta a ponta, celular e desktop) |
| Banco (schema, RLS, ativação de 30 dias, revogação) | Pronto. Testado em Postgres 16 local com um *stub* do Supabase (`npm run test:db`) |
| Supabase real (Auth, e-mails, Edge Functions) | **Não conectado.** Nenhum projeto foi criado, nenhum deploy feito |
| Webhook da Cakto | Código pronto e lógica testada. **Não implantado nem testado com a Cakto real** |
| Página de vendas e e-book | Prontos. O checkout depende do link da sua oferta |

Até o Supabase e a Cakto estarem conectados e testados (seção “Antes de clientes reais”), **ninguém consegue ativar o bônus de verdade**.

## Como funciona o acesso de 30 dias

1. A pessoa compra o e-book na Cakto.
2. A Cakto chama a Edge Function `cakto-webhook`, que valida o segredo e grava a compra em `verified_purchases` (tabela que o navegador não lê nem escreve).
3. A pessoa cria a conta no app **com o mesmo e-mail** e confirma o e-mail.
4. Ao entrar, o app chama `claim_verified_purchase()` no banco. A função confere e-mail confirmado + compra aprovada e ainda não usada, e cria em `access_entitlements` um acesso de **30 dias a partir desse momento**.
5. Rotina, diário (criar/editar) e biblioteca são liberados **pelo RLS do banco** só enquanto o acesso estiver ativo. Depois dos 30 dias, a pessoa ainda lê, exporta e apaga os próprios dados.
6. Reembolso ou chargeback na Cakto → o webhook marca a compra e **revoga** o acesso.

Nada disso depende de flag no navegador, parâmetro de URL ou `localStorage`. Uma conta nova não tem acesso, e o usuário não consegue inserir nem alterar o próprio acesso (testado).

## Estrutura

```
pele-em-foco/
├── src/
│   ├── app/            sessão (usuário, perfil, acesso), hooks
│   ├── services/       interfaces + implementação Supabase + implementação demo
│   ├── components/     layout, navegação, guards de rota, UI reutilizável
│   ├── pages/auth/     entrar, criar conta, recuperar e redefinir senha
│   ├── pages/app/      início, minha rotina, diário, aprender, artigo, guia de produtos, perfil
│   ├── pages/site/     página de vendas, pós-compra, privacidade, termos
│   ├── content/        artigos (fonte única do seed do banco), fontes, FAQ, guia de produtos
│   ├── lib/            datas, rotina, diário, validação, env
│   └── styles/app.css  componentes sobre os tokens de brand/tokens.css
├── supabase/
│   ├── migrations/     schema + RLS + funções; seed dos artigos (gerado)
│   ├── functions/      cakto-webhook, delete-account, _shared/cakto.ts
│   ├── tests/          testes de banco (Postgres local)
│   └── config.toml
├── brand/              design tokens e design system
├── ebook/              fonte do e-book (HTML não versionado), build do PDF
├── docs/               Supabase, Cakto, entrega, fontes, revisão editorial
└── tests/smoke.mjs     ponta a ponta (Playwright)
```

Sobre o Tailwind: o projeto já tinha um design system próprio em CSS, com tokens compartilhados entre o app e o e-book. Manter tudo na mesma fonte foi mais simples e consistente do que acrescentar uma segunda camada de estilo.

## Rodando localmente

Requisitos: Node 20+ (testado com 22). Para os testes de banco: PostgreSQL 16 instalado (`/usr/lib/postgresql/16/bin`).

```bash
cd pele-em-foco
npm install
npm run dev              # http://localhost:5173 — sem .env.local roda em MODO DEMONSTRAÇÃO
```

No modo demonstração há uma faixa amarela fixa avisando. Contas e dados ficam no navegador, senhas são guardadas só como hash PBKDF2, e os botões “Simular compra / Simular bônus expirado / Remover acesso” existem **apenas** nesse modo. O build de produção com Supabase elimina todo esse código (verificado no bundle).

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run typecheck` | TypeScript |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:db` | Sobe um Postgres temporário, aplica as migrations e roda os testes de acesso e RLS |
| `VITE_DEMO_MODE=true npm run build && npm run test:e2e` | Fluxos completos no navegador, celular e desktop |
| `npm run build` | Build de produção |
| `npm run db:seed-articles` | Regenera o seed SQL da biblioteca a partir de `src/content/articles.ts` |
| `npm run ebook:pdf` / `npm run ebook:samples` | PDF do e-book e páginas de amostra |

## Configurando o Supabase

Passo a passo completo em [`docs/SUPABASE.md`](docs/SUPABASE.md). Resumo:

1. Criar o projeto (região São Paulo) → copiar URL e anon key para `.env.local`.
2. `supabase link --project-ref <ref>` e `supabase db push` (aplica as duas migrations).
3. Auth: confirmação de e-mail **ligada**, senha mínima 8, URLs de redirecionamento (`/app`, `/redefinir-senha`), SMTP próprio para produção.
4. `supabase functions deploy cakto-webhook --no-verify-jwt` e `supabase functions deploy delete-account`.
5. `supabase secrets set CAKTO_WEBHOOK_SECRET=... CAKTO_PRODUCT_ID=... APP_ORIGIN=https://seu-dominio`.
6. Criar o webhook na Cakto apontando para a função (eventos `purchase_approved`, `refund`, `chargeback`) — veja [`docs/CAKTO.md`](docs/CAKTO.md).

Enquanto o webhook não estiver no ar, dá para liberar uma compra manualmente no SQL Editor:

```sql
select public.record_verified_purchase('email@do-comprador.com', 'pedido-cakto-123', null, 'approved', 'manual');
```

## Deploy (Vercel)

1. Projeto com **Root Directory = `pele-em-foco`** (o `vercel.json` já faz o rewrite das rotas).
2. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e as da página de vendas (veja `.env.example`). **Não** defina `VITE_DEMO_MODE` em produção.
3. Depois do deploy, adicione o domínio em Supabase → Auth → URL Configuration.

Sem as variáveis do Supabase e sem `VITE_DEMO_MODE`, o build de produção mostra “App em configuração” em vez de rodar o modo demo por engano.

## Antes de clientes reais

Checklist detalhado em [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md). O mínimo:

- [ ] Projeto Supabase criado, migrations aplicadas e os cenários de `docs/SUPABASE.md` §5 conferidos no projeto real (cadastro, confirmação de e-mail, ativação, isolamento, expiração, reembolso).
- [ ] SMTP próprio configurado (o e-mail padrão do Supabase tem limite baixo de envios e não serve para produção).
- [ ] Edge Functions implantadas; um evento de teste da Cakto ativa o acesso; um reembolso revoga.
- [ ] Exclusão de conta testada de ponta a ponta.
- [ ] Revisão jurídica de privacidade e termos; revisão técnica do conteúdo por dermatologista.

## Repositório público e o e-book

Este repositório é **público**. Por isso `ebook/src/pele-em-foco.html` e `ebook/dist/` estão no `.gitignore`. Os artigos curtos da biblioteca estão no código (são o seed do banco).
