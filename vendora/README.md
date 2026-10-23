# Vendora AI

> Do link ao anúncio, com inteligência artificial.

Plataforma SaaS que transforma o link (ou os dados) de um produto em anúncios para **Mercado Livre**, **Shopee** e **TikTok Shop**: lê os dados públicos da página, mostra o que foi confirmado e o que falta, gera título, descrição, ficha técnica e palavras-chave por canal, trata as imagens e exporta tudo para publicação.

Fluxo principal: **colar link → analisar → revisar → editar imagens → exportar.**

---

## Estado real de cada recurso

Legenda: **1** implementado e testado · **2** implementado, não testado em ambiente real · **3** depende de configuração/credenciais · **4** ainda não implementado.

| Recurso | Estado | Observação |
|---|---|---|
| Cadastro, login, logout, sessão (cookie httpOnly, senha com scrypt) | 1 | Testes de integração + E2E no navegador |
| Validação de URL e proteção contra SSRF (IPs privados, loopback, metadata, IPv6, DNS rebinding, redirects) | 1 | `test/url.test.ts` inclui um servidor local que **não** é alcançado |
| Respeito ao `robots.txt`, detecção de bloqueio (403/429/captcha) | 1 | Com páginas de teste |
| Extração de dados (JSON-LD, microdados, Open Graph, meta) com status por campo | 1 | Testada com páginas de teste fictícias |
| Extração em **lojas reais** | 2 | A rede deste ambiente bloqueia sites externos; o código nunca foi exercitado contra uma loja real. Grandes marketplaces costumam bloquear robôs — a importação manual cobre esse caso |
| Falha de extração registrada com motivo, sem dados inventados; importação manual | 1 | Testes + E2E |
| Gerador básico (sem IA) + verificação de afirmações sem fonte | 1 | Medidas, %, garantias e certificações ausentes da origem viram alerta; especificações sem fonte são removidas |
| Geração com IA (Claude, `claude-opus-5-5`, saída estruturada, fallback do servidor) | 2 · 3 | Testado com o transporte HTTP simulado (formato da requisição, recusa, chave inválida). **Nenhuma chamada real à API foi feita** — exige `ANTHROPIC_API_KEY` |
| Perfis por marketplace + limites ajustáveis por conta + validação de texto e imagem | 1 | Ver "Regras dos marketplaces" abaixo |
| Upload e importação de imagens, validação pelo conteúdo, original preservada | 1 | |
| Editor: recorte, giro, espelho, brilho, contraste, saturação, fundo branco, tamanho, formato, desfazer/refazer, antes/depois, download | 1 | Processamento final no servidor (sharp); prévia no navegador |
| Remoção de fundo (remove.bg) | 2 · 3 | Exige `REMOVE_BG_API_KEY`; sem ela a interface informa que não está disponível |
| Resultado em abas, edição de todos os textos, versões, restaurar, regenerar título/descrição, salvar, criar outro | 1 | |
| Exportação ZIP (texto + imagens), TXT e JSON | 1 | |
| Histórico, painel com indicadores de uso, configurações, exclusão de conta | 1 | |
| Controle de acesso por usuário, verificação de origem (CSRF), limite de login | 1 | |
| Limites de uso por hora (análises) e por IP nas demais rotas | 2 | Configurados; só o limite de login tem teste |
| Retenção: imagens órfãs, sessões e estados OAuth expirados | 1 | Roda na subida e a cada 6 h; `npm run retention -w server` para execução avulsa |
| Armazenamento local | 1 | |
| Armazenamento S3/R2/MinIO | 2 · 3 | Exige bucket e credenciais |
| Mercado Livre: conexão OAuth (PKCE), renovação de token, leitura de anúncio pela API | 2 · 3 | Exige app no DevCenter (`ML_CLIENT_ID`/`ML_CLIENT_SECRET`); mapeamento da resposta testado com dados simulados |
| Shopee e TikTok Shop: autorização de conta | 4 | Exigem aprovação como parceiro antes de liberar credenciais |
| **Publicação automática e consulta de status** (todos os canais) | 4 | A rota responde 501 e a interface diz isso. Use a exportação |
| Sugestão de categoria via API do marketplace | 4 | Hoje só a IA sugere, com nível de confiança e a base usada |
| Imagens promocionais geradas por IA | 4 | Existe apenas a marcação manual "promocional", que impede usá-la como foto principal |
| Recuperação de senha, verificação de e-mail, 2FA, cobrança/planos | 4 | |
| Landing page com 3D por rolagem e movimento reduzido | 1 | Verificada em desktop e celular (390 px) e com `prefers-reduced-motion` |
| Imagem Docker | 2 | `Dockerfile` não foi construído neste ambiente |

