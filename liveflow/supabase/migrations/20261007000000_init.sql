-- =====================================================================
-- LiveFlow — schema inicial
-- Todas as tabelas de domínio têm id (uuid), user_id, created_at, updated_at
-- e RLS habilitado com acesso restrito ao dono (auth.uid() = user_id).
--
-- Sobre a tabela "users": o Supabase já mantém auth.users (fonte da verdade
-- de identidade). Duplicá-la em public.users só cria dessincronização.
-- public.profiles é o espelho 1:1 de auth.users com os dados de aplicação.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.plan_tier as enum ('free', 'pro', 'premium');
create type public.product_status as enum ('active', 'paused', 'archived');
create type public.video_status as enum ('available', 'scheduled', 'streaming', 'finished', 'archived');
create type public.live_status as enum ('draft', 'scheduled', 'running', 'finished', 'cancelled', 'error');
create type public.integration_status as enum ('disconnected', 'connected', 'expired', 'error');

-- ---------------------------------------------------------------------
-- Função utilitária: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Planos (preparação SaaS). Tabela de referência, leitura pública.
-- ---------------------------------------------------------------------
create table public.plan_limits (
  plan public.plan_tier primary key,
  max_products int,          -- null = ilimitado
  max_videos int,
  max_lives_per_month int,
  max_ai_generations_per_month int,
  analytics_history_days int,
  storage_mb int
);

insert into public.plan_limits values
  ('free',    10,   10,   30,   30,    30,   1024),
  ('pro',     100,  200,  600,  500,   180,  20480),
  ('premium', null, null, null, 3000,  730,  102400);

alter table public.plan_limits enable row level security;
create policy "plan_limits são públicos para leitura" on public.plan_limits
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text not null default '',
  avatar_url text,
  plan public.plan_tier not null default 'free',
  onboarding_completed boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cria o profile automaticamente no cadastro.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- O usuário NÃO pode trocar o próprio plano pelo client: só o backend
-- (service_role, via webhook de pagamento) pode.
create or replace function public.protect_profile_plan()
returns trigger language plpgsql as $$
begin
  if new.plan is distinct from old.plan and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'plan só pode ser alterado pelo backend de cobrança';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id é imutável';
  end if;
  return new;
end $$;

create trigger profiles_protect_plan before update on public.profiles
  for each row execute function public.protect_profile_plan();

-- ---------------------------------------------------------------------
-- Assinaturas (Stripe / Mercado Pago no futuro). Escrita só via backend.
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan public.plan_tier not null,
  provider text not null check (provider in ('stripe', 'mercadopago', 'manual')),
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  image_url text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  promo_price numeric(12, 2) check (promo_price is null or promo_price >= 0),
  commission_rate numeric(5, 2) not null default 0 check (commission_rate between 0 and 100),
  category text not null default '' check (char_length(category) <= 80),
  product_url text check (product_url is null or product_url ~* '^https?://'),
  sku text check (sku is null or char_length(sku) <= 80),
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  storage_path text,          -- caminho no bucket video-files ({user_id}/...)
  thumbnail_path text,        -- caminho no bucket thumbnails
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  mime_type text,
  status public.video_status not null default 'available',
  usage_count int not null default 0 check (usage_count >= 0),
  -- Preparado para processamento externo (transcodificação):
  processing_status text not null default 'ready' check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  processing_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- live_schedules (regras de recorrência)
