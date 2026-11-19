# LumePro — página de produto único

Página de vendas do **Depilador Elétrico de Sobrancelhas LumePro** por **R$ 99,90**.
Oferta única: sem order bump, sem upsell, sem produtos adicionais.

| Arquivo | O que é |
|---|---|
| `index.html` | Página de vendas (11 blocos) + janela de checkout |
| `politicas.html` | Privacidade, entrega, trocas e devoluções, pagamento |
| `loja.js` | **Configuração comercial**: dados da loja, atendimento, textos das políticas, modo de checkout |
| `api/checkout.js` | Checkout Mercado Pago (função serverless da Vercel) |
| `fotos/` | Fotografias do produto (veja `fotos/LEIA-ME.txt`) |

## O que falta preencher antes de publicar

Abra a página com **`?revisao=1`** no fim do endereço (ex.: `https://seudominio.com.br/?revisao=1`).
Aparece uma caixa listando tudo o que ainda está pendente. Na página, cada informação
que falta aparece como **"Pendente: …"** até ser preenchida em `loja.js`.

- **Loja:** razão social, CNPJ, endereço comercial.
- **Atendimento:** e-mail, WhatsApp, horário.
- **Entrega:** prazo de envio, prazo de entrega, frete, transportadora, rastreio.
- **Trocas:** como solicitar e como é feito o reembolso.
- **Privacidade:** ferramentas de medição/anúncio usadas (ex.: Meta Pixel), data de atualização.
- **Checkout:** credencial do Mercado Pago e valor do frete (abaixo).

A página não mostra avaliações, número de vendas, estoque limitado, frete grátis,
garantia da loja nem prazo de entrega, porque essas informações não foram fornecidas.
A política de trocas cita apenas os prazos previstos em lei no Código de Defesa do Consumidor
(arrependimento em 7 dias, art. 49; reclamação de defeito em 90 dias, art. 26, II).

## Checkout

Escolha **um** modo em `loja.js → checkout.modo`.

### Modo `"mercadopago"` (padrão)

O cliente preenche nome, e-mail, WhatsApp e endereço de entrega na própria página
(o CEP preenche o endereço pelo ViaCEP) e é levado ao **Checkout Pro do Mercado Pago**,
onde paga com as formas habilitadas na sua conta (Pix, cartão, boleto…).

1. Publique a pasta `lumepro/` na Vercel (Root Directory = `lumepro`).
2. Em **Settings → Environment Variables**, crie:
   - `MP_ACCESS_TOKEN` — Access Token da sua conta Mercado Pago
     (Mercado Pago Developers → Suas integrações → Credenciais).
     Comece com a credencial **de teste** para validar o fluxo e depois troque pela de produção.
   - `LUMEPRO_FRETE` — valor do frete em reais, ex.: `19.90`. Use `0` **somente** se a loja
     decidir não cobrar frete. Sem essa variável o checkout fica bloqueado (nada é cobrado).
   - Opcional: `LUMEPRO_SITE_URL` (endereço público, para o retorno após o pagamento) e
     `LUMEPRO_WEBHOOK_URL` (para receber notificações de pagamento).
3. Faça um novo deploy e teste uma compra.

**Segurança do preço:** o valor de R$ 99,90 está fixo no servidor (`api/checkout.js`).
O navegador não consegue alterá-lo. Sempre 1 unidade.

**Onde ver os pedidos:** no painel do Mercado Pago. Cada pagamento tem a referência
do pedido (`LP-…`) e os dados de entrega nos metadados (`metadata.entrega`) e no endereço
de envio da preferência. Para receber os pedidos automaticamente (e-mail, planilha, ERP),
configure `LUMEPRO_WEBHOOK_URL`.

Sem `MP_ACCESS_TOKEN` e `LUMEPRO_FRETE`, o botão abre a janela de checkout com o aviso
"O pagamento ainda não está disponível" e o botão de pagamento desativado. Nenhum
pagamento ou pedido é simulado.

### Modo `"link"`

Se você usa uma plataforma de checkout (Yampi, Cartpanda, Shopify, link de pagamento…),
defina `checkout.modo: "link"` e `checkout.link: "https://..."`. Todos os botões de compra
levam direto a esse endereço, repassando os parâmetros `utm_*`, `fbclid`, `gclid` e `ttclid`
do anúncio. Frete, prazo e formas de pagamento passam a ser exibidos pela plataforma.

## Botões de compra

"QUERO MEU LUMEPRO" (primeira dobra e detalhes), "GARANTIR MEU LUMEPRO" (oferta final)
e a barra fixa do celular abrem o checkout. "Comprar", no topo, leva à oferta.

## Imagens

- Fotos reais usadas: primeira dobra/oferta, retoque (bloco 1), uso (bloco 2), detalhes (bloco 5).
- Ilustrações, sempre com o rótulo **"Ilustração"**: LED (bloco 3), nécessaire (bloco 4),
  passo a passo (bloco 6) e itens da embalagem (bloco 7). Foram desenhadas a partir das
  fotos do produto real (corpo branco, ponta cobre com bico dourado, tampa com recorte em V).
- Para trocar uma ilustração por foto real, veja os comentários `<!-- Foto real: ... -->` no `index.html`.

## Testar localmente

A página abre direto no navegador (`index.html`), mas o checkout Mercado Pago só funciona
publicado na Vercel (ou com `vercel dev`), porque depende de `api/checkout.js`.
