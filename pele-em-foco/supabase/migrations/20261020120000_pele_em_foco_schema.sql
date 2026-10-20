-- =====================================================================
-- Pele em Foco — schema inicial
--
-- Regras centrais:
-- * Todo dado pessoal (perfil, rotina, diário) pertence a um auth.users.id
--   e só o dono lê. RLS habilitado em todas as tabelas do schema public.
-- * Acesso ao bônus (access_entitlements) NUNCA é escrito pelo cliente.
--   Só funções security definer / service_role criam ou alteram linhas.
-- * Escrita de rotina e diário e leitura da biblioteca exigem acesso ativo,
--   verificado no banco (private.has_active_access), não no navegador.
-- * Após o fim do bônus a pessoa continua podendo LER, EXPORTAR e APAGAR os
--   próprios dados (LGPD), mas não cria nem edita registros.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Utilitário: updated_at automático
-- ---------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- profiles (1:1 com auth.users) — só o mínimo necessário
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  accepted_disclaimer_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Cria o perfil quando a conta nasce no Supabase Auth.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, accepted_disclaimer_at)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60),
    case when (new.raw_user_meta_data ->> 'accepted_disclaimer') = 'true' then now() end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;

create policy "perfil: dono lê" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: dono edita" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- O cliente só pode alterar o nome exibido.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Compras verificadas (preenchida só pelo webhook da Cakto / service_role)
-- ---------------------------------------------------------------------
create table public.verified_purchases (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and position('@' in email) > 1),
  external_order_id text not null unique,
  product_id text,
  status text not null check (status in ('approved', 'refunded', 'chargeback')),
  source text not null default 'cakto' check (source in ('cakto', 'manual')),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index verified_purchases_email_idx on public.verified_purchases (email) where claimed_at is null;
create index verified_purchases_claimed_by_idx on public.verified_purchases (claimed_by);
create trigger verified_purchases_updated_at before update on public.verified_purchases
  for each row execute function private.set_updated_at();

alter table public.verified_purchases enable row level security;
-- Sem políticas: anon e authenticated não leem nem escrevem.
revoke all on public.verified_purchases from anon, authenticated;

-- ---------------------------------------------------------------------
-- Direito de acesso ao app (bônus de 30 dias)
-- ---------------------------------------------------------------------
create table public.access_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  source text not null check (source in ('cakto', 'manual')),
  external_order_id text unique,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create index access_entitlements_user_idx on public.access_entitlements (user_id, expires_at desc);

alter table public.access_entitlements enable row level security;
create policy "acesso: dono lê" on public.access_entitlements
  for select to authenticated using (user_id = (select auth.uid()));

-- Ninguém além do service_role / funções privilegiadas escreve aqui.
revoke insert, update, delete, truncate on public.access_entitlements from anon, authenticated;
grant select on public.access_entitlements to authenticated;

-- Acesso ativo do usuário atual. Usado nas políticas abaixo.
create or replace function private.has_active_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_entitlements e
    where e.user_id = (select auth.uid())
      and e.status = 'active'
      and now() >= e.starts_at
      and now() < e.expires_at
  );
$$;

revoke execute on function private.has_active_access() from public, anon;
grant execute on function private.has_active_access() to authenticated;

