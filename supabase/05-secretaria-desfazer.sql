-- Dicoon CRM: DESFAZ o 05-secretaria-estrutura.sql.
-- ATENÇÃO: apaga as conversas, mensagens, respostas aprovadas e o canal criados pela Secretária.
-- Leads, negociações e tarefas cadastrados continuam (só perdem a ligação com as conversas).
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- De propósito, NÃO volta o "responsável" de leads/negociações/imóveis para usuarios_equipe:
-- aquilo era um defeito que impedia salvar negociações.

begin;

drop function if exists public.fn_novo_lead_whatsapp(text, text, public.lead_interest_type, text, uuid);

drop table if exists public.mensagens;
drop table if exists public.conversas;
drop table if exists public.respostas_aprovadas;
drop table if exists public.integracao_falhas;
drop table if exists public.canais;

drop index if exists public.leads_telefone_digitos_idx;
drop index if exists public.tarefas_responsavel_data_idx;
drop index if exists public.tarefas_lead_idx;
alter table public.tarefas drop column if exists lead_id;
alter table public.tarefas drop column if exists negociacao_id;
alter table public.tarefas drop column if exists origem;

-- Tarefas voltam a ficar sem regras (bloqueadas para o app), como antes.
drop policy if exists tarefas_select on public.tarefas;
drop policy if exists tarefas_insert on public.tarefas;
drop policy if exists tarefas_update on public.tarefas;
drop policy if exists tarefas_delete on public.tarefas;

drop function if exists public.fn_so_digitos(text);
drop function if exists public.fn_equipe_ativa();

commit;
