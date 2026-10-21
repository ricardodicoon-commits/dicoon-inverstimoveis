-- Dicoon CRM: apaga os dados fictícios de teste.
-- Mantém as tabelas, as regras de acesso e o usuário admin (profiles / login).
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- ATENÇÃO: não tem como desfazer pelo Supabase. Os dados de teste
-- continuam no arquivo DICOON-BACKUP-COMPLETO.zip, se um dia precisar.

-- 1) Antes: quantos registros existem
select
  (select count(*) from public.clientes) as clientes,
  (select count(*) from public.negociacoes) as negociacoes,
  (select count(*) from public.leads) as leads,
  (select count(*) from public.documentos) as documentos,
  (select count(*) from public.profiles) as usuarios;

-- 2) Apaga (na ordem certa por causa das ligações entre tabelas)
begin;
delete from public.documentos;
delete from public.negociacoes;
delete from public.leads;
delete from public.clientes;
commit;

-- 3) Depois: deve dar 0 em tudo, menos em usuarios
select
  (select count(*) from public.clientes) as clientes,
  (select count(*) from public.negociacoes) as negociacoes,
  (select count(*) from public.leads) as leads,
  (select count(*) from public.documentos) as documentos,
  (select count(*) from public.profiles) as usuarios;

-- 4) Confere o admin: aprovado e ativo devem ser true, role = admin
select email, role, ativo, aprovado from public.profiles;
