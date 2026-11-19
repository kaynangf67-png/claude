/* =====================================================================
   CONFIGURAÇÃO COMERCIAL DA LUMEPRO
   Usada pela página de vendas (index.html) e pelas políticas (politicas.html).

   Campo vazio ("") = informação ainda não fornecida. A página mostra
   "Pendente" no lugar e lista tudo o que falta em  index.html?revisao=1
   ===================================================================== */
window.LUMEPRO = {
  // Oferta aprovada: produto único, sem order bump, sem upsell. NÃO ALTERAR.
  produto: "Depilador Elétrico de Sobrancelhas LumePro",
  preco: 99.90,

  /* CHECKOUT — escolha UM modo:
     "mercadopago": formulário de entrega nesta página + pagamento no
                    Mercado Pago (Checkout Pro). Requer as variáveis de
                    ambiente MP_ACCESS_TOKEN e LUMEPRO_FRETE na Vercel
                    (veja LEIA-ME.md). O preço é fixado no servidor.
     "link":        botão leva direto ao checkout de uma plataforma
                    (Yampi, Cartpanda, Shopify, link de pagamento etc.).
                    Preencha checkout.link com o endereço do produto. */
  checkout: {
    modo: "mercadopago",
    link: "",
  },

  loja: {
    nome: "LumePro",
    razaoSocial: "",      // ex.: "LumePro Comércio de Cosméticos Ltda."
    cnpj: "",             // ex.: "00.000.000/0001-00"
    endereco: "",         // endereço comercial completo
  },

  atendimento: {
    email: "",            // ex.: "atendimento@seudominio.com.br"
    whatsapp: "",         // só números com DDD, ex.: "11999999999"
    horario: "",          // ex.: "Segunda a sexta, das 9h às 18h"
  },

  // Textos das políticas. Escreva com as condições reais da loja.
  entrega: {
    prazoEnvio: "",       // ex.: "até 2 dias úteis após a confirmação do pagamento"
    prazoEntrega: "",     // ex.: "de 5 a 12 dias úteis, conforme a região"
    frete: "",            // como o frete é cobrado (deve bater com LUMEPRO_FRETE)
    transportadora: "",   // ex.: "Correios"
    rastreio: "",         // como o cliente recebe o código de rastreio
  },
  trocas: {
    procedimento: "",     // como solicitar troca/devolução e para onde enviar
    reembolso: "",        // como e em quanto tempo o valor é devolvido
  },
  privacidade: {
    ferramentas: "",      // ex.: "Meta Pixel e Google Analytics, para medir anúncios"
    atualizadoEm: "",     // ex.: "19/11/2026"
  },
};
