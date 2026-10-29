\set ON_ERROR_STOP 0
set timezone = 'America/Sao_Paulo';
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
-- Horários fixos (o Cal.com repete o mesmo horário nos avisos repetidos).
select (date_trunc('day', now()) + interval '2 days 10 hours') as t1, (date_trunc('day', now()) + interval '3 days 15 hours') as t2 \gset
\echo '== 1. agendamento novo com telefone desconhecido (+55) -> cria lead (site) sem o 55, compromisso e lembrete'
set role service_role;
select fn_receber_agendamento('BOOKING_CREATED', 'TESTE-uid-1', null, 'TESTE Conversa sobre financiamento',
  :'t1', :'t1'::timestamptz + interval '30 min', 'TESTE Joana Souza', '+55 (51) 98765-4321', 'joana@exemplo.com', 'Google Meet') ->> 'criado' as criado;
reset role;
select c.categoria, c.status, l.origem_lead::text as origem, l.telefone, p.role::text as responsavel,
       (select status from lembretes_envios le where le.compromisso_id = c.id) as lembrete
  from compromissos c join leads l on l.id = c.lead_id join profiles p on p.id = c.responsavel_id where c.titulo like 'TESTE Conversa%';
\echo '== 2. o mesmo aviso repetido -> nao duplica e nao mexe no horario'
set role service_role;
select fn_receber_agendamento('BOOKING_CREATED', 'TESTE-uid-1', null, 'TESTE Conversa sobre financiamento',
  :'t1', :'t1'::timestamptz + interval '30 min', 'TESTE Joana Souza', '5551987654321', null, null) ->> 'repetido' as repetido;
reset role;
select (select count(*) from compromissos where titulo like 'TESTE Conversa%') as compromissos, (select count(*) from leads where nome = 'TESTE Joana Souza') as leads,
       (select status from compromissos where titulo like 'TESTE Conversa%') as status_inalterado;
\echo '== 3. remarcado no Cal.com (uid novo apontando para o anterior) -> mesmo compromisso, reagendado, lembrete replanejado'
set role service_role;
select fn_receber_agendamento('BOOKING_RESCHEDULED', 'TESTE-uid-2', 'TESTE-uid-1', 'TESTE Conversa sobre financiamento',
  :'t2', :'t2'::timestamptz + interval '30 min', 'TESTE Joana Souza', '+5551987654321', null, null) ->> 'remarcado' as remarcado;
reset role;
select c.status, (select count(*) from compromissos where titulo like 'TESTE Conversa%') as total,
       (select string_agg(status, ',' order by created_at) from lembretes_envios le where le.compromisso_id = c.id) as lembretes
  from compromissos c where c.titulo like 'TESTE Conversa%';
\echo '== 4. cancelado (pelo uid novo) -> compromisso cancelado, lembrete cancelado'
set role service_role;
select fn_receber_agendamento('BOOKING_CANCELLED', 'TESTE-uid-2', null, null, now(), now() + interval '1 min', null, null, null, null) ->> 'cancelado' as cancelado;
reset role;
select c.status, (select string_agg(status, ',' order by created_at) from lembretes_envios le where le.compromisso_id = c.id) as lembretes
  from compromissos c where c.titulo like 'TESTE Conversa%';
\echo '== 5. telefone de lead existente (veio com +55) -> nao cria lead novo; responsavel = o do lead'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.fn_novo_lead_whatsapp('TESTE Paulo Lead', '51922223333', 'seguro') ->> 'duplicado' as lead_existente;
reset role; reset request.jwt.claim.sub;
set role service_role;
select fn_receber_agendamento('BOOKING_CREATED', 'TESTE-uid-3', null, 'TESTE Seguro auto', now() + interval '3 days', now() + interval '3 days 1 hour',
  'Paulo', '+55 51 92222-3333', null, null) ->> 'criado' as criado;
reset role;
select (select count(*) from leads where fn_so_digitos(telefone) in ('51922223333', '5551922223333')) as leads_com_telefone,
       c.responsavel_id = '00000000-0000-0000-0000-000000000001' as responsavel_do_lead, c.lead_id is not null as ligado_ao_lead
  from compromissos c where c.titulo = 'TESTE Seguro auto';
\echo '== 5b. telefone de CLIENTE existente -> liga ao cliente, sem lead novo'
set role service_role;
select fn_receber_agendamento('BOOKING_CREATED', 'TESTE-uid-6', null, 'TESTE Cliente antigo', now() + interval '5 days', now() + interval '5 days 1 hour',
  'Cliente', '+55 51 99999-0000', null, null) ->> 'cliente_id' is not null as ligou_cliente;
reset role;
\echo '== 6. sem telefone -> compromisso interno do admin, com aviso, sem lembrete'
set role service_role;
select fn_receber_agendamento('BOOKING_CREATED', 'TESTE-uid-4', null, 'TESTE Sem telefone', now() + interval '4 days', now() + interval '4 days 1 hour',
  'Fulano', null, 'fulano@exemplo.com', null) ->> 'criado' as criado;
reset role;
select c.observacoes like '%Sem telefone%' as aviso, (select count(*) from lembretes_envios le where le.compromisso_id = c.id) as lembretes, p.role::text as responsavel
  from compromissos c join profiles p on p.id = c.responsavel_id where c.titulo = 'TESTE Sem telefone';
\echo '== 7. evento desconhecido -> ignorado'
set role service_role;
select fn_receber_agendamento('MEETING_ENDED', 'TESTE-uid-5', null, null, now(), now() + interval '1 min', null, null, null, null) ->> 'ignorado' as ignorado;
reset role;
\echo '== 8. usuario logado e anon NAO podem chamar (erro de permissao)'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select fn_receber_agendamento('BOOKING_CREATED', 'x', null, 'x', now(), now() + interval '1 hour', 'x', '51900000000', null, null);
set role anon;
select fn_receber_agendamento('BOOKING_CREATED', 'y', null, 'y', now(), now() + interval '1 hour', 'y', '51900000001', null, null);
reset role;
\echo '== 9. admin ve o registro dos agendamentos externos; atendente nao'
set role authenticated;
select count(*) as admin_ve from agendamentos_externos;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select count(*) as atendente_ve from agendamentos_externos;
reset role;
