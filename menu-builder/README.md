# Web Company Menu Builder

Ferramenta interna para criar cardápios digitais: **criar projeto → enviar fotos → extrair com IA → revisar → personalizar → visualizar → publicar** (link + QR Code).

React 19 + TypeScript + Vite + Tailwind 4 · Supabase (Postgres, Auth, Storage, Edge Functions) · Claude API (visão) · `qrcode`.

O cardápio é **só informativo**: sem carrinho, pedidos, pagamento ou checkout. O botão de WhatsApp é opcional, apenas para contato, e só aparece com autorização.

---

## 1. Rodar localmente

```bash
cd menu-builder
npm install
npm run dev          # http://localhost:5173
```

Sem variáveis de ambiente o app abre em **modo demonstração**:

- os dados ficam só no navegador (IndexedDB);
- não há login;
- um projeto **fictício** ("Cantina Exemplo (fictícia)") vem pronto, identificado como tal;
- a extração por IA fica **desativada**, com aviso na tela. Nada é simulado.

Todas as outras telas funcionam: criação, upload, editor, aparência, publicação, QR Code e página pública. O link público, porém, só abre no mesmo navegador.

## 2. Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend (`.env.local` / Vercel) | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | frontend | chave **anon** (pública; a segurança vem do RLS) |
| `VITE_PUBLIC_BASE_URL` | frontend, opcional | domínio usado no link e no QR Code (ex.: `https://cardapios.webcompany.com.br`). Padrão: o domínio atual |
| `ANTHROPIC_API_KEY` | **segredo da Edge Function** | chave da Claude API. Nunca vai para o navegador |
| `AI_MODEL` | segredo, opcional | padrão `claude-opus-5-5` |
| `AI_DAILY_IMAGE_LIMIT` | segredo, opcional | padrão `60` imagens por usuário a cada 24 h |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase nas Edge Functions.

## 3. Configurar o Supabase

```bash
npm i -g supabase                 # ou use npx supabase
supabase login
supabase link --project-ref SEU_REF
supabase db push                  # aplica supabase/migrations/
```

As migrations (`20261012000000_menu_builder.sql` e `20261012000100_hardening.sql`) criam:

- **Tabelas:** `profiles`, `restaurant_projects`, `menu_categories`, `menu_products`, `project_assets`, `ai_usage`, `activity_log`.
- **Integridade:** chaves estrangeiras, índices e `CHECK`s (slug, cores, status, preço ≥ 0, tipo e tamanho de arquivo). Uma FK composta impede ligar um produto a uma categoria de outro projeto, e `unique(project_id, sha256)` impede enviar a mesma imagem duas vezes.
- **Permissões explícitas:** o visitante (`anon`) não tem acesso a nenhuma tabela; só à função pública. Não dependemos dos privilégios padrão do projeto.
- **RLS:** cada usuário só lê e altera os próprios projetos. `ai_usage` é **somente leitura** para o usuário, porque só a Edge Function (service role) grava ali. Assim ninguém consegue apagar o próprio histórico para burlar o limite.
- **`get_public_menu(slug)`:** a única porta do público. Devolve só campos públicos, só cardápios com status `published` e só itens revisados com preço. O público nunca lê tabelas.
- **`is_slug_available(slug, id)`:** verifica duplicidade sem expor projetos de outras pessoas.
- **Buckets:** `menu-sources` (**privado**: páginas do cardápio) e `menu-media` (público: logo, capa, fotos de pratos), ambos limitados a 10 MB e JPG/PNG/WebP. O caminho é obrigatoriamente `<uid>/...`.

Depois, em **Authentication**, crie as contas da equipe e **desative o cadastro aberto** (Sign-ups). A tela de login tem "Criar conta" para o primeiro acesso.

## 4. Configurar a IA

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy extract-menu
```

Como a função `supabase/functions/extract-menu` trabalha:

1. Valida o JWT do usuário. Lê projeto e imagens **com o cliente do usuário**, então o RLS garante a posse.
2. Recusa mais de **8 imagens por chamada** e respeita o **limite diário**. Pula imagens já analisadas, salvo pedido explícito de reanálise.
3. Envia as imagens à Claude API com saída em **JSON validado por esquema** (`output_config.format`). Usa `fallbacks: "default"`, que reencaminha automaticamente em caso de recusa por política.
4. **Revalida tudo** em `supabase/functions/_shared/extraction.ts`, que tem testes. O item vai para revisão quando:
   - o preço está ausente;
   - o texto do preço impresso diverge do número lido;
   - a confiança fica abaixo de 85%;
   - o item aparece em duas imagens com preços diferentes;
   - já existe item com o mesmo nome no projeto;
   - a imagem está ilegível ou incompleta.
5. Grava categorias e produtos marcados para revisão e registra o uso com tokens e custo estimado em `ai_usage`.

O prompt proíbe inventar preço, ingrediente, alergênico, tamanho ou complemento. Um preço de grupo ambíguo (ex.: "Caldos … R$ 19,90") não é espalhado pelos itens.

## 5. Deploy do frontend (Vercel)

Crie um projeto com **Root Directory = `menu-builder`**, framework Vite, e as variáveis `VITE_*`. O `vercel.json` já reescreve as rotas da SPA (`/m/:slug`, `/projetos/...`) para `index.html`.

## 6. Testar

```bash
npm test                     # 26 testes: regras, extração, repositório local
npm run typecheck            # frontend
npm run typecheck:functions  # Edge Function contra os tipos reais dos SDKs
npm run build
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

