# Cardápio Digital — template Web Company

Cardápio informativo (sem pedidos, carrinho ou pagamento) em React + TypeScript + Tailwind v4 + Vite.
Cada cliente = **um arquivo** em `src/clients/<cliente>.ts` (registrado em `src/clients/index.ts`),
escolhido pela variável `CLIENT`. Fotos em `public/images/`.

```bash
npm install
CLIENT=barretos npm run dev             # http://localhost:5173 — pendentes marcados em vermelho
CLIENT=barretos npm run validate        # relatório de revisão (preços, fotos, pendências)
CLIENT=barretos npm run check:publish   # falha se houver qualquer pendência; rode antes de publicar
CLIENT=barretos npm run build           # dist/ estático (falha se a configuração tiver erros)
```

## Fluxo por cliente

1. Copie `src/clients/demo.ts` para `src/clients/<cliente>.ts` e registre em `src/clients/index.ts`.
2. `stage`: `'preview'` enquanto o dono não aprovou (mostra itens não confirmados, com faixa de aviso);
   `'live'` só depois da aprovação item por item.
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
| `stage` diferente de `'live'` | Faixa de aviso, `noindex` e bloqueia `check:publish`. Em `'preview'` os itens pendentes vão ao ar para o dono revisar. |
| `publicUrl` vazio | Bloqueia `check:publish`. |

## Tema

`theme` aceita 5 cores `#rrggbb` e uma fonte: `classico`, `elegante`, `moderno`, `rustico`.
A cor do texto sobre a cor da marca é escolhida automaticamente pelo contraste.
O validador recusa texto com contraste abaixo de 4.5:1.

## Estrutura

```
src/
  clients/<cliente>.ts   ← dados de cada restaurante (demo.ts é o modelo)
  types/menu.ts          ← tipos reutilizáveis
  lib/                   ← preço em BRL, validação, tema, URLs
  components/            ← Hero, CategoryNav, ProductCard, InfoSection, ShareSection, ImageDialog
scripts/validate.ts      ← relatório de revisão
vite.config.ts           ← valida no build, injeta SEO/cores/fontes, remove pendentes do bundle
```
