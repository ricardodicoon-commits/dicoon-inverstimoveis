-- Desfaz o 10-financeiro.sql.
-- ATENÇÃO: APAGA DE VEZ todas as contas, categorias e lançamentos financeiros.
-- Antes de rodar, exporte o financeiro pelo app se quiser guardar os dados.

begin;

drop view if exists public.fin_saldos;
drop table if exists public.fin_lancamentos;
drop table if exists public.fin_categorias;
drop table if exists public.fin_contas;
drop function if exists public.fn_fin_lancamento_validar();
drop function if exists public.fn_fin_lancamento_recorrente();
drop function if exists public.fn_fin_conta_atualizada();

commit;
