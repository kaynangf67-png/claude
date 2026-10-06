# Site — Unnica Odonto

Landing page institucional focada em conversão para WhatsApp.
React + TypeScript + Tailwind CSS v4 + Vite. Sem dependências além de React e Lucide.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/ (site estático, pronto para Vercel/Netlify/qualquer hospedagem)
```

## Onde editar

**Tudo fica em `src/config/clinic.ts`**: nome, WhatsApp, endereço, Instagram, horários,
responsável técnico, tratamentos, FAQ e mensagens do WhatsApp.
Title, meta description, Open Graph e Schema.org são gerados no build a partir desse arquivo.

Campos vazios aparecem no site com um marcador `[a preencher]` em tom de madeira.
Nenhuma informação da clínica foi inventada.

## Pendências antes de publicar

| Campo | Onde | Observação |
|---|---|---|
| Nome da marca | `clinic.name` | Fotos mostram **UNNICA** (dois N). Confirmar a grafia oficial. |
| Tratamentos | `treatments` | 6 placeholders. Substituir pela lista oficial. |
| Responsável técnico + CRO | `technicalLead`, `clinicRegistration` | Exigido pelo Código de Ética Odontológica na divulgação. |
| Endereço, link do Maps, cidade | `address`, `cityLabel` | Sem endereço, o Schema.org não é publicado. |
| Instagram, horários | `instagram`, `openingHours` | Na porta: "@unnicaodonto…" (parcialmente coberto). |
| História e equipe | `history` | Seção "Conheça a Unnica Odonto". |
| URL do site | `siteUrl` | Necessária para canonical, og:url e Schema.org. |
| Autorização de imagem | `src/assets/atendimento.*` | A foto mostra um paciente. Usar só com termo de autorização assinado; senão, remover. |
| Logo oficial | `Wordmark` em `src/components/ui.tsx` | Hoje é uma marca tipográfica provisória. Trocar por SVG oficial. |
| Fotos em alta resolução | `src/assets/` | As atuais têm ~600 px de largura (capturas de tela). Fotos originais deixam o site visivelmente mais nítido. |

## Estrutura

```
src/
  config/clinic.ts      ← dados da clínica (único arquivo a editar)
  lib/                  ← WhatsApp, fotos, Schema.org
  components/           ← Header, Hero, TrustSection, Differentials, Treatments,
                          ClinicGallery, AboutClinic, HowItWorks, FAQ, FinalCTA,
                          Footer, WhatsAppButton
```

Cada link de WhatsApp tem `data-cta="<origem>"` (hero, header, tratamento-card:…, faq:…, flutuante…),
o que permite medir no Google Tag Manager qual ponto converte mais.
