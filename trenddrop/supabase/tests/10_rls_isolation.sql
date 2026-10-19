-- Teste de isolamento (RLS). Rode após 00_stub_supabase.sql e a migration. Linhas com ERROR são as tentativas bloqueadas esperadas.
\set ON_ERROR_STOP 0
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
-- catálogo compartilhado (service role)
insert into products (id, owner_id, marketplace, source_name, external_id, name, quality) values ('aaaaaaaa-0000-0000-0000-000000000001', null, 'mercadolivre', 'API', 'MLB1', 'Compartilhado', 'oficial');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into products (id, owner_id, marketplace, source_name, name, quality) values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'manual', 'eu', 'Privado A', 'manual');
insert into favorites (user_id, product_id) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002');
insert into favorites (user_id, product_id) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001');
insert into supplier_links (product_id, url, supplier_cost) values ('aaaaaaaa-0000-0000-0000-000000000001', 'https://x.y/p', 10);
select 'A vê produtos', count(*) from products;
-- tentativas indevidas de A
update products set name = 'hack' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'shared intacto', name from products where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into products (owner_id, marketplace, source_name, name, quality) values ('22222222-2222-2222-2222-222222222222', 'manual', 'x', 'falso dono', 'manual');
insert into products (owner_id, marketplace, source_name, name, quality) values (auth.uid(), 'manual', 'x', 'demo', 'demo');
select 'secrets A', count(*) from integration_secrets;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'B vê produtos', count(*) from products;
select 'B vê favoritos', count(*) from favorites;
select 'B vê links', count(*) from supplier_links;
insert into favorites (user_id, product_id) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002');
delete from products where id = 'aaaaaaaa-0000-0000-0000-000000000002';
reset role;
select 'privado A ainda existe', count(*) from products where id = 'aaaaaaaa-0000-0000-0000-000000000002';
