-- Desafio Menos Açúcar — Programa beta "Primeira Turma"
-- Acesso, consentimento, feedback e painel do fundador.
-- Toda regra de autorização fica no banco. O cliente nunca decide quem tem acesso ou quem é admin.

-- ---------------------------------------------------------------------------
-- Configuração (só lida por funções security definer; sem políticas para o cliente)
-- ---------------------------------------------------------------------------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

-- Enquanto for true, toda conta nova recebe acesso gratuito da Primeira Turma.
-- Para fechar as inscrições: update public.app_config set value = 'false' where key = 'beta_signups_open';
insert into public.app_config (key, value) values ('beta_signups_open', 'true');

-- ---------------------------------------------------------------------------
-- Administradores: só entram por SQL (SQL Editor / service_role). Sem política de escrita.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Consentimento e origem do acesso
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column marketing_opt_in boolean not null default false,
  add column marketing_opt_in_at timestamptz;

alter table public.access_grants
  add column source text not null default 'beta' check (source in ('beta', 'purchase', 'manual')),
  add column cohort text;

-- Acesso ativo de quem chama. É a única regra que as políticas consultam,
-- então trocar beta por pago no futuro é mudar QUEM recebe o grant, não as políticas.
create or replace function public.has_active_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.access_grants g
    where g.user_id = auth.uid()
      and g.status = 'active'
      and (g.ends_at is null or g.ends_at > now())
  );
$$;
revoke all on function public.has_active_access() from public, anon;
grant execute on function public.has_active_access() to authenticated;

-- Cadastro: exige o aceite do aviso de privacidade (com declaração de 18+) e
-- concede o acesso beta se as inscrições estiverem abertas.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  name text := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40);
  terms text := new.raw_user_meta_data ->> 'terms_version';
  marketing boolean := coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false);
  beta_open boolean := coalesce((select (value)::text::boolean from public.app_config where key = 'beta_signups_open'), false);
begin
  if terms is null or char_length(terms) not between 1 and 32 then
    raise exception 'É preciso aceitar o aviso de privacidade para participar.';
  end if;
  if char_length(name) < 2 then
    name := 'Participante';
  end if;
  insert into public.profiles (id, display_name, terms_version, terms_accepted_at, marketing_opt_in, marketing_opt_in_at)
  values (new.id, name, terms, now(), marketing, case when marketing then now() end);
  if beta_open then
    insert into public.access_grants (user_id, status, source, cohort) values (new.id, 'active', 'beta', 'primeira-turma');
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Para contas criadas antes do aviso de privacidade existir.
create or replace function public.accept_terms(p_version text, p_marketing boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if p_version is null or char_length(p_version) not between 1 and 32 then raise exception 'Versão inválida.'; end if;
  update public.profiles
     set terms_version = p_version,
         terms_accepted_at = now(),
         marketing_opt_in = coalesce(p_marketing, false),
         marketing_opt_in_at = case when coalesce(p_marketing, false) then now() end
   where id = auth.uid();
end;
$$;
revoke all on function public.accept_terms(text, boolean) from public, anon;
grant execute on function public.accept_terms(text, boolean) to authenticated;

-- Comunicações futuras: separado da participação, pode mudar a qualquer momento.
create or replace function public.set_marketing_consent(p_opt_in boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  update public.profiles
     set marketing_opt_in = coalesce(p_opt_in, false),
         marketing_opt_in_at = case when coalesce(p_opt_in, false) then now() end
   where id = auth.uid();
end;
$$;
revoke all on function public.set_marketing_consent(boolean) from public, anon;
grant execute on function public.set_marketing_consent(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- O desafio passa a exigir acesso ativo (além das regras que já existiam)
-- ---------------------------------------------------------------------------
alter policy "missões: concluir liberadas" on public.mission_completions
  with check (
    user_id = (select auth.uid())
    and (select public.has_active_access())
    and day <= (select public.my_unlocked_day())
  );
alter policy "quiz: criar o próprio" on public.quiz_responses
  with check (user_id = (select auth.uid()) and (select public.has_active_access()));
alter policy "quiz: atualizar o próprio" on public.quiz_responses
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.has_active_access()));
alter policy "estratégias: salvar as próprias" on public.saved_strategies
  with check (user_id = (select auth.uid()) and (select public.has_active_access()));

create or replace function public.start_challenge()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_active_access() then
    raise exception 'Sua conta não tem acesso ativo ao desafio.';
  end if;
  if not exists (select 1 from public.quiz_responses where user_id = auth.uid()) then
    raise exception 'Conclua o questionário antes de iniciar o desafio.';
  end if;
  update public.profiles
     set challenge_started_on = coalesce(challenge_started_on, (now() at time zone time_zone)::date),
         onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Feedback: escrito só via submit_feedback(), que valida etapa, chaves, opções e tamanho.
-- ---------------------------------------------------------------------------
create table public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stage text not null check (stage in ('inicial', 'dia7', 'dia21', 'geral')),
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 12000),
  created_at timestamptz not null default now()
);
alter table public.feedback_responses enable row level security;

