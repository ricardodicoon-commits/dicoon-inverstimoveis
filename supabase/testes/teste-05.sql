\set ON_ERROR_STOP 0
\echo '== atendente 1 cadastra lead'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.fn_novo_lead_whatsapp('Maria Teste', '(51) 98888-1111', 'financiamento', 'quer financiar apto') ->> 'duplicado' as duplicado;
\echo '== mesmo telefone em outro formato: deve ser duplicado=true'
select public.fn_novo_lead_whatsapp('Maria T', '51988881111', 'seguro') ->> 'duplicado' as duplicado;
\echo '== telefone de cliente existente: liga o cliente'
select (public.fn_novo_lead_whatsapp('Cliente Antigo', '51 99999 0000', 'imovel') ->> 'cliente_id') is not null as ligou_cliente;
\echo '== o que a atendente 1 ve (leads, negociacoes, tarefas, conversas, mensagens)'
select (select count(*) from leads) l, (select count(*) from negociacoes) n, (select count(*) from tarefas) t, (select count(*) from conversas) c, (select count(*) from mensagens) m;
select etapa, origem_lead::text from negociacoes join leads on leads.id = negociacoes.lead_id limit 1;
\echo '== atendente 1 conclui a propria tarefa'
update tarefas set status = 'concluida' where titulo like '%Maria%';
select status from tarefas where titulo like '%Maria%';
\echo '== atendente 2 nao ve nada da atendente 1'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select (select count(*) from leads) l, (select count(*) from tarefas) t, (select count(*) from conversas) c, (select count(*) from mensagens) m;
\echo '== atendente 2 nao consegue mudar canal (so admin): 0 linhas'
update canais set modo = 'ativo';
select modo from canais;
\echo '== atendente 2 nao grava mensagem como secretaria: deve dar erro'
insert into conversas (canal_id, contato_telefone, responsavel_id) select id, '5100000000', auth.uid() from canais;
insert into mensagens (conversa_id, direcao, autor, texto) select id, 'saida', 'secretaria', 'x' from conversas;
\echo '== pendente (nao aprovado) nao cadastra: deve dar erro'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select public.fn_novo_lead_whatsapp('X', '51977776666', 'seguro');
\echo '== telefone curto: deve dar erro'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.fn_novo_lead_whatsapp('X', '1234', 'seguro');
\echo '== anon (sem login) nao ve nada'
reset request.jwt.claim.sub;
set role anon;
select (select count(*) from conversas) c, (select count(*) from respostas_aprovadas) r, (select count(*) from tarefas) t;
\echo '== admin ve tudo e distribui para a atendente 2'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select (select count(*) from leads) l, (select count(*) from conversas) c, (select count(*) from respostas_aprovadas) r;
select public.fn_novo_lead_whatsapp('Joao Admin', '51955554444', 'consorcio', null, '00000000-0000-0000-0000-000000000002') ->> 'duplicado' as duplicado;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select count(*) as tarefas_da_atendente2 from tarefas;
reset role;
\echo '== DEPOIS do 05: negociacao manual com responsavel real funciona'
insert into negociacoes (etapa, responsavel_id) values ('analise', '00000000-0000-0000-0000-000000000001') returning etapa;
