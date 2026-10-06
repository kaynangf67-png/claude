# Site — Academia Transformers Fitness (Jacaraípe, Serra/ES)

Site institucional de demonstração, focado em levar o visitante do Google ao WhatsApp.
Mesma base do site da Nobre Academia: React + TypeScript + Tailwind CSS v4 + Vite,
**pré-renderizado em HTML estático** no build. Identidade amarelo e preto.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/
npm run fotos     # otimiza as fotos de photos-originais/ (AVIF + WebP)
```

**Tudo fica em `src/config/academia.ts`.** A cor de destaque fica em `src/index.css` (`--color-brand-*`).
Para canonical/sitemap, defina `SITE_URL` no build (na Vercel é automático).

## Fontes dos dados (nada inventado)

| Dado | Fonte pública |
|---|---|
| Endereço Av. Minas Gerais, 15 — Res. Jacaraípe, CEP 29175-456 | Gympass/Wellhub, TotalPass, CNPJ |
| Celular (27) 99607-0045 | Gympass/Wellhub, Solutudo |
| Musculação, Jump, Ritbox, Aeróbica, Ritmos, Zumba, Fitdance, Circuito | Descrição da academia no Gympass/Wellhub |
| Horários (seg–sex 5h–11h e 13h–22h; sáb 7h–11h) | Listagem no Gympass/Wellhub |
| Equipamentos modernos, ambiente familiar, atendimento personalizado, armários | Descrição da própria academia no Gympass/Wellhub |
| Aceita Wellhub e TotalPass | Gympass/Wellhub, TotalPass |
| Instagram @academiatransformersfitness, Facebook | Busca pública |
| Link do Maps | Enviado pelo cliente |

## Pendências

| Campo | Onde | Observação |
|---|---|---|
| **Confirmar WhatsApp** | `WHATSAPP_NUMBER` | O celular público foi usado como WhatsApp. Testar clicando no botão. |
| **Fotos reais** | `photos-originais/` → `npm run fotos` → `gallery`, `heroImage` | Galeria com espaços reservados. |
| **Nota do Google** | `googleRating` | Não confirmada; enquanto `null`, a seção mostra só o link para o Google. |
| Confirmar horários | `openingHours` | Vieram do Gympass. |
| Avaliações reais | `reviews` | Copiar do Google com autorização. |
| Logo oficial | `Logo` em `src/components/ui.tsx`, `public/favicon.svg` | Marca tipográfica provisória. |
| Segunda unidade? | — | O CNPJ tem filial (…/0002-32). Se houver outra unidade, dá para incluir. |
