# Site — Dra. Sâmia Lima

Página única focada em levar o visitante ao WhatsApp do consultório.
React + TypeScript + Tailwind CSS v4 + Vite + Lucide. Sem outras dependências.

```bash
npm install
npm run dev        # http://localhost:5173 (modo prévia ligado)
npm run build      # typecheck + dist/ estático (Vercel, Netlify ou qualquer hospedagem)
npm run preview    # serve o dist/ como no site publicado
```

## Onde editar

**Todo o conteúdo fica em `src/config/site.ts`**: dados profissionais, textos da seção "Sobre",
tratamentos, avaliações, FAQ, mensagens do WhatsApp e SEO. Title, meta description, Open Graph,
JSON-LD (Schema.org/Dentist), `robots.txt` e `sitemap.xml` são gerados no build a partir desse arquivo.

Fotos: `src/lib/photos.ts` (instruções no próprio arquivo).

### Modo prévia

Tratamentos com `published: false`, horários e formação não confirmados **não aparecem no site publicado**.
Para revisar tudo com a Dra. Sâmia, rode `npm run dev` ou abra o site com `?previa` no endereço
(ex.: `https://seu-dominio/?previa`). Os itens pendentes aparecem com o selo "Aguardando confirmação".
A prévia recebe `noindex`.

## Pendências antes de publicar

| Item | Onde | Situação |
|---|---|---|
| Tratamentos oferecidos | `services` | Só "Consulta e avaliação" está publicado. Os outros 9 são sugestões: confirmar e mudar `published` para `true`. |
| Texto "Conheça a Dra. Sâmia" | `about.intro`, `about.bio` | **Texto proposto.** Precisa da aprovação dela. |
| Formação e trajetória | `about.credentials` | Vazio. Não aparece até ser preenchido. |
| Fotos reais | `src/lib/photos.ts` | Nenhuma foto foi fornecida. Hoje há painéis ilustrados da marca no lugar. Um retrato profissional é o que mais aumenta a confiança no site. |
| Logotipo do cartão de visita | `Wordmark` em `src/components/ui.tsx` | O cartão não foi enviado. Hoje é uma marca tipográfica provisória com a paleta informada. |
| Avaliações do Google | `reviews`, `googleRating` | Vazio. O site mostra um botão para o perfil no Google. Só cadastrar texto fiel ao original e com autorização. |
| Horários | `professional.openingHours` | Vazio. Não aparece até ser preenchido. |
| CEP | `professional.address.postalCode` | Melhora os dados estruturados. |
| Pino exato do mapa | `professional.address.mapEmbedUrl` | Hoje o mapa é gerado pelo endereço. Para o pino da ficha, use Google Maps → Compartilhar → Incorporar. |
| Domínio | `professional.siteUrl` | Sem ele não há canonical, `og:url` absoluto nem sitemap. |
| Política de privacidade | `professional.privacyPolicyUrl` | O site não coleta dados nem usa analytics. Se adicionar Google Analytics/Meta Pixel, crie a política e um aviso de cookies (LGPD). |

## Notas de ética e privacidade

- Nenhum preço, convênio, condição de pagamento, especialidade, depoimento ou número foi inventado.
- O Código de Ética Odontológica proíbe anunciar preços e formas de pagamento: por isso a seção de convênios
  só direciona para o WhatsApp.
- Fotos de pacientes, "antes e depois" e selfies com pacientes exigem TCLE assinado (Resolução CFO-196/2019).
  Antes de publicar depoimentos, vale confirmar as regras atuais com o CRO-ES.
- O mapa do Google só carrega quando o visitante clica em "Carregar mapa interativo".

## Estrutura

```
src/
  config/site.ts   ← conteúdo editável (único arquivo a editar no dia a dia)
  lib/             ← WhatsApp, fotos, prévia, Schema.org
  components/      ← Header, Hero, TrustSection, About, Services, HowItWorks, Reviews,
                     Insurance, FAQ, Contact, FinalCTA, Footer, WhatsAppButton
```

Cada link de WhatsApp tem `data-cta="<origem>"` (hero, header, tratamento:<id>, convenios:<tipo>, faq:<n>,
flutuante…), o que permite medir no Google Tag Manager qual ponto converte mais.

Deploy na Vercel: crie um projeto apontando para este repositório com **Root Directory = `samia-lima`**.
