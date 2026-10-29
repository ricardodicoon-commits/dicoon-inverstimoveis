-- Imita o mínimo do Supabase e das tabelas atuais da Dicoon, para testar o 05.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
create publication supabase_realtime;

create type profile_role_type as enum ('admin', 'corretor', 'atendente');
create type lead_interest_type as enum ('seguro', 'financiamento', 'consorcio', 'investimento', 'imovel');
create type lead_origin_type as enum ('site', 'whatsapp', 'instagram', 'google_ads', 'indicacao', 'outro');
create type lead_status_type as enum ('novo', 'em_atendimento', 'proposta_enviada', 'convertido', 'perdido');
create type negotiation_stage_type as enum ('novo_contato', 'analise', 'proposta', 'aprovacao', 'concluido');

create table profiles (id uuid primary key, nome text not null, email text not null, telefone text, role profile_role_type not null, ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), aprovado boolean not null default false);
create table usuarios_equipe (id uuid primary key default gen_random_uuid(), nome text not null);
create table imoveis (id uuid primary key default gen_random_uuid(), responsavel_id uuid constraint imoveis_responsavel_id_fkey references usuarios_equipe(id));
create table clientes (id uuid primary key default gen_random_uuid(), nome_completo text not null, telefone text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), responsavel_id uuid);
create table leads (id uuid primary key default gen_random_uuid(), nome text not null, telefone text not null, email text, cpf_cnpj text, tipo_interesse lead_interest_type not null, produto_interesse text, origem_lead lead_origin_type not null, observacoes text, status lead_status_type not null, responsavel_id uuid constraint leads_responsavel_id_fkey references usuarios_equipe(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table negociacoes (id uuid primary key default gen_random_uuid(), cliente_id uuid references clientes(id), lead_id uuid references leads(id), produto_id uuid, valor_estimado numeric, etapa negotiation_stage_type not null, observacoes text, responsavel_id uuid constraint negociacoes_responsavel_id_fkey references usuarios_equipe(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table tarefas (id uuid primary key default gen_random_uuid(), titulo text not null, descricao text, tipo text not null, cliente_id uuid, proposta_id uuid, responsavel_id uuid, data_tarefa date not null, hora_inicio time, hora_fim time, prioridade text not null, status text not null, observacoes text, created_at timestamptz, updated_at timestamptz);

create function fn_is_admin() returns boolean language sql stable security definer as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and ativo and aprovado) $$;
create function trigger_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- Regras iguais às do Supabase (lidas em 28/10/2026) para leads, negociações e clientes.
create function fn_is_active_user() returns boolean language sql stable security definer as $$ select exists (select 1 from profiles where id = auth.uid() and ativo and aprovado) $$;
alter table leads enable row level security;
alter table negociacoes enable row level security;
alter table clientes enable row level security;
create policy leads_select on leads for select using (fn_is_admin() or responsavel_id = auth.uid());
create policy leads_insert on leads for insert with check (fn_is_admin() or (responsavel_id = auth.uid() and fn_is_active_user()));
create policy leads_update on leads for update using (fn_is_admin() or responsavel_id = auth.uid()) with check (fn_is_admin() or (responsavel_id = auth.uid() and fn_is_active_user()));
create policy leads_delete on leads for delete using (fn_is_admin());
create policy negociacoes_select on negociacoes for select using (fn_is_admin() or responsavel_id = auth.uid());
create policy negociacoes_insert on negociacoes for insert with check (fn_is_admin() or (responsavel_id = auth.uid() and fn_is_active_user()));
create policy negociacoes_update on negociacoes for update using (fn_is_admin() or responsavel_id = auth.uid()) with check (fn_is_admin() or (responsavel_id = auth.uid() and fn_is_active_user()));
create policy negociacoes_delete on negociacoes for delete using (fn_is_admin());
create policy clientes_select on clientes for select using (fn_is_admin() or responsavel_id = auth.uid());
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;

insert into profiles (id, nome, email, role, ativo, aprovado) values
 ('00000000-0000-0000-0000-00000000000a', 'Admin', 'a@x', 'admin', true, true),
 ('00000000-0000-0000-0000-000000000001', 'Atendente 1', 'b@x', 'atendente', true, true),
 ('00000000-0000-0000-0000-000000000002', 'Atendente 2', 'c@x', 'atendente', true, true),
 ('00000000-0000-0000-0000-000000000003', 'Pendente', 'd@x', 'corretor', true, false);
insert into clientes (nome_completo, telefone) values ('Cliente Antigo', '(51) 99999-0000');
