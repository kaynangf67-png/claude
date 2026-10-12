-- Web Company Menu Builder — esquema inicial.
-- Princípios:
--   * Todo dado pertence a um dono (owner_id). RLS garante que cada usuário só vê o que é seu.
--   * O público NUNCA lê tabelas diretamente: usa get_public_menu(slug), que devolve só
--     campos públicos de cardápios publicados e só itens revisados com preço.
--   * Preparado para SaaS (plano, uso de IA, log de atividades) sem cobrar nem bloquear nada agora.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  -- Reservado para planos futuros. Nenhuma regra usa este campo hoje.
  plan text not null default 'internal',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- projetos
create table public.restaurant_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  restaurant_name text not null check (char_length(restaurant_name) between 1 and 120),
  slug text unique check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60)),
  description text not null default '',
  business_type text not null default '',
  phone text not null default '',
  whatsapp_number text not null default '',
  show_whatsapp boolean not null default false,
  address text not null default '',
  opening_hours text not null default '',
  instagram_url text not null default '',
  google_maps_url text not null default '',
  website_url text not null default '',
  logo_url text,
  cover_url text,
  primary_color text not null default '#1e3a5f' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null default '#c2410c' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  theme text not null default 'claro' check (theme in ('claro', 'noite')),
  status text not null default 'setup'
    check (status in ('setup', 'awaiting_analysis', 'awaiting_review', 'approved', 'published', 'unpublished', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index restaurant_projects_owner_idx on public.restaurant_projects (owner_id, updated_at desc);

-- ---------------------------------------------------------------- arquivos
create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.restaurant_projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bucket text not null check (bucket in ('menu-sources', 'menu-media')),
  storage_path text not null,
  -- URL pública (só para o bucket menu-media). Páginas de cardápio ficam privadas.
  file_url text,
  file_type text not null check (file_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  purpose text not null check (purpose in ('menu_page', 'dish', 'ambiance', 'logo', 'cover', 'other')),
  original_filename text not null default '',
  sha256 text not null,
  analyzed_at timestamptz,
  analysis_error text,
  created_at timestamptz not null default now(),
  -- Mesma imagem duas vezes no mesmo projeto = desperdício de armazenamento e de IA.
  unique (project_id, sha256)
);
create index project_assets_project_idx on public.project_assets (project_id);

-- ---------------------------------------------------------------- cardápio
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.restaurant_projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, project_id)
);
create index menu_categories_project_idx on public.menu_categories (project_id, sort_order);

create table public.menu_products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.restaurant_projects (id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  price numeric(10, 2) check (price is null or price >= 0),
  -- [{"label": "Grande", "price": 25.0}] ; price pode ser null (precisa confirmar)
  variations jsonb not null default '[]'::jsonb check (jsonb_typeof(variations) = 'array'),
  image_url text,
  available boolean not null default true,
  sort_order integer not null default 0,
  source_reference text not null default 'manual',
  source_asset_id uuid references public.project_assets (id) on delete set null,
  confidence numeric(3, 2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  review_required boolean not null default false,
  review_notes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Garante que a categoria é do MESMO projeto do produto.
  foreign key (category_id, project_id) references public.menu_categories (id, project_id) on delete cascade
);
create index menu_products_project_idx on public.menu_products (project_id, category_id, sort_order);

-- ---------------------------------------------------------------- uso de IA e atividades
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.restaurant_projects (id) on delete set null,
  model text not null,
  images integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 4),
  status text not null check (status in ('success', 'error', 'refused')),
  error text,
  created_at timestamptz not null default now()
);
create index ai_usage_owner_idx on public.ai_usage (owner_id, created_at desc);

create table public.activity_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.restaurant_projects (id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_project_idx on public.activity_log (project_id, created_at desc);

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger restaurant_projects_touch before update on public.restaurant_projects
  for each row execute function public.touch_updated_at();
create trigger menu_products_touch before update on public.menu_products
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.restaurant_projects enable row level security;
alter table public.project_assets enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_products enable row level security;
alter table public.ai_usage enable row level security;
alter table public.activity_log enable row level security;

create policy "perfil próprio: ler" on public.profiles for select using (id = auth.uid());
create policy "perfil próprio: editar nome" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "projetos do dono" on public.restaurant_projects for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "arquivos do dono" on public.project_assets for all
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.restaurant_projects p where p.id = project_id and p.owner_id = auth.uid())
  );

