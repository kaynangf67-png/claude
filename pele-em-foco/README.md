# Pele em Foco

Produto digital educativo em português: **e-book** sobre acne, pele oleosa e rotina básica + **app web companheiro** (bônus para compradores) + **página de vendas**.

> Conteúdo educativo. Não faz diagnóstico, não indica tratamento, não substitui dermatologista.

## O que tem aqui

| Pasta | Conteúdo |
|---|---|
| `brand/` | Tokens de design (`tokens.css`) e documentação do design system |
| `ebook/src/` | Fonte editável do e-book (HTML + CSS de impressão A5). **O HTML não é versionado** (repositório público) |
| `ebook/assets/cover.svg` | Arte da capa (vetorial) |
| `ebook/config.json` | Autor, revisor técnico, contato, URL do app e data do bônus impressos no PDF |
| `ebook/scripts/` | Build do PDF (Playwright + pypdf) e exportação das páginas de amostra |
| `ebook/dist/pele-em-foco.pdf` | PDF final gerado pelo build (não versionado) |
| `src/` | App React + TypeScript: página de vendas, pós-compra, páginas legais e app companheiro |
| `src/content/` | Artigos da biblioteca, FAQ, fontes e guia de produtos |
| `public/` | Capa em PNG, amostras do e-book, favicon, manifest |
| `docs/` | Fontes verificadas, fluxo de entrega e acesso, checklist editorial |
| `tests/smoke.mjs` | Teste ponta a ponta (mobile e desktop) |
| `LAUNCH_CHECKLIST.md` | O que está pronto, o que falta, em ordem de prioridade |

## Requisitos

- Node.js 20+ (testado com 22) e npm
- Para gerar o PDF: Chromium do Playwright (`npx playwright install chromium` fora deste ambiente), Python 3 com `pypdf` (`pip install pypdf`) e, para amostras, `pdftoppm` (poppler-utils)

## Instalação e comandos

```bash
cd pele-em-foco
npm install
cp .env.example .env.local   # preencha antes de publicar

npm run dev          # http://localhost:5173
npm run typecheck
npm test             # testes de lógica (vitest)
npm run build        # gera dist/
npm run preview      # serve o build
npm run test:e2e     # após o build: fluxo completo no navegador, mobile e desktop

npm run ebook:pdf      # regenera ebook/dist/pele-em-foco.pdf e public/capa-pele-em-foco.png
npm run ebook:samples  # regenera public/amostras/*.png a partir do PDF
```

Rotas: `/` vendas · `/obrigado` pós-compra · `/privacidade` · `/termos` · `/app` (onboarding em `/app/boas-vindas`, depois início, rotina, diário, biblioteca, produtos e perfil).

## Configuração (variáveis de ambiente)

Todas são `VITE_*`, portanto **públicas** (vão para o navegador). Não há segredo nenhum neste projeto.

| Variável | Para quê | Sem ela |
|---|---|---|
| `VITE_PRICE_LABEL` | Preço exibido (“R$ 27,00”) | Aviso “a configurar” |
| `VITE_CHECKOUT_URL` | Link da oferta na Cakto (`https://pay.cakto.com.br/...`) | Botão de compra desativado |
| `VITE_CAKTO_DELIVERY` | `email` ou `members` (igual ao canal de entrega do produto na Cakto) | `email` |
| `VITE_BONUS_END_DATE` | Último dia do app gratuito (AAAA-MM-DD) | Aviso “a configurar” |
| `VITE_REFUND_DAYS` | Prazo de reembolso (mínimo forçado: 7) | 7 |
| `VITE_SUPPORT_EMAIL` | Suporte | Aviso “a configurar” |
| `VITE_BUSINESS_NAME`, `VITE_BUSINESS_DOCUMENT` | Responsável e CPF/CNPJ | Aviso “a configurar” |
| `VITE_SITE_URL` | URL pública (uso em textos) | — |

Enquanto faltar algo, a página de vendas mostra uma faixa amarela “Página em configuração”. Isso é proposital: ninguém publica sem perceber. A faixa também aparece se a data do bônus já passou.

Para o PDF, preencha `ebook/config.json` e rode `npm run ebook:pdf`. Sem revisor técnico preenchido, o PDF declara que **não** houve revisão por dermatologista.

## Deploy (Vercel)

1. Novo projeto apontando para este repositório, **Root Directory = `pele-em-foco`**.
2. Framework: Vite (já em `vercel.json`, com rewrite para as rotas do React Router).
3. Configure as variáveis acima em *Settings → Environment Variables* e faça o deploy.
4. Rode a checagem pós-deploy do `LAUNCH_CHECKLIST.md`.

Qualquer hospedagem estática serve (Netlify, Cloudflare Pages): build `npm run build`, saída `dist`, e redirecionar todas as rotas para `index.html`.

**Nada foi publicado a partir deste ambiente.** Nenhum deploy foi feito ou testado.

## Funcionalidades implementadas

- **Página de vendas** com capa, capítulos, amostras reais do PDF, bônus com condições, para quem é/não é, compromisso editorial, oferta, FAQ, rodapé com aviso educativo.
- **Pós-compra** (`/obrigado`) que orienta sem confirmar pagamento nem liberar nada.
- **Políticas** de privacidade e termos/reembolso (modelos marcados para revisão jurídica).
- **App:** onboarding com aceite do aviso educativo e preferências opcionais; rotina manhã/noite gerada pelas preferências e personalizável; diário com hábitos, observações autorrelatadas, etiquetas, nota e histórico; biblioteca com 8 artigos + FAQ, todos com fontes; guia de produtos por categoria; perfil com preferências, período do bônus, exportação e exclusão total dos dados.
- **Persistência local** (`localStorage`, chave `pele-em-foco:v1`) com tolerância a dados corrompidos e a navegadores que bloqueiam armazenamento (o app avisa). Nada é gravado antes do onboarding; “Apagar todos os dados” remove a chave.

## O que depende de serviços externos ou não existe

- **Checkout/pagamento (Cakto):** só o link da oferta. Não há webhook nem confirmação de compra no site. Passo a passo da configuração em `docs/CAKTO.md`.
- **Controle de acesso ao app:** não existe. Qualquer pessoa com o link usa o app. O período do bônus é **informativo** (avisos e textos), sem bloqueio. Caminho para implementar de verdade: `docs/ACESSO-E-ENTREGA.md`.
- **Contas e sincronização na nuvem:** não existem; os dados ficam no aparelho.
- **Entrega do PDF:** feita pela Cakto (e-mail ou Cakto Members).
- **Produtos específicos e afiliados:** a lista começa vazia de propósito. Regras de cadastro em `src/content/products.ts` (validadas por teste).
- **Fotografia de marca:** não há. Só arte vetorial.
- **PWA offline:** há manifest, mas não service worker.

## Repositório público e o PDF

Este repositório no GitHub é **público**. Para não entregar o produto pago de graça, `ebook/src/pele-em-foco.html` e `ebook/dist/` estão no `.gitignore`. Os arquivos foram enviados separadamente; para regenerar o PDF, coloque o HTML em `ebook/src/` e rode `npm run ebook:pdf`. As amostras em `public/amostras/` (4 páginas) são públicas de propósito.
