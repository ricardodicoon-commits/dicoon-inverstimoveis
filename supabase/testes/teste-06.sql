\set ON_ERROR_STOP 0
set timezone = 'America/Sao_Paulo';
insert into profiles (id, nome, email, role, ativo, aprovado) values
 ('00000000-0000-0000-0000-000000000005', 'Maria (Secretaria)', 'm@x', 'secretaria', true, true);
set role authenticated;
\echo '== 1. atendente 1 cria compromisso (dados ficticios)'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into compromissos (titulo, categoria, inicio, fim, local) values
 ('TESTE Reuniao construtora', 'reuniao_com_construtora', '2026-11-03 10:00-03', '2026-11-03 11:00-03', 'Canoas');
select titulo, status, to_char(inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as inicio from compromissos;
\echo '== 2. conflito: 10:30-11:30 deve achar 1; 11:00-12:00 deve achar 0 (fim exclusivo)'
select count(*) as conflitos_1030 from fn_conflitos_agenda('2026-11-03 10:30-03', '2026-11-03 11:30-03');
select count(*) as conflitos_1100 from fn_conflitos_agenda('2026-11-03 11:00-03', '2026-11-03 12:00-03');
\echo '== 3. reagendar: vira reagendado e grava historico'
update compromissos set inicio = '2026-11-04 14:00-03', fim = '2026-11-04 15:00-03' where titulo like 'TESTE Reuniao%';
select status, (select count(*) from compromissos_historico) as historico from compromissos;
\echo '== 4. fim antes do inicio: deve dar erro'
insert into compromissos (titulo, inicio, fim) values ('TESTE errado', '2026-11-05 10:00-03', '2026-11-05 09:00-03');
\echo '== 5. compromisso pessoal da atendente 1'
insert into compromissos (titulo, categoria, inicio, fim) values ('TESTE Medico', 'compromisso_pessoal', '2026-11-06 08:00-03', '2026-11-06 09:00-03');
\echo '== 6. tarefa: criar, concluir (concluida_em), status invalido rejeitado'
insert into tarefas (titulo, responsavel_id, prioridade) values ('TESTE Ligar para parceiro', auth.uid(), 'urgente');
update tarefas set status = 'concluida' where titulo = 'TESTE Ligar para parceiro';
select status, concluida_em is not null as tem_data_conclusao from tarefas where titulo = 'TESTE Ligar para parceiro';
insert into tarefas (titulo, responsavel_id, status) values ('TESTE status ruim', auth.uid(), 'feito');
\echo '== 7. tarefa atrasada aparece (data no passado, pendente)'
insert into tarefas (titulo, responsavel_id, data_tarefa) values ('TESTE Atrasada', auth.uid(), current_date - 2);
select count(*) as atrasadas from tarefas where status = 'pendente' and data_tarefa < current_date;
\echo '== 8. recorrente semanal: concluir cria a proxima so uma vez'
insert into tarefas (titulo, responsavel_id, data_tarefa, recorrencia) values ('TESTE Relatorio semanal', auth.uid(), '2026-11-02', 'semanal');
update tarefas set status = 'concluida' where titulo = 'TESTE Relatorio semanal' and data_tarefa = '2026-11-02';
update tarefas set status = 'pendente' where titulo = 'TESTE Relatorio semanal' and data_tarefa = '2026-11-02';
update tarefas set status = 'concluida' where titulo = 'TESTE Relatorio semanal' and data_tarefa = '2026-11-02';
select data_tarefa, status, origem from tarefas where titulo = 'TESTE Relatorio semanal' order by data_tarefa;
\echo '== 9. subtarefa'
insert into tarefas (titulo, responsavel_id, tarefa_pai_id) select 'TESTE sub', auth.uid(), id from tarefas where titulo = 'TESTE Atrasada';
select count(*) as subtarefas from tarefas where tarefa_pai_id is not null;
\echo '== 10. follow-up: lead do 05 + follow-up vencido; segundo igual na mesma data deve dar erro'
select public.fn_novo_lead_whatsapp('TESTE Carlos', '51911112222', 'financiamento') ->> 'duplicado' as lead_duplicado;
insert into tarefas (titulo, tipo, responsavel_id, negociacao_id, data_tarefa, motivo, proxima_acao)
  select 'TESTE Retorno simulacao', 'follow_up', auth.uid(), id, current_date - 1, 'pediu simulacao', 'ligar' from negociacoes limit 1;
select count(*) as follow_ups_vencidos from tarefas where tipo = 'follow_up' and status = 'pendente' and data_tarefa < current_date;
insert into tarefas (titulo, tipo, responsavel_id, negociacao_id, data_tarefa)
  select 'TESTE Retorno dup', 'follow_up', auth.uid(), id, current_date - 1 from negociacoes limit 1;
select etapa as etapa_negociacao_nao_mudou from negociacoes limit 1;
\echo '== 11. rascunho: criado sem envio; marcar enviado sem data deve dar erro'
insert into rascunhos_mensagens (tipo, destinatario_nome, conteudo) values ('confirmacao_de_reuniao', 'TESTE Carlos', 'Ola, TESTE Carlos!');
select status, enviado_em from rascunhos_mensagens;
update rascunhos_mensagens set status = 'enviado_manual';
update rascunhos_mensagens set status = 'enviado_manual', enviado_em = now();
select status, enviado_em is not null as com_data from rascunhos_mensagens;
\echo '== 12. nota e ideia pessoais'
insert into notas (texto) values ('TESTE nota'); insert into notas (tipo, texto) values ('ideia', 'TESTE ideia');
\echo '== 12b. destinatario: rascunho para o telefone de OUTRA pessoa ligado ao lead do Carlos deve dar erro'
insert into rascunhos_mensagens (tipo, destinatario_nome, destinatario_telefone, conteudo, lead_id)
  select 'retorno_comercial', 'Outro', '51900000000', 'Ola', id from leads where nome = 'TESTE Carlos';
\echo '== 12c. destinatario certo (telefone do proprio Carlos, outro formato) passa'
insert into rascunhos_mensagens (tipo, destinatario_nome, destinatario_telefone, conteudo, negociacao_id)
  select 'retorno_comercial', 'TESTE Carlos', '(51) 91111-2222', 'Ola Carlos', n.id from negociacoes n join leads l on l.id = n.lead_id where l.nome = 'TESTE Carlos'
  returning lead_id is not null as herdou_lead;
\echo '== 13. ADMIN ve tudo (inclusive pessoal) e pode editar'
insert into tarefas (titulo, responsavel_id, categoria) values ('TESTE pessoal da atendente', auth.uid(), 'pessoal');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) as admin_ve_compromissos from compromissos;
select count(*) as admin_ve_tarefa_pessoal from tarefas where categoria = 'pessoal';
select count(*) as admin_ve_notas from notas;
update tarefas set prioridade = 'alta' where titulo = 'TESTE pessoal da atendente' returning 'admin editou' as ok;
\echo '== 13b. SECRETARIA: ve tudo, le o CRM, cria para a atendente 1, edita so o que criou'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
select (select count(*) from compromissos) c, (select count(*) from tarefas) t, (select count(*) from notas) n, (select count(*) from leads) l, (select count(*) from negociacoes) ng, (select count(*) from conversas) cv;
insert into compromissos (titulo, inicio, fim, responsavel_id) values ('TESTE Visita marcada pela secretaria', '2026-11-07 15:00-03', '2026-11-07 16:00-03', '00000000-0000-0000-0000-000000000001');
update compromissos set local = 'Imobiliaria X' where titulo = 'TESTE Visita marcada pela secretaria' returning 'editou o que criou' as ok;
update compromissos set local = 'mexeu' where titulo = 'TESTE Reuniao construtora';
select local = 'Canoas' as nao_mexeu_no_dos_outros from compromissos where titulo = 'TESTE Reuniao construtora';
update tarefas set status = 'cancelada' where titulo = 'TESTE Atrasada';
select status as tarefa_dos_outros from tarefas where titulo = 'TESTE Atrasada';
update leads set status = 'perdido';
select count(*) as leads_alterados from leads where status = 'perdido';
delete from compromissos where titulo = 'TESTE Reuniao construtora';
select count(*) as nao_excluiu from compromissos where titulo = 'TESTE Reuniao construtora';
\echo '== 13c. atendente 1 ve a visita que a secretaria marcou para ela'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select count(*) as visita_na_agenda_dela from compromissos where titulo like '%secretaria%';
\echo '== 14. ATENDENTE 2 nao ve nada da atendente 1'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select (select count(*) from compromissos) c, (select count(*) from tarefas) t, (select count(*) from rascunhos_mensagens) r, (select count(*) from notas) n, (select count(*) from compromissos_historico) h, (select count(*) from conversas) cv;
\echo '== 15. ATENDENTE 2 nao cria compromisso em nome da atendente 1: erro'
insert into compromissos (titulo, inicio, fim, responsavel_id) values ('x', now(), now() + interval '1h', '00000000-0000-0000-0000-000000000001');
\echo '== 16. PENDENTE (nao aprovado) nao cria compromisso: erro'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
insert into compromissos (titulo, inicio, fim) values ('x', now(), now() + interval '1h');
\echo '== 17. anon nao ve nada'
reset request.jwt.claim.sub; set role anon;
select (select count(*) from compromissos) c, (select count(*) from tarefas) t, (select count(*) from modelos_mensagens) m;
reset role;
\echo '== 18. pessoal da atendente 1 continua intacto'
select titulo from compromissos where categoria = 'compromisso_pessoal';
\echo '== 19. modelos'
select count(*) as modelos from modelos_mensagens;
