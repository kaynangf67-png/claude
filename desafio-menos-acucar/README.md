# Desafio Menos Açúcar

Desafio gamificado de 21 dias para adultos brasileiros que querem ter uma relação mais consciente com doces e bebidas adoçadas. Missões curtas, guia de alternativas, XP, conquistas e um relatório final. O app não promete emagrecimento nem resultado de saúde e não pune quem perde um dia.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # regras do desafio (dias, XP, conquistas, guia) e o backend de demonstração
npm run typecheck  # gera os tipos de rota do Next e roda o tsc
npm run build
```

Sem variáveis de ambiente o app roda em **modo demonstração**: a conta e o progresso ficam no `localStorage` do navegador. A interface avisa isso o tempo todo. Em `/entrar` ou `/criar-conta`, **"Explorar com uma conta de exemplo"** abre uma conta já no Dia 6, marcada como "dados de exemplo". Em *Perfil → Ferramentas de demonstração* dá para simular a passagem de um dia.

> O modo demonstração **não é seguro** e não pretende ser. A senha vira um hash SHA-256 no próprio navegador só para o login funcionar como o real. É para testar o produto, não para guardar dados de verdade.

## Ligando o Supabase (modo real)

1. Crie um projeto no Supabase.
2. Aplique, em ordem, `supabase/migrations/0001_init.sql` e `0002_beta.sql` (`supabase db push`, ou cole no SQL Editor).
3. Em *Authentication → URL Configuration*, adicione `http://localhost:3000` e a URL de produção. O link de confirmação de e-mail volta para `/auth/confirmar`.
4. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL`.

A anon key é pública por design. Quem protege os dados é o **RLS**. Nunca coloque `service_role`, chaves de pagamento ou segredos de webhook em variáveis `NEXT_PUBLIC_*`.

**O que já foi verificado.** As migrations foram aplicadas num PostgreSQL 16 local (schema `auth` simulado) e atacadas com `supabase/tests/rls_manual.sql` e `supabase/tests/beta_manual.sql`. As regras do beta também foram testadas no projeto real, simulando um participante dentro de uma transação desfeita no fim. O fluxo cadastro → confirmação → quiz → missão já rodou em produção com uma conta real.

### O que o banco garante (não a interface)

| Regra | Onde |
|---|---|
| Cada pessoa só lê e altera os próprios dados | Políticas RLS em todas as tabelas |
| Só dá para concluir missão já liberada pelo calendário | Política de `insert` em `mission_completions` + `challenge_unlocked_day()` |
| A data de início do desafio não pode ser alterada pelo cliente | Só `display_name` tem `grant update`; o início é definido por `start_challenge()` |
| Data de conclusão vem do servidor | `completed_at` sem `grant insert` para o cliente |
| Uma conclusão por dia | `unique (user_id, day)` |
| Compras e acesso são só leitura | `purchases` e `access_grants` sem políticas de escrita |
| Sem acesso ativo não há desafio | `has_active_access()` nas políticas de missões, quiz, estratégias e em `start_challenge()` / `submit_feedback()` |
| Cadastro exige o aceite do aviso de privacidade | O gatilho `handle_new_user()` recusa contas sem `terms_version` |
| Feedback validado no servidor | Só via `submit_feedback()`: etapa liberada, uma resposta por etapa, chaves e opções conhecidas, até 1000 caracteres |
| Admin não depende do cliente | Tabela `admins` sem política de escrita; `admin_beta_metrics()` e `admin_feedback()` checam `is_admin()` |

O "hoje" do servidor usa o fuso do perfil (`America/Sao_Paulo` por padrão). O modo demonstração usa o relógio do navegador.

## Programa beta: Primeira Turma

**Regra de acesso.** Enquanto `app_config.beta_signups_open` for `true`, toda conta nova recebe um `access_grants` com `source = 'beta'` e `cohort = 'primeira-turma'`. As políticas do desafio só olham `has_active_access()`. Para virar pago no futuro, a regra não muda: o que muda é **quem cria o grant** (um webhook de pagamento verificado, com `source = 'purchase'`).

```sql
-- Fechar inscrições da Primeira Turma (contas novas ficam sem acesso; as atuais continuam)
update public.app_config set value = 'false' where key = 'beta_signups_open';
-- Reabrir
update public.app_config set value = 'true' where key = 'beta_signups_open';
```

**Tornar alguém administrador** (no SQL Editor do Supabase; não existe caminho pelo app):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'SEU-EMAIL@exemplo.com';
```

Depois, entre no app com essa conta e abra `/admin`. Administradores não entram nas métricas. Para remover o acesso, apague a linha correspondente em `public.admins` pelo Table Editor.

