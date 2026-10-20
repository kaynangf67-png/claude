# Entrega do produto e acesso ao app

## Jornada pretendida

1. **Descoberta** — conteúdo nas redes sociais leva para a página de vendas (`/`).
2. **Página de vendas** — explica o guia, mostra amostras, o bônus e as condições.
3. **Compra** — botão leva ao checkout da plataforma (`VITE_CHECKOUT_URL`). Pagamento, nota/recibo e e-mail de confirmação são da plataforma.
4. **Entrega do e-book** — a plataforma envia o PDF (`ebook/dist/pele-em-foco.pdf`, enviado por você como arquivo do produto na plataforma).
5. **Acesso ao app** — o e-mail de entrega (modelo abaixo) e a última página do PDF trazem o link do app. A URL de redirecionamento pós-compra aponta para `/obrigado`.
6. **Período do bônus** — data única para todos os compradores (`VITE_BONUS_END_DATE`), exibida na página de vendas, no app, nos termos e no PDF (`ebook/config.json → bonusEndDate`).

## O que está implementado (e o que não está)

| Item | Situação |
|---|---|
| Botão de compra para checkout externo | Implementado. Sem URL configurada, o botão fica desativado. **Não testado com checkout real** (nenhum link foi fornecido). |
| Página `/obrigado` | Implementada. **Não confirma pagamento e não libera nada**; só orienta. |
| PDF para upload na plataforma | Gerado e inspecionado. |
| App acessível pelo link | Implementado. **Sem controle de acesso**: qualquer pessoa com o link usa o app. |
| Período do bônus | Data configurável, exibida em todo lugar e com aviso de encerramento no app. **Não bloqueia o uso após a data.** |
| Validação de compra, login, expiração no servidor | **Não implementado.** |

Isso é deliberado: sem backend, qualquer “trava” no navegador (parâmetro de URL, código no `localStorage`) seria contornável em segundos e daria uma falsa sensação de segurança.

## Por que uma data única, e não “X dias após a compra”

“30 dias a partir da compra” exige saber, no servidor, quando cada pessoa comprou. Sem backend isso não existe. A data única é honesta, simples de comunicar e funciona hoje. Para mudar para prazo por comprador, siga a próxima seção.

## Caminho para acesso restrito de verdade (próxima etapa)

Requer um backend (sugestão: Supabase) e o webhook da plataforma de pagamento.

1. **Banco:** tabela `entitlements (email text primary key, purchased_at timestamptz, expires_at timestamptz, status text, order_id text unique)` com RLS: o usuário autenticado só lê a linha do próprio e-mail; ninguém escreve pelo cliente.
2. **Webhook:** Edge Function `payment-webhook` que valida a assinatura/token da plataforma, trata compra aprovada (cria/atualiza `entitlements` com `expires_at = purchased_at + duração`) e reembolso/chargeback (`status = 'revoked'`). Segredos (`WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) só como secrets da função, nunca em `VITE_*`.
3. **Login:** Supabase Auth com link mágico por e-mail (o mesmo e-mail da compra).
4. **Verificação:** o app consulta `entitlements` após o login; RLS garante que a resposta vem do servidor. Expirado ou revogado → tela explicando a situação e oferecendo exportar os dados.
5. **Dados na nuvem (opcional):** migrar rotina/diário do `localStorage` para tabelas com RLS por usuário. Atualizar a política de privacidade antes (passa a haver tratamento de dados no servidor).
6. **Testes obrigatórios antes de anunciar:** compra aprovada → acesso; reembolso → acesso revogado; e-mail diferente → sem acesso; expiração → bloqueio; webhook com assinatura inválida → rejeitado.

Nada disso deve ser anunciado como funcionando antes desses testes passarem.

## Configuração na plataforma de pagamento (checklist)

- [ ] Criar o produto com o PDF final como arquivo de entrega.
- [ ] Definir preço e copiar o link do checkout para `VITE_CHECKOUT_URL`.
- [ ] URL de redirecionamento pós-compra: `https://SEU-DOMINIO/obrigado`.
- [ ] Personalizar o e-mail de entrega com o modelo abaixo.
- [ ] Prazo de garantia/reembolso igual a `VITE_REFUND_DAYS` (mínimo 7).
- [ ] Fazer uma compra de teste real (ou no modo de teste da plataforma) e conferir: e-mail recebido, PDF abre, link do app abre, redirecionamento para `/obrigado`.

## Modelo de e-mail de entrega

> **Assunto:** Seu Pele em Foco chegou
>
> Olá!
>
> Obrigado por comprar o **Pele em Foco — Guia prático para entender a acne e organizar sua rotina de cuidados**.
>
> **1. Baixe o e-book:** [link de download da plataforma]
>
> **2. Acesse o app bônus:** https://SEU-DOMINIO/app
> Funciona no navegador do celular ou do computador. Dica: use “Adicionar à tela inicial” no menu do navegador.
>
> **Acesso gratuito ao app até [DATA DO BÔNUS].** Antes dessa data, avisaremos por este e-mail como fica o uso depois dela. Seus registros ficam salvos no seu aparelho e podem ser exportados a qualquer momento.
>
> Lembrete: o guia e o app são educativos e não substituem consulta com dermatologista.
>
> Dúvidas: [E-MAIL DE SUPORTE]
> Reembolso: até [N] dias após a compra, pela plataforma ou respondendo este e-mail.
>
> Pele em Foco
