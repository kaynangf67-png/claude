-- =====================================================================
-- TrendDrop Radar — schema inicial
--
-- Dois tipos de dado:
-- 1) Catálogo compartilhado (owner_id IS NULL): gravado só pelo backend com
--    a service role (sincronização agendada). Leitura para usuários logados.
-- 2) Dados privados (owner_id/user_id = auth.uid()): produtos monitorados
--    pelo usuário, links de fornecedor, favoritos, alertas, simulações,
--    tarifas e configurações. RLS impede acesso cruzado.
-- =====================================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Fontes de dados (referência)
-- ---------------------------------------------------------------------
create table public.data_sources (
  id text primary key,
  name text not null,
  provider text not null,
  official boolean not null,
  docs_url text,
  notes text not null default ''
);

insert into public.data_sources (id, name, provider, official, docs_url, notes) values
  ('google_trends', 'Google Trends', 'SerpApi', false, 'https://serpapi.com/google-trends-api', 'Interesse relativo de pesquisa (0–100). Não é volume nem vendas.'),
  ('mercadolivre', 'Mercado Livre', 'API oficial Mercado Livre', true, 'https://developers.mercadolivre.com.br', 'Busca, tendências de busca e ranking de mais vendidos (posição).'),
  ('shopee', 'Shopee', 'Shopee Affiliate Open API', true, 'https://affiliate.shopee.com.br', 'Vendas informadas pela API de afiliados; período não documentado.'),
  ('tiktok', 'TikTok Shop', 'Cadastro manual', false, 'https://partner.tiktokshop.com', 'Sem API pública de dados de mercado.'),
  ('dropseller', 'DropSeller', 'Links configurados pelo usuário', false, null, 'Sem API pública documentada.'),
  ('manual', 'Cadastro manual', 'Usuário', false, null, '');

alter table public.data_sources enable row level security;
create policy "fontes legíveis por usuários logados" on public.data_sources for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade, -- null = catálogo compartilhado
  marketplace text not null check (marketplace in ('mercadolivre', 'shopee', 'tiktok', 'manual')),
  source_name text not null check (char_length(source_name) <= 120),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  external_id text check (char_length(external_id) <= 120),
  name text not null check (char_length(name) between 1 and 300),
  image_url text check (image_url is null or image_url ~* '^https?://'),
  category text check (char_length(category) <= 160),
  price numeric(12, 2) check (price is null or price >= 0),
  metrics jsonb not null default '[]'::jsonb,
  trend_term text check (char_length(trend_term) <= 120),
  trend jsonb not null default '[]'::jsonb,
  growth_pct numeric(8, 1),
  competition jsonb,
  similar_prices jsonb not null default '[]'::jsonb,
  quality text not null check (quality in ('oficial', 'terceiro', 'manual')), -- 'demo' nunca vai ao banco
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index products_shared_unique on public.products (marketplace, external_id) where owner_id is null and external_id is not null;
create unique index products_owner_unique on public.products (owner_id, marketplace, external_id) where owner_id is not null and external_id is not null;
create index products_owner_idx on public.products (owner_id);
create index products_updated_idx on public.products (updated_at desc);

alter table public.products enable row level security;
create policy "ler catálogo compartilhado e os próprios" on public.products for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy "inserir somente os próprios" on public.products for insert to authenticated
  with check (owner_id = auth.uid());
create policy "alterar somente os próprios" on public.products for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "excluir somente os próprios" on public.products for delete to authenticated
  using (owner_id = auth.uid());

