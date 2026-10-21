# Entrega do produto e acesso ao app

O produto vendido é o **app**, com pagamento único e acesso vitalício. Não há arquivo para entregar: a entrega é a liberação do acesso na conta.

## Jornada

1. **Descoberta** — redes sociais e anúncios levam para o teste grátis (`/`). Quem quer pular o teste vai para `/conhecer`.
2. **Teste** — 6 perguntas com imagens, no navegador, sem salvar respostas. O resultado mostra o que a rotina precisa, quando procurar dermatologista e a oferta do app.
3. **Compra** — o botão leva ao checkout da **Cakto** (`VITE_CHECKOUT_URL`). Pagamento, recibo e e-mail de confirmação são da Cakto (`docs/CAKTO.md`).
4. **Registro da compra** — o webhook da Cakto chama a Edge Function `cakto-webhook`, que grava a compra aprovada em `verified_purchases`.
5. **Conta** — `/obrigado` (página de agradecimento da Cakto, após Pix/cartão) e o e-mail da Cakto orientam a criar a conta **com o mesmo e-mail da compra** e confirmar o e-mail.
6. **Ativação** — ao entrar, o app chama `claim_verified_purchase()`; o banco cria um acesso **vitalício** (`expires_at = 'infinity'`).
7. **Reembolso/chargeback** — o webhook marca a compra e o banco revoga o acesso ligado ao pedido. A pessoa ainda pode ler, exportar e apagar os próprios dados.

## Por que o e-mail precisa ser confirmado

Sem confirmação, qualquer pessoa poderia criar uma conta com o e-mail de um comprador e usar a compra dele. `claim_verified_purchase()` recusa contas com `email_confirmed_at` vazio.

## “Vitalício”

Vale enquanto o app for oferecido (veja os termos): se for descontinuado, aviso de pelo menos 30 dias pelo e-mail da conta e exportação dos dados. Pagamento único não cobre custos recorrentes de hospedagem e e-mail: acompanhe esse custo por cliente.

## Situação

| Item | Situação |
|---|---|
| Schema, RLS, ativação, revogação | Implementado e testado em Postgres local (`npm run test:db`) |
| Webhook (`supabase/functions/cakto-webhook`) | Implementado; lógica testada (`src/lib/cakto.test.ts`); **não implantado** |
| Exclusão de conta (`supabase/functions/delete-account`) | Implementado; **não implantado** |
| Liberação manual (sem webhook) | `select public.record_verified_purchase('email', 'pedido', null, 'approved', 'manual');` no SQL Editor |

## Casos de borda

- **Comprou com um e-mail e criou a conta com outro:** não ativa. O suporte resolve registrando manualmente a compra com o e-mail da conta (`record_verified_purchase` com um id de pedido novo, ex.: `pedido-123-ajuste`).
- **Pagamento por boleto:** a compra só é registrada quando a Cakto aprova; até lá o app mostra “Seu acesso ainda não está ativo” e o botão “Verificar novamente”.
- **Duas compras com o mesmo e-mail:** com acesso vitalício a segunda não muda nada. Ofereça reembolso da segunda.

## Modelo de e-mail de entrega (se a Cakto permitir personalizar)

> **Assunto:** Seu acesso ao Pele em Foco
>
> Olá!
>
> Para liberar o app, crie sua conta em https://SEU-DOMINIO/criar-conta usando **este mesmo e-mail** e confirme o e-mail. O acesso é vitalício, sem mensalidade.
>
> Lembrete: o app é educativo e não substitui consulta com dermatologista.
>
> Dúvidas: [E-MAIL DE SUPORTE] · Reembolso: até [N] dias após a compra, em app.cakto.com.br/refund ou respondendo este e-mail.
