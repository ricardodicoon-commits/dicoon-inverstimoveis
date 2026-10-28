-- Dicoon CRM: estrutura da Secretária (atendimento por WhatsApp), em STANDBY.
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- Só ACRESCENTA: não apaga nem altera dados existentes. Pode ser rodado mais de uma vez.
-- Se der erro no meio, nada é aplicado (transação única).
-- Para desfazer: 05-secretaria-desfazer.sql.
--
-- O que cria:
--   * canais               – canal de WhatsApp, começa "Não conectado" e em "standby".
--   * conversas            – uma por contato e canal, ligada a lead, cliente e negociação.
--   * mensagens            – histórico; id_externo único evita processar a mesma mensagem duas vezes.
--   * respostas_aprovadas  – textos aprovados (os mesmos das respostas rápidas do celular).
--   * integracao_falhas    – registro de falhas da futura integração (só o admin lê).
--   * tarefas              – ganha lead_id, negociacao_id e origem, além das regras de acesso.
--   * fn_novo_lead_whatsapp – cadastro rápido: cria lead, negociação, tarefa e conversa de uma vez,
--                             sem duplicar quando o telefone já existe.
-- Nenhuma senha, token ou chave fica no banco: isso vai para os segredos do servidor no dia do start.

begin;

-- 1) Quem é da equipe (ativo, aprovado e não cliente) ------------------------

create or replace function public.fn_equipe_ativa()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo = true and aprovado = true and role::text <> 'cliente'
  );
$$;

-- anon também executa (devolve falso sem login), para as regras negarem sem dar erro.
revoke execute on function public.fn_equipe_ativa() from public;
grant execute on function public.fn_equipe_ativa() to authenticated, anon;

-- Só os dígitos do telefone, para comparar sem se perder em espaços e traços.
create or replace function public.fn_so_digitos(texto text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(texto, ''), '\D', '', 'g'), '');
$$;

-- 2) Correção: "responsável" apontava para a tabela antiga usuarios_equipe (vazia),
--    o que impedia salvar negociações e leads. Passa a apontar para os usuários reais.
--    (Em 28/10/2026 leads, negociações e imóveis estavam vazios, então não há dado afetado.)

alter table public.leads drop constraint if exists leads_responsavel_id_fkey;
alter table public.leads add constraint leads_responsavel_id_fkey
  foreign key (responsavel_id) references public.profiles(id) on delete set null;
alter table public.negociacoes drop constraint if exists negociacoes_responsavel_id_fkey;
alter table public.negociacoes add constraint negociacoes_responsavel_id_fkey
  foreign key (responsavel_id) references public.profiles(id) on delete set null;
alter table public.imoveis drop constraint if exists imoveis_responsavel_id_fkey;
alter table public.imoveis add constraint imoveis_responsavel_id_fkey
  foreign key (responsavel_id) references public.profiles(id) on delete set null;

-- 3) Tabelas ------------------------------------------------------------------

create table if not exists public.canais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'whatsapp' check (tipo in ('whatsapp')),
  nome text not null,
  numero text,
  provedor text,
  conexao text not null default 'nao_conectado'
    check (conexao in ('nao_conectado', 'configuracao_pendente', 'conectado', 'erro')),
  modo text not null default 'standby' check (modo in ('standby', 'ativo')),
  atualizado_em timestamptz not null default now()
);

insert into public.canais (nome)
select 'WhatsApp de atendimento'
where not exists (select 1 from public.canais where tipo = 'whatsapp');

