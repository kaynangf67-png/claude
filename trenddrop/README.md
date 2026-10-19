# TrendDrop Radar

Plataforma de inteligência de produtos para dropshipping no Brasil. Ela ajuda a encontrar produtos com **procura crescente**, **margem positiva** e **concorrência administrável** no Mercado Livre, Shopee e TikTok Shop, a cruzar com o Google Trends e a chegar ao fornecedor **DropSeller** com o mínimo de cliques.

> **Princípio do projeto:** nada é inventado. Indicador sem dado aparece como "ainda não carregado". Cada número mostra a origem, a data e o tipo: venda oficial, venda informada, posição em ranking, buscas, interesse relativo, visualizações ou curtidas. Popularidade nunca é apresentada como venda.

## Rodando

```bash
cd trenddrop
npm install
npm run dev      # http://localhost:5173 (as rotas /api rodam no próprio Vite)
npm test         # 26 testes: lucro, indicador, crescimento, alertas, integrações, API
npm run build
```

Sem nenhuma variável de ambiente, o app abre no **modo local**: sem login, com dados apenas neste navegador e com os indicadores vazios até você monitorar produtos. Para conhecer a ferramenta, ative o **modo demonstração** (menu lateral ou Configurações). Ele usa dados **fictícios**, isolados dos seus dados reais e com aviso permanente na tela.

## O que cada fonte entrega (verificado em out/2026)

