-- Dicoon CRM: apaga os dados fictícios de teste.
-- Mantém as tabelas, as regras de acesso, os usuários (profiles / login)
-- e os cadastros gerais (bancos parceiros, produtos, configurações).
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- ATENÇÃO: não tem como desfazer pelo Supabase. Os dados de teste
-- continuam em Downloads\DICOON-BACKUP-COMPLETO.zip, se um dia precisar.
-- Se der erro no meio, nada é apagado (tudo roda numa transação só).

-- 1) Antes: quantos registros existem
select
  (select count(*) from public.clientes) as clientes,
  (select count(*) from public.negociacoes) as negociacoes,
  (select count(*) from public.propostas) as propostas,
  (select count(*) from public.tarefas) as tarefas,
  (select count(*) from public.leads) as leads,
  (select count(*) from public.documentos) as documentos,
  (select count(*) from public.imoveis) as imoveis,
  (select count(*) from public.profiles) as usuarios;

-- 2) Apaga (na ordem certa por causa das ligações entre tabelas)
begin;
delete from public.documentos;
delete from public.tarefas;
delete from public.propostas;
delete from public.negociacoes;
delete from public.leads;
delete from public.imoveis;
delete from public.clientes;
commit;

-- 3) Depois: deve dar 0 em tudo, menos em usuarios
select
  (select count(*) from public.clientes) as clientes,
  (select count(*) from public.negociacoes) as negociacoes,
  (select count(*) from public.propostas) as propostas,
  (select count(*) from public.tarefas) as tarefas,
  (select count(*) from public.leads) as leads,
  (select count(*) from public.documentos) as documentos,
  (select count(*) from public.imoveis) as imoveis,
  (select count(*) from public.profiles) as usuarios;

-- 4) Confere o admin: aprovado e ativo devem ser true, role = admin
select email, role, ativo, aprovado from public.profiles;
