\set ON_ERROR_STOP 0
set timezone = 'America/Sao_Paulo';
insert into profiles (id, nome, email, role, ativo, aprovado) values
 ('00000000-0000-0000-0000-000000000005', 'Maria (Secretaria)', 'm@x', 'secretaria', true, true);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.fn_novo_lead_whatsapp('TESTE Carlos Silva', '(51) 91111-2222', 'financiamento') ->> 'duplicado' as lead1;
select public.fn_novo_lead_whatsapp('TESTE Ana NaoQuer', '51933334444', 'seguro') ->> 'duplicado' as lead2;
reset role; update leads set aceita_mensagens = false where nome = 'TESTE Ana NaoQuer'; set role authenticated;

\echo '== 1. compromisso amanha 10h com lead e lembrete 30 min -> lembrete >= 60 min antes, mensagem com nome/data/hora'
insert into compromissos (titulo, categoria, inicio, fim, lead_id, lembrete_minutos)
  select 'TESTE Visita Carlos', 'visita_imobiliaria', date_trunc('day', now()) + interval '1 day 10 hours', date_trunc('day', now()) + interval '1 day 11 hours', id, 30
  from leads where nome = 'TESTE Carlos Silva';
select l.status, extract(epoch from (c.inicio - l.enviar_em)) / 60 as minutos_antes, l.destinatario_telefone,
       l.mensagem like 'Olá, TESTE!%visita%' as msg_ok, l.mensagem like '%' || to_char(c.inicio, 'DD/MM/YYYY') || ' às 10:00%' as data_ok
  from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Visita Carlos';
\echo '== 2. compromisso em 30 min -> lembrete para agora'
insert into compromissos (titulo, inicio, fim, lead_id)
  select 'TESTE Em cima da hora', now() + interval '30 min', now() + interval '90 min', id from leads where nome = 'TESTE Carlos Silva';
select abs(extract(epoch from (l.enviar_em - now()))) < 5 as enviar_agora from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Em cima da hora';
\echo '== 3. reagendar -> antigo cancelado, novo pendente (so 1 pendente)'
update compromissos set inicio = inicio + interval '1 day', fim = fim + interval '1 day' where titulo = 'TESTE Visita Carlos';
select c.status as compromisso, string_agg(l.status, ',' order by l.created_at) as lembretes from compromissos c join lembretes_envios l on l.compromisso_id = c.id where c.titulo = 'TESTE Visita Carlos' group by c.status;
\echo '== 4. cancelar compromisso -> lembrete pendente cancelado'
update compromissos set status = 'cancelado' where titulo = 'TESTE Em cima da hora';
select string_agg(l.status, ',') as lembretes_do_cancelado from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Em cima da hora';
\echo '== 5. contato que nao aceita mensagens -> sem_permissao + 1 tarefa para o responsavel'
insert into compromissos (titulo, inicio, fim, lead_id)
  select 'TESTE Reuniao Ana', now() + interval '2 days', now() + interval '2 days 1 hour', id from leads where nome = 'TESTE Ana NaoQuer';
select l.status, (select count(*) from tarefas t where t.compromisso_id = l.compromisso_id and t.origem = 'lembrete') as tarefas from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Reuniao Ana';
\echo '== 6. resposta antes de registrar envio: deve dar erro'
select fn_lembrete_resposta(l.id, 'confirmo') from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Visita Carlos' and l.status = 'pendente';
\echo '== 7. registrar envio -> aguardando_confirmacao; repetir: erro'
select fn_lembrete_enviado(l.id) from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Visita Carlos' and l.status = 'pendente';
select status from compromissos where titulo = 'TESTE Visita Carlos';
select fn_lembrete_enviado(l.id) from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Visita Carlos' and l.status = 'enviado_manual';
\echo '== 8. ambigua mantem; confirmo -> confirmado'
select fn_lembrete_resposta(l.id, 'ambigua', 'hã?') from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Visita Carlos' and l.status = 'enviado_manual';
select status as apos_ambigua from compromissos where titulo = 'TESTE Visita Carlos';
select fn_lembrete_resposta(l.id, 'confirmo') from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Visita Carlos' and l.status = 'enviado_manual';
select c.status, l.status as lembrete, l.resposta_opcao from compromissos c join lembretes_envios l on l.compromisso_id = c.id and l.status = 'respondido' where c.titulo = 'TESTE Visita Carlos';
\echo '== 9. remarcar 2x -> solicitou_remarcacao e so 1 tarefa'
insert into compromissos (titulo, inicio, fim, lead_id)
  select 'TESTE Remarca', now() + interval '3 days', now() + interval '3 days 1 hour', id from leads where nome = 'TESTE Carlos Silva';
