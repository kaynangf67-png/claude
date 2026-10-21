-- O app passa a ser o produto vendido (sem e-book), com acesso vitalício.
-- A ativação grava expires_at = 'infinity'; o restante do controle de acesso não muda:
-- reembolso e chargeback continuam revogando, e cada compra ativa uma única vez.

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
  values (v_uid, 'active', now(), 'infinity', v_purchase.source, v_purchase.external_order_id);

  update public.verified_purchases
  set claimed_by = v_uid, claimed_at = now()
  where id = v_purchase.id;

  return 'activated';
end $$;

revoke execute on function public.claim_verified_purchase() from public, anon;
grant execute on function public.claim_verified_purchase() to authenticated;

-- Quem já ativou pelo modelo antigo (30 dias) recebe o acesso vitalício que agora é vendido.
update public.access_entitlements set expires_at = 'infinity' where status = 'active';
