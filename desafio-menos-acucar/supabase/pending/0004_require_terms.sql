-- Aplicar SÓ depois que a versão do app com o aceite no cadastro estiver publicada.
-- Volta a exigir o aceite do aviso de privacidade no próprio banco (defesa além da interface).
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

