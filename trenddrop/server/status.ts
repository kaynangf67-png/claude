import type { IntegrationStatus } from '../shared/types';
import { isDatabaseConfigured } from './db';
import { isTrendsConfigured } from './integrations/googleTrends';
import { isMercadoLivreConfigured } from './integrations/mercadoLivre';
import { isShopeeConfigured } from './integrations/shopee';

/** Status das integrações. Informa apenas presença de configuração — nunca valores. */
export function integrationStatus(): IntegrationStatus[] {
  const trends = isTrendsConfigured();
  const ml = isMercadoLivreConfigured();
  const shopee = isShopeeConfigured();
  const db = isDatabaseConfigured();
  return [
    {
      id: 'google_trends',
      name: 'Google Trends',
      provider: 'SerpApi (serviço intermediário)',
      state: trends ? 'conectada' : 'pendente',
      message: trends
        ? 'Consultas de interesse relativo no Brasil habilitadas.'
        : 'Defina SERPAPI_KEY no servidor. A API oficial do Google Trends está em alpha fechado (acesso por inscrição).',
      requires: ['SERPAPI_KEY'],
      docsUrl: 'https://serpapi.com/google-trends-api',
      dataAvailable: ['Interesse ao longo do tempo (até 5 termos)', 'Interesse por estado', 'Consultas relacionadas e em ascensão'],
      limitations: [
        'Índice 0–100 é interesse RELATIVO de pesquisa, não volume nem vendas.',
        'Cada consulta consome créditos do plano SerpApi (há cache de 1h).',
        'Regiões e consultas relacionadas só para um termo por vez.',
      ],
    },
    {
      id: 'mercadolivre',
      name: 'Mercado Livre',
      provider: 'API oficial Mercado Livre',
      state: ml ? 'conectada' : 'pendente',
      message: ml
        ? 'Busca, tendências de busca e ranking de mais vendidos habilitados.'
        : 'Crie um app no DevCenter do Mercado Livre e defina ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REFRESH_TOKEN.',
      requires: ['ML_CLIENT_ID', 'ML_CLIENT_SECRET', 'ML_REFRESH_TOKEN'],
      docsUrl: 'https://developers.mercadolivre.com.br',
      dataAvailable: ['Busca de anúncios (preço, categoria, link)', 'Total de anúncios por termo (base da concorrência)', '50 buscas em alta (semanal)', 'Ranking oficial de mais vendidos por categoria (posição)'],
      limitations: [
        'O ranking de mais vendidos informa a POSIÇÃO, não a quantidade vendida.',
        'A quantidade vendida por anúncio nem sempre é exposta pela API.',
        'Refresh token é de uso único; sem banco configurado, a rotação fica só em memória.',
      ],
    },
    {
      id: 'shopee',
      name: 'Shopee',
      provider: 'Shopee Affiliate Open API',
      state: shopee ? 'conectada' : 'pendente',
      message: shopee
        ? 'Busca de ofertas com vendas informadas habilitada.'
        : 'Exige conta aprovada no programa de afiliados Shopee. Defina SHOPEE_AFFILIATE_APP_ID e SHOPEE_AFFILIATE_SECRET.',
      requires: ['SHOPEE_AFFILIATE_APP_ID', 'SHOPEE_AFFILIATE_SECRET'],
      docsUrl: 'https://affiliate.shopee.com.br',
      dataAvailable: ['Busca de ofertas por palavra-chave', 'Ordenação por mais vendidos', 'Vendas informadas, preço, nota, comissão de afiliado'],
      limitations: ['O período do campo de vendas não é documentado pela fonte.', 'Não informa o total de anúncios (sem estimativa de concorrência).'],
    },
    {
      id: 'tiktok',
      name: 'TikTok Shop',
      provider: 'Sem API pública de dados de mercado',
      state: 'indisponivel',
      message:
        'A TikTok Shop Partner API dá acesso apenas aos dados da sua própria loja. Não há API oficial de produtos em tendência do mercado. Use o cadastro manual com a fonte identificada (ex.: TikTok Creative Center).',
      requires: [],
      docsUrl: 'https://partner.tiktokshop.com',
      dataAvailable: ['Cadastro manual de produtos observados, com fonte e data'],
      limitations: ['Sem coleta automática: scraping violaria os termos da plataforma.', 'Visualizações e curtidas não são vendas.'],
    },
    {
      id: 'dropseller',
      name: 'DropSeller',
      provider: 'Links configurados por você',
      state: 'pendente',
      message:
        'Não encontramos API pública documentada do DropSeller. Cadastre o link de cada produto e, em Configurações, o modelo de URL de pesquisa do fornecedor.',
      requires: [],
      dataAvailable: ['Link direto por produto (manual)', 'Pesquisa pelo nome do produto (modelo de URL configurado)'],
      limitations: ['Sem associação automática enquanto não houver integração autorizada.'],
    },
    {
      id: 'database',
      name: 'Sincronização agendada',
      provider: 'Supabase (service role no servidor)',
      state: db ? 'conectada' : 'pendente',
      message: db
        ? 'O cron diário grava histórico de preços e tendências no banco.'
        : 'Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e CRON_SECRET para gravar históricos automaticamente.',
      requires: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET'],
      dataAvailable: ['Histórico de preços', 'Histórico de tendências', 'Catálogo compartilhado de produtos monitorados'],
      limitations: ['Frequência diária (cron da Vercel).'],
    },
  ];
}