create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references public.canais(id) on delete restrict,
  contato_telefone text not null,
  contato_nome text,
  lead_id uuid references public.leads(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  negociacao_id uuid references public.negociacoes(id) on delete set null,
  situacao text not null default 'aguardando_equipe'
    check (situacao in ('aguardando_equipe', 'aguardando_cliente', 'em_atendimento', 'encerrada')),
  atendido_por text not null default 'humano' check (atendido_por in ('secretaria', 'humano')),
  responsavel_id uuid references public.profiles(id) on delete set null,
  ultima_mensagem_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canal_id, contato_telefone)
);
create index if not exists conversas_responsavel_idx on public.conversas(responsavel_id);
create index if not exists conversas_ultima_idx on public.conversas(ultima_mensagem_em desc);
create index if not exists conversas_lead_idx on public.conversas(lead_id);

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida')),
  autor text not null check (autor in ('cliente', 'secretaria', 'humano', 'registro')),
  texto text,
  id_externo text unique,
  status_envio text not null default 'registrada'
    check (status_envio in ('registrada', 'pendente', 'enviada', 'entregue', 'lida', 'falhou')),
  erro text,
  created_at timestamptz not null default now()
);
create index if not exists mensagens_conversa_idx on public.mensagens(conversa_id, created_at);

create table if not exists public.respostas_aprovadas (
  id uuid primary key default gen_random_uuid(),
  atalho text not null unique,
  titulo text not null,
  texto text not null,
  area text not null default 'geral' check (area in ('geral', 'credito', 'seguros', 'imoveis', 'consorcio')),
  ordem integer not null default 0,
  ativa boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.integracao_falhas (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  detalhe text,
  id_externo text,
  created_at timestamptz not null default now()
);

-- Tarefas: ligação com lead e negociação, e quem criou (pessoa ou secretária).
alter table public.tarefas add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.tarefas add column if not exists negociacao_id uuid references public.negociacoes(id) on delete set null;
alter table public.tarefas add column if not exists origem text not null default 'manual';
create index if not exists tarefas_responsavel_data_idx on public.tarefas(responsavel_id, data_tarefa);
create index if not exists tarefas_lead_idx on public.tarefas(lead_id);
create index if not exists leads_telefone_digitos_idx on public.leads(public.fn_so_digitos(telefone));

-- updated_at automático (a função trigger_set_updated_at já existe no banco).
drop trigger if exists set_updated_at_conversas on public.conversas;
create trigger set_updated_at_conversas before update on public.conversas
  for each row execute function public.trigger_set_updated_at();

-- 4) Respostas aprovadas iniciais (as mesmas do celular; editáveis pelo admin) -

insert into public.respostas_aprovadas (atalho, titulo, area, ordem, texto) values
('saudacao', 'Saudação', 'geral', 1,
 'Olá! Você está falando com a Dicoon Invest, de Canoas/RS. Como podemos ajudar? Responda com o número:' || chr(10) ||
 '1 - Crédito e financiamento' || chr(10) || '2 - Seguros' || chr(10) || '3 - Imóveis' || chr(10) ||
 '4 - Consórcio' || chr(10) || '5 - Falar com um atendente'),
('ausencia', 'Fora do horário', 'geral', 2,
 'Olá! Recebemos sua mensagem. Nosso atendimento é de segunda a sexta, das 9h às 18h. Assim que voltarmos, um especialista da Dicoon Invest responde você.'),
('credito', 'Crédito e financiamento', 'credito', 3,
 'Trabalhamos com financiamento imobiliário e de veículos, home equity e outras linhas, junto aos bancos parceiros. Para começar, me conta: qual é o objetivo e o valor aproximado? A aprovação e as condições são definidas pela instituição financeira.'),
('seguros', 'Seguros', 'seguros', 4,
 'Fazemos cotação de seguros (auto, residencial, vida, empresarial e outros) com várias seguradoras. Qual seguro você procura? Um especialista prepara a cotação para você.'),
('imoveis', 'Imóveis', 'imoveis', 5,
 'Ajudamos a comprar, vender ou alugar imóveis. Você procura um imóvel ou quer anunciar o seu? Me diga a cidade, o tipo e a faixa de valor.'),
('consorcio', 'Consórcio', 'consorcio', 6,
 'O consórcio é uma forma de planejar a compra de imóvel ou veículo sem juros, com taxa de administração. Qual bem você quer conquistar e em quanto tempo?'),
