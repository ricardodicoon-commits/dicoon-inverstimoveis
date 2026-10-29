-- Dicoon CRM: cada compromisso que veio do Cal.com guarda o identificador do agendamento (calcom_uid),
-- para a Agenda remarcar e cancelar PELO Cal.com (assim o cliente é sempre avisado).
-- Rodar DEPOIS do 08. Só acrescenta; pode rodar de novo. Desfazer: 09-compromisso-calcom-uid-desfazer.sql.

begin;

alter table public.compromissos add column if not exists calcom_uid text;
create index if not exists compromissos_calcom_uid_idx on public.compromissos(calcom_uid);

-- Preenche os que já entraram.
update public.compromissos c
   set calcom_uid = a.uid
  from public.agendamentos_externos a
 where a.compromisso_id = c.id and c.calcom_uid is null
   and a.atualizado_em = (select max(atualizado_em) from public.agendamentos_externos x where x.compromisso_id = c.id);

-- Mantém o calcom_uid sempre igual ao agendamento mais recente (remarcar no Cal.com troca o uid).
create or replace function public.fn_compromisso_calcom_uid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.compromisso_id is not null then
    update public.compromissos set calcom_uid = new.uid where id = new.compromisso_id and calcom_uid is distinct from new.uid;
  end if;
  return new;
end;
$$;

drop trigger if exists agendamento_externo_uid on public.agendamentos_externos;
create trigger agendamento_externo_uid after insert on public.agendamentos_externos
  for each row execute function public.fn_compromisso_calcom_uid();

commit;

select count(*) filter (where calcom_uid is not null) as compromissos_com_calcom from public.compromissos;