**Pesquisas.** Inicial (após o questionário), Dia 7 e Dia 21, todas opcionais, mais o "Fale com a gente" no Perfil (assunto + mensagem, inclusive pedidos sobre dados). As perguntas ficam em `src/domain/feedback.ts`, e as chaves aceitas, em `submit_feedback()` no banco: mudar uma exige mudar a outra.

**Métricas** (`/admin`): cadastrados → iniciaram (fizeram o questionário) → fizeram 1+ missão → voltaram (missões em 2 ou mais dias diferentes) → chegaram ao Dia 7 (concluíram a missão 7) → concluíram (21 missões). Também mostra conclusões por missão, taxa de resposta das pesquisas sobre quem já podia responder, dificuldades e objetivos do questionário, facilidade de uso, se recomendaria e se pagaria. As respostas individuais mostram só o primeiro nome.

**Consentimento.** O cadastro tem duas caixas separadas: o aceite do aviso de privacidade (com declaração de 18+), que é obrigatório, e o recebimento de novidades por e-mail, que é opcional e pode mudar a qualquer momento no Perfil. Contas criadas antes do aviso veem uma tela de aceite no próximo acesso. Mudou o texto de `/privacidade`? Suba `TERMS_VERSION` em `src/services/backend.ts`.

## Arquitetura

```
src/
  app/                    rotas (App Router)
    page.tsx              landing pública
    entrar/, criar-conta/ autenticação
    onboarding/           quiz de uma pergunta por tela
    (app)/                área logada com navegação: inicio, desafio, desafio/[dia], guia, progresso, perfil, relatorio
    auth/confirmar/       troca o código do e-mail de confirmação por sessão (Supabase)
  proxy.ts                (Next 16 "middleware") renova sessão e redireciona visitante; não age no modo demo
  domain/                 REGRAS E CONTEÚDO, sem React: tipos, missões, quiz, guia, XP/níveis/conquistas, personalização
  validation/schemas.ts   zod: quiz, cadastro, login, conclusão de missão (mensagens em pt-BR)
  services/
    backend.ts            contrato único de dados (Backend)
    demoBackend.ts        localStorage
    supabaseBackend.ts    Supabase (RLS faz a segurança)
    index.ts              único ponto que escolhe demo ou Supabase
    quizDraft.ts          rascunho do quiz salvo a cada resposta
  components/
    ui/                   design system: Button, Card, Badge, Field, Progress, Notice, Logo
    landing/, quiz/, app/ componentes por área
    views/                telas da área logada (client components)
supabase/migrations/      schema + RLS
```

Decisões que valem saber:

- **XP, nível e conquistas são derivados** dos registros (`mission_completions`, `saved_strategies`), nunca armazenados. Uma fonte da verdade, nada para dessincronizar. A data de cada conquista é a data do registro que a desbloqueou.
- **Dia perdido não bloqueia nada.** Uma missão nova abre por dia; as anteriores ficam disponíveis. Não há sequência (streak) para quebrar, de propósito.
- **Personalização** muda a versão sugerida da missão (rápida/completa), a dica do painel e a ordem do guia. Ela não esconde conteúdo.
- O quiz não coleta peso, exames, diagnóstico nem outro dado de saúde.

## Design

Tokens em `src/app/globals.css`. Mudanças em relação ao briefing, por contraste (WCAG AA, 4,5:1 para texto):

- `#737A72` no off-white dá 4,11:1 e reprova. O cinza secundário virou `#646B63` (5,12:1).
- `#58A878` no off-white dá 2,68:1. Ele fica só em preenchimentos e ícones; textos verdes usam `#2F7A4F` (4,87:1) ou `#A6D8B8` sobre o verde floresta (6,07:1).

Fontes: Newsreader (títulos) e Figtree (texto) via `next/font`. Ícones: Lucide. Animações respeitam `prefers-reduced-motion`.

## O que falta (próximas fases)

- **Pagamento.** O controle de acesso já existe (`access_grants` + `has_active_access()`). Falta escolher o provedor e criar o webhook no servidor, com verificação de assinatura e `SUPABASE_SERVICE_ROLE_KEY` só no servidor, que cria grants com `source = 'purchase'` e fechar `beta_signups_open`.
- Recuperação de senha (não há link "esqueci minha senha" ainda, para não exibir um botão que não funciona).
- Exclusão de conta pelo próprio app (precisa de função no servidor com `service_role`). Hoje o pedido chega pelo "Fale com a gente → Meus dados / privacidade" e a exclusão é feita no painel do Supabase (Authentication → Users → Delete user, que apaga em cascata). "Recomeçar o desafio" apaga o progresso, mas mantém as respostas das pesquisas.
- E-mails de cadastro: o envio padrão do Supabase tem limite baixo por hora. Para turmas maiores, configure um SMTP próprio.
- Lembretes/notificações diárias.
- Testes de ponta a ponta automatizados (o fluxo foi verificado manualmente no navegador).