-- ---------------------------------------------------------------------
create table public.live_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id uuid references public.videos (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  duration_minutes int not null check (duration_minutes between 5 and 720),
  recurrence jsonb not null,  -- {frequency, time, startDate, endDate?, weekdays?, intervalDays?}
  timezone text not null default 'America/Sao_Paulo',
  generated_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- automations
-- ---------------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  schedule_id uuid not null references public.live_schedules (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  is_active boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- lives (cada ocorrência/sessão)
-- ---------------------------------------------------------------------
create table public.lives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id uuid references public.videos (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  schedule_id uuid references public.live_schedules (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  duration_minutes int not null check (duration_minutes between 5 and 720),
  status public.live_status not null default 'draft',
  external_id text,           -- id na plataforma externa (quando houver API oficial)
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- analytics (métricas diárias, atribuídas a produto/vídeo/live)
-- ---------------------------------------------------------------------
create table public.analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  product_id uuid references public.products (id) on delete cascade,
  video_id uuid references public.videos (id) on delete set null,
  live_id uuid references public.lives (id) on delete set null,
  views int not null default 0 check (views >= 0),
  clicks int not null default 0 check (clicks >= 0),
  conversions int not null default 0 check (conversions >= 0), -- pedidos
  units_sold int not null default 0 check (units_sold >= 0),   -- vendas (itens)
  revenue numeric(14, 2) not null default 0,                   -- faturamento (GMV)
  commission numeric(14, 2) not null default 0,
  cost numeric(14, 2) not null default 0,                      -- investimento (p/ ROI)
  source text not null default 'manual' check (source in ('manual', 'demo', 'tiktok')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- notifications (também alimenta "Atividade recente")
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ai_generations
-- ---------------------------------------------------------------------
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('script', 'variations', 'hooks', 'copilot')),
  product_id uuid references public.products (id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  provider text not null default 'local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- integrations (metadados visíveis ao usuário — SEM tokens)
-- ---------------------------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('tiktok', 'tiktok_shop')),
  status public.integration_status not null default 'disconnected',
  account_name text,
  scopes text[] not null default '{}',
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Tokens OAuth ficam aqui: RLS ligado e NENHUMA policy => só service_role
-- (Edge Functions) lê/escreve. O browser nunca vê access/refresh tokens.
create table public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  integration_id uuid not null unique references public.integrations (id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index products_user_status_idx on public.products (user_id, status);
create index products_user_created_idx on public.products (user_id, created_at desc);
create unique index products_user_sku_uidx on public.products (user_id, sku) where sku is not null;
create index videos_user_created_idx on public.videos (user_id, created_at desc);
create index videos_product_idx on public.videos (product_id);
create index lives_user_starts_idx on public.lives (user_id, starts_at);
create index lives_user_status_idx on public.lives (user_id, status);
create index lives_product_idx on public.lives (product_id);
create index lives_video_idx on public.lives (video_id);
create index lives_schedule_idx on public.lives (schedule_id);
create index live_schedules_user_idx on public.live_schedules (user_id);
create index automations_user_idx on public.automations (user_id, is_active);
create index analytics_user_date_idx on public.analytics (user_id, date desc);
create index analytics_product_idx on public.analytics (product_id, date);
create index analytics_live_idx on public.analytics (live_id);
create index analytics_video_idx on public.analytics (video_id);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index ai_generations_user_created_idx on public.ai_generations (user_id, created_at desc);
create index subscriptions_user_idx on public.subscriptions (user_id);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','subscriptions','products','videos','live_schedules','automations',
                           'lives','analytics','notifications','ai_generations','integrations','integration_secrets']
  loop
    execute format('create trigger %I_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Integridade entre donos: impede referenciar produto/vídeo de outro usuário
-- (RLS protege leitura, mas FK sozinha aceitaria um uuid alheio).
-- ---------------------------------------------------------------------
create or replace function public.assert_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- ifs aninhados: o PL/pgSQL só resolve new.<coluna> quando o ramo executa.
  if tg_table_name in ('videos','lives','live_schedules','analytics','ai_generations') then
    if new.product_id is not null then
      perform 1 from public.products where id = new.product_id and user_id = new.user_id;
      if not found then raise exception 'produto inválido'; end if;
    end if;
  end if;
  if tg_table_name in ('lives','live_schedules','analytics') then
    if new.video_id is not null then
      perform 1 from public.videos where id = new.video_id and user_id = new.user_id;
      if not found then raise exception 'vídeo inválido'; end if;
    end if;
  end if;
  if tg_table_name in ('lives','automations') then
    if new.schedule_id is not null then
      perform 1 from public.live_schedules where id = new.schedule_id and user_id = new.user_id;
      if not found then raise exception 'agenda inválida'; end if;
    end if;
  end if;
  if tg_table_name = 'analytics' then
    if new.live_id is not null then
      perform 1 from public.lives where id = new.live_id and user_id = new.user_id;
      if not found then raise exception 'live inválida'; end if;
    end if;
  end if;
  return new;
end $$;

create trigger videos_same_owner before insert or update on public.videos for each row execute function public.assert_same_owner();
create trigger lives_same_owner before insert or update on public.lives for each row execute function public.assert_same_owner();
create trigger live_schedules_same_owner before insert or update on public.live_schedules for each row execute function public.assert_same_owner();
create trigger automations_same_owner before insert or update on public.automations for each row execute function public.assert_same_owner();
create trigger analytics_same_owner before insert or update on public.analytics for each row execute function public.assert_same_owner();
create trigger ai_generations_same_owner before insert or update on public.ai_generations for each row execute function public.assert_same_owner();

-- ---------------------------------------------------------------------
-- Limites de plano aplicados NO BANCO (o client pode ser burlado).
-- ---------------------------------------------------------------------
create or replace function public.enforce_plan_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan public.plan_tier;
  v_limit int;
  v_count int;
begin
  select plan into v_plan from public.profiles where user_id = new.user_id;
  v_plan := coalesce(v_plan, 'free');

  if tg_table_name = 'products' then
    select max_products into v_limit from public.plan_limits where plan = v_plan;
    select count(*) into v_count from public.products where user_id = new.user_id and status <> 'archived';
  elsif tg_table_name = 'videos' then
    select max_videos into v_limit from public.plan_limits where plan = v_plan;
    select count(*) into v_count from public.videos where user_id = new.user_id and status <> 'archived';
  elsif tg_table_name = 'lives' then
    select max_lives_per_month into v_limit from public.plan_limits where plan = v_plan;
    select count(*) into v_count from public.lives
      where user_id = new.user_id and date_trunc('month', starts_at) = date_trunc('month', new.starts_at);
  elsif tg_table_name = 'ai_generations' then
    select max_ai_generations_per_month into v_limit from public.plan_limits where plan = v_plan;
    select count(*) into v_count from public.ai_generations
      where user_id = new.user_id and created_at >= date_trunc('month', now());
  end if;

  if v_limit is not null and v_count >= v_limit then
    raise exception 'PLAN_LIMIT: limite do plano % atingido em %', v_plan, tg_table_name
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger products_plan_limit before insert on public.products for each row execute function public.enforce_plan_limit();
create trigger videos_plan_limit before insert on public.videos for each row execute function public.enforce_plan_limit();
create trigger lives_plan_limit before insert on public.lives for each row execute function public.enforce_plan_limit();
create trigger ai_generations_plan_limit before insert on public.ai_generations for each row execute function public.enforce_plan_limit();

-- ---------------------------------------------------------------------
-- RLS: dono lê e escreve somente o que é seu
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','products','videos','live_schedules','automations','lives',
                           'analytics','notifications','ai_generations','integrations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: select próprio" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s: insert próprio" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s: update próprio" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s: delete próprio" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end $$;

-- profile é criado pelo trigger; não deixamos o usuário apagar o próprio profile pelo client
drop policy "profiles: delete próprio" on public.profiles;
drop policy "profiles: insert próprio" on public.profiles;

-- subscriptions: usuário só lê; escrita exclusiva do backend (service_role ignora RLS)
alter table public.subscriptions enable row level security;
create policy "subscriptions: select próprio" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- integration_secrets: RLS sem policies = inacessível para anon/authenticated
alter table public.integration_secrets enable row level security;

-- ---------------------------------------------------------------------
-- STORAGE
-- Convenção de caminho: {user_id}/{arquivo}. A 1ª pasta identifica o dono.
-- avatars e product-images: leitura pública (imagens exibidas em links);
-- video-files e thumbnails: privados (URLs assinadas).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',        'avatars',        true,  2097152,    array['image/png','image/jpeg','image/webp']),
  ('product-images', 'product-images', true,  5242880,    array['image/png','image/jpeg','image/webp']),
  ('video-files',    'video-files',    false, 2147483648, array['video/mp4','video/quicktime','video/webm']),
  ('thumbnails',     'thumbnails',     false, 2097152,    array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "storage: dono lê arquivos privados" on storage.objects
  for select to authenticated
  using (bucket_id in ('video-files', 'thumbnails', 'avatars', 'product-images')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "storage: dono envia na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('video-files', 'thumbnails', 'avatars', 'product-images')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "storage: dono atualiza na própria pasta" on storage.objects
  for update to authenticated
  using (bucket_id in ('video-files', 'thumbnails', 'avatars', 'product-images')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "storage: dono remove na própria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id in ('video-files', 'thumbnails', 'avatars', 'product-images')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
