-- Desafio Menos Açúcar — schema inicial
-- Segurança: toda tabela com dados de usuário tem RLS ligado. O cliente usa a anon key;
-- quem garante que cada pessoa só vê e altera o que é seu são as políticas abaixo.
-- Compras e acesso são SOMENTE LEITURA para o cliente: só o servidor (service_role,
-- via webhook verificado do provedor de pagamento, em fase futura) escreve nelas.

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  -- Fuso usado para calcular "hoje" no servidor. O público é brasileiro.
  time_zone text not null default 'America/Sao_Paulo',
  challenge_started_on date,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: ler o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles: atualizar o próprio" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- O cliente só pode mudar o nome. Início do desafio é definido pelo servidor (start_challenge).
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Cria o perfil quando a conta é criada no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40);
begin
  if char_length(name) < 2 then
    name := 'Participante';
  end if;
  insert into public.profiles (id, display_name) values (new.id, name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Respostas do quiz (uma linha por pessoa; pode ser refeito)
-- ---------------------------------------------------------------------------
create table public.quiz_responses (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  goal text not null check (goal in ('doces', 'bebidas', 'beliscos', 'alimentacao_geral')),
  moments text[] not null check (
    cardinality(moments) between 1 and 3
    and moments <@ array['manha', 'apos_almoco', 'tarde', 'apos_jantar', 'noite', 'estresse', 'tedio', 'social', 'fim_de_semana']
  ),
  frequency text not null check (frequency in ('raramente', 'algumas_vezes_semana', 'uma_vez_dia', 'varias_vezes_dia')),
  difficulty text not null check (difficulty in ('vontade_repentina', 'doces_a_vista', 'habito_apos_refeicao', 'emocional', 'rotina_corrida', 'convivio')),
  daily_time text not null check (daily_time in ('5', '10', '20')),
  alternatives text[] not null check (
    cardinality(alternatives) between 1 and 5
    and alternatives <@ array['frutas', 'bebidas', 'lanches_salgados', 'receitas_rapidas', 'estrategias']
  ),
  budget text not null check (budget in ('economico', 'moderado', 'flexivel', 'nao_informar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quiz_responses enable row level security;

create policy "quiz: ler o próprio" on public.quiz_responses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "quiz: criar o próprio" on public.quiz_responses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "quiz: atualizar o próprio" on public.quiz_responses
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger quiz_touch before update on public.quiz_responses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Dia liberado do desafio (calculado no servidor, no fuso do perfil)
-- ---------------------------------------------------------------------------
create or replace function public.challenge_unlocked_day(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.challenge_started_on is null then 0
    else greatest(1, least(21, ((now() at time zone p.time_zone)::date - p.challenge_started_on) + 1))
  end
  from public.profiles p
  where p.id = p_user;
$$;

revoke all on function public.challenge_unlocked_day(uuid) from public, anon;
grant execute on function public.challenge_unlocked_day(uuid) to authenticated;

-- Inicia o Dia 1 (idempotente) e marca o onboarding como concluído.
create or replace function public.start_challenge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.quiz_responses where user_id = auth.uid()) then
    raise exception 'Conclua o questionário antes de iniciar o desafio.';
  end if;
  update public.profiles
     set challenge_started_on = coalesce(challenge_started_on, (now() at time zone time_zone)::date),
         onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = auth.uid();
end;
$$;

revoke all on function public.start_challenge() from public, anon;
grant execute on function public.start_challenge() to authenticated;

-- ---------------------------------------------------------------------------
-- Missões concluídas (imutáveis pelo cliente: só inserir)
-- ---------------------------------------------------------------------------
create table public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day smallint not null check (day between 1 and 21),
  feeling text not null check (feeling in ('facil', 'ok', 'desafiador')),
  reflection text check (reflection is null or char_length(reflection) <= 600),
  completed_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.mission_completions enable row level security;

create policy "missões: ler as próprias" on public.mission_completions
  for select to authenticated using (user_id = (select auth.uid()));

-- Só dá para concluir missões já liberadas pelo calendário.
create policy "missões: concluir liberadas" on public.mission_completions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and day <= public.challenge_unlocked_day((select auth.uid()))
  );

-- completed_at sempre vem do servidor.
revoke insert on public.mission_completions from authenticated;
grant insert (user_id, day, feeling, reflection) on public.mission_completions to authenticated;

create index mission_completions_user_idx on public.mission_completions (user_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Estratégias salvas
-- ---------------------------------------------------------------------------
create table public.saved_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  strategy_id text not null check (char_length(strategy_id) between 1 and 64),
  note text check (note is null or char_length(note) <= 300),
  saved_at timestamptz not null default now(),
  unique (user_id, strategy_id)
);

alter table public.saved_strategies enable row level security;

create policy "estratégias: ler as próprias" on public.saved_strategies
  for select to authenticated using (user_id = (select auth.uid()));
create policy "estratégias: salvar as próprias" on public.saved_strategies
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "estratégias: editar as próprias" on public.saved_strategies
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "estratégias: remover as próprias" on public.saved_strategies
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Recomeçar o desafio (apaga progresso e respostas; mantém a conta)
-- ---------------------------------------------------------------------------
create or replace function public.reset_challenge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.mission_completions where user_id = auth.uid();
  delete from public.saved_strategies where user_id = auth.uid();
  delete from public.quiz_responses where user_id = auth.uid();
  update public.profiles
     set challenge_started_on = null, onboarding_completed_at = null
   where id = auth.uid();
end;
$$;

revoke all on function public.reset_challenge() from public, anon;
grant execute on function public.reset_challenge() to authenticated;

-- ---------------------------------------------------------------------------
-- Compras e acesso — escritos APENAS pelo servidor (service_role) após
-- verificação da assinatura do webhook do provedor de pagamento. Fase futura.
-- ---------------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  buyer_email text not null,
  provider text not null,
  provider_reference text not null,
  status text not null check (status in ('pending', 'paid', 'refunded', 'chargeback')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

alter table public.purchases enable row level security;

create policy "compras: ler as próprias" on public.purchases
  for select to authenticated using (user_id = (select auth.uid()));
-- Sem políticas de insert/update/delete: o cliente não consegue escrever.

create table public.access_grants (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null check (status in ('active', 'refunded', 'revoked')),
  purchase_id uuid references public.purchases (id) on delete set null,
  granted_at timestamptz not null default now(),
  ends_at timestamptz
);

alter table public.access_grants enable row level security;

create policy "acesso: ler o próprio" on public.access_grants
  for select to authenticated using (user_id = (select auth.uid()));
-- Sem políticas de escrita para o cliente.
