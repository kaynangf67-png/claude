# Site — Nilcéia Dias Hair & Company

Landing page premium para tráfego pago (Meta Ads / Google Ads), com conversão pelo WhatsApp.
React 19 + TypeScript + Tailwind CSS v4 + Vite, **pré-renderizada** em HTML estático (cada página
já chega pronta ao navegador, o que acelera o carregamento e ajuda SEO e as prévias de link).

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/ (site estático: Vercel, Netlify ou qualquer hospedagem)
npm run preview   # serve o dist/ em http://localhost:4173
```

No Vercel: crie um projeto com **Root Directory = `nilceia-dias`**. O `vercel.json` já está pronto.

## Páginas

| URL | Público | CTA principal |
|---|---|---|
| `/` | geral | agendar |
| `/noivas/` | campanha de noivas | consultar a data |
| `/tratamentos-capilares/` | campanha de tratamentos | conversar sobre o cabelo |
| `/cabelos/` | campanha de cabelos | serviços de cabelo |
| `/privacidade/` | política de privacidade (modelo) | — |

Todas reutilizam os mesmos componentes; muda o hero, a ordem das seções e a mensagem do WhatsApp
(`src/config/pages.ts`). Nova campanha = nova entrada em `pages.ts` + HTML em uma pasta + linha em
`pageEntries` (`vite.config.ts`) e em `scripts/prerender.mjs`.

## Onde editar

- **`src/config/site.ts`** — contato, endereço, números de autoridade, serviços, FAQ, mensagens do WhatsApp,
  depoimentos, portfólio, foto da Nilcéia.
- **`src/config/pages.ts`** — textos do hero e ordem das seções de cada página.
- **`src/lib/photos.ts`** — imagens editoriais.

## Rastreamento (variáveis de ambiente — veja `.env.example`)

| Variável | Uso |
|---|---|
| `VITE_SITE_URL` | canonical, `og:url`, JSON-LD. **Obrigatória antes de publicar.** |
| `VITE_GTM_ID` | Se definida, carrega **só** o GTM; configure GA4/Pixel lá dentro. |
| `VITE_GA4_ID` | GA4 direto (quando não usar GTM). |
| `VITE_META_PIXEL_ID` | Meta Pixel direto (quando não usar GTM). |

- Nada é carregado antes do consentimento (banner LGPD). Sem nenhum ID, o banner nem aparece.
- Eventos no `dataLayer` (e no GA4/Pixel quando carregados): `page_view`, `view_service` (com `category`),
  `view_brides_section`, `click_whatsapp_<origem>` (`hero`, `header`, `brides`, `hair`, `treatments`, `makeup`,
  `footer`, `sticky`, `floating`, `final`, `steps`, `identification`, `faq`, `location`, `about`, `menu`),
  `click_directions`, `click_phone`, `click_instagram`, `faq_open`, `view_map`.
  Todo clique no WhatsApp também dispara `Contact` no Meta Pixel.
- Cada evento leva `page_type`, `cta_source`, `category` e as UTMs da sessão. **Nenhum dado pessoal** é enviado.
- Cliques repetidos em menos de 1 s e visualizações repetidas não são contados de novo.
- UTMs (`utm_*`, `gclid`, `fbclid`) ficam na sessão, seguem para as outras páginas do site e são anexadas
  discretamente à mensagem do WhatsApp: `(Ref.: instagram / noivas-nov)`. Desligue em `appendCampaignRef`.
- Depuração: abra qualquer página com `?debug_analytics=1` e veja os eventos no console.
- Um clique no WhatsApp **não** é um agendamento: trate-o como "conversa iniciada" nas campanhas.

## Pendências antes de publicar

| Item | Onde | Situação |
|---|---|---|
| 33 anos / +10 mil noivas | `facts` | Informados no briefing. Confirmar com a Nilcéia (e ter como comprovar). `show: false` esconde. |
| Nota 5,0 Casamentos.com.br | `brand.casamentos.rating` | Não foi possível abrir a página para conferir. |
| Serviços específicos (corte, escova, cachoterapia…) | `services[].items` | Vazios até confirmação. |
| Make **e unhas** | `services` (`enabled`) | Confirmar se unhas são oferecidas. |
| Horários | `brand.openingHours` | Não informados; o site não exibe. |
| Depoimentos reais | `reviews` | Vazio: a seção mostra só a nota e o link. |
| Portfólio real | `portfolio` | Vazio: a galeria leva ao Instagram. |
| Foto da Nilcéia | `nilceiaPhoto` | Sem foto: a seção usa composição tipográfica. |
| Imagens | `src/assets/` | As atuais são **geradas** (ilustrativas), recortadas da colagem enviada e com baixa resolução (≤ 725 px). Trocar por fotos reais em alta. |
| Logo oficial | `Wordmark` em `src/components/ui.tsx` | Assinatura tipográfica provisória. |
| URL final | `VITE_SITE_URL` | Necessária para canonical / Open Graph / JSON-LD. |
| Política de privacidade | `src/components/Privacy.tsx` | Modelo; revisar antes de publicar. |
