-- Dicoon CRM: cria a função "cliente" para o portal do cliente.
-- Rodar ANTES do 04-acessos-por-papel.sql, sozinho:
-- Supabase > SQL Editor > New query > colar > Run.
-- Pode ser rodado mais de uma vez sem problema.

alter type public.profile_role_type add value if not exists 'cliente';

-- Conferência: deve listar admin, corretor, atendente (ou parecidos) e cliente.
select unnest(enum_range(null::public.profile_role_type)) as funcoes;
