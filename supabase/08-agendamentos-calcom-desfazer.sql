-- Dicoon CRM: DESFAZ o 08-agendamentos-calcom.sql.
-- Compromissos e leads já criados pelo Cal.com continuam; some só o registro de ligação com o Cal.com.
-- Antes, desligue o webhook no Cal.com (Settings > Developer > Webhooks), senão os avisos passam a falhar.

begin;
drop function if exists public.fn_receber_agendamento(text, text, text, text, timestamptz, timestamptz, text, text, text, text, text);
drop table if exists public.agendamentos_externos;
commit;