| Fonte | Como integramos | O que dá | O que NÃO dá |
|---|---|---|---|
| **Google Trends** | [SerpApi](https://serpapi.com/google-trends-api) (`SERPAPI_KEY`) | Interesse ao longo do tempo (até 5 termos), por estado, consultas relacionadas e em ascensão. Períodos: 7d (`now 7-d`), 30d (`today 1-m`), 90d (`today 3-m`), 12m (`today 12-m`). | Volume de buscas ou vendas. O índice 0–100 é **relativo** à própria consulta. |
| **Mercado Livre** | API oficial, OAuth (`ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REFRESH_TOKEN`) | `/sites/MLB/search` (preço, categoria, total de anúncios), `/trends/MLB` (50 buscas em alta, semanal), `/highlights/MLB/category/{id}` (ranking oficial de mais vendidos, top 20) | A quantidade vendida nem sempre vem. O ranking traz a **posição**, não a quantidade. |
| **Shopee** | Shopee Affiliate Open API, GraphQL `productOfferV2` (`SHOPEE_AFFILIATE_APP_ID`, `SHOPEE_AFFILIATE_SECRET`) | Ofertas por palavra-chave, ordenação por mais vendidos, campo `sales`, preço, nota, comissão | O período do campo `sales` não é documentado, por isso aparece como "vendas informadas". Também não traz o total de anúncios, então não há estimativa de concorrência. |
| **TikTok Shop** | Cadastro manual com fonte obrigatória | Produtos que você observou (ex.: TikTok Creative Center), com fonte e data | **Não existe API oficial de dados de mercado.** A Partner API só acessa a sua própria loja. Coleta automática violaria os termos. |
| **DropSeller** | Link por produto + modelo de URL de pesquisa configurado por você | Botão "ENCONTRAR NO DROPSELLER" com link direto ou pesquisa pelo nome | Não encontramos API pública nem URL documentada do DropSeller. **O app não preenche nenhum endereço por você.** |

Detalhes que merecem atenção:

- **API oficial do Google Trends:** anunciada em jul/2025, ainda em alpha fechado (por inscrição, sem chave self-service). O provedor fica isolado em `server/integrations/googleTrends.ts`; quando houver acesso, basta trocar a implementação de `fetchTrends`.
- **Refresh token do Mercado Livre:** é de uso único. A cada renovação, o novo token é gravado em `integration_secrets` (só a service role acessa). Sem banco configurado, ele fica apenas em memória, e o `ML_REFRESH_TOKEN` precisa ser atualizado se a função reiniciar depois de uma renovação. Para obter o primeiro token, crie o app no DevCenter e faça o fluxo `authorization_code` uma vez.
- **Assinatura da Shopee:** `Authorization: SHA256 Credential={AppId}, Timestamp={ts}, Signature=sha256(AppId+ts+payload+Secret)`. Conferimos esse formato no código de SDKs da comunidade. A documentação oficial exige login de afiliado, então valide na primeira chamada real.
- **Nada de scraping.** Segredos ficam só no servidor (`server/`), nunca em `VITE_*`.

## Metodologias

**Lucro**, em `shared/analysis.ts`:
- Lucro = preço − custo do fornecedor − taxas (comissão + tarifa fixa + tarifas adicionais + impostos) − frete pago pelo vendedor − outros custos.
- Margem = lucro ÷ preço × 100.
- Preço mínimo = custos fixos ÷ (1 − percentuais).

As tarifas são **configuráveis por marketplace e por usuário**. Não há valores padrão "universais".

**Indicador de oportunidade (0–100):**

| Componente | Peso | Escala |
|---|---|---|
| Crescimento da procura | 35 | −20% ou menos = 0; +60% ou mais = 1 |
| Margem potencial | 30 | 0% ou menos = 0; 40% ou mais = 1 |
| Concorrência | 20 | baixa = 1; média = 0,5; alta = 0,15 |
| Qualidade dos dados | 15 | oficial = 1; intermediário = 0,75; manual = 0,5; demo = 0 |

Componentes sem dado são excluídos e os pesos restantes são redistribuídos. A tela mostra a **cobertura**, e com menos de 50% de cobertura o indicador não é exibido. O indicador é um critério de ordenação, não uma previsão nem garantia de vendas.

**Crescimento:** média do último terço do período ÷ média do primeiro terço. Isso reduz o efeito de picos isolados.

**Concorrência:** total de anúncios na busca oficial do Mercado Livre. Abaixo de 500 é baixa, até 5.000 é média e acima disso é alta. É uma aproximação: não pesa vendedores grandes nem anúncios patrocinados.

## Banco de dados (Supabase)

1. Crie um projeto e aplique `supabase/migrations/20261019000000_init.sql` (`supabase db push` ou SQL Editor).
2. Frontend: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O app passa a exigir login, e cada usuário tem os próprios favoritos, alertas, simulações, tarifas e links de fornecedor.
3. Backend (sincronização diária): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` e `SYNC_TERMS`. O cron da Vercel (`vercel.json`) chama `/api/sync`, que grava o histórico de tendências e preços no catálogo compartilhado.

Tabelas: `products` (o catálogo compartilhado tem `owner_id` nulo e é somente leitura para usuários; os produtos privados têm dono), `price_history`, `trend_history`, `data_sources`, `supplier_links`, `favorites`, `alerts`, `alert_events`, `profit_simulations`, `marketplace_fees`, `user_settings`, `integration_settings` e `integration_secrets` (sem políticas, ou seja, só a service role).

**RLS validado em Postgres 16:** `supabase/tests/` tem um stub de `auth` e um teste em que o usuário B não vê nem altera dados de A, ninguém altera o catálogo compartilhado, não é possível gravar com outro dono nem com qualidade "demo" e `integration_secrets` fica inacessível.

## Alertas

Os alertas são avaliados **dentro do painel** sempre que os dados carregam: aumento de interesse, margem atingida, mudança de preço e nova oportunidade por categoria. Cada um dispara no máximo uma vez a cada 24h. Não há e-mail nem push: nenhum mecanismo real foi configurado, e o app não finge que há.

## Arquitetura

```
shared/      tipos + regras puras (lucro, indicador, crescimento, concorrência) usadas no front e no back
server/      roteador /api, integrações (googleTrends, mercadoLivre, shopee), status, sync, acesso admin ao banco
api/         funções serverless da Vercel (1 arquivo por rota, todas delegam a server/router.ts)
src/data/    Repository: LocalRepository (modo local/demo) e SupabaseRepository
src/state/   contexto (modo, sessão), hooks React Query, motor de alertas
src/pages/   11 páginas + detalhes do produto + login
supabase/    migration e testes de RLS
```

## Limitações conhecidas

- Nenhuma integração foi testada contra as APIs reais neste ambiente: não havia credenciais e a rede bloqueia `api.mercadolibre.com`. Parsers e assinaturas têm testes com respostas no formato documentado. Faça a primeira chamada real e confira.
- O histórico de preços só se forma com o tempo (monitoramento e cron diário). Não importamos histórico retroativo.
- O ranking de mais vendidos do ML pode trazer itens `USER_PRODUCT` que não detalhamos. Eles são omitidos, e a tela informa quantos ficaram de fora.
- No modo local, os dados ficam no `localStorage`: sem backup e sem sincronização entre dispositivos.
