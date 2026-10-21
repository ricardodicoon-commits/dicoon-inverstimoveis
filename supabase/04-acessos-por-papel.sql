-- Dicoon CRM: acessos por função (substitui as regras do 01-seguranca.sql).
-- Rodar DEPOIS do 03-papel-cliente.sql:
-- Supabase > SQL Editor > New query > colar tudo > Run.
-- Pode ser rodado mais de uma vez sem problema. Se der erro, nada é aplicado.
--
-- Regras:
--   * ADMIN: vê, cadastra, edita e exclui tudo.
--   * COMERCIAL (corretor/atendente) ativo e aprovado: vê e cadastra só os
--     registros em que é o responsável; não edita nem exclui.
--   * CLIENTE: vê só o próprio cadastro, as próprias negociações e o contato
--     do responsável. Não altera nada.
--   * O login de um cliente é ligado ao cadastro pelo e-mail: quando o admin
--     cria no Supabase um usuário com o mesmo e-mail de um cliente cadastrado,
--     ele já nasce como "cliente", liberado e ligado ao cadastro.

begin;

-- 1) Quem é quem -------------------------------------------------------------

-- Comercial ou admin ativo e aprovado (cliente não entra aqui).
create or replace function public.fn_is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo = true and aprovado = true and role::text <> 'cliente'
  );
$$;

create or replace function public.fn_is_cliente()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo = true and aprovado = true and role::text = 'cliente'
  );
$$;

-- 2) Ligação do login com o cadastro do cliente ------------------------------

alter table public.clientes add column if not exists usuario_id uuid references public.profiles(id) on delete set null;
create index if not exists clientes_usuario_id_idx on public.clientes(usuario_id);
create index if not exists clientes_email_lower_idx on public.clientes(lower(email));

-- Cadastros de cliente ligados ao login de quem está acessando.
create or replace function public.fn_meus_clientes()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.clientes where usuario_id = auth.uid() and public.fn_is_cliente();
$$;

-- Contato do responsável, para o portal do cliente (só nome, telefone e e-mail).
create or replace function public.fn_meu_responsavel()
returns table (nome text, telefone text, email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.nome::text, p.telefone::text, p.email::text
  from public.clientes c
  join public.profiles p on p.id = c.responsavel_id
  where c.usuario_id = auth.uid() and public.fn_is_cliente()
  limit 1;
$$;

-- Login novo com e-mail de cliente cadastrado: nasce como cliente liberado.
create or replace function public.fn_perfil_de_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is not null and exists (select 1 from public.clientes where lower(email) = lower(new.email)) then
    new.role := 'cliente';
    new.aprovado := true;
    new.ativo := true;
  end if;
  return new;
end;
$$;

create or replace function public.fn_vincular_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role::text = 'cliente' then
    update public.clientes set usuario_id = new.id
    where lower(email) = lower(new.email) and usuario_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_perfil_de_cliente on public.profiles;
create trigger trigger_perfil_de_cliente
  before insert on public.profiles
  for each row execute function public.fn_perfil_de_cliente();

drop trigger if exists trigger_vincular_cliente on public.profiles;
create trigger trigger_vincular_cliente
  after insert on public.profiles
  for each row execute function public.fn_vincular_cliente();

-- 3) Ninguém além do admin muda função, aprovação ou status de ativo ---------
-- (sem login, como no painel do Supabase, as alterações continuam liberadas)

create or replace function public.fn_prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.fn_is_admin() then
    return new;
  end if;
  if new.id is distinct from auth.uid() then
    raise exception 'Você não pode alterar perfis de outros usuários.';
  end if;
  new.role := old.role;
  new.ativo := old.ativo;
  new.aprovado := old.aprovado;
  new.email := old.email;
  return new;
end;
$$;

drop trigger if exists trigger_prevent_role_escalation on public.profiles;
create trigger trigger_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.fn_prevent_role_escalation();

revoke execute on function public.fn_is_approved_user() from public;
revoke execute on function public.fn_is_cliente() from public;
revoke execute on function public.fn_meus_clientes() from public;
revoke execute on function public.fn_meu_responsavel() from public;
grant execute on function public.fn_is_approved_user() to authenticated;
grant execute on function public.fn_is_cliente() to authenticated;
grant execute on function public.fn_meus_clientes() to authenticated;
grant execute on function public.fn_meu_responsavel() to authenticated;

