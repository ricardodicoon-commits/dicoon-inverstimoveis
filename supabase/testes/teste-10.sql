\set ON_ERROR_STOP 0
-- Teste do 10-financeiro.sql (sobre 05+06, que trazem o papel "secretaria").
-- Resultado esperado em cada passo está no \echo.
insert into profiles (id, nome, email, role, ativo, aprovado) values
  ('00000000-0000-0000-0000-0000000000a5', 'Secretaria', 's@x', 'secretaria', true, true)
on conflict do nothing;

\echo '== 1. categorias iniciais criadas (esperado: 29 = 11 receitas + 18 despesas)'
select count(*) as total, count(*) filter (where tipo = 'receita') as receitas from fin_categorias;

\echo '== 2. admin cria conta e lançamentos (esperado: 3 lançamentos)'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into fin_contas (nome, tipo, saldo_inicial, data_saldo_inicial) values ('TESTE Banco', 'banco', 1000, '2026-01-01');
insert into fin_lancamentos (tipo, descricao, categoria_id, valor, competencia, vencimento)
  select 'receber', 'TESTE comissão', id, 500, '2026-10-01', '2026-10-15' from fin_categorias where nome = 'Comissão: consórcio';
insert into fin_lancamentos (tipo, descricao, categoria_id, valor, competencia, vencimento, recorrencia)
  select 'pagar', 'TESTE aluguel', id, 200, '2026-10-01', '2026-10-10', 'mensal' from fin_categorias where nome = 'Aluguel e condomínio';
insert into fin_lancamentos (tipo, descricao, categoria_id, valor, competencia, vencimento)
  select 'pagar', 'TESTE luz', id, 80, '2026-10-01', '2026-10-20' from fin_categorias where nome = 'Energia, água e internet';
select count(*) as lancamentos_admin from fin_lancamentos;

\echo '== 3. categoria incompatível (esperado: ERRO "Categoria incompatível")'
insert into fin_lancamentos (tipo, descricao, categoria_id, valor, competencia, vencimento)
  select 'receber', 'TESTE errado', id, 10, '2026-10-01', '2026-10-01' from fin_categorias where nome = 'Pró-labore';

\echo '== 4. pago sem data ou sem conta (esperado: 2 ERROS de fin_lancamentos_pago_coerente)'
update fin_lancamentos set status = 'pago' where descricao = 'TESTE luz';
update fin_lancamentos set status = 'pago', pago_em = '2026-10-20' where descricao = 'TESTE luz';

\echo '== 5. pagar o aluguel mensal cria o de novembro (esperado: 1 novo, venc. 2026-11-10, pendente)'
update fin_lancamentos set status = 'pago', pago_em = '2026-10-10', conta_id = (select id from fin_contas where nome = 'TESTE Banco')
  where descricao = 'TESTE aluguel' and lancamento_origem_id is null;
select vencimento, competencia, status, valor_pago from fin_lancamentos where descricao = 'TESTE aluguel' and lancamento_origem_id is not null;

\echo '== 6. editar o aluguel já pago não duplica (esperado: 2 aluguéis no total)'
update fin_lancamentos set observacoes = 'editado' where descricao = 'TESTE aluguel' and lancamento_origem_id is null;
select count(*) as alugueis from fin_lancamentos where descricao = 'TESTE aluguel';

\echo '== 7. recebe a comissão; saldo = 1000 + 500 - 200 = 1300 (esperado: 1300.00, valor_pago 500.00)'
update fin_lancamentos set status = 'pago', pago_em = '2026-10-15', conta_id = (select id from fin_contas where nome = 'TESTE Banco')
  where descricao = 'TESTE comissão';
select valor_pago from fin_lancamentos where descricao = 'TESTE comissão';
select nome, saldo_atual from fin_saldos;

\echo '== 8. voltar para pendente limpa o valor pago (esperado: pendente, valor_pago vazio)'
update fin_lancamentos set status = 'pendente', pago_em = null where descricao = 'TESTE comissão';
select status, valor_pago from fin_lancamentos where descricao = 'TESTE comissão';
reset role;

\echo '== 9. SECRETÁRIA não vê nada (esperado: 0 0 0 0)'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a5';
select (select count(*) from fin_lancamentos) as lanc, (select count(*) from fin_contas) as contas,
       (select count(*) from fin_categorias) as cat, (select count(*) from fin_saldos) as saldos;
\echo '== 10. SECRETÁRIA não cria, não altera, não apaga (esperado: ERRO de RLS e depois UPDATE 0, DELETE 0)'
insert into fin_contas (nome) values ('TESTE invasao');
update fin_lancamentos set valor = 1;
delete from fin_lancamentos;
reset role;

\echo '== 11. ATENDENTE não vê nada (esperado: 0 0)'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select (select count(*) from fin_lancamentos) as lanc, (select count(*) from fin_categorias) as cat;
reset role;

\echo '== 12. USUÁRIO PENDENTE (corretor não aprovado) não vê nada (esperado: 0)'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select count(*) as lanc from fin_lancamentos;
reset role;

\echo '== 13. ANÔNIMO sem permissão (esperado: ERRO permission denied)'
set role anon;
select count(*) from fin_lancamentos;
reset role;

\echo '== 14. dados intactos depois das tentativas (esperado: 4 lançamentos, nenhum com valor 1)'
select count(*) as total, count(*) filter (where valor = 1) as alterados from fin_lancamentos;