-- Uma resposta por etapa (as mensagens "geral" podem se repetir).
create unique index feedback_one_per_stage on public.feedback_responses (user_id, stage) where stage <> 'geral';
create index feedback_stage_idx on public.feedback_responses (stage, created_at desc);

create policy "feedback: ler o próprio" on public.feedback_responses
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.feedback_responses from authenticated, anon;

create or replace function public.submit_feedback(p_stage text, p_answers jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  allowed text[];
  k text;
  v jsonb;
  unlocked integer;
  done integer;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if not public.has_active_access() then raise exception 'Sua conta não tem acesso ativo ao desafio.'; end if;

  allowed := case p_stage
    when 'inicial' then array['interesse', 'dificuldade', 'utilidade']
    when 'dia7' then array['facilidade', 'mais_util', 'impedimentos', 'melhorias']
    when 'dia21' then array['quanto_completou', 'estrategias', 'faltou', 'recomendaria', 'recomendaria_motivo', 'pagaria', 'pagaria_expectativa']
    when 'geral' then array['assunto', 'mensagem']
  end;
  if allowed is null then raise exception 'Etapa de feedback inválida.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'Respostas inválidas.'; end if;

  for k, v in select * from jsonb_each(p_answers) loop
    if not (k = any(allowed)) then raise exception 'Pergunta desconhecida: %', k; end if;
    if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 1000 then
      raise exception 'Resposta inválida ou longa demais.';
    end if;
  end loop;

  if p_stage = 'dia7' and p_answers ? 'facilidade'
     and not (p_answers ->> 'facilidade' = any(array['muito_facil', 'facil', 'neutro', 'dificil', 'muito_dificil'])) then
    raise exception 'Opção inválida.';
  end if;
  if p_stage = 'dia21' then
    if p_answers ? 'quanto_completou' and not (p_answers ->> 'quanto_completou' = any(array['tudo', 'mais_da_metade', 'menos_da_metade', 'quase_nada'])) then
      raise exception 'Opção inválida.';
    end if;
    if p_answers ? 'recomendaria' and not (p_answers ->> 'recomendaria' = any(array['sim', 'talvez', 'nao'])) then
      raise exception 'Opção inválida.';
    end if;
    if p_answers ? 'pagaria' and not (p_answers ->> 'pagaria' = any(array['sim', 'talvez', 'nao'])) then
      raise exception 'Opção inválida.';
    end if;
  end if;
  if p_stage = 'geral' then
    if not (p_answers ? 'mensagem') or char_length(trim(p_answers ->> 'mensagem')) < 3 then
      raise exception 'Escreva sua mensagem.';
    end if;
    if p_answers ? 'assunto' and not (p_answers ->> 'assunto' = any(array['sugestao', 'problema', 'privacidade', 'outro'])) then
      raise exception 'Opção inválida.';
    end if;
    if (select count(*) from public.feedback_responses where user_id = auth.uid() and stage = 'geral') >= 30 then
      raise exception 'Limite de mensagens atingido. Obrigado por tanto retorno!';
    end if;
  end if;

  -- Cada etapa só abre no momento certo do desafio.
  unlocked := public.my_unlocked_day();
  done := (select count(*) from public.mission_completions where user_id = auth.uid());
  if p_stage = 'inicial' and unlocked < 1 then raise exception 'Conclua o questionário inicial antes.'; end if;
  if p_stage = 'dia7' and unlocked < 7 and done < 7 then raise exception 'Esta pesquisa abre no Dia 7.'; end if;
  if p_stage = 'dia21' and unlocked < 21 and done < 21 then raise exception 'Esta pesquisa abre no Dia 21.'; end if;

  if p_stage <> 'geral' and exists (select 1 from public.feedback_responses where user_id = auth.uid() and stage = p_stage) then
    raise exception 'Você já respondeu esta etapa.';
  end if;

  insert into public.feedback_responses (user_id, stage, answers) values (auth.uid(), p_stage, p_answers);
end;
$$;
revoke all on function public.submit_feedback(text, jsonb) from public, anon;
grant execute on function public.submit_feedback(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Painel do fundador: só agregados, e só para quem está em public.admins.
-- Administradores ficam fora das contagens para os testes do fundador não inflarem os números.
-- ---------------------------------------------------------------------------
create or replace function public.admin_beta_metrics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;

  with people as (
    select p.id, p.time_zone, p.challenge_started_on, p.marketing_opt_in
    from public.profiles p
    where not exists (select 1 from public.admins a where a.user_id = p.id)
  ),
  per_person as (
    select pe.id,
      pe.challenge_started_on is not null as started,
      count(m.id) as missions,
      count(distinct (m.completed_at at time zone pe.time_zone)::date) as active_days,
      bool_or(m.day = 7) as did_day7,
      bool_or(m.day = 21) as did_day21,
      case when pe.challenge_started_on is null then 0
           else ((now() at time zone pe.time_zone)::date - pe.challenge_started_on) + 1 end as calendar_day
    from people pe
    left join public.mission_completions m on m.user_id = pe.id
    group by pe.id, pe.challenge_started_on, pe.time_zone
  ),
  fb as (
    select f.stage, f.answers from public.feedback_responses f
    where f.user_id in (select id from people)
  )
  select jsonb_build_object(
    'generated_at', now(),
    'registered', (select count(*) from people),
    'marketing_opt_in', (select count(*) from people where marketing_opt_in),
    'started', (select count(*) from per_person where started),
    'completed_one', (select count(*) from per_person where missions >= 1),
    'returned', (select count(*) from per_person where active_days >= 2),
    'reached_day7', (select count(*) from per_person where did_day7),
    'completed_21', (select count(*) from per_person where missions >= 21),
    'by_day', (
      select jsonb_agg(jsonb_build_object('day', d, 'completed', coalesce(c.n, 0)) order by d)
      from generate_series(1, 21) d
      left join (
        select m.day, count(*) n from public.mission_completions m
        where m.user_id in (select id from people) group by m.day
      ) c on c.day = d
    ),
    'feedback', jsonb_build_object(
      'inicial', jsonb_build_object('submitted', (select count(*) from fb where stage = 'inicial'), 'eligible', (select count(*) from per_person where started)),
      'dia7', jsonb_build_object('submitted', (select count(*) from fb where stage = 'dia7'), 'eligible', (select count(*) from per_person where started and (calendar_day >= 7 or missions >= 7))),
      'dia21', jsonb_build_object('submitted', (select count(*) from fb where stage = 'dia21'), 'eligible', (select count(*) from per_person where started and (calendar_day >= 21 or missions >= 21))),
      'geral', jsonb_build_object('submitted', (select count(*) from fb where stage = 'geral'))
    ),
    'difficulties', (
      select coalesce(jsonb_object_agg(difficulty, n), '{}'::jsonb) from (
        select q.difficulty, count(*) n from public.quiz_responses q where q.user_id in (select id from people) group by q.difficulty
      ) t
    ),
    'goals', (
      select coalesce(jsonb_object_agg(goal, n), '{}'::jsonb) from (
        select q.goal, count(*) n from public.quiz_responses q where q.user_id in (select id from people) group by q.goal
      ) t
    ),
    'ease_day7', (
      select coalesce(jsonb_object_agg(v, n), '{}'::jsonb) from (
        select answers ->> 'facilidade' v, count(*) n from fb where stage = 'dia7' and answers ? 'facilidade' group by 1
      ) t
    ),
    'would_pay', (
      select coalesce(jsonb_object_agg(v, n), '{}'::jsonb) from (
        select answers ->> 'pagaria' v, count(*) n from fb where stage = 'dia21' and answers ? 'pagaria' group by 1
      ) t
    ),
    'would_recommend', (
      select coalesce(jsonb_object_agg(v, n), '{}'::jsonb) from (
        select answers ->> 'recomendaria' v, count(*) n from fb where stage = 'dia21' and answers ? 'recomendaria' group by 1
      ) t
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_beta_metrics() from public, anon;
grant execute on function public.admin_beta_metrics() to authenticated;

-- Respostas individuais: só o primeiro nome (sem e-mail), para leitura pelo fundador.
create or replace function public.admin_feedback(p_stage text default null, p_limit integer default 200)
returns table (id uuid, first_name text, stage text, answers jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  return query
    select f.id, split_part(p.display_name, ' ', 1), f.stage, f.answers, f.created_at
    from public.feedback_responses f
    join public.profiles p on p.id = f.user_id
    where (p_stage is null or f.stage = p_stage)
      and not exists (select 1 from public.admins a where a.user_id = f.user_id)
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;
revoke all on function public.admin_feedback(text, integer) from public, anon;
grant execute on function public.admin_feedback(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Contas que já existiam antes do beta entram na Primeira Turma.
-- (O aceite do aviso de privacidade é pedido no próximo acesso, pelo app.)
-- ---------------------------------------------------------------------------
insert into public.access_grants (user_id, status, source, cohort)
select p.id, 'active', 'beta', 'primeira-turma' from public.profiles p
where not exists (select 1 from public.access_grants g where g.user_id = p.id);