-- 4) Regras das tabelas -------------------------------------------------------

do $$
declare
  t text;
  p record;
  tem_dono boolean;
begin
  -- Apaga as regras antigas das tabelas tratadas aqui.
  foreach t in array array['clientes', 'negociacoes', 'leads', 'documentos', 'imoveis', 'propostas', 'tarefas',
                           'bancos_parceiros', 'produtos_financeiros', 'produtos_servicos', 'configuracoes'] loop
    continue when to_regclass('public.' || t) is null;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;

  -- Clientes: comercial vê e cadastra os seus; cliente vê o próprio; admin tudo.
  create policy clientes_select on public.clientes for select using (
    public.fn_is_admin()
    or (responsavel_id = auth.uid() and public.fn_is_approved_user())
    or (usuario_id = auth.uid() and public.fn_is_cliente())
  );
  create policy clientes_insert on public.clientes for insert with check (
    public.fn_is_admin()
    or (responsavel_id = auth.uid() and usuario_id is null and public.fn_is_approved_user())
  );
  create policy clientes_update on public.clientes for update using (public.fn_is_admin()) with check (public.fn_is_admin());
  create policy clientes_delete on public.clientes for delete using (public.fn_is_admin());

  -- Negociações: idem; o cliente vê as dele.
  create policy negociacoes_select on public.negociacoes for select using (
    public.fn_is_admin()
    or (responsavel_id = auth.uid() and public.fn_is_approved_user())
    or (cliente_id in (select public.fn_meus_clientes()))
  );
  create policy negociacoes_insert on public.negociacoes for insert with check (
    public.fn_is_admin()
    or (
      responsavel_id = auth.uid() and public.fn_is_approved_user()
      and cliente_id in (select id from public.clientes where responsavel_id = auth.uid())
    )
  );
  create policy negociacoes_update on public.negociacoes for update using (public.fn_is_admin()) with check (public.fn_is_admin());
  create policy negociacoes_delete on public.negociacoes for delete using (public.fn_is_admin());

  -- Tabelas internas com responsável: comercial vê e cadastra as suas.
  -- Sem coluna de responsável: só o admin.
  foreach t in array array['leads', 'documentos', 'imoveis', 'propostas', 'tarefas'] loop
    continue when to_regclass('public.' || t) is null;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'responsavel_id'
    ) into tem_dono;
    if tem_dono then
      execute format('create policy %I on public.%I for select using (public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_is_approved_user()))', t || '_select', t);
      execute format('create policy %I on public.%I for insert with check (public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_is_approved_user()))', t || '_insert', t);
    else
      execute format('create policy %I on public.%I for select using (public.fn_is_admin())', t || '_select', t);
      execute format('create policy %I on public.%I for insert with check (public.fn_is_admin())', t || '_insert', t);
    end if;
    execute format('create policy %I on public.%I for update using (public.fn_is_admin()) with check (public.fn_is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.fn_is_admin())', t || '_delete', t);
  end loop;

  -- Cadastros gerais: comercial consulta; só o admin altera. Cliente não vê.
  foreach t in array array['bancos_parceiros', 'produtos_financeiros', 'produtos_servicos', 'configuracoes'] loop
    continue when to_regclass('public.' || t) is null;
    execute format('create policy %I on public.%I for select using (public.fn_is_admin() or public.fn_is_approved_user())', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (public.fn_is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.fn_is_admin()) with check (public.fn_is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.fn_is_admin())', t || '_delete', t);
  end loop;

  -- Registro de auditoria: só o admin lê (as regras de gravação ficam como estão).
  if to_regclass('public.auditoria_logs') is not null then
    alter table public.auditoria_logs enable row level security;
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'auditoria_logs' and cmd in ('SELECT', 'UPDATE', 'DELETE', 'ALL') loop
      execute format('drop policy %I on public.auditoria_logs', p.policyname);
    end loop;
    create policy auditoria_logs_select on public.auditoria_logs for select using (public.fn_is_admin());
  end if;
end $$;

-- Perfis: cada um vê o próprio; o admin vê e altera todos.
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

-- Tempo real: avisa as telas quando clientes, negociações ou perfis mudam.
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

-- Conferência: regras por tabela (as de dados devem ter 4: SELECT, INSERT, UPDATE, DELETE).
select tablename, string_agg(cmd, ', ' order by cmd) as regras
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
