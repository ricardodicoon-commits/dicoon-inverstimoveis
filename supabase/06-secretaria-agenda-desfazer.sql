-- Dicoon CRM: DESFAZ o 06-secretaria-agenda.sql.
-- ATENÇÃO: apaga compromissos, histórico, rascunhos, modelos, notas e o estado dos alertas.
-- Tarefas continuam (perdem só as colunas novas: categoria, subtarefa, recorrência, follow-up...).
-- As regras de acesso das tarefas voltam às do 05.

-- O papel "secretaria" continua existindo no tipo (o Postgres não remove valores de enum);
-- quem estiver nele perde os acessos especiais, porque as regras somem.

begin;

do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'leads', 'negociacoes', 'conversas', 'mensagens', 'propostas', 'documentos', 'imoveis'] loop
    continue when to_regclass('public.' || t) is null;
    execute format('drop policy if exists %I on public.%I', 'secretaria_le_' || t, t);
  end loop;
end $$;

drop trigger if exists tarefa_recorrente on public.tarefas;
drop trigger if exists tarefa_antes_update on public.tarefas;
drop function if exists public.fn_tarefa_recorrente();
drop function if exists public.fn_tarefa_antes_update();

drop index if exists public.tarefas_follow_up_unico_idx;
drop index if exists public.tarefas_pai_idx;
drop index if exists public.tarefas_compromisso_idx;
alter table public.tarefas drop constraint if exists tarefas_categoria_check;
alter table public.tarefas drop constraint if exists tarefas_status_check;
alter table public.tarefas drop constraint if exists tarefas_prioridade_check;
alter table public.tarefas drop constraint if exists tarefas_recorrencia_check;
alter table public.tarefas drop column if exists tarefa_pai_id;
alter table public.tarefas drop column if exists compromisso_id;
alter table public.tarefas drop column if exists recorrencia;
alter table public.tarefas drop column if exists concluida_em;
alter table public.tarefas drop column if exists motivo;
alter table public.tarefas drop column if exists proxima_acao;
alter table public.tarefas drop column if exists resultado;

drop table if exists public.alertas_estado;
drop table if exists public.notas;
drop table if exists public.rascunhos_mensagens;
drop function if exists public.fn_rascunho_destinatario();
drop table if exists public.modelos_mensagens;
drop function if exists public.fn_conflitos_agenda(timestamptz, timestamptz, uuid);
drop table if exists public.compromissos_historico;
drop table if exists public.compromissos;
drop function if exists public.fn_compromisso_historico();
drop function if exists public.fn_compromisso_antes_update();

-- Regras das tarefas como no 05 (a categoria sai por último porque as regras novas dependem dela).
drop policy if exists tarefas_select on public.tarefas;
drop policy if exists tarefas_insert on public.tarefas;
drop policy if exists tarefas_update on public.tarefas;
drop policy if exists tarefas_delete on public.tarefas;
alter table public.tarefas drop column if exists categoria;
alter table public.tarefas drop column if exists criado_por;
create policy tarefas_select on public.tarefas for select using (public.fn_is_admin() or responsavel_id = auth.uid());
create policy tarefas_insert on public.tarefas for insert with check (
  public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_equipe_ativa())
);
create policy tarefas_update on public.tarefas for update
  using (public.fn_is_admin() or responsavel_id = auth.uid())
  with check (public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_equipe_ativa()));
create policy tarefas_delete on public.tarefas for delete using (public.fn_is_admin());

drop function if exists public.fn_ve_tudo();
drop function if exists public.fn_eh_secretaria();

commit;
