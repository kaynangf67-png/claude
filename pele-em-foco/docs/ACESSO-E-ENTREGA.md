# Entrega do produto e acesso ao app

## Jornada

1. **Descoberta** — redes sociais levam para a página de vendas (`/`).
2. **Compra** — o botão leva ao checkout da **Cakto** (`VITE_CHECKOUT_URL`). Pagamento, recibo e e-mail de confirmação são da Cakto (`docs/CAKTO.md`).
3. **E-book** — a Cakto entrega o PDF por e-mail ou pela área de membros (`VITE_CAKTO_DELIVERY`).
4. **Registro da compra** — o webhook da Cakto chama a Edge Function `cakto-webhook`, que grava a compra aprovada em `verified_purchases`.
5. **Conta** — `/obrigado` (página de agradecimento da Cakto, após Pix/cartão) e a última página do PDF orientam a criar a conta **com o mesmo e-mail da compra** e confirmar o e-mail.
6. **Ativação** — ao entrar, o app chama `claim_verified_purchase()`; o banco cria um acesso de **30 dias a partir desse momento**.
7. **Expiração** — depois dos 30 dias, rotina, diário (criar/editar) e biblioteca ficam bloqueados pelo RLS; a pessoa vê uma mensagem clara e pode ler, exportar e apagar os próprios dados.
8. **Reembolso/chargeback** — o webhook marca a compra e o banco revoga o acesso ligado ao pedido.

## Por que a ativação é na criação da conta, e não na compra

“30 dias a partir da compra” penalizaria quem cria a conta dias depois. Contar a partir da ativação é mais justo e fácil de explicar. A compra continua sendo a prova: sem compra aprovada no servidor não há ativação, e cada compra ativa uma única vez (inclusive se a conta for excluída e recriada).

## Por que o e-mail precisa ser confirmado

Sem confirmação, qualquer pessoa poderia criar uma conta com o e-mail de um comprador e usar o bônus dele. `claim_verified_purchase()` recusa contas com `email_confirmed_at` vazio.

## Situação

| Item | Situação |
|---|---|
| Schema, RLS, ativação, expiração, revogação | Implementado e testado em Postgres local (`npm run test:db`) |
| Webhook (`supabase/functions/cakto-webhook`) | Implementado; lógica testada (`src/lib/cakto.test.ts`); **não implantado** |
| Exclusão de conta (`supabase/functions/delete-account`) | Implementado; **não implantado** |
| Liberação manual (sem webhook) | `select public.record_verified_purchase('email', 'pedido', null, 'approved', 'manual');` no SQL Editor |

## Casos de borda

- **Comprou com um e-mail e criou a conta com outro:** não ativa. Hoje o suporte resolve registrando manualmente a compra com o e-mail da conta (`record_verified_purchase` com um id de pedido novo, ex.: `pedido-123-ajuste`). Considere um formulário de suporte para isso.
- **Pagamento por boleto:** a compra só é registrada quando a Cakto aprova; até lá o app mostra “Seu acesso ainda não está ativo” e o botão “Verificar novamente”.
- **Duas compras com o mesmo e-mail:** a segunda fica guardada e pode ativar um novo período depois que o primeiro terminar (a pessoa entra e o app tenta a ativação).

## Modelo de e-mail de entrega (se a Cakto permitir personalizar)

> **Assunto:** Seu Pele em Foco chegou
>
> Olá!
>
> **1. Baixe o e-book:** [link de download ou da área de membros da Cakto]
>
> **2. Ative o app (30 dias de bônus):** crie sua conta em https://SEU-DOMINIO/criar-conta usando **este mesmo e-mail** e confirme o e-mail. Os 30 dias começam a contar na ativação.
>
> Lembrete: o guia e o app são educativos e não substituem consulta com dermatologista.
>
> Dúvidas: [E-MAIL DE SUPORTE] · Reembolso: até [N] dias após a compra, em app.cakto.com.br/refund ou respondendo este e-mail.