('docs', 'Documentos iniciais', 'credito', 7,
 'Para uma análise inicial, normalmente pedimos: documento de identidade com CPF, comprovante de residência e comprovante de renda. O especialista confirma a lista exata para o seu caso.'),
('atendente', 'Encaminhar a um atendente', 'geral', 8,
 'Certo! Já avisei um especialista da Dicoon Invest, que vai continuar o seu atendimento por aqui em breve.')
on conflict (atalho) do nothing;

-- 5) Cadastro rápido de lead do WhatsApp -------------------------------------

create or replace function public.fn_novo_lead_whatsapp(
  p_nome text,
  p_telefone text,
  p_interesse public.lead_interest_type,
  p_observacao text default null,
  p_responsavel uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tel text := public.fn_so_digitos(p_telefone);
  v_resp uuid;
  v_canal uuid;
  v_lead uuid;
  v_cliente uuid;
  v_neg uuid;
  v_tarefa uuid;
  v_conversa uuid;
begin
  if not (public.fn_is_admin() or public.fn_equipe_ativa()) then
    raise exception 'Você não tem permissão para esta ação.';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome do contato.';
  end if;
  if v_tel is null or length(v_tel) < 10 then
    raise exception 'Informe o telefone com DDD.';
  end if;

  -- Só o admin distribui para outra pessoa; os demais ficam como responsáveis.
  v_resp := case when public.fn_is_admin() then coalesce(p_responsavel, auth.uid()) else auth.uid() end;

  -- Já existe lead em aberto com este telefone? Não duplica: devolve o existente.
  select id into v_lead from public.leads
  where public.fn_so_digitos(telefone) = v_tel and status::text not in ('convertido', 'perdido')
  order by created_at desc limit 1;
  if v_lead is not null then
    return jsonb_build_object('duplicado', true, 'lead_id', v_lead);
  end if;

  -- Já é cliente? Liga a negociação e a conversa ao cadastro existente.
  select id into v_cliente from public.clientes
  where public.fn_so_digitos(telefone) = v_tel order by created_at desc limit 1;

  select id into v_canal from public.canais where tipo = 'whatsapp' order by atualizado_em limit 1;

  insert into public.leads (nome, telefone, tipo_interesse, origem_lead, status, observacoes, responsavel_id)
  values (trim(p_nome), v_tel, p_interesse, 'whatsapp', 'novo', nullif(trim(p_observacao), ''), v_resp)
  returning id into v_lead;

  insert into public.negociacoes (lead_id, cliente_id, etapa, observacoes, responsavel_id)
  values (v_lead, v_cliente, 'novo_contato', nullif(trim(p_observacao), ''), v_resp)
  returning id into v_neg;

  insert into public.tarefas (titulo, tipo, lead_id, negociacao_id, cliente_id, responsavel_id,
                              data_tarefa, prioridade, status, origem, descricao)
  values ('Retornar contato: ' || trim(p_nome), 'retorno', v_lead, v_neg, v_cliente, v_resp,
          current_date, 'alta', 'pendente', 'secretaria', 'Lead recebido pelo WhatsApp.')
  returning id into v_tarefa;

  insert into public.conversas (canal_id, contato_telefone, contato_nome, lead_id, cliente_id, negociacao_id,
                                responsavel_id, situacao, atendido_por, ultima_mensagem_em)
  values (v_canal, v_tel, trim(p_nome), v_lead, v_cliente, v_neg, v_resp, 'em_atendimento', 'humano', now())
  on conflict (canal_id, contato_telefone) do update
    set contato_nome = excluded.contato_nome, lead_id = excluded.lead_id,
        cliente_id = coalesce(excluded.cliente_id, public.conversas.cliente_id),
        negociacao_id = excluded.negociacao_id, responsavel_id = excluded.responsavel_id,
        situacao = 'em_atendimento', ultima_mensagem_em = now()
  returning id into v_conversa;

  insert into public.mensagens (conversa_id, direcao, autor, texto)
  values (v_conversa, 'entrada', 'registro', 'Lead cadastrado no CRM a partir do WhatsApp.');

  return jsonb_build_object('duplicado', false, 'lead_id', v_lead, 'negociacao_id', v_neg,
                            'tarefa_id', v_tarefa, 'conversa_id', v_conversa, 'cliente_id', v_cliente);
end;
$$;

revoke execute on function public.fn_novo_lead_whatsapp(text, text, public.lead_interest_type, text, uuid) from public;
grant execute on function public.fn_novo_lead_whatsapp(text, text, public.lead_interest_type, text, uuid) to authenticated;

-- 6) Regras de acesso (RLS) ---------------------------------------------------

