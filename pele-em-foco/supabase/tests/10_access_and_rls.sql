-- Testes de acesso, bônus e isolamento entre usuários.
-- Rodados por supabase/tests/run_local.sh contra Postgres 16 + stub do Supabase.
\set QUIET on
create schema test;

create function test.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', label; end if;
  raise notice 'ok — %', label;
end $$;

-- Executa um comando que DEVE falhar.
create function test.fails(cmd text, label text) returns void language plpgsql as $$
begin
  begin
    execute cmd;
  exception when others then
    raise notice 'ok — % (recusado: %)', label, sqlerrm;
    return;
  end;
  raise exception 'FALHOU: % (deveria ter sido recusado)', label;
end $$;

-- Troca o usuário "logado" (como o PostgREST faz com o JWT).
create function test.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
end $$;

grant usage on schema test to anon, authenticated, service_role;
grant execute on all functions in schema test to anon, authenticated, service_role;

-- Usuários: A e B confirmados, C sem e-mail confirmado, D para reembolso.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com', now(), '{"display_name":"Ana","accepted_disclaimer":"true"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@exemplo.com', now(), '{"display_name":"Bruno","accepted_disclaimer":"true"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carla@exemplo.com', null, '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'davi@exemplo.com', now(), '{}');

insert into public.educational_articles (slug, category, title, summary, reading_minutes, body, sources)
values ('teste', 'entendendo-a-acne', 'Teste', 'Resumo', 2, '[]', '[{"label":"AAD","url":"https://www.aad.org"}]');

select test.ok((select count(*) = 4 from public.profiles), 'trigger cria perfil para cada conta');
select test.ok((select accepted_disclaimer_at is not null and display_name = 'Ana' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'perfil guarda nome e aceite do aviso');

-- ===== A sem acesso =====
set role authenticated;
select test.login('00000000-0000-0000-0000-00000000000a');
select test.ok((select status = 'none' from public.get_my_access()), 'conta nova não tem acesso');
select test.fails($$insert into public.routine_completions (completed_on, period, step_key) values (current_date, 'manha', 'limpeza')$$, 'sem acesso não registra rotina');
select test.fails($$insert into public.journal_entries (entry_date, notes) values (current_date, 'x')$$, 'sem acesso não cria diário');
select test.ok((select count(*) = 0 from public.educational_articles), 'sem acesso não lê a biblioteca');
select test.ok(public.claim_verified_purchase() = 'no_purchase', 'sem compra verificada não ativa');
select test.fails($$insert into public.access_entitlements (user_id, starts_at, expires_at, source) values ('00000000-0000-0000-0000-00000000000a', now(), now() + interval '999 days', 'manual')$$, 'usuário não concede acesso a si mesmo');
select test.fails($$update public.access_entitlements set expires_at = now() + interval '999 days'$$, 'usuário não altera expiração');
select test.fails($$select * from public.verified_purchases$$, 'usuário não lê compras verificadas');
select test.fails($$select public.record_verified_purchase('ana@exemplo.com', 'fake', null, 'approved')$$, 'usuário não registra compra');
select test.fails($$update public.profiles set accepted_disclaimer_at = null$$, 'usuário não altera data do aceite');
update public.profiles set display_name = 'Ana Lu' where id = '00000000-0000-0000-0000-00000000000a';
select test.ok((select display_name = 'Ana Lu' from public.profiles), 'usuário edita o próprio nome');
reset role;

-- ===== Webhook (service_role) registra compras =====
set role service_role;
select public.record_verified_purchase('  ANA@Exemplo.com ', 'pedido-1', 'prod-1', 'approved');
select public.record_verified_purchase('carla@exemplo.com', 'pedido-3', 'prod-1', 'approved');
select public.record_verified_purchase('davi@exemplo.com', 'pedido-4', 'prod-1', 'approved');
select public.record_verified_purchase('ana@exemplo.com', 'pedido-1', 'prod-1', 'approved'); -- reenvio do mesmo evento
reset role;
select test.ok((select count(*) = 3 from public.verified_purchases), 'reenvio do webhook não duplica compra');
select test.ok((select email = 'ana@exemplo.com' from public.verified_purchases where external_order_id = 'pedido-1'), 'e-mail normalizado');

-- ===== C (e-mail não confirmado) e B (sem compra) não ativam =====
set role authenticated;
select test.login('00000000-0000-0000-0000-00000000000c');
select test.ok(public.claim_verified_purchase() = 'email_not_confirmed', 'e-mail não confirmado não ativa acesso');
select test.login('00000000-0000-0000-0000-00000000000b');
select test.ok(public.claim_verified_purchase() = 'no_purchase', 'compra de outra pessoa não ativa a conta de B');

-- ===== A ativa e usa =====
select test.login('00000000-0000-0000-0000-00000000000a');
select test.ok(public.claim_verified_purchase() = 'activated', 'A ativa com compra verificada e e-mail confirmado');
select test.ok((select status = 'active' and expires_at - starts_at = interval '30 days' from public.get_my_access()), 'acesso ativo por exatamente 30 dias');
select test.ok(public.claim_verified_purchase() = 'already_active', 'segunda ativação é idempotente');
insert into public.routine_completions (completed_on, period, step_key) values (current_date, 'manha', 'limpeza');
select test.fails($$insert into public.routine_completions (completed_on, period, step_key) values (current_date, 'manha', 'limpeza')$$, 'conclusão duplicada é recusada');
select test.fails($$insert into public.routine_completions (completed_on, period, step_key) values (current_date, 'manha', 'revisao')$$, 'passo inválido para o período é recusado');
select test.fails($$insert into public.routine_completions (user_id, completed_on, period, step_key) values ('00000000-0000-0000-0000-00000000000b', current_date, 'noite', 'limpeza')$$, 'A não grava rotina em nome de B');
insert into public.routine_completions (completed_on, period, step_key) values (current_date, 'noite', 'revisao');
delete from public.routine_completions where period = 'noite';
select test.ok((select count(*) = 1 from public.routine_completions), 'desfazer conclusão remove só o passo');
insert into public.journal_entries (entry_date, notes, skin_feel, observations, products_used)
  values (current_date, 'Testa oleosa', 'mais-oleosa', '{oleosidade}', 'Gel de limpeza');
update public.journal_entries set notes = 'Testa oleosa à tarde' where entry_date = current_date;
select test.ok((select notes = 'Testa oleosa à tarde' from public.journal_entries), 'A edita o próprio diário');
select test.fails($$insert into public.journal_entries (entry_date) values (current_date)$$, 'uma entrada de diário por dia');
select test.fails($$insert into public.journal_entries (entry_date, observations) values (current_date - 1, '{diagnostico}')$$, 'observação fora da lista é recusada');
select test.ok((select count(*) >= 12 from public.educational_articles), 'com acesso ativo lê a biblioteca (seed + teste)');

-- ===== Isolamento: B não vê nem altera dados de A =====
select test.login('00000000-0000-0000-0000-00000000000b');
select test.ok((select count(*) = 0 from public.journal_entries), 'B não vê o diário de A');
select test.ok((select count(*) = 0 from public.routine_completions), 'B não vê a rotina de A');
select test.ok((select count(*) = 0 from public.access_entitlements), 'B não vê o acesso de A');
select test.ok((select count(*) = 0 from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'B não vê o perfil de A');
with u as (update public.journal_entries set notes = 'invadido' returning 1) select test.ok((select count(*) = 0 from u), 'B não edita o diário de A');
with d as (delete from public.journal_entries returning 1) select test.ok((select count(*) = 0 from d), 'B não apaga o diário de A');
reset role;
select test.ok((select notes = 'Testa oleosa à tarde' from public.journal_entries where user_id = '00000000-0000-0000-0000-00000000000a'), 'diário de A intacto');

-- ===== Expiração =====
update public.access_entitlements set starts_at = now() - interval '40 days', expires_at = now() - interval '10 days'
  where user_id = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select test.login('00000000-0000-0000-0000-00000000000a');
select test.ok((select status = 'expired' from public.get_my_access()), 'status expirado após 30 dias');
select test.fails($$insert into public.routine_completions (completed_on, period, step_key) values (current_date, 'noite', 'limpeza')$$, 'expirado não registra rotina');
select test.fails($$insert into public.journal_entries (entry_date) values (current_date - 3)$$, 'expirado não cria diário');
with u as (update public.journal_entries set notes = 'x' returning 1) select test.ok((select count(*) = 0 from u), 'expirado não edita diário');
select test.ok((select count(*) = 0 from public.educational_articles), 'expirado não lê a biblioteca');
select test.ok((select count(*) = 1 from public.journal_entries), 'expirado ainda lê os próprios dados (exportação)');
select test.ok(public.claim_verified_purchase() = 'no_purchase', 'mesma compra não reativa o acesso');
select public.delete_my_data();
select test.ok((select count(*) = 0 from public.journal_entries) and (select count(*) = 0 from public.routine_completions), 'expirado consegue apagar os próprios dados');

-- ===== Reembolso revoga =====
select test.login('00000000-0000-0000-0000-00000000000d');
select test.ok(public.claim_verified_purchase() = 'activated', 'D ativa');
reset role;
set role service_role;
select public.record_verified_purchase('davi@exemplo.com', 'pedido-4', 'prod-1', 'refunded');
reset role;
set role authenticated;
select test.login('00000000-0000-0000-0000-00000000000d');
select test.ok((select status = 'revoked' from public.get_my_access()), 'reembolso revoga o acesso');
select test.fails($$insert into public.routine_completions (completed_on, period, step_key) values (current_date, 'manha', 'limpeza')$$, 'revogado não registra rotina');
reset role;

-- ===== Anônimo =====
set role anon;
select test.login(null);
select test.fails($$select * from public.journal_entries$$, 'anônimo não lê diário');
select test.fails($$select * from public.educational_articles$$, 'anônimo não lê biblioteca');
select test.fails($$select public.get_my_access()$$, 'anônimo não consulta acesso');
select test.fails($$select public.claim_verified_purchase()$$, 'anônimo não ativa acesso');
reset role;

-- ===== Exclusão de conta em cascata =====
delete from auth.users where id = '00000000-0000-0000-0000-00000000000d';
select test.ok((select count(*) = 0 from public.access_entitlements where user_id = '00000000-0000-0000-0000-00000000000d'), 'excluir conta apaga acesso e perfil em cascata');
select test.ok((select claimed_by is null from public.verified_purchases where external_order_id = 'pedido-4'), 'compra fica registrada sem vínculo após exclusão');

-- ===== Reenvio atrasado de "aprovado" depois de reembolso não reabre a compra =====
set role service_role;
select public.record_verified_purchase('fabio@exemplo.com', 'pedido-6', 'prod-1', 'approved');
select public.record_verified_purchase('fabio@exemplo.com', 'pedido-6', 'prod-1', 'refunded');
select public.record_verified_purchase('fabio@exemplo.com', 'pedido-6', 'prod-1', 'approved');
reset role;
select test.ok((select status = 'refunded' from public.verified_purchases where external_order_id = 'pedido-6'), 'reembolso é final mesmo com reenvio de aprovado');
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-00000000000f', 'fabio@exemplo.com', now());
set role authenticated;
select test.login('00000000-0000-0000-0000-00000000000f');
select test.ok(public.claim_verified_purchase() = 'no_purchase', 'compra reembolsada antes da ativação não ativa');
reset role;

-- ===== Excluir e recriar a conta não renova o bônus =====
set role service_role;
select public.record_verified_purchase('eva@exemplo.com', 'pedido-5', 'prod-1', 'approved');
reset role;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-00000000000e', 'eva@exemplo.com', now());
set role authenticated;
select test.login('00000000-0000-0000-0000-00000000000e');
select test.ok(public.claim_verified_purchase() = 'activated', 'E ativa');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000e';
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000e2', 'eva@exemplo.com', now());
set role authenticated;
select test.login('00000000-0000-0000-0000-0000000000e2');
select test.ok(public.claim_verified_purchase() = 'no_purchase', 'conta recriada com o mesmo e-mail não reusa a compra');
reset role;

\echo 'TODOS OS TESTES DE BANCO PASSARAM'
