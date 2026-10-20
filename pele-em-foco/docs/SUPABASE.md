# Supabase — configuração

## 1. Projeto

1. Crie um projeto em supabase.com, região **South America (São Paulo)**.
2. *Settings → API*: copie **Project URL** e **anon public key** para `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. **Nunca** copie a `service_role` para variáveis `VITE_*`, para o repositório ou para o frontend.

## 2. Banco

```bash
npm i -g supabase            # ou use npx supabase
supabase login
supabase link --project-ref <ref-do-projeto>
supabase db push             # aplica supabase/migrations/*.sql
```

Alternativa sem CLI: cole, em ordem, os dois arquivos de `supabase/migrations/` no SQL Editor.

### Tabelas

| Tabela | Conteúdo | Quem lê | Quem escreve |
|---|---|---|---|
| `profiles` | nome exibido, data do aceite do aviso | o dono | trigger na criação da conta; o dono altera só `display_name` |
| `verified_purchases` | e-mail, pedido, status vindos da Cakto | ninguém pelo app | `record_verified_purchase` (só `service_role`) |
| `access_entitlements` | `user_id`, `status`, `starts_at`, `expires_at`, `source`, `external_order_id`, `created_at` | o dono | só funções privilegiadas (`claim_verified_purchase`, `record_verified_purchase`) |
| `routine_completions` | dia, período, passo | o dono | o dono, **com acesso ativo**; único por (usuário, dia, período, passo) |
| `journal_entries` | data, notas, sensação, observações, produtos | o dono | criar/editar com acesso ativo; apagar sempre |
| `educational_articles` | artigos e fontes | usuários **com acesso ativo** | só migrations / painel |

### Funções

| Função | Para quê | Executável por |
|---|---|---|
| `get_my_access()` | situação para a interface (`active`, `expired`, `revoked`, `none`) | `authenticated` |
| `claim_verified_purchase()` | vincula compra aprovada ao usuário (e-mail confirmado e igual) e ativa 30 dias. Cada compra ativa uma vez, mesmo se a conta for excluída e recriada | `authenticated` |
| `record_verified_purchase(email, pedido, produto, status, origem)` | grava compra (`approved`/`refunded`/`chargeback`); reembolso revoga | `service_role` |
| `delete_my_data()` | apaga rotina e diário do usuário | `authenticated` |
| `private.has_active_access()` | usada nas políticas RLS | interna |

### Testar as regras

`npm run test:db` roda 58 verificações num Postgres local com um *stub* do schema `auth`. O stub imita `auth.uid()` e os grants padrão do Supabase, mas **não é o Supabase**: depois do `db push`, repita os cenários principais no projeto real (duas contas de teste, uma com compra registrada manualmente).

## 3. Auth

*Authentication → Providers → Email*:
- **Confirm email: ligado** (a ativação do bônus exige e-mail confirmado; sem isso, alguém poderia criar conta com o e-mail de outra pessoa).
- Senha mínima: 8.

*Authentication → URL Configuration*:
- Site URL: `https://seu-dominio`
- Redirect URLs: `https://seu-dominio/app`, `https://seu-dominio/redefinir-senha` (e os equivalentes `http://localhost:5173/...` para desenvolvimento).

*Authentication → Emails*:
- Traduza os modelos (confirmação, redefinição de senha) para português.
- Configure **SMTP próprio** (Resend, Postmark, Amazon SES…). O serviço de e-mail padrão do Supabase tem limite baixo de envios e é só para testes.

## 4. Edge Functions

```bash
supabase functions deploy cakto-webhook --no-verify-jwt
supabase functions deploy delete-account
supabase secrets set CAKTO_WEBHOOK_SECRET=<segredo da Cakto> CAKTO_PRODUCT_ID=<id do produto> APP_ORIGIN=https://seu-dominio
```

- `cakto-webhook`: URL `https://<ref>.supabase.co/functions/v1/cakto-webhook`. Sem JWT (a Cakto não manda); valida o `secret` do corpo em tempo constante.
- `delete-account`: exige o JWT do usuário; usa a `service_role` só no servidor para apagar `auth.users` (o resto apaga em cascata).

Nenhuma das duas foi implantada ou testada contra o Supabase real neste projeto.

## 5. Primeira verificação no projeto real

1. Crie a conta A (e-mail que você controla) e confirme. O app deve mostrar “Seu acesso ainda não está ativo”.
2. No SQL Editor: `select public.record_verified_purchase('<email A>', 'teste-1', null, 'approved', 'manual');`
3. No app, “Verificar novamente” → acesso ativo por 30 dias; marque passos e crie um registro no diário.
4. Crie a conta B e confirme que ela não vê nada de A.
5. `update public.access_entitlements set expires_at = now() - interval '1 minute' where external_order_id = 'teste-1';` → A vê “período terminou”, não grava, mas lê o histórico.
6. `select public.record_verified_purchase('<email A>', 'teste-1', null, 'refunded', 'manual');` → acesso revogado.
7. Exclua a conta B pelo Perfil e confira em *Authentication → Users*.
