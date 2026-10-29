-- Dicoon CRM: DESFAZ o 09-compromisso-calcom-uid.sql.
begin;
drop trigger if exists agendamento_externo_uid on public.agendamentos_externos;
drop function if exists public.fn_compromisso_calcom_uid();
drop index if exists public.compromissos_calcom_uid_idx;
alter table public.compromissos drop column if exists calcom_uid;
commit;