-- Situação do acesso para a interface (nunca usada para autorizar nada).
create or replace function public.get_my_access()
returns table (status text, starts_at timestamptz, expires_at timestamptz, source text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when e.id is null then 'none'
      when e.status = 'revoked' then 'revoked'
      when now() >= e.expires_at then 'expired'
      when now() < e.starts_at then 'none'
      else 'active'
    end,
    e.starts_at, e.expires_at, e.source
  from (select (select auth.uid()) as uid) me
  left join lateral (
    select * from public.access_entitlements x
    where x.user_id = me.uid
    order by (x.status = 'active' and now() < x.expires_at) desc, x.expires_at desc
    limit 1
  ) e on true
  where me.uid is not null;
$$;

revoke execute on function public.get_my_access() from public, anon;
grant execute on function public.get_my_access() to authenticated;

-- Vincula uma compra verificada à conta do usuário (e-mail confirmado e igual
-- ao da compra) e ativa 30 dias a partir de agora. Idempotente.
create or replace function public.claim_verified_purchase()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_confirmed timestamptz;
  v_purchase public.verified_purchases%rowtype;
begin
  if v_uid is null then
    return 'not_authenticated';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;

  if v_confirmed is null then
    return 'email_not_confirmed';
  end if;

  if private.has_active_access() then
    return 'already_active';
  end if;

  select * into v_purchase
  from public.verified_purchases p
  -- claimed_at (e não claimed_by) marca uso: excluir e recriar a conta não reativa a mesma compra.
  where p.email = v_email and p.status = 'approved' and p.claimed_at is null
  order by p.created_at
  limit 1
  for update skip locked;

  if not found then
    return 'no_purchase';
  end if;

  insert into public.access_entitlements (user_id, status, starts_at, expires_at, source, external_order_id)
  values (v_uid, 'active', now(), now() + interval '30 days', v_purchase.source, v_purchase.external_order_id);

  update public.verified_purchases
  set claimed_by = v_uid, claimed_at = now()
  where id = v_purchase.id;

  return 'activated';
end $$;

revoke execute on function public.claim_verified_purchase() from public, anon;
grant execute on function public.claim_verified_purchase() to authenticated;

-- Registro de compra pelo webhook (ou manualmente no SQL Editor).
-- Só service_role pode executar.
create or replace function public.record_verified_purchase(
  p_email text,
  p_order_id text,
  p_product_id text,
  p_status text,
  p_source text default 'cakto'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.verified_purchases (email, external_order_id, product_id, status, source)
  values (lower(trim(p_email)), p_order_id, p_product_id, p_status, p_source)
  on conflict (external_order_id) do update
    -- Reembolso e chargeback são finais: um reenvio atrasado de "aprovado" não reabre a compra.
    set status = case
          when public.verified_purchases.status in ('refunded', 'chargeback') then public.verified_purchases.status
          else excluded.status
        end,
        email = excluded.email,
        product_id = coalesce(excluded.product_id, public.verified_purchases.product_id);

  -- Reembolso ou chargeback revogam o acesso ligado a este pedido.
  if p_status in ('refunded', 'chargeback') then
    update public.access_entitlements set status = 'revoked' where external_order_id = p_order_id;
  end if;
end $$;

revoke execute on function public.record_verified_purchase(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_verified_purchase(text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Rotina: conclusões por usuário, dia, período e passo
-- ---------------------------------------------------------------------
create table public.routine_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  completed_on date not null,
  period text not null check (period in ('manha', 'noite')),
  step_key text not null,
  created_at timestamptz not null default now(),
  constraint routine_step_valid check (
    (period = 'manha' and step_key in ('limpeza', 'hidratacao', 'protecao-solar'))
    or (period = 'noite' and step_key in ('limpeza', 'hidratacao', 'revisao'))
  ),
  constraint routine_completions_unique unique (user_id, completed_on, period, step_key)
);

alter table public.routine_completions enable row level security;
create policy "rotina: dono lê" on public.routine_completions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "rotina: dono registra com acesso ativo" on public.routine_completions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_active_access()));
create policy "rotina: dono desfaz com acesso ativo" on public.routine_completions
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.has_active_access()));

revoke all on public.routine_completions from anon;
grant select, insert, delete on public.routine_completions to authenticated;

-- ---------------------------------------------------------------------
-- Diário da pele: uma entrada por dia
-- ---------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  skin_feel text check (skin_feel in ('como-sempre', 'mais-oleosa', 'repuxando', 'irritada')),
  observations text[] not null default '{}' check (
    observations <@ array['espinhas-novas', 'menos-espinhas', 'vermelhidao', 'ressecamento', 'oleosidade', 'coceira']::text[]
  ),
  products_used text not null default '' check (char_length(products_used) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_one_per_day unique (user_id, entry_date)
);

create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);
create trigger journal_entries_updated_at before update on public.journal_entries
  for each row execute function private.set_updated_at();

alter table public.journal_entries enable row level security;
create policy "diário: dono lê" on public.journal_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "diário: dono cria com acesso ativo" on public.journal_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_active_access()));
create policy "diário: dono edita com acesso ativo" on public.journal_entries
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.has_active_access()))
  with check (user_id = (select auth.uid()));
-- Apagar é sempre permitido ao dono, mesmo após o fim do bônus.
create policy "diário: dono apaga" on public.journal_entries
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.journal_entries from anon;
grant select, insert, delete on public.journal_entries to authenticated;
grant update (entry_date, notes, skin_feel, observations, products_used) on public.journal_entries to authenticated;

-- Apagar a própria rotina também é sempre permitido (exclusão de dados).
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.routine_completions where user_id = (select auth.uid());
  delete from public.journal_entries where user_id = (select auth.uid());
end $$;

revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- ---------------------------------------------------------------------
-- Biblioteca educativa (conteúdo do bônus: exige acesso ativo)
-- ---------------------------------------------------------------------
create table public.educational_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null check (category in (
    'entendendo-a-acne', 'rotina-de-cuidados', 'ingredientes-e-rotulos',
    'habitos-e-bem-estar', 'mitos-e-verdades', 'quando-procurar-dermatologista'
  )),
  title text not null,
  summary text not null,
  reading_minutes int not null check (reading_minutes between 1 and 30),
  body jsonb not null,
  sources jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) > 0),
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index educational_articles_category_idx on public.educational_articles (category, sort_order) where published;
create trigger educational_articles_updated_at before update on public.educational_articles
  for each row execute function private.set_updated_at();

alter table public.educational_articles enable row level security;
create policy "biblioteca: leitura com acesso ativo" on public.educational_articles
  for select to authenticated using (published and (select private.has_active_access()));

revoke all on public.educational_articles from anon;
revoke insert, update, delete on public.educational_articles from authenticated;
grant select on public.educational_articles to authenticated;
