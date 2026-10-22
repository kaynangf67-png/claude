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
2. Aplique `supabase/migrations/0001_init.sql` (`supabase db push`, ou cole o arquivo no SQL Editor).
3. Em *Authentication → URL Configuration*, adicione `http://localhost:3000` e a URL de produção. O link de confirmação de e-mail volta para `/auth/confirmar`.
4. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL`.

A anon key é pública por design. Quem protege os dados é o **RLS**. Nunca coloque `service_role`, chaves de pagamento ou segredos de webhook em variáveis `NEXT_PUBLIC_*`.

**O que já foi verificado e o que não foi.** A migration foi aplicada num PostgreSQL 16 local com o schema `auth` e os papéis `anon`/`authenticated` simulados, e as regras abaixo foram atacadas uma a uma com `supabase/tests/rls_manual.sql` (leitura e escrita entre usuários, dia bloqueado, data forjada, compra forjada). Todas se comportaram como esperado. **O `SupabaseBackend` (cliente JS) ainda não rodou contra um projeto Supabase real**: faça o fluxo completo (cadastro → confirmação de e-mail → quiz → missão) num projeto de teste antes de abrir para usuários.

### O que o banco garante (não a interface)

| Regra | Onde |
|---|---|
| Cada pessoa só lê e altera os próprios dados | Políticas RLS em todas as tabelas |
| Só dá para concluir missão já liberada pelo calendário | Política de `insert` em `mission_completions` + `challenge_unlocked_day()` |
| A data de início do desafio não pode ser alterada pelo cliente | Só `display_name` tem `grant update`; o início é definido por `start_challenge()` |
| Data de conclusão vem do servidor | `completed_at` sem `grant insert` para o cliente |
| Uma conclusão por dia | `unique (user_id, day)` |
| Compras e acesso são só leitura | `purchases` e `access_grants` sem políticas de escrita |

O "hoje" do servidor usa o fuso do perfil (`America/Sao_Paulo` por padrão). O modo demonstração usa o relógio do navegador.

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

- **Pagamento e controle de acesso.** As tabelas `purchases` e `access_grants` existem, mas nada as preenche e **o app não bloqueia ninguém hoje**: quem cria conta usa tudo. Antes de vender, é preciso escolher o provedor, criar o webhook no servidor com verificação de assinatura (usando `SUPABASE_SERVICE_ROLE_KEY`, só no servidor) e checar `access_grants` nas políticas RLS das tabelas do desafio.
- Recuperação de senha (não há link "esqueci minha senha" ainda, para não exibir um botão que não funciona).
- Exclusão de conta no modo Supabase (precisa de função no servidor com `service_role`). Hoje existe "Recomeçar o desafio", que apaga o progresso.
- Lembretes/notificações diárias.
- Testes de ponta a ponta automatizados (o fluxo foi verificado manualmente no navegador).
