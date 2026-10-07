-- VagaAqui v2 — esquema do piloto (Supabase / Postgres 15+)
-- Sem PostGIS: buscas por caixa lat/lon com índice, suficiente para raios de ~1 km.

create extension if not exists pgcrypto;

-- Relatos dos motoristas (o "tempo real" do app)
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  segment_id  text not null check (length(segment_id) between 1 and 64),
  kind        text not null check (kind in ('free', 'full', 'left', 'parked')),
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  trust       real not null default 1 check (trust > 0 and trust <= 1),
  device_id   text not null check (length(device_id) between 8 and 64),
  user_id     uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists reports_box_idx on public.reports (lat, lon, created_at desc);
create index if not exists reports_device_idx on public.reports (device_id, created_at desc);

-- Eventos de métrica do piloto (acerto da previsão, retenção, interesse no Pro)
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  name        text not null check (name in ('app_open','forecast_shown','answer','report','subscribe_click','waitlist','navigate')),
  props       jsonb not null default '{}'::jsonb,
  device_id   text not null check (length(device_id) between 8 and 64),
  user_id     uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists events_name_idx on public.events (name, created_at desc);

-- Assinaturas (preenchida pelo webhook do gateway de pagamento, nunca pelo app)
create table if not exists public.subscriptions (
  user_id     uuid primary key,
  status      text not null check (status in ('active','past_due','canceled')),
  provider    text not null,
  current_period_end timestamptz not null,
  updated_at  timestamptz not null default now()
);

alter table public.reports enable row level security;
alter table public.events enable row level security;
alter table public.subscriptions enable row level security;

-- Leitura: só relatos das últimas 3 horas (o app usa 90 min). Histórico bruto não fica exposto.
drop policy if exists reports_read_recent on public.reports;
create policy reports_read_recent on public.reports
  for select to anon, authenticated
  using (created_at > now() - interval '3 hours');

-- Escrita: qualquer motorista (anônimo ou logado) pode relatar, com horário do servidor.
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute' and created_at < now() + interval '1 minute');

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to anon, authenticated
  with check (true);

drop policy if exists subscriptions_own on public.subscriptions;
create policy subscriptions_own on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

-- Anti-abuso simples: no máximo 20 relatos por aparelho a cada 10 minutos.
create or replace function public.reports_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where device_id = new.device_id and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'limite de relatos atingido, tente mais tarde' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.reports_rate_limit();

-- LGPD: apagar os dados de um aparelho
create or replace function public.delete_my_data(p_device_id text) returns void
language sql security definer set search_path = public as $$
  delete from public.reports where device_id = p_device_id;
  delete from public.events where device_id = p_device_id;
$$;
grant execute on function public.delete_my_data(text) to anon, authenticated;

-- Painel do piloto (só para quem tem acesso ao banco — não exposto ao app)
create or replace view public.metrics_overview with (security_invoker = true) as
with answers as (
  select (props->>'predicted')::float as p, case when props->>'answer' = 'street' then 1 else 0 end as y, created_at, device_id
  from public.events where name = 'answer' and props ? 'predicted' and props->>'predicted' is not null
)
select
  (select count(distinct device_id) from public.events where name = 'app_open') as devices,
  (select count(*) from answers) as answers,
  (select round(avg(case when (p >= 0.5)::int = y then 1 else 0 end)::numeric, 3) from answers) as hit_rate,
  (select round(avg((p - y) ^ 2)::numeric, 4) from answers) as brier,
  (select count(*) from public.reports where created_at > now() - interval '7 days') as reports_7d,
  (select percentile_cont(0.5) within group (order by (props->>'sinceOpenMs')::float) from public.events where name = 'forecast_shown' and props->>'sinceOpenMs' is not null) as median_open_to_answer_ms,
  (select count(distinct device_id) from public.events where name in ('subscribe_click','waitlist')) as pro_interest_devices;
revoke all on public.metrics_overview from anon, authenticated;