alter table public.canais enable row level security;
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;
alter table public.respostas_aprovadas enable row level security;
alter table public.integracao_falhas enable row level security;
alter table public.tarefas enable row level security;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array['canais', 'conversas', 'mensagens', 'respostas_aprovadas', 'integracao_falhas', 'tarefas'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- Canal e respostas: a equipe consulta; só o admin altera.
create policy canais_select on public.canais for select using (public.fn_is_admin() or public.fn_equipe_ativa());
create policy canais_admin on public.canais for all using (public.fn_is_admin()) with check (public.fn_is_admin());
create policy respostas_select on public.respostas_aprovadas for select using (public.fn_is_admin() or public.fn_equipe_ativa());
create policy respostas_admin on public.respostas_aprovadas for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- Conversas: admin vê tudo; a equipe vê as suas e as que ainda não têm responsável (fila).
create policy conversas_select on public.conversas for select using (
  public.fn_is_admin() or (public.fn_equipe_ativa() and (responsavel_id = auth.uid() or responsavel_id is null))
);
create policy conversas_insert on public.conversas for insert with check (
  public.fn_is_admin() or (public.fn_equipe_ativa() and (responsavel_id = auth.uid() or responsavel_id is null))
);
create policy conversas_update on public.conversas for update
  using (public.fn_is_admin() or (public.fn_equipe_ativa() and (responsavel_id = auth.uid() or responsavel_id is null)))
  with check (public.fn_is_admin() or (public.fn_equipe_ativa() and responsavel_id = auth.uid()));
create policy conversas_delete on public.conversas for delete using (public.fn_is_admin());

-- Mensagens: segue a conversa. A equipe só registra mensagens humanas ou anotações.
create policy mensagens_select on public.mensagens for select using (
  conversa_id in (select id from public.conversas)
);
create policy mensagens_insert on public.mensagens for insert with check (
  (public.fn_is_admin() or public.fn_equipe_ativa())
  and autor in ('humano', 'registro')
  and conversa_id in (select id from public.conversas)
);
create policy mensagens_admin_update on public.mensagens for update using (public.fn_is_admin()) with check (public.fn_is_admin());
create policy mensagens_admin_delete on public.mensagens for delete using (public.fn_is_admin());

-- Falhas da integração: só o admin lê (quem grava é o servidor, no futuro).
create policy falhas_select on public.integracao_falhas for select using (public.fn_is_admin());

-- Tarefas: cada um vê e mexe nas suas; admin em todas.
create policy tarefas_select on public.tarefas for select using (public.fn_is_admin() or responsavel_id = auth.uid());
create policy tarefas_insert on public.tarefas for insert with check (
  public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_equipe_ativa())
);
create policy tarefas_update on public.tarefas for update
  using (public.fn_is_admin() or responsavel_id = auth.uid())
  with check (public.fn_is_admin() or (responsavel_id = auth.uid() and public.fn_equipe_ativa()));
create policy tarefas_delete on public.tarefas for delete using (public.fn_is_admin());

-- 7) Tempo real: telas atualizam sozinhas -------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'negociacoes', 'leads', 'tarefas', 'conversas', 'mensagens'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;

-- Conferência: canal em standby e não conectado; 8 respostas aprovadas.
select nome, conexao, modo, (select count(*) from public.respostas_aprovadas) as respostas from public.canais;
