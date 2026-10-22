-- Teste manual das políticas RLS. Rode como superusuário num banco DESCARTÁVEL,
-- depois da migration e de um stub do schema auth (auth.users, auth.uid() lendo
-- request.jwt.claim.sub) e dos papéis anon/authenticated. Cada bloco diz o resultado esperado.
\set ON_ERROR_STOP 0
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@a.com','{"display_name":"Ana"}'),
                              ('22222222-2222-2222-2222-222222222222','b@b.com','{"display_name":"B"}');
\echo '--- perfis criados pelo trigger (nome curto vira Participante)'
select display_name from public.profiles order by display_name;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);

\echo '--- 1. start_challenge sem quiz deve FALHAR'
select public.start_challenge();
\echo '--- 2. quiz próprio + start'
insert into public.quiz_responses (user_id,goal,moments,frequency,difficulty,daily_time,alternatives,budget)
 values ('11111111-1111-1111-1111-111111111111','doces','{tarde}','uma_vez_dia','emocional','5','{frutas}','economico');
select public.start_challenge();
select challenge_started_on is not null as iniciou, public.challenge_unlocked_day(id) as dia from public.profiles;
\echo '--- 3. quiz com momento inválido deve FALHAR'
update public.quiz_responses set moments='{hacker}';
\echo '--- 4. concluir Dia 1 OK; Dia 2 (bloqueado) deve FALHAR; Dia 1 de novo deve FALHAR'
insert into public.mission_completions (user_id,day,feeling) values ('11111111-1111-1111-1111-111111111111',1,'ok');
insert into public.mission_completions (user_id,day,feeling) values ('11111111-1111-1111-1111-111111111111',2,'ok');
insert into public.mission_completions (user_id,day,feeling) values ('11111111-1111-1111-1111-111111111111',1,'ok');
\echo '--- 5. forjar completed_at deve FALHAR'
insert into public.mission_completions (user_id,day,feeling,completed_at) values ('11111111-1111-1111-1111-111111111111',1,'ok','2020-01-01');
\echo '--- 6. adiantar o início do desafio deve FALHAR'
update public.profiles set challenge_started_on = '2020-01-01';
\echo '--- 7. mudar o nome OK'
update public.profiles set display_name='Ana Paula';
\echo '--- 8. escrever compra/acesso deve FALHAR (RLS)'
insert into public.purchases (user_id,buyer_email,provider,provider_reference,status,amount_cents) values ('11111111-1111-1111-1111-111111111111','a@a.com','x','1','paid',0);
insert into public.access_grants (user_id,status) values ('11111111-1111-1111-1111-111111111111','active');
\echo '--- 9. inserir conclusão em nome de outro usuário deve FALHAR'
insert into public.mission_completions (user_id,day,feeling) values ('22222222-2222-2222-2222-222222222222',1,'ok');
\echo '--- 10. usuário B não vê nada da A'
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select (select count(*) from public.profiles) perfis, (select count(*) from public.quiz_responses) quiz, (select count(*) from public.mission_completions) missoes;
\echo '--- 11. B tenta apagar/editar dados da A (0 linhas)'
update public.profiles set display_name='hack' where id='11111111-1111-1111-1111-111111111111';
delete from public.saved_strategies;
\echo '--- 12. anon não vê nada'
reset role; set role anon;
select count(*) from public.profiles;
reset role;
\echo '--- 13. reset_challenge da A'
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select public.reset_challenge();
select (select count(*) from public.mission_completions) missoes, (select challenge_started_on from public.profiles) inicio;