### Por que não há Three.js

O 3D da landing usa transformações CSS (`perspective`, `translateZ`, `rotateX/Y`) animadas pelo Framer Motion a partir da rolagem. Para cartões de interface isso dá o mesmo efeito com custo de GPU baixo, sem baixar ~150 KB de WebGL e sem travar computadores modestos. Three.js/React Three Fiber só valeria a pena para um modelo 3D real do produto, o que não existe no fluxo.

---

## Arquitetura

```
vendora/
├── shared/   Regras dos marketplaces, esquemas (zod) e detecção de afirmações sem fonte — usados no front e no back
├── server/   API REST (Fastify + TypeScript), Prisma/PostgreSQL
│   └── src/modules/
│       ├── auth/          cadastro, login, sessão, exclusão de conta
│       ├── extraction/    leitura da página (parse), robots.txt, API do Mercado Livre
│       ├── ai/            provedores (Claude, básico), prompt, pós-processamento anti-invenção
│       ├── products/      análise, cadastro manual, correção de campos
│       ├── images/        processamento (sharp), remoção de fundo, rotas
│       ├── listings/      geração, versões, regeneração, exportação
│       ├── marketplaces/  adaptadores (autorização, envio, status), configurações, integrações, uso
│       └── storage/       local ou S3, URLs assinadas
│   └── src/security/      validação de URL e fetch protegido contra SSRF
└── web/      React + TypeScript + Vite + Tailwind CSS 4 + Framer Motion
```

Separação pedida para os marketplaces:

| Responsabilidade | Onde |
|---|---|
| Geração do conteúdo | `server/src/modules/ai` (independe do canal; recebe as regras) |
| Validação das regras | `shared/src/marketplaces.ts` (`validateListingText`, `validateImage`) |
| Autorização da conta | `MarketplaceAdapter.authorizationUrl / exchangeCode / refresh` |
| Envio do anúncio | `MarketplaceAdapter.publish` (hoje responde 501) |
| Status da publicação | `MarketplaceAdapter.publicationStatus` (hoje responde 501) |

Provedores são injetados em `AppContext` (`server/src/context.ts`): trocar a IA, o armazenamento, o removedor de fundo ou o "fetcher" não exige mexer nas rotas.

### Banco de dados

`server/prisma/schema.prisma`: `User`, `Session`, `Product` (dados + status de cada campo + motivo da falha), `Listing` e `ListingVersion` (cada edição/regeneração é uma versão), `Asset` (original × editada, com `parentId` apontando para a original), `MarketplaceConnection` (tokens cifrados), `OAuthState`, `UsageEvent`. Migrações em `server/prisma/migrations`.

---

## Executar localmente

Requisitos: Node 22+, PostgreSQL 16 (ou Docker).

```bash
cd vendora
cp .env.example .env
# gere a chave e cole em TOKEN_ENCRYPTION_KEY
openssl rand -hex 32

docker compose up -d          # PostgreSQL com os bancos vendora e vendora_test
npm install                   # também roda `prisma generate`
npm run db:migrate            # aplica as migrações no banco de desenvolvimento
npm run dev                   # API em :3001 e front em http://localhost:5173
```

Sem `ANTHROPIC_API_KEY`, o app funciona com o **gerador básico**, que só reorganiza os dados de origem — a interface avisa isso em todas as telas relevantes.

### Testes

```bash
npm test          # shared + server (Postgres real em TEST_DATABASE_URL) + web
npm run typecheck
```

A suíte do servidor aplica as migrações em `TEST_DATABASE_URL` e **apaga os dados desse banco** — nunca aponte para produção. Os testes não acessam a internet: páginas de lojas e respostas de APIs são simuladas e identificadas como fictícias.

Cobertura principal: validação de URLs/SSRF, extração e falhas de extração, fluxo completo (cadastro → análise → imagens → edição → anúncio → versões → exportação), isolamento entre usuários, OAuth com `state` inválido, retenção, limite de login, editor (histórico, recorte, ajustes).

---

## Implantação

Front e API rodam na **mesma origem** (o servidor entrega o build do front), o que mantém o cookie de sessão `SameSite=Lax` e evita CORS.

```bash
npm ci
npm run build                       # server/dist + web/dist
cd server
npx prisma migrate deploy
NODE_ENV=production WEB_DIST_DIR=../web/dist node --env-file=../.env dist/index.js
```

Ou com Docker: `docker build -t vendora .` e `docker run --env-file .env -p 3001:3001 vendora` (a imagem roda `prisma migrate deploy` ao subir).

Checklist de produção:

