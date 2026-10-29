\set ON_ERROR_STOP 0
set timezone = 'America/Sao_Paulo';
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
select (date_trunc('day', now()) + interval '2 days 10 hours') as t1, (date_trunc('day', now()) + interval '3 days 15 hours') as t2 \gset
\echo '== 1. criado pelo Cal.com -> compromisso guarda o calcom_uid'
set role service_role;
select fn_receber_agendamento('BOOKING_CREATED', 'TESTE-uid-A', null, 'TESTE X', :'t1', :'t1'::timestamptz + interval '15 min', 'TESTE Ana', '51955556666', 'a@x.com', null) ->> 'criado' as criado;
reset role;
select calcom_uid from compromissos where titulo = 'TESTE X';
\echo '== 2. remarcado (uid novo) -> calcom_uid passa a ser o novo, mesmo compromisso'
set role service_role;
select fn_receber_agendamento('BOOKING_RESCHEDULED', 'TESTE-uid-B', 'TESTE-uid-A', 'TESTE X', :'t2', :'t2'::timestamptz + interval '15 min', 'TESTE Ana', '51955556666', null, null) ->> 'remarcado' as remarcado;
reset role;
select calcom_uid, status, (select count(*) from compromissos where titulo = 'TESTE X') as total from compromissos where titulo = 'TESTE X';
\echo '== 3. atendente dona do compromisso enxerga o calcom_uid (regras normais da agenda)'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) as admin_ve from compromissos where calcom_uid = 'TESTE-uid-B';
reset role;
