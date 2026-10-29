-- Dicoon CRM: Financeiro (contas a pagar, contas a receber, contas/caixa e categorias).
-- Rodar no SQL Editor do Supabase: New query > colar tudo > Run.
-- Só ACRESCENTA (não apaga nem altera dados existentes). Pode ser rodado mais de uma vez.
-- Para desfazer: 10-financeiro-desfazer.sql (ATENÇÃO: o desfazer apaga os lançamentos financeiros).
--
-- Regras (decididas pelo Ricardo em 29/10/2026):
--   * SOMENTE O ADMIN vê e mexe no financeiro. Secretária, corretor, atendente e cliente não
--     enxergam nada (nem por consulta direta à API): a proteção é feita aqui, pelo banco.
--   * Sem integração com bancos: tudo é lançado à mão no app.
--   * Cada categoria já diz em que linha da DRE e em que grupo do fluxo de caixa (DFC) entra,
--     para a Filó (agente financeira) não precisar adivinhar classificação.
--   * DRE usa a data de competência; DFC usa a data do pagamento (pago_em).

begin;

-- 1) Contas (banco, caixa, aplicação) ---------------------------------------------

create table if not exists public.fin_contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  tipo text not null default 'banco' check (tipo in ('banco', 'caixa', 'aplicacao')),
  saldo_inicial numeric(14, 2) not null default 0,
  data_saldo_inicial date not null default current_date,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Categorias, já ligadas à DRE e à DFC -----------------------------------------

create table if not exists public.fin_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  tipo text not null check (tipo in ('receita', 'despesa')),
  linha_dre text not null check (linha_dre in (
    'receita_bruta', 'deducoes', 'custo_servico', 'despesa_operacional',
    'depreciacao', 'resultado_financeiro', 'fora_dre')),
  grupo_dfc text not null check (grupo_dfc in ('operacional', 'investimento', 'financiamento')),
  ordem integer not null default 100,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (nome, tipo)
);

-- 3) Lançamentos (a receber e a pagar) ---------------------------------------------

create table if not exists public.fin_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receber', 'pagar')),
  descricao text not null check (length(trim(descricao)) > 0),
  categoria_id uuid not null references public.fin_categorias(id),
  conta_id uuid references public.fin_contas(id),
  valor numeric(14, 2) not null check (valor > 0),
  competencia date not null,
  vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  pago_em date,
  valor_pago numeric(14, 2) check (valor_pago is null or valor_pago > 0),
  forma_pagamento text check (forma_pagamento is null or forma_pagamento in (
    'pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'debito_automatico', 'outro')),
  parceiro text, -- quem paga ou recebe: banco, administradora, seguradora, fornecedor
  cliente_id uuid references public.clientes(id) on delete set null,
  negociacao_id uuid references public.negociacoes(id) on delete set null,
  recorrencia text check (recorrencia is null or recorrencia = 'mensal'),
  lancamento_origem_id uuid references public.fin_lancamentos(id) on delete set null,
  observacoes text,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- "pago" sempre tem data de pagamento e conta; os outros status não têm data de pagamento.
  constraint fin_lancamentos_pago_coerente check (
    (status = 'pago' and pago_em is not null and conta_id is not null)
    or (status <> 'pago' and pago_em is null))
);

create index if not exists fin_lancamentos_vencimento_idx on public.fin_lancamentos (status, vencimento);
create index if not exists fin_lancamentos_competencia_idx on public.fin_lancamentos (competencia);
create index if not exists fin_lancamentos_pago_em_idx on public.fin_lancamentos (pago_em);
create index if not exists fin_lancamentos_origem_idx on public.fin_lancamentos (lancamento_origem_id);

-- 4) Regras automáticas -------------------------------------------------------------

-- A receber só com categoria de receita; a pagar só com categoria de despesa.
-- Ao marcar como pago sem informar o valor pago, considera o valor do lançamento.
create or replace function public.fn_fin_lancamento_validar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
begin
  select tipo into v_tipo from public.fin_categorias where id = new.categoria_id;
  if (new.tipo = 'receber' and v_tipo <> 'receita') or (new.tipo = 'pagar' and v_tipo <> 'despesa') then
    raise exception 'Categoria incompatível: conta a % precisa de categoria de %.',
      new.tipo, case new.tipo when 'receber' then 'receita' else 'despesa' end;
  end if;
  if new.status = 'pago' and new.valor_pago is null then
    new.valor_pago := new.valor;
  elsif new.status <> 'pago' then
    new.valor_pago := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fin_lancamento_validar on public.fin_lancamentos;
create trigger fin_lancamento_validar before insert or update on public.fin_lancamentos
  for each row execute function public.fn_fin_lancamento_validar();

-- Lançamento mensal: ao ser pago, cria o do mês seguinte (uma vez só).
create or replace function public.fn_fin_lancamento_recorrente()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.recorrencia is null or new.status <> 'pago' or (tg_op = 'UPDATE' and old.status = 'pago') then
    return null;
  end if;
  if exists (select 1 from public.fin_lancamentos where lancamento_origem_id = new.id) then
    return null;
  end if;
  insert into public.fin_lancamentos (tipo, descricao, categoria_id, conta_id, valor, competencia, vencimento,
                                      forma_pagamento, parceiro, cliente_id, negociacao_id, recorrencia,
                                      lancamento_origem_id, observacoes, criado_por)
  values (new.tipo, new.descricao, new.categoria_id, new.conta_id, new.valor,
          (new.competencia + interval '1 month')::date, (new.vencimento + interval '1 month')::date,
          new.forma_pagamento, new.parceiro, new.cliente_id, new.negociacao_id, new.recorrencia,
          new.id, new.observacoes, new.criado_por);
  return null;
