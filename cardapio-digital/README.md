# Cardápio Digital — template Web Company

Cardápio informativo (sem pedidos, carrinho ou pagamento) em React + TypeScript + Tailwind v4 + Vite.
Cada cliente novo = **editar um arquivo** (`src/config/restaurant.ts`) e colocar as fotos em `public/images/`.

```bash
npm install
npm run dev             # http://localhost:5173 — mostra itens pendentes marcados em vermelho
npm run validate        # relatório de revisão (preços, fotos, pendências)
npm run check:publish   # falha se houver qualquer pendência; rode antes de publicar
npm run build           # dist/ estático (falha se a configuração tiver erros)
```

## Fluxo por cliente

1. Copie esta pasta para o cliente (ou crie um branch) e edite `src/config/restaurant.ts`.
2. Troque `demo: true` por `demo: false` só quando os dados forem reais.
3. Fotos: `public/images/products/<id-do-produto>.webp` (≈ 800×800, < 150 KB) e
   `public/images/brand/logo.svg|png`, `public/images/brand/hero.webp` (≈ 1600×1000).
4. `npm run validate` → resolva os erros → envie o relatório ao dono para confirmar.
5. Preencha `publicUrl` com o domínio final (o QR Code usa esse valor).
6. `npm run check:publish` precisa passar antes do deploy.

## Regras de dados (garantidas pelo código)

| Situação | O que acontece |
|---|---|
| Preço `value: null` (PRECISA CONFIRMAR) ou `verified: false` | Aparece marcado em `npm run dev`; **não entra no bundle de produção** e bloqueia `check:publish`. |
| `source` e `note` | Campos internos. Nunca chegam ao JavaScript publicado. |
| Campo opcional ausente (logo, capa, endereço, horário, redes) | A seção correspondente some. |
| Produto sem foto | Placeholder neutro só em dev; em produção o card fica só com texto. |
| `categoryId` inexistente, ID duplicado, cor inválida, caminho de imagem quebrado, preço com 3+ casas | **Build falha.** |
| `demo: true` ou `publicUrl` vazio | Bloqueia `check:publish`. Demo também gera `noindex`. |

## Tema

`theme` aceita 5 cores `#rrggbb` e uma fonte: `classico`, `elegante`, `moderno`, `rustico`.
A cor do texto sobre a cor da marca é escolhida automaticamente pelo contraste.
O validador recusa texto com contraste abaixo de 4.5:1.

## Estrutura

```
src/
  config/restaurant.ts   ← dados do cliente (único arquivo a editar)
  types/menu.ts          ← tipos reutilizáveis
  lib/                   ← preço em BRL, validação, tema, URLs
  components/            ← Hero, CategoryNav, ProductCard, InfoSection, ShareSection, ImageDialog
scripts/validate.ts      ← relatório de revisão
vite.config.ts           ← valida no build, injeta SEO/cores/fontes, remove pendentes do bundle
```
