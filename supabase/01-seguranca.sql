-- SUBSTITUÍDO por 03-papel-cliente.sql + 04-acessos-por-papel.sql. Não rodar mais.
-- Dicoon CRM: regras de acesso (RLS)
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- Regras:
--   * ninguém lê nem grava nada sem estar ATIVO e APROVADO pelo admin;
--   * cada usuário só vê e edita os registros em que é o responsável;
--   * o admin vê tudo e é o único que exclui;
--   * cada usuário vê apenas o próprio perfil (o admin vê todos).
-- Pode ser rodado mais de uma vez sem problema.

begin;

create or replace function public.fn_is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo = true and aprovado = true
  );
$$;

-- Tabelas com dono (responsavel_id): clientes, leads, negociações, documentos, imóveis.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['clientes', 'leads', 'negociacoes', 'documentos', 'imoveis'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy %I on public.%I for select using (public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_is_approved_user()))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert with check (public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_is_approved_user()))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update using (public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_is_approved_user())) with check (public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_is_approved_user()))',
      t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.fn_is_admin())', t || '_delete', t);
  end loop;
end $$;

-- Cadastros gerais: bancos parceiros e produtos financeiros.
-- Leitura para usuários aprovados; alterações só pelo admin.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['bancos_parceiros', 'produtos_financeiros'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for select using (public.fn_is_admin() or public.fn_is_approved_user())', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (public.fn_is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.fn_is_admin()) with check (public.fn_is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.fn_is_admin())', t || '_delete', t);
  end loop;
end $$;

-- Perfis: cada um vê o próprio; o admin vê e edita todos.
-- O gatilho trigger_prevent_role_escalation continua impedindo que um usuário
-- mude a própria função, aprovação ou status de ativo.
do $$
declare
  p record;
begin
  alter table public.profiles enable row level security;
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
  create policy profiles_select on public.profiles for select using (id = auth.uid() or public.fn_is_admin());
  create policy profiles_update on public.profiles for update
    using (id = auth.uid() or public.fn_is_admin())
    with check (id = auth.uid() or public.fn_is_admin());
  create policy profiles_insert on public.profiles for insert with check (public.fn_is_admin());
  create policy profiles_delete on public.profiles for delete using (public.fn_is_admin());
end $$;

-- Tempo real: avisa as telas quando clientes ou negociações mudam
-- (o Supabase continua aplicando as regras acima a cada usuário).
do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'negociacoes', 'profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;

-- Conferência: deve listar 4 regras por tabela.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
