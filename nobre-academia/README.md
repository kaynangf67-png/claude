# Site — Nobre Academia (Jacaraípe, Serra/ES)

Site institucional de demonstração, focado em levar o visitante do Google ao WhatsApp.
React + TypeScript + Tailwind CSS v4 + Vite, **pré-renderizado em HTML estático** no build
(o Google lê a página inteira sem executar JavaScript).

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/ (site estático: Vercel, Netlify ou qualquer hospedagem)
npm run fotos     # otimiza as fotos de photos-originais/ (AVIF + WebP, 800 e 1600 px)
```

## Onde editar

**Tudo fica em `src/config/academia.ts`**: WhatsApp, telefone, endereço, nota do Google, Instagram,
horários, modalidades, comodidades, fotos, avaliações e mensagens do WhatsApp.
Title, meta description, Open Graph, Schema.org, `robots.txt` e `sitemap.xml` são gerados no build.

Para a URL do site (canonical, og:url, sitemap) defina `SITE_URL=https://seudominio.com.br` no build.
Na Vercel isso é automático (usa o domínio de produção do projeto).

Cada botão de contato tem `data-cta="<origem>"` (hero, header, modalidade:gap, faq, flutuante…)
para medir no Google Tag Manager qual ponto converte mais.

## Regra do projeto: nada inventado

| Dado | Fonte pública |
|---|---|
| Endereço, telefone (27) 3243-4654 | Google, Gympass/Wellhub, TotalPass, Instagram |
| Musculação, Funcional, GAP, Jump, Zumba, MMA | Listagem no Gympass/Wellhub |
| Ar-condicionado, vestiário, Wi-Fi, acessibilidade | Google e Gympass/Wellhub |
| Instagram @academia_nobre_jacaraipe | Busca pública; perfil exibe o mesmo telefone |
| Nota 4,5 no Google | Informada pelo cliente |

## Pendências antes de publicar

| Campo | Onde | Observação |
|---|---|---|
| **WhatsApp** | `WHATSAPP_NUMBER` | Não há número público. Sem ele, todos os botões **ligam** para o fixo. É o item mais importante. |
| **Fotos reais** | `photos-originais/` → `npm run fotos` → `gallery`, `heroImage`, `activities[].image` | A galeria mostra espaços reservados. Sem foto, o hero usa composição gráfica. |
| **Horários** | `openingHours` | Fontes externas divergem (o Instagram cita 6h–11h e 16h–21h). Só entram no Google quando todos forem preenchidos. |
| **Nome oficial** | `academia.name` | Gympass, TotalPass e catálogos usam **"Academia Nobre"**. Confirmar a grafia preferida. |
| **Link do perfil no Maps** | `mapsUrl` | Hoje é busca pelo endereço. Trocar pelo link de compartilhamento do perfil (usado em "Como chegar" e "Ver avaliações"). |
| Coordenadas | `geo` | Copiar do pin oficial no Maps. |
| Avaliações | `reviews` | Copiar avaliações reais do Google, com autorização. Nunca inventar. |
| Logo oficial | `Logo` em `src/components/ui.tsx`, `public/favicon.svg` | Hoje é uma marca tipográfica provisória. |
| Outras modalidades | `activities` | Catálogos citam dança, artes marciais e fisiculturismo como categoria; não entraram por falta de confirmação. |
| Fundação | — | O CNPJ da empresa é de 2005. "Desde 2005" é um bom selo de confiança, mas precisa da confirmação do dono. |

## Decisões de SEO

- Tipo Schema.org `HealthClub` (subtipo de `SportsActivityLocation` e `LocalBusiness`), com `alternateName: "Academia Nobre"`.
- A nota do Google **não** vai no Schema.org: o Google não aceita `aggregateRating` autodeclarado por empresas locais.
- O H1 contém "Nobre Academia em Jacaraípe".
