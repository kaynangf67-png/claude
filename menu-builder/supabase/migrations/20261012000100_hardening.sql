-- Ajustes apontados pelo verificador de segurança do Supabase.

-- Função de gatilho do cadastro: só o próprio gatilho deve executá-la, nunca a API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- search_path fixo: impede que um objeto homônimo em outro schema seja usado no lugar.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;
