-- Dicoon CRM: DESFAZ o 07-lembretes-e-follow-up.sql.
-- ATENÇÃO: apaga o registro de lembretes e follow-ups e a preferência "aceita mensagens".
-- Compromissos com as situações novas voltam para as do 06:
--   aguardando_confirmacao/solicitou_remarcacao -> a_confirmar; cancelamento_solicitado -> cancelado;
--   nao_compareceu/follow_up_pendente -> cancelado (com anotação nas observações).
-- Tarefas criadas pelos lembretes continuam.

begin;

drop trigger if exists compromisso_planejar_lembrete on public.compromissos;
drop function if exists public.fn_follow_up_resposta(uuid, integer, text, text);
drop function if exists public.fn_validar_comparecimento(uuid, boolean, text);
drop function if exists public.fn_lembrete_resposta(uuid, text, text);
drop function if exists public.fn_lembrete_enviado(uuid);
drop function if exists public.fn_tarefa_compromisso(public.compromissos, text, text, text);
drop function if exists public.fn_pode_operar(public.compromissos);
drop function if exists public.fn_planejar_lembrete();
drop table if exists public.lembretes_envios;
drop function if exists public.fn_montar_mensagem(text, public.compromissos, text);
drop function if exists public.fn_contato_compromisso(public.compromissos);

alter table public.compromissos drop constraint if exists compromissos_status_check;
update public.compromissos set observacoes = concat_ws(chr(10), observacoes, 'Situação anterior: ' || status)
 where status in ('nao_compareceu', 'follow_up_pendente');
update public.compromissos set status = case
  when status in ('aguardando_confirmacao', 'solicitou_remarcacao') then 'a_confirmar'
  else 'cancelado' end
 where status in ('aguardando_confirmacao', 'solicitou_remarcacao', 'cancelamento_solicitado', 'nao_compareceu', 'follow_up_pendente');
alter table public.compromissos add constraint compromissos_status_check
  check (status in ('a_confirmar', 'confirmado', 'reagendado', 'cancelado', 'realizado'));

create or replace function public.fn_compromisso_antes_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if (new.inicio is distinct from old.inicio or new.fim is distinct from old.fim)
     and new.status = old.status and old.status in ('a_confirmar', 'confirmado') then
    new.status := 'reagendado';
  end if;
  return new;
end;
$$;

alter table public.clientes drop column if exists aceita_mensagens;
alter table public.leads drop column if exists aceita_mensagens;

delete from public.modelos_mensagens m
 where m.tipo in ('lembrete_confirmacao', 'follow_up_falta', 'follow_up_pergunta_1', 'follow_up_pergunta_2',
                  'follow_up_pergunta_3', 'follow_up_remarcar', 'follow_up_encerramento', 'pedido_esclarecimento')
   and not exists (select 1 from public.rascunhos_mensagens r where r.tipo = m.tipo);

commit;
