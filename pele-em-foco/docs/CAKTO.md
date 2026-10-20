# Configuração na Cakto

Pesquisado em 20/10/2026 na central de ajuda, no blog, na página de reembolso e na documentação da API da Cakto. O ambiente de desenvolvimento **não conseguiu abrir as páginas da Cakto diretamente**: as informações vieram dos trechos indexados por mecanismos de busca. **Confira cada passo no painel**, porque menus mudam de nome.

## 1. Criar o produto

1. No painel da Cakto: **Produtos → criar produto**, tipo pagamento único.
2. Preço: o valor que você definir (é o mesmo texto de `VITE_PRICE_LABEL`).
3. Taxas informadas pela Cakto (confira no painel antes de precificar): Pix 0% + R$ 2,49; cartão 4,99% + R$ 2,49; sem mensalidade.

## 2. Escolher como entregar o PDF

Na seção de entrega do produto há duas opções. Escolha uma e use o mesmo valor em `VITE_CAKTO_DELIVERY`:

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **Acesso por e-mail** (`email`) | O PDF (ou link) chega no e-mail de confirmação da compra | Menos atrito: o cliente baixa direto | Você controla pouco o texto do e-mail |
| **Cakto Members** (`members`) | O cliente recebe login e senha e acessa em aluno.cakto.com.br | Lugar fixo para o PDF, o link do app e futuras atualizações | Mais um login; há relatos públicos de dificuldade de acesso após a compra |

**Recomendação:** comece por **e-mail**. Para um e-book barato, cada passo extra até o arquivo gera chamado no suporte. O link do app já está na última página do PDF e em `/obrigado`, então não depende do texto do e-mail.

Seja qual for a escolha, suba o PDF **gerado com `ebook/config.json` preenchido** (principalmente `appUrl` e `bonusEndDate`), para o link do app aparecer impresso no e-book.

## 3. Página de obrigado

1. No produto: **Upsell/Downsell** → ative **“Este produto tem uma página de agradecimento personalizada ou upsell”**.
2. Cole `https://SEU-DOMINIO/obrigado`. A ajuda da Cakto menciona um “Gerador de Upsell” para páginas externas, com botões de aceite e recusa. Isso é para quem tem oferta de upsell. Se você não tiver, teste se a Cakto redireciona direto para a URL sem exigir os botões.
3. A Cakto só redireciona para essa página **depois de Pix ou cartão aprovados**. No boleto ela mostra a página padrão dela, então quem paga com boleto depende do e-mail.
4. `/obrigado` **não confirma pagamento** e não libera nada. Qualquer pessoa pode abrir essa URL, e tudo bem: ela só orienta.

## 4. Link do checkout

Em **Produtos → seu produto → Ver links**, copie o link da oferta (`https://pay.cakto.com.br/...`) para `VITE_CHECKOUT_URL` na hospedagem. Se o link não for `pay.cakto.com.br`, a página de vendas mostra a faixa “em configuração”.

## 5. Reembolso (como funciona na Cakto)

- O comprador pede em **app.cakto.com.br/refund**, em até **7 dias corridos** após a compra (art. 49 do CDC, segundo a própria Cakto).
- Se você não responder em **24 horas**, a Cakto estorna automaticamente.
- O valor volta pelo meio de pagamento original. O prazo de devolução depende do método (a Cakto cita até 7 a 15 dias úteis em um texto e prazos por método em outro).
- Se `VITE_REFUND_DAYS` for maior que 7, os dias extras só funcionam pelo seu suporte (estorno manual no painel). Não prometa o que você não vai conseguir cumprir.
- Há reclamações públicas no Reclame Aqui sobre reembolso negado ou atrasado na Cakto. Responda os pedidos rápido: o problema cai na sua reputação, não na da plataforma.

## 6. Compra de teste (obrigatória antes de anunciar)

- [ ] Compra com Pix de valor real (ou cupom de 100%, se a Cakto permitir no seu plano), com um e-mail seu.
- [ ] O e-mail da Cakto chegou? O PDF abre? O link do app na última página funciona?
- [ ] O redirecionamento para `/obrigado` aconteceu?
- [ ] Pedido de reembolso em app.cakto.com.br/refund funciona e o estorno aparece?
- [ ] Repetir no celular.

## 7. Webhooks (só para a próxima etapa, com backend)

Hoje o site **não recebe nada da Cakto**. Quando houver backend para controlar o acesso ao app (`docs/ACESSO-E-ENTREGA.md`):

- Eventos relevantes: `purchase_approved` (liberar), `refund` e `chargeback` (revogar). Também existem `purchase_refused` e `refund_requested`.
- O webhook é criado com os produtos e eventos desejados, e a Cakto devolve um `secret`. Segundo a documentação e exemplos públicos, o `secret` vem **no corpo** do JSON (não em cabeçalho HMAC), junto com `event` e `data` (com `customer`, `product`, `offer`, `status`…). Compare o `secret` no servidor e rejeite se não bater.
- Responda em até 8 segundos.
- Reenvio de evento usa o payload original. Um pedido reembolsado depois pode ter o `purchase_approved` antigo reenviado, então trate eventos por ordem/estado, não só pelo último que chegou.
- Valide os campos com um evento de teste real da sua conta antes de confiar no formato.

## Fontes

- Blog Cakto — O que é ebook e como vender: https://www.cakto.com.br/blog/o-que-e-ebook
- Ajuda — Como funciona a Área de Membros: https://ajuda.cakto.com.br/pt-br/articles/13-como-funciona-a-area-de-membros-da-cakto
- Ajuda — Como configurar a página de obrigado: https://ajuda.cakto.com.br/pt-br/articles/114-o-que-e-e-como-funcionam-as-paginas-de-obrigado
- Ajuda — Upsell e funis: https://ajuda.cakto.com.br/pt-br/articles/15-como-configurar-upsell-e-diferentes-funis-na-cakto
- Política de reembolso: https://www.cakto.com.br/reembolso
- Ajuda — Como solicitar reembolso: https://ajuda.cakto.com.br/pt-br/articles/116-como-solicitar-reembolso-na-cakto
- API — Criar webhook: https://docs.cakto.com.br/api-reference/webhooks/create
- API — Primeira venda: https://docs.cakto.com.br/comece-aqui/receber-primeira-venda
