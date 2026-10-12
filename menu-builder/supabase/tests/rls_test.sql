-- Testes de segurança e da leitura pública. Cada falha interrompe com erro.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@ex.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@ex.com');

-- Ana cria um projeto com 1 item pronto, 1 pendente, 1 sem preço, 1 com variação sem preço.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into restaurant_projects (id, restaurant_name, slug, phone, whatsapp_number, show_whatsapp)
values ('10000000-0000-0000-0000-000000000001', 'Sabor da Casa', 'sabor-da-casa', '27 3333-3333', '27999999999', false);
insert into menu_categories (id, project_id, name, sort_order) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Pratos', 0),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Vazia', 1);
insert into menu_products (project_id, category_id, name, price, variations, review_required, review_notes, source_reference, confidence, sort_order) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Feijoada', 39.90, '[]', false, '{}', 'ia:foto.jpg', 0.97, 0),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Pendente', 10, '[]', true, '{"nota interna secreta"}', 'ia:foto.jpg', 0.5, 1),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Sem preço', null, '[]', false, '{}', 'manual', null, 2),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Marmita', null, '[{"label":"P","price":20},{"label":"G","price":null}]', false, '{}', 'manual', null, 3),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Porção', null, '[{"label":"Meia","price":22},{"label":"Inteira","price":36}]', false, '{}', 'manual', null, 4);

do $$ begin
  if (select count(*) from restaurant_projects) <> 1 then raise exception 'Ana deveria ver 1 projeto'; end if;
end $$;

-- 1) Bia não enxerga nem altera nada da Ana.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from restaurant_projects) <> 0 then raise exception 'FALHA: Bia vê projeto da Ana'; end if;
  if (select count(*) from menu_products) <> 0 then raise exception 'FALHA: Bia vê produtos da Ana'; end if;
  update restaurant_projects set restaurant_name = 'hack';
  if found then raise exception 'FALHA: Bia alterou projeto da Ana'; end if;
end $$;

-- 2) Bia não consegue inserir produto no projeto da Ana.
do $$ begin
  begin
    insert into menu_products (project_id, category_id, name, price)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Invasor', 1);
    raise exception 'FALHA: Bia inseriu produto no projeto da Ana';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 3) Bia não consegue gravar uso de IA (só a Edge Function, com service role).
do $$ begin
  begin
    insert into ai_usage (owner_id, model, status) values ('00000000-0000-0000-0000-00000000000b', 'x', 'success');
    raise exception 'FALHA: usuário gravou ai_usage';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4) Slug: Bia não pode reutilizar o slug da Ana, mas a função informa sem expor o projeto.
do $$ begin
  if is_slug_available('sabor-da-casa', gen_random_uuid()) then raise exception 'FALHA: slug ocupado aparece livre'; end if;
  if not is_slug_available('outro-nome', gen_random_uuid()) then raise exception 'FALHA: slug livre aparece ocupado'; end if;
end $$;

-- 5) Público (anon) não lê tabelas e não vê cardápio não publicado.
reset request.jwt.claim.sub;
set role anon;
do $$ begin
  if (select count(*) from restaurant_projects) <> 0 then raise exception 'FALHA: anon lê tabela de projetos'; end if;
  if get_public_menu('sabor-da-casa') is not null then raise exception 'FALHA: cardápio não publicado visível'; end if;
end $$;

-- 6) Publica e confere o que o público recebe.
reset role;
update restaurant_projects set status = 'published', published_at = now() where slug = 'sabor-da-casa';
set role anon;
do $$
declare m jsonb := get_public_menu('sabor-da-casa');
declare names text;
begin
  if m is null then raise exception 'FALHA: cardápio publicado não retornou'; end if;
  select string_agg(p ->> 'name', ',' order by (p ->> 'name')) into names
    from jsonb_array_elements(m -> 'categories') c, jsonb_array_elements(c -> 'products') p;
  if names <> 'Feijoada,Porção' then raise exception 'FALHA: itens públicos = %', names; end if;
  if jsonb_array_length(m -> 'categories') <> 1 then raise exception 'FALHA: categoria vazia apareceu'; end if;
  if m::text ~ '(owner|source_reference|confidence|review|nota interna|00000000-0000-0000-0000-00000000000a)' then
    raise exception 'FALHA: dado interno vazou: %', m; end if;
  if m -> 'whatsappNumber' <> 'null'::jsonb then raise exception 'FALHA: WhatsApp não autorizado apareceu'; end if;
end $$;

-- 7) Restrições de integridade.
reset role;
do $$ begin
  begin
    insert into restaurant_projects (owner_id, restaurant_name, slug) values ('00000000-0000-0000-0000-00000000000a', 'X', 'Slug Inválido');
    raise exception 'FALHA: slug inválido aceito';
  exception when check_violation then null;
  end;
end $$;

-- Produto não pode apontar para categoria de outro projeto.
do $$
declare other uuid;
begin
  insert into restaurant_projects (owner_id, restaurant_name) values ('00000000-0000-0000-0000-00000000000b', 'Outro') returning id into other;
  begin
    insert into menu_products (project_id, category_id, name) values (other, '20000000-0000-0000-0000-000000000001', 'Cruzado');
    raise exception 'FALHA: produto ligado a categoria de outro projeto';
  exception when foreign_key_violation then null;
  end;
end $$;

-- 8) Profile criado automaticamente.
do $$ begin
  if (select count(*) from profiles) <> 2 then raise exception 'FALHA: profiles não criados pelo trigger'; end if;
end $$;

select 'TODOS OS TESTES DE BANCO PASSARAM' as resultado;