-- Visibilidade reutilizável nas tabelas dependentes.
create or replace function public.can_read_product(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.products where id = p and (owner_id is null or owner_id = auth.uid()));
$$;
create or replace function public.owns_product(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.products where id = p and owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Histórico de preços
-- ---------------------------------------------------------------------
create table public.price_history (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  price numeric(12, 2) not null check (price >= 0),
  source_id text not null references public.data_sources (id),
  captured_at timestamptz not null default now()
);
create index price_history_product_idx on public.price_history (product_id, captured_at);

alter table public.price_history enable row level security;
create policy "ler histórico de produtos visíveis" on public.price_history for select to authenticated
  using (public.can_read_product(product_id));
create policy "gravar histórico dos próprios produtos" on public.price_history for insert to authenticated
  with check (public.owns_product(product_id));

-- ---------------------------------------------------------------------
-- Histórico de tendências (por termo)
-- ---------------------------------------------------------------------
create table public.trend_history (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users (id) on delete cascade, -- null = compartilhado (cron)
  term text not null check (char_length(term) between 1 and 120),
  geo text not null default 'BR',
  day date not null,
  value numeric(6, 2) not null check (value >= 0),
  source_id text not null references public.data_sources (id),
  captured_at timestamptz not null default now()
);
create unique index trend_history_shared_unique on public.trend_history (term, geo, day, source_id) where owner_id is null;
create unique index trend_history_owner_unique on public.trend_history (owner_id, term, geo, day, source_id) where owner_id is not null;

alter table public.trend_history enable row level security;
create policy "ler tendências compartilhadas e próprias" on public.trend_history for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy "gravar tendências próprias" on public.trend_history for insert to authenticated
  with check (owner_id = auth.uid());
create policy "atualizar tendências próprias" on public.trend_history for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- Links do fornecedor (por usuário e produto) + custo informado
-- ---------------------------------------------------------------------
create table public.supplier_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  supplier text not null default 'dropseller' check (supplier in ('dropseller')),
  url text check (url is null or url ~* '^https?://'),
  supplier_cost numeric(12, 2) check (supplier_cost is null or supplier_cost >= 0),
  confirmed boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, supplier)
);
create trigger supplier_links_updated_at before update on public.supplier_links for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Favoritos
-- ---------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------
-- Alertas e ocorrências
-- ---------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('interest_increase', 'margin_reached', 'price_change', 'new_opportunity')),
  product_id uuid references public.products (id) on delete cascade,
  category text check (char_length(category) <= 160),
  threshold numeric(10, 2) not null,
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  check (type = 'new_opportunity' or product_id is not null)
);

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alert_id uuid not null references public.alerts (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  message text not null check (char_length(message) <= 500),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index alert_events_user_idx on public.alert_events (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Simulações de lucro e tarifas por marketplace
-- ---------------------------------------------------------------------
create table public.profit_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  marketplace text not null,
  inputs jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create table public.marketplace_fees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  marketplace text not null check (marketplace in ('mercadolivre', 'shopee', 'tiktok', 'manual')),
  commission_pct numeric(5, 2) not null default 0 check (commission_pct between 0 and 100),
  fixed_fee numeric(10, 2) not null default 0 check (fixed_fee >= 0),
  extra_fees_pct numeric(5, 2) not null default 0 check (extra_fees_pct between 0 and 100),
  shipping numeric(10, 2) not null default 0 check (shipping >= 0),
  other_costs numeric(10, 2) not null default 0 check (other_costs >= 0),
  tax_pct numeric(5, 2) not null default 0 check (tax_pct between 0 and 100),
  notes text not null default '' check (char_length(notes) <= 500),
  updated_at timestamptz not null default now(),
  unique (user_id, marketplace)
);
create trigger marketplace_fees_updated_at before update on public.marketplace_fees for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Configurações do usuário e das integrações (sem segredos)
-- ---------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  dropseller_search_url text check (dropseller_search_url is null or (dropseller_search_url ~* '^https?://' and position('{q}' in dropseller_search_url) > 0)),
  target_margin_pct numeric(5, 2) not null default 25 check (target_margin_pct between 0 and 90),
  updated_at timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings for each row execute function public.set_updated_at();

create table public.integration_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  integration_id text not null check (integration_id in ('google_trends', 'mercadolivre', 'shopee', 'tiktok', 'dropseller')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb, -- preferências não secretas (ex.: categoria padrão)
  updated_at timestamptz not null default now(),
  primary key (user_id, integration_id)
);

-- Segredos rotacionados pelo backend (ex.: refresh token do Mercado Livre).
-- RLS ligado e SEM políticas: somente a service role acessa.
create table public.integration_secrets (
  integration_id text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (integration_id, key)
);
alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS das tabelas privadas: dono = auth.uid(); referências a produtos
-- precisam ser visíveis ao usuário.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['supplier_links', 'favorites', 'alerts', 'alert_events', 'profit_simulations', 'marketplace_fees', 'user_settings', 'integration_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "dono insere" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "dono exclui" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- Impede referenciar produto privado de outro usuário.
create or replace function public.assert_product_visible()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null and not exists (
    select 1 from public.products where id = new.product_id and (owner_id is null or owner_id = new.user_id)
  ) then
    raise exception 'produto inválido';
  end if;
  return new;
end $$;

create trigger supplier_links_product before insert or update on public.supplier_links for each row execute function public.assert_product_visible();
create trigger favorites_product before insert or update on public.favorites for each row execute function public.assert_product_visible();
create trigger alerts_product before insert or update on public.alerts for each row execute function public.assert_product_visible();
create trigger alert_events_product before insert or update on public.alert_events for each row execute function public.assert_product_visible();
create trigger profit_simulations_product before insert or update on public.profit_simulations for each row execute function public.assert_product_visible();

-- alert_events.alert_id precisa ser do mesmo usuário.
create or replace function public.assert_alert_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.alerts where id = new.alert_id and user_id = new.user_id) then
    raise exception 'alerta inválido';
  end if;
  return new;
end $$;
create trigger alert_events_alert before insert or update on public.alert_events for each row execute function public.assert_alert_owner();