create policy "categorias do dono" on public.menu_categories for all
  using (exists (select 1 from public.restaurant_projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurant_projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "produtos do dono" on public.menu_products for all
  using (exists (select 1 from public.restaurant_projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurant_projects p where p.id = project_id and p.owner_id = auth.uid()));

-- Uso de IA: só leitura para o dono. Quem grava é a Edge Function com a service role,
-- para que ninguém apague o próprio histórico e burle o limite diário.
create policy "uso de IA: ler o próprio" on public.ai_usage for select using (owner_id = auth.uid());

create policy "atividades: ler" on public.activity_log for select using (owner_id = auth.uid());
create policy "atividades: registrar" on public.activity_log for insert with check (owner_id = auth.uid());

-- ---------------------------------------------------------------- permissões explícitas
-- Não dependemos dos privilégios padrão do projeto. Visitante (anon) não toca em tabela
-- nenhuma: só na função get_public_menu. Usuário logado tem acesso filtrado pelo RLS acima.
revoke all on public.profiles, public.restaurant_projects, public.project_assets, public.menu_categories,
  public.menu_products, public.ai_usage, public.activity_log from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.restaurant_projects, public.project_assets,
  public.menu_categories, public.menu_products to authenticated;
grant select on public.ai_usage to authenticated;
grant select, insert on public.activity_log to authenticated;
grant usage on sequence public.activity_log_id_seq to authenticated;

-- ---------------------------------------------------------------- leitura pública
-- Única porta do público. SECURITY DEFINER para ignorar o RLS, mas devolve apenas
-- campos públicos, apenas cardápios publicados e apenas itens revisados e com preço.
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'slug', p.slug,
    'restaurantName', p.restaurant_name,
    'description', p.description,
    'businessType', p.business_type,
    'phone', p.phone,
    'whatsappNumber', case when p.show_whatsapp and p.whatsapp_number <> '' then p.whatsapp_number end,
    'address', p.address,
    'openingHours', p.opening_hours,
    'instagramUrl', p.instagram_url,
    'googleMapsUrl', p.google_maps_url,
    'websiteUrl', p.website_url,
    'logoUrl', p.logo_url,
    'coverUrl', p.cover_url,
    'primaryColor', p.primary_color,
    'secondaryColor', p.secondary_color,
    'theme', p.theme,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'products', c.products) order by c.sort_order)
      from (
        select c.id, c.name, c.sort_order,
          (select jsonb_agg(jsonb_build_object(
              'id', m.id,
              'name', m.name,
              'description', m.description,
              'price', case when jsonb_array_length(m.variations) > 0 then null else m.price end,
              'variations', m.variations,
              'imageUrl', m.image_url,
              'available', m.available
            ) order by m.sort_order)
           from public.menu_products m
           where m.category_id = c.id
             and not m.review_required
             and (
               (jsonb_array_length(m.variations) = 0 and m.price is not null)
               or (jsonb_array_length(m.variations) > 0
                   and not exists (
                     select 1 from jsonb_array_elements(m.variations) v
                     where jsonb_typeof(v -> 'price') <> 'number'
                   ))
             )
          ) as products
        from public.menu_categories c
        where c.project_id = p.id
      ) c
      where c.products is not null
    ), '[]'::jsonb)
  )
  from public.restaurant_projects p
  where p.slug = p_slug and p.status = 'published';
$$;

revoke all on function public.get_public_menu(text) from public, anon, authenticated;
grant execute on function public.get_public_menu(text) to anon, authenticated;

-- Disponibilidade de slug sem expor projetos de outros usuários.
create or replace function public.is_slug_available(p_slug text, p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.restaurant_projects where slug = p_slug and id <> p_project_id
  );
$$;
revoke all on function public.is_slug_available(text, uuid) from public, anon, authenticated;
grant execute on function public.is_slug_available(text, uuid) to authenticated;

-- ---------------------------------------------------------------- storage
-- menu-sources: privado (fotos das páginas do cardápio, material de trabalho).
-- menu-media:   público (logo, capa, fotos de pratos que aparecem no cardápio).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-sources', 'menu-sources', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('menu-media', 'menu-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Caminho obrigatório: <uid>/<project_id>/<arquivo>. O primeiro segmento precisa ser o próprio usuário.
create policy "storage: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id in ('menu-sources', 'menu-media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: dono lê" on storage.objects for select to authenticated
  using (bucket_id in ('menu-sources', 'menu-media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id in ('menu-sources', 'menu-media') and (storage.foldername(name))[1] = auth.uid()::text);
