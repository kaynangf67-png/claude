-- =====================================================================
-- Publicações de vídeos curtos (operação sem aparecer).
-- Fluxo assistido: o LiveFlow prepara e lembra; a postagem (com link de
-- produto) é feita pelo usuário no app do TikTok. Integração via Content
-- Posting API oficial fica para depois da auditoria do app.
-- =====================================================================

create type public.post_status as enum ('draft', 'scheduled', 'published', 'failed', 'cancelled');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id uuid references public.videos (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  caption text not null default '' check (char_length(caption) <= 2200),
  hashtags text[] not null default '{}' check (cardinality(hashtags) <= 30),
  format text not null default 'maos' check (format in ('maos', 'unboxing', 'antes_depois', 'comparativo', 'pov_texto', 'narracao')),
  scheduled_at timestamptz,
  status public.post_status not null default 'draft',
  published_url text check (published_url is null or published_url ~* '^https://(www\.|vm\.|vt\.)?tiktok\.com/'),
  published_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_user_scheduled_idx on public.posts (user_id, scheduled_at);
create index posts_user_status_idx on public.posts (user_id, status);
create index posts_video_idx on public.posts (video_id);
create index posts_product_idx on public.posts (product_id);

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- Publicação agendada precisa de horário; publicada precisa de data.
alter table public.posts add constraint posts_schedule_consistency
  check ((status <> 'scheduled' or scheduled_at is not null) and (status <> 'published' or published_at is not null));

-- Métricas por publicação.
alter table public.analytics add column post_id uuid references public.posts (id) on delete set null;
create index analytics_post_idx on public.analytics (post_id);

-- Mesmo dono para referências de posts (e para analytics.post_id).
create or replace function public.assert_post_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'posts' then
    if new.product_id is not null then
      perform 1 from public.products where id = new.product_id and user_id = new.user_id;
      if not found then raise exception 'produto inválido'; end if;
    end if;
    if new.video_id is not null then
      perform 1 from public.videos where id = new.video_id and user_id = new.user_id;
      if not found then raise exception 'vídeo inválido'; end if;
    end if;
  elsif tg_table_name = 'analytics' then
    if new.post_id is not null then
      perform 1 from public.posts where id = new.post_id and user_id = new.user_id;
      if not found then raise exception 'publicação inválida'; end if;
    end if;
  end if;
  return new;
end $$;

create trigger posts_same_owner before insert or update on public.posts
  for each row execute function public.assert_post_owner();
create trigger analytics_post_owner before insert or update on public.analytics
  for each row execute function public.assert_post_owner();

alter table public.posts enable row level security;
create policy "posts: select próprio" on public.posts for select to authenticated using ((select auth.uid()) = user_id);
create policy "posts: insert próprio" on public.posts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "posts: update próprio" on public.posts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "posts: delete próprio" on public.posts for delete to authenticated using ((select auth.uid()) = user_id);

-- Limite de publicações por mês por plano.
alter table public.plan_limits add column max_posts_per_month int;
update public.plan_limits set max_posts_per_month = case plan when 'free' then 60 when 'pro' then 900 else null end;

create or replace function public.enforce_post_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan public.plan_tier; v_limit int; v_count int; v_ref timestamptz;
begin
  select coalesce(plan, 'free') into v_plan from public.profiles where user_id = new.user_id;
  select max_posts_per_month into v_limit from public.plan_limits where plan = coalesce(v_plan, 'free');
  v_ref := coalesce(new.scheduled_at, now());
  select count(*) into v_count from public.posts
    where user_id = new.user_id and date_trunc('month', coalesce(scheduled_at, created_at)) = date_trunc('month', v_ref);
  if v_limit is not null and v_count >= v_limit then
    raise exception 'PLAN_LIMIT: limite do plano % atingido em posts', v_plan using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger posts_plan_limit before insert on public.posts for each row execute function public.enforce_post_limit();
