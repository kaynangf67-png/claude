-- Visitantes não logados (anon) não têm nada a ler em perfis e acessos.
-- O RLS já devolvia zero linhas; isto fecha também a permissão de tabela.
revoke all on public.profiles from anon;
revoke all on public.access_entitlements from anon;