select fn_lembrete_enviado(l.id) from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Remarca';
select fn_lembrete_resposta(l.id, 'remarcar', 'prefiro sexta') from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Remarca';
select fn_lembrete_resposta(l.id, 'remarcar') from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Remarca';
select c.status, (select count(*) from tarefas t where t.compromisso_id = c.id and t.origem = 'remarcacao') as tarefas from compromissos c where c.titulo = 'TESTE Remarca';
\echo '== 10. compromisso no passado: validar falta -> follow_up_pendente + lembrete de follow-up + tarefa; validar de novo: erro'
reset role;
insert into compromissos (titulo, inicio, fim, lead_id, responsavel_id, criado_por, status)
  select 'TESTE Faltou', now() - interval '3 hours', now() - interval '2 hours', id, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'confirmado' from leads where nome = 'TESTE Carlos Silva';
set role authenticated;
select fn_validar_comparecimento(id, false, 'nao apareceu') from compromissos where titulo = 'TESTE Faltou';
select c.status, l.etapa, l.status as lembrete, l.mensagem like 'Olá, TESTE! Sentimos sua falta%' as msg_ok,
       (select count(*) from tarefas t where t.compromisso_id = c.id and t.origem = 'nao_compareceu') as tarefas
  from compromissos c join lembretes_envios l on l.compromisso_id = c.id where c.titulo = 'TESTE Faltou';
select fn_validar_comparecimento(id, false) from compromissos where titulo = 'TESTE Faltou';
\echo '== 11. follow-up: envio, perguntas 1 e 2, desfecho remarcar'
select fn_lembrete_enviado(l.id) from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Faltou';
select fn_follow_up_resposta(l.id, 1, 'Tive um imprevisto') from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Faltou';
select fn_follow_up_resposta(l.id, 2, 'Sim, mas em outra data', 'remarcar') from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Faltou';
select c.status, l.respostas, (select count(*) from tarefas t where t.compromisso_id = c.id and t.origem = 'remarcacao') as tarefa_remarcar
  from compromissos c join lembretes_envios l on l.compromisso_id = c.id where c.titulo = 'TESTE Faltou';
\echo '== 12. compromisso futuro nao pode ser validado: erro'
select fn_validar_comparecimento(id, true) from compromissos where titulo = 'TESTE Remarca';
\echo '== 13. atendente 2: nao ve lembretes e nao opera os da atendente 1 (erro)'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select count(*) as lembretes_visiveis from lembretes_envios;
select fn_lembrete_enviado(id) from (select '00000000-0000-0000-0000-000000000000'::uuid id) x;
reset role;
select id as lembrete_reuniao_ana into temp t_ana from lembretes_envios where compromisso_id = (select id from compromissos where titulo = 'TESTE Reuniao Ana');
grant select on t_ana to authenticated;
set role authenticated;
select fn_lembrete_resposta((select lembrete_reuniao_ana from t_ana), 'confirmo');
\echo '== 14. secretaria opera compromisso da atendente 1'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
insert into compromissos (titulo, inicio, fim, lead_id, responsavel_id)
  select 'TESTE Da secretaria', now() + interval '4 days', now() + interval '4 days 1 hour', id, '00000000-0000-0000-0000-000000000001' from leads where nome = 'TESTE Carlos Silva';
select count(*) as secretaria_ve_lembretes from lembretes_envios;
select fn_lembrete_enviado(l.id) from lembretes_envios l join compromissos c on c.id = l.compromisso_id where c.titulo = 'TESTE Da secretaria';
select status from compromissos where titulo = 'TESTE Da secretaria';
\echo '== 15. atendente 1 nao altera lembrete direto (0 linhas)'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update lembretes_envios set status = 'enviado', enviado_em = now() where status = 'pendente';
select count(*) as enviados_falsos from lembretes_envios where status = 'enviado';
\echo '== 16. sigilo: todo destinatario e o telefone do proprio lead do compromisso'
reset role;
select count(*) as destinatarios_errados from lembretes_envios l join compromissos c on c.id = l.compromisso_id join leads ld on ld.id = c.lead_id
 where l.destinatario_telefone is not null and l.destinatario_telefone <> fn_so_digitos(ld.telefone);
