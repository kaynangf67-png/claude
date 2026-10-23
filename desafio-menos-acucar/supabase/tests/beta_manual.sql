-- Teste manual do programa beta. Rode num banco DESCARTÁVEL depois de 0001 + 0002
-- (com o mesmo stub do schema auth descrito em rls_manual.sql). Cada bloco diz o esperado.
\set ON_ERROR_STOP 0
\echo '--- 1. cadastro SEM aceite do aviso deve FALHAR'
insert into auth.users values ('a0000000-0000-0000-0000-000000000001','sem@x.com','{"display_name":"Sem"}');
\echo '--- 2. cadastro COM aceite: perfil + acesso beta'
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','ana@x.com','{"display_name":"Ana","terms_version":"beta-2026-10","marketing_opt_in":"false"}');
insert into auth.users values ('b0000000-0000-0000-0000-00000000000b','bia@x.com','{"display_name":"Bia","terms_version":"beta-2026-10","marketing_opt_in":"true"}');
select p.display_name, p.terms_version is not null aceitou, p.marketing_opt_in mkt, g.status, g.source from public.profiles p join public.access_grants g on g.user_id=p.id where p.display_name in ('Ana','Bia') order by 1;

set role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-00000000000a',false) \g /dev/null
\echo '--- 3. usuária comum: is_admin false; métricas e feedback de admin devem FALHAR'
select public.is_admin();
select public.admin_beta_metrics();
select * from public.admin_feedback();
\echo '--- 4. virar admin sozinha deve FALHAR'
insert into public.admins values ('a0000000-0000-0000-0000-00000000000a');
\echo '--- 5. dar acesso a si mesma / estender acesso deve FALHAR (0 linhas ou erro)'
insert into public.access_grants (user_id,status) values ('a0000000-0000-0000-0000-00000000000a','active');
update public.access_grants set ends_at = null;
\echo '--- 6. mexer nas configurações (fechar/abrir beta) deve FALHAR ou afetar 0 linhas'
update public.app_config set value='false';
select count(*) as config_visivel from public.app_config;
\echo '--- 7. feedback dia7 antes do Dia 7 deve FALHAR; inicial antes do quiz deve FALHAR'
select public.submit_feedback('dia7','{}');
select public.submit_feedback('inicial','{"interesse":"x"}');
\echo '--- 8. quiz + início; inicial OK; inicial de novo FALHA; chave desconhecida FALHA; inserção direta FALHA'
insert into public.quiz_responses (user_id,goal,moments,frequency,difficulty,daily_time,alternatives,budget) values ('a0000000-0000-0000-0000-00000000000a','doces','{tarde}','uma_vez_dia','emocional','5','{frutas}','economico');
select public.start_challenge();
select public.submit_feedback('inicial','{"interesse":"curiosidade","dificuldade":"tarde"}');
select public.submit_feedback('inicial','{"interesse":"de novo"}');
select public.submit_feedback('geral','{"mensagem":"oi","hack":"x"}');
insert into public.feedback_responses (user_id,stage,answers) values ('a0000000-0000-0000-0000-00000000000a','dia21','{}');
\echo '--- 9. geral OK; opção inválida FALHA; resposta gigante FALHA'
select public.submit_feedback('geral','{"assunto":"sugestao","mensagem":"Gostei do guia"}');
select public.submit_feedback('geral','{"assunto":"spam","mensagem":"abc"}');
select public.submit_feedback('geral', jsonb_build_object('mensagem', repeat('a', 1001)));
\echo '--- 10. consentimento de marketing muda sem afetar participação'
select public.set_marketing_consent(true);
select marketing_opt_in, marketing_opt_in_at is not null from public.profiles;
\echo '--- 11. Bia não vê feedback da Ana'
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-00000000000b',false) \g /dev/null
select count(*) as feedback_visivel_para_bia from public.feedback_responses;
\echo '--- 12. sem acesso ativo: missão, quiz e feedback devem FALHAR'
reset role;
update public.access_grants set status='revoked' where user_id='b0000000-0000-0000-0000-00000000000b';
set role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-00000000000b',false) \g /dev/null
insert into public.quiz_responses (user_id,goal,moments,frequency,difficulty,daily_time,alternatives,budget) values ('b0000000-0000-0000-0000-00000000000b','doces','{tarde}','uma_vez_dia','emocional','5','{frutas}','economico');
select public.submit_feedback('geral','{"mensagem":"oi oi"}');
\echo '--- 13. admin (inserido por SQL) vê métricas reais, sem contar a si mesmo'
reset role;
insert into public.admins values ('b0000000-0000-0000-0000-00000000000b');
set role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-00000000000a',false) \g /dev/null
insert into public.mission_completions (user_id,day,feeling) values ('a0000000-0000-0000-0000-00000000000a',1,'ok');
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-00000000000b',false) \g /dev/null
select public.admin_beta_metrics() - 'by_day' - 'generated_at' as metricas;
select first_name, stage, answers from public.admin_feedback() order by stage;
\echo '--- 14. inscrições fechadas: conta nova fica sem acesso'
reset role;
update public.app_config set value='false' where key='beta_signups_open';
insert into auth.users values ('c0000000-0000-0000-0000-00000000000c','cai@x.com','{"display_name":"Caio","terms_version":"beta-2026-10"}');
select count(*) as grants_do_caio from public.access_grants where user_id='c0000000-0000-0000-0000-00000000000c';