- HTTPS na frente (proxy/plataforma); `COOKIE_SECURE=true`; `APP_URL` com o domínio final.
- `TOKEN_ENCRYPTION_KEY` própria e guardada em cofre de segredos. Trocar a chave invalida os tokens de marketplace salvos e os links de imagem.
- `STORAGE_DRIVER=s3` com bucket **privado** (as imagens são servidas pela API com URL assinada de 1 h).
- Disco local só serve para uma instância; com várias réplicas, use S3.
- O limitador de requisições é em memória: com várias réplicas, cada uma conta separado.
- `FETCH_USER_AGENT` com uma URL que explique o robô.

---

## Integrações externas

### IA — Anthropic Claude

- Variáveis: `ANTHROPIC_API_KEY`, `AI_MODEL` (padrão `claude-opus-5-5`), `AI_EFFORT` (`low`/`medium`/`high`).
- Chamada: `beta.messages.create` com `output_config.format` (JSON Schema gerado do esquema zod `ListingContent`) e `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): se o modelo recusar, a própria API tenta um modelo de fallback. A resposta é validada de novo com zod.
- O conteúdo da página vai isolado em `<dados_do_produto>` e o prompt manda ignorar instruções escritas ali (proteção contra *prompt injection* vinda da loja).
- Depois da IA, `postProcess` aplica os limites do canal, remove especificações sem fonte, rebaixa "fatos" sem fonte para "sugestão de marketing" e lista alertas.
- Trocar de provedor: implemente `ListingGenerator` (`server/src/modules/ai/types.ts`) e registre em `createContext`.

### Mercado Livre

1. Crie um app em <https://developers.mercadolivre.com.br/devcenter>.
2. Redirect URI: `APP_URL/api/integrations/mercado_livre/callback`.
3. Defina `ML_CLIENT_ID` e `ML_CLIENT_SECRET`.
4. Em **Integrações**, clique em "Conectar conta". O `state` é de uso único, expira em 10 min e é vinculado ao usuário logado; o PKCE (S256) protege a troca do código.
5. Com a conta conectada, links de anúncios (`MLB-...`) são lidos por `GET /items/{id}` e `/items/{id}/description` em vez da página pública.

Não implementado: publicação (`POST /items`), atributos obrigatórios por categoria, consulta de status, preditor de categoria.

### Shopee e TikTok Shop

Ambas exigem cadastro e aprovação como parceiro (Shopee Open Platform, TikTok Shop Partner Center) antes de liberar credenciais. Os adaptadores existem para manter a arquitetura; até a aprovação, só exportação manual.

### Remoção de fundo — remove.bg

`REMOVE_BG_API_KEY`. O resultado é salvo como **cópia** em PNG transparente; combine com "fundo branco" no editor. Para trocar de serviço, implemente `BackgroundRemover`.

### Armazenamento — S3 compatível

`STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (R2/MinIO), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

---

## Regras dos marketplaces

Revisadas em **23/10/2026** (`shared/src/marketplaces.ts`). Só são oficiais as regras de imagem do Mercado Livre (mínimo 500 px, recomendado 1200 px, máximo 1920 px, até 10 MB) e o fato de o limite de título do ML depender da categoria (`max_title_length`). Os limites de título e imagem da Shopee e do TikTok Shop vieram de fontes de terceiros **que divergem entre si** (ex.: título da Shopee citado como 100, 120 e 255 caracteres); usamos o valor mais conservador e a tela de Configurações mostra quais valores não foram verificados. Cada conta pode ajustar os limites.

---

## Segurança

- **SSRF**: só http/https nas portas 80/443, sem credenciais na URL, sem IP literal, sem nomes internos (`localhost`, `.internal`, `.local`, metadata). O DNS é validado **no momento da conexão** (todas as respostas precisam ser públicas), o que cobre DNS rebinding; cada redirect é revalidado; tamanho e tempo de resposta limitados.
- **Uploads**: tipo detectado pelo conteúdo (JPG/PNG/WEBP), limite de pixels contra "bombas de descompressão", metadados EXIF/GPS removidos, nomes de arquivo gerados pelo servidor.
- **Sessão**: token aleatório no cookie httpOnly; no banco só o SHA-256. Senhas com scrypt. Login com tempo constante para e-mail inexistente.
- **CSRF**: `SameSite=Lax` + recusa de requisições que alteram dados vindas de outra origem.
- **Segredos**: chaves só no servidor; tokens OAuth cifrados com AES-256-GCM; logs sem cookies, cabeçalhos de autenticação e senhas; erros internos não chegam ao usuário.
- **Acesso**: toda consulta filtra por `userId`; imagens servidas por URL assinada com validade.
- **Cabeçalhos**: Helmet com CSP restrita (`script-src 'self'`).