`test:db` cria um banco descartável num **Postgres local** e roda nele:

- stubs que imitam `auth`/`storage` do Supabase;
- a migration;
- `supabase/tests/rls_test.sql`, que cobre:
  - isolamento entre usuários;
  - bloqueio de escrita em `ai_usage`;
  - slug duplicado;
  - público sem acesso às tabelas;
  - cardápio não publicado invisível;
  - itens pendentes ou sem preço fora do cardápio público;
  - nenhum campo interno no JSON público;
  - WhatsApp só quando autorizado;
  - FK entre projetos;
  - perfil criado automaticamente.

### Fluxo manual completo

1. **Painel → Novo cardápio:** preencha o nome (único campo obrigatório) e salve.
2. **Materiais:** envie fotos das páginas do cardápio (finalidade "Página do cardápio") e fotos de pratos. Imagens grandes são reduzidas para 2000 px antes do envio.
3. **Extração:** confira as imagens selecionadas e clique em Analisar.
4. **Revisão:** filtre "Só itens para revisar", abra cada item, confira com a foto e clique em **Marcar como revisado**. O sistema não deixa revisar item sem preço.
5. **Aparência:** escolha estilo (Claro/Noite), cores, logo e capa, com prévia no celular.
6. **Publicação:** defina o endereço (`/m/seu-restaurante`), confira a revisão final, **aprove**, **publique** e baixe o QR Code (SVG para gráfica, PNG).

## 7. O que depende de credenciais

| Recurso | Sem credenciais | Com Supabase | Com Supabase + chave de IA |
|---|---|---|---|
| Telas, editor, publicação, QR | ✅ (local) | ✅ | ✅ |
| Login e dados compartilhados entre aparelhos | — | ✅ | ✅ |
| Link público acessível por qualquer pessoa | — | ✅ | ✅ |
| Extração de cardápio por IA | — (aviso explícito) | erro claro: "IA não configurada" | ✅ |

## 8. Arquitetura e preparação para SaaS

```
src/
  domain/      tipos e regras puras (publicação, slug, dados públicos)
  data/        MenuRepository: SupabaseRepository | LocalRepository (demo)
  pages/       painel, wizard do projeto (6 etapas), público, prévia
  components/  UI, layout, MenuView (motor único de renderização)
supabase/
  migrations/  esquema + RLS + funções públicas + storage
  functions/   extract-menu (Edge Function) e _shared/extraction.ts (puro, testado)
  tests/       testes de banco
```

- **Um único motor (`MenuView`)** renderiza todos os restaurantes. O que muda é o dado, o estilo (`claro`/`noite`) e as cores.
- **Pronto para multiusuário:** todo dado tem `owner_id` e RLS por dono. `profiles.plan` existe mas **não bloqueia nada**. `ai_usage` registra tokens e custo por usuário, e `activity_log` registra as operações.
- **Fora desta versão, de propósito:** pagamentos, assinaturas, equipes e painel administrativo. Para incluir equipes, troque `owner_id = auth.uid()` nas políticas por uma checagem de membro da organização.

## 9. Limitações conhecidas

- **Integrações reais não testadas neste ambiente:** não havia projeto Supabase nem chave de IA disponíveis. O banco foi testado num Postgres 16 local com stubs do Supabase, e a Edge Function passou só na checagem de tipos contra os SDKs reais, **sem chamada real à IA**. O primeiro uso real precisa de um teste com fotos de verdade.
- **Instagram/Google Maps:** não há importação automática (essas plataformas não permitem leitura livre por terceiros). Os links são guardados e exibidos, e os dados são preenchidos à mão.
- **Salvamento do editor:** grava o cardápio inteiro por upsert e exclusão, sem transação única. Uma falha no meio pode deixar parte salva. A tela mostra "Erro ao salvar" e permite tentar de novo.
- **SEO da página pública:** é SPA. Título e descrição são definidos no navegador, então prévias de link no WhatsApp mostram dados genéricos. Para isso seria preciso renderização no servidor ou uma função de borda.
- **Fotos públicas:** imagens do bucket `menu-media` têm URL pública (não adivinhável) mesmo antes da publicação. Páginas de cardápio ficam no bucket privado.
- **Reordenação:** por botões ↑/↓ (acessível e confiável), sem arrastar e soltar.