end;
$$;

drop trigger if exists fin_lancamento_recorrente on public.fin_lancamentos;
create trigger fin_lancamento_recorrente after insert or update on public.fin_lancamentos
  for each row execute function public.fn_fin_lancamento_recorrente();

create or replace function public.fn_fin_conta_atualizada()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fin_conta_atualizada on public.fin_contas;
create trigger fin_conta_atualizada before update on public.fin_contas
  for each row execute function public.fn_fin_conta_atualizada();

-- 5) Saldo de cada conta (respeita as regras de acesso de quem consulta) -----------

create or replace view public.fin_saldos
with (security_invoker = true)
as
select c.id as conta_id,
       c.nome,
       c.tipo,
       c.ativa,
       c.saldo_inicial,
       c.saldo_inicial
         + coalesce(sum(case when l.tipo = 'receber' then l.valor_pago else -l.valor_pago end), 0) as saldo_atual
from public.fin_contas c
left join public.fin_lancamentos l
  on l.conta_id = c.id and l.status = 'pago' and l.pago_em >= c.data_saldo_inicial
group by c.id;

-- 6) Acesso: só o admin -------------------------------------------------------------

alter table public.fin_contas enable row level security;
alter table public.fin_categorias enable row level security;
alter table public.fin_lancamentos enable row level security;

drop policy if exists fin_contas_admin on public.fin_contas;
create policy fin_contas_admin on public.fin_contas
  for all to authenticated using (public.fn_is_admin()) with check (public.fn_is_admin());

drop policy if exists fin_categorias_admin on public.fin_categorias;
create policy fin_categorias_admin on public.fin_categorias
  for all to authenticated using (public.fn_is_admin()) with check (public.fn_is_admin());

drop policy if exists fin_lancamentos_admin on public.fin_lancamentos;
create policy fin_lancamentos_admin on public.fin_lancamentos
  for all to authenticated using (public.fn_is_admin()) with check (public.fn_is_admin());

revoke all on public.fin_contas, public.fin_categorias, public.fin_lancamentos, public.fin_saldos from anon;
grant select, insert, update, delete on public.fin_contas, public.fin_categorias, public.fin_lancamentos to authenticated;
grant select on public.fin_saldos to authenticated;

revoke execute on function public.fn_fin_lancamento_validar() from public;
revoke execute on function public.fn_fin_lancamento_recorrente() from public;
revoke execute on function public.fn_fin_conta_atualizada() from public;

-- 7) Categorias iniciais para correspondente bancário (o admin ajusta no app) -------

insert into public.fin_categorias (nome, tipo, linha_dre, grupo_dfc, ordem) values
  ('Comissão: financiamento imobiliário', 'receita', 'receita_bruta', 'operacional', 10),
  ('Comissão: financiamento de veículos', 'receita', 'receita_bruta', 'operacional', 11),
  ('Comissão: home equity', 'receita', 'receita_bruta', 'operacional', 12),
  ('Comissão: crédito pessoal e consignado', 'receita', 'receita_bruta', 'operacional', 13),
  ('Comissão: consórcio', 'receita', 'receita_bruta', 'operacional', 14),
  ('Comissão: seguros', 'receita', 'receita_bruta', 'operacional', 15),
  ('Comissão: intermediação imobiliária', 'receita', 'receita_bruta', 'operacional', 16),
  ('Outras receitas', 'receita', 'receita_bruta', 'operacional', 19),
  ('Rendimentos de aplicações', 'receita', 'resultado_financeiro', 'operacional', 30),
  ('Aporte de sócio', 'receita', 'fora_dre', 'financiamento', 40),
  ('Empréstimo recebido', 'receita', 'fora_dre', 'financiamento', 41),
  ('Impostos sobre o faturamento', 'despesa', 'deducoes', 'operacional', 10),
  ('Comissões repassadas a corretores e parceiros', 'despesa', 'custo_servico', 'operacional', 20),
  ('Salários e encargos', 'despesa', 'despesa_operacional', 'operacional', 30),
  ('Pró-labore', 'despesa', 'despesa_operacional', 'operacional', 31),
  ('Aluguel e condomínio', 'despesa', 'despesa_operacional', 'operacional', 32),
  ('Energia, água e internet', 'despesa', 'despesa_operacional', 'operacional', 33),
  ('Telefone e WhatsApp', 'despesa', 'despesa_operacional', 'operacional', 34),
  ('Marketing e anúncios', 'despesa', 'despesa_operacional', 'operacional', 35),
  ('Sistemas e assinaturas', 'despesa', 'despesa_operacional', 'operacional', 36),
  ('Contabilidade', 'despesa', 'despesa_operacional', 'operacional', 37),
  ('Material de escritório e limpeza', 'despesa', 'despesa_operacional', 'operacional', 38),
  ('Deslocamento e combustível', 'despesa', 'despesa_operacional', 'operacional', 39),
  ('Outras despesas', 'despesa', 'despesa_operacional', 'operacional', 49),
  ('Tarifas bancárias', 'despesa', 'resultado_financeiro', 'operacional', 50),
  ('Juros pagos', 'despesa', 'resultado_financeiro', 'financiamento', 51),
  ('Compra de equipamentos e móveis', 'despesa', 'fora_dre', 'investimento', 60),
  ('Pagamento de empréstimo', 'despesa', 'fora_dre', 'financiamento', 70),
  ('Distribuição de lucros', 'despesa', 'fora_dre', 'financiamento', 71)
on conflict (nome, tipo) do nothing;

commit;
