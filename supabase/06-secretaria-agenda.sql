-- Dicoon CRM: Secretária Inteligente — agenda, central de tarefas, follow-up, mensagens e notas.
-- Rodar DEPOIS do 05-secretaria-estrutura.sql: SQL Editor > New query > colar tudo > Run.
-- Só ACRESCENTA (não apaga dados). Pode ser rodado mais de uma vez. Transação única.
-- Para desfazer: 06-secretaria-agenda-desfazer.sql.
--
-- Regras (decididas pelo Ricardo em 28/10/2026):
--   * Nada aqui envia mensagem, cria evento em agenda externa ou chama serviço de terceiros.
--   * ADMIN: vê e edita tudo.
--   * SECRETÁRIA (novo papel): vê tudo — inclusive leads, clientes, negociações e conversas,
--     só leitura —, cria compromissos e tarefas para qualquer pessoa e edita só o que ela criou.
--   * Demais (corretor/atendente): veem e editam o que é deles ou o que eles criaram.
--   * Follow-up é uma tarefa do tipo 'follow_up' ligada à negociação: não duplica funis
--     e nunca muda a etapa da negociação sozinho.

-- Papel "secretaria" (precisa vir antes e fora do bloco que o usa).
alter type public.profile_role_type add value if not exists 'secretaria';

begin;

create or replace function public.fn_eh_secretaria()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo = true and aprovado = true and role::text = 'secretaria'
  );
$$;
revoke execute on function public.fn_eh_secretaria() from public;
grant execute on function public.fn_eh_secretaria() to authenticated, anon;

-- Admin ou secretária: enxergam tudo.
create or replace function public.fn_ve_tudo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.fn_is_admin() or public.fn_eh_secretaria();
$$;
revoke execute on function public.fn_ve_tudo() from public;
grant execute on function public.fn_ve_tudo() to authenticated, anon;

-- 1) Compromissos (agenda) ----------------------------------------------------

create table if not exists public.compromissos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  categoria text not null default 'reuniao_comercial' check (categoria in (
    'reuniao_comercial', 'visita_imobiliaria', 'reuniao_com_construtora', 'reuniao_com_parceiro',
    'atendimento_agendado', 'compromisso_pessoal', 'tarefa_externa', 'outros')),
  inicio timestamptz not null,
  fim timestamptz not null,
  local text,
  endereco text,
  participantes text,
  objetivo text,
  observacoes text,
  resultado text,
  status text not null default 'a_confirmar'
    check (status in ('a_confirmar', 'confirmado', 'reagendado', 'cancelado', 'realizado')),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  lembrete_minutos integer default 30 check (lembrete_minutos is null or lembrete_minutos between 0 and 10080),
  cliente_id uuid references public.clientes(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  negociacao_id uuid references public.negociacoes(id) on delete set null,
  responsavel_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  criado_por uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim > inicio)
);
create index if not exists compromissos_responsavel_inicio_idx on public.compromissos(responsavel_id, inicio);
create index if not exists compromissos_negociacao_idx on public.compromissos(negociacao_id);

create table if not exists public.compromissos_historico (
  id uuid primary key default gen_random_uuid(),
  compromisso_id uuid not null references public.compromissos(id) on delete cascade,
  inicio_anterior timestamptz,
  fim_anterior timestamptz,
  inicio_novo timestamptz,
  fim_novo timestamptz,
  status_anterior text,
  status_novo text,
  alterado_por uuid default auth.uid(),
  alterado_em timestamptz not null default now()
);
create index if not exists compromissos_historico_idx on public.compromissos_historico(compromisso_id, alterado_em);

-- Mudou o horário sem mudar a situação: vira "reagendado" (exceto cancelado/realizado).
create or replace function public.fn_compromisso_antes_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if (new.inicio is distinct from old.inicio or new.fim is distinct from old.fim)
     and new.status = old.status and old.status in ('a_confirmar', 'confirmado') then
    new.status := 'reagendado';
  end if;
  return new;
end;
$$;

-- Guarda o histórico de horário e situação.
create or replace function public.fn_compromisso_historico()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.inicio is distinct from old.inicio or new.fim is distinct from old.fim or new.status is distinct from old.status then
    insert into public.compromissos_historico
      (compromisso_id, inicio_anterior, fim_anterior, inicio_novo, fim_novo, status_anterior, status_novo)
    values (new.id, old.inicio, old.fim, new.inicio, new.fim, old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists compromisso_antes_update on public.compromissos;
create trigger compromisso_antes_update before update on public.compromissos
  for each row execute function public.fn_compromisso_antes_update();
drop trigger if exists compromisso_historico on public.compromissos;
create trigger compromisso_historico after update on public.compromissos
  for each row execute function public.fn_compromisso_historico();

-- Conflitos de horário do próprio usuário (respeita as regras de acesso de quem consulta).
create or replace function public.fn_conflitos_agenda(p_inicio timestamptz, p_fim timestamptz, p_ignorar uuid default null)
returns table (id uuid, titulo text, inicio timestamptz, fim timestamptz, status text)
language sql
stable
set search_path = public, pg_temp
as $$
  select c.id, c.titulo, c.inicio, c.fim, c.status
  from public.compromissos c
  where c.responsavel_id = auth.uid()
    and c.status not in ('cancelado', 'realizado')
    and (p_ignorar is null or c.id <> p_ignorar)
    and tstzrange(c.inicio, c.fim, '[)') && tstzrange(p_inicio, p_fim, '[)')
  order by c.inicio;
$$;
revoke execute on function public.fn_conflitos_agenda(timestamptz, timestamptz, uuid) from public;
grant execute on function public.fn_conflitos_agenda(timestamptz, timestamptz, uuid) to authenticated;

-- 2) Central de tarefas (amplia a tabela existente) --------------------------

alter table public.tarefas alter column tipo set default 'tarefa';
alter table public.tarefas alter column prioridade set default 'media';
alter table public.tarefas alter column status set default 'pendente';
alter table public.tarefas alter column data_tarefa set default current_date;
alter table public.tarefas add column if not exists categoria text not null default 'comercial';
alter table public.tarefas add column if not exists tarefa_pai_id uuid references public.tarefas(id) on delete cascade;
alter table public.tarefas add column if not exists compromisso_id uuid references public.compromissos(id) on delete set null;
alter table public.tarefas add column if not exists recorrencia text;
alter table public.tarefas add column if not exists concluida_em timestamptz;
alter table public.tarefas add column if not exists motivo text;
alter table public.tarefas add column if not exists proxima_acao text;
alter table public.tarefas add column if not exists resultado text;
alter table public.tarefas add column if not exists criado_por uuid default auth.uid() references public.profiles(id) on delete set null;

alter table public.tarefas drop constraint if exists tarefas_categoria_check;
alter table public.tarefas add constraint tarefas_categoria_check check (categoria in (
  'administrativo', 'agenda', 'comercial', 'documentacao', 'parcerias', 'imobiliaria',
  'consorcios', 'consignados', 'seguros', 'credito', 'pessoal', 'outros'));
alter table public.tarefas drop constraint if exists tarefas_status_check;
alter table public.tarefas add constraint tarefas_status_check
  check (status in ('pendente', 'em_andamento', 'aguardando_terceiro', 'concluida', 'cancelada'));
alter table public.tarefas drop constraint if exists tarefas_prioridade_check;
alter table public.tarefas add constraint tarefas_prioridade_check
  check (prioridade in ('baixa', 'media', 'alta', 'urgente'));
alter table public.tarefas drop constraint if exists tarefas_recorrencia_check;
alter table public.tarefas add constraint tarefas_recorrencia_check
  check (recorrencia is null or recorrencia in ('diaria', 'semanal', 'mensal'));

create index if not exists tarefas_pai_idx on public.tarefas(tarefa_pai_id);
create index if not exists tarefas_compromisso_idx on public.tarefas(compromisso_id);
-- Um único follow-up em aberto por negociação e data.
create unique index if not exists tarefas_follow_up_unico_idx on public.tarefas(negociacao_id, data_tarefa)
  where tipo = 'follow_up' and status not in ('concluida', 'cancelada') and negociacao_id is not null;

-- Data de conclusão e próxima ocorrência das tarefas recorrentes.
create or replace function public.fn_tarefa_antes_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());
  elsif new.status <> 'concluida' then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

create or replace function public.fn_tarefa_recorrente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proxima date;
begin
  if new.recorrencia is null or new.status <> 'concluida' or old.status = 'concluida' then
    return new;
  end if;
  v_proxima := case new.recorrencia
    when 'diaria' then new.data_tarefa + 1
    when 'semanal' then new.data_tarefa + 7
    else (new.data_tarefa + interval '1 month')::date
  end;
  -- Não cria de novo se a próxima já existir (reabrir e concluir outra vez não duplica).
  if not exists (
    select 1 from public.tarefas
    where titulo = new.titulo and responsavel_id is not distinct from new.responsavel_id
      and data_tarefa = v_proxima and recorrencia = new.recorrencia
  ) then
    insert into public.tarefas (titulo, descricao, tipo, categoria, prioridade, status, data_tarefa,
                                hora_inicio, hora_fim, recorrencia, responsavel_id, cliente_id, lead_id,
                                negociacao_id, origem, observacoes)
    values (new.titulo, new.descricao, new.tipo, new.categoria, new.prioridade, 'pendente', v_proxima,
            new.hora_inicio, new.hora_fim, new.recorrencia, new.responsavel_id, new.cliente_id, new.lead_id,
            new.negociacao_id, 'recorrencia', new.observacoes);
  end if;
  return new;
end;
$$;

drop trigger if exists tarefa_antes_update on public.tarefas;
create trigger tarefa_antes_update before update on public.tarefas
  for each row execute function public.fn_tarefa_antes_update();
drop trigger if exists tarefa_recorrente on public.tarefas;
create trigger tarefa_recorrente after update on public.tarefas
  for each row execute function public.fn_tarefa_recorrente();

-- 3) Mensagens: modelos e rascunhos (nunca enviados pelo sistema) -------------

create table if not exists public.modelos_mensagens (
  id uuid primary key default gen_random_uuid(),
  tipo text not null unique,
  titulo text not null,
  texto text not null,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.modelos_mensagens (tipo, titulo, texto) values
('confirmacao_de_reuniao', 'Confirmação de reunião',
 'Olá, {nome}! Tudo bem? Confirmando nossa reunião em {data}, às {hora}, em {local}. Posso confirmar sua presença?'),
('lembrete_de_compromisso', 'Lembrete de compromisso',
 'Olá, {nome}! Passando para lembrar do nosso compromisso em {data}, às {hora}, em {local}. Até lá!'),
('solicitacao_de_confirmacao', 'Pedido de confirmação',
 'Olá, {nome}! Você consegue confirmar o horário de {data}, às {hora}? Se precisar, ajustamos.'),
('reagendamento', 'Reagendamento',
 'Olá, {nome}! Precisamos ajustar nosso horário. Podemos remarcar para {data}, às {hora}? Me avise o que fica melhor para você.'),
('agradecimento_por_reuniao', 'Agradecimento pela reunião',
 'Olá, {nome}! Obrigado pela reunião de hoje. Fico à disposição para os próximos passos.'),
('acompanhamento_de_simulacao', 'Acompanhamento de simulação',
 'Olá, {nome}! Conseguiu analisar a simulação que conversamos? Posso esclarecer alguma dúvida? Lembrando que a aprovação e as condições são definidas pela instituição financeira.'),
('retorno_comercial', 'Retorno comercial',
 'Olá, {nome}! Retomando nosso contato sobre {assunto}. Podemos seguir com os próximos passos?'),
('solicitacao_de_documentos', 'Pedido de documentos',
 'Olá, {nome}! Para dar andamento, preciso dos seguintes documentos: {documentos}. Pode me enviar quando puder? Nunca peça nem envie senhas.'),
('contato_com_parceiros', 'Contato com parceiro',
 'Olá, {nome}! Aqui é da Dicoon Invest. Gostaria de conversar sobre {assunto}. Qual o melhor horário para você?'),
('pos_visita_imobiliaria', 'Pós-visita ao imóvel',
 'Olá, {nome}! O que achou do imóvel que visitamos em {data}? Fico à disposição para tirar dúvidas ou agendar outras visitas.')
on conflict (tipo) do nothing;

create table if not exists public.rascunhos_mensagens (
  id uuid primary key default gen_random_uuid(),
  tipo text not null references public.modelos_mensagens(tipo) on update cascade,
  destinatario_nome text,
  destinatario_telefone text,
  conteudo text not null check (length(trim(conteudo)) > 0),
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'enviado_manual', 'descartado')),
  enviado_em timestamptz,
  cliente_id uuid references public.clientes(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  negociacao_id uuid references public.negociacoes(id) on delete set null,
  compromisso_id uuid references public.compromissos(id) on delete set null,
  autor_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- "Enviado" só existe se alguém marcou a data do envio manual.
  check ((status = 'enviado_manual') = (enviado_em is not null))
);
create index if not exists rascunhos_autor_idx on public.rascunhos_mensagens(autor_id, created_at desc);

-- Regra do Ricardo: uma mensagem só pode ir para o PRÓPRIO cliente a que se refere.
-- Se o rascunho está ligado a cliente/lead/negociação, o telefone do destinatário tem de ser
-- o desse cadastro, e cliente, lead e negociação têm de ser da mesma pessoa.
create or replace function public.fn_rascunho_destinatario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tel text := public.fn_so_digitos(new.destinatario_telefone);
  v_neg record;
begin
  if new.negociacao_id is not null then
    select cliente_id, lead_id into v_neg from public.negociacoes where id = new.negociacao_id;
    if (new.cliente_id is not null and v_neg.cliente_id is distinct from new.cliente_id)
       or (new.lead_id is not null and v_neg.lead_id is distinct from new.lead_id) then
      raise exception 'A mensagem mistura dados de clientes diferentes.';
    end if;
    new.cliente_id := coalesce(new.cliente_id, v_neg.cliente_id);
    new.lead_id := coalesce(new.lead_id, v_neg.lead_id);
  end if;
  if v_tel is not null then
    if new.cliente_id is not null and not exists (
      select 1 from public.clientes where id = new.cliente_id and public.fn_so_digitos(telefone) = v_tel
    ) and new.lead_id is null then
      raise exception 'O destinatário precisa ser o próprio cliente desta mensagem.';
    end if;
    if new.lead_id is not null and not exists (
      select 1 from public.leads where id = new.lead_id and public.fn_so_digitos(telefone) = v_tel
    ) and not exists (
      select 1 from public.clientes where id = new.cliente_id and public.fn_so_digitos(telefone) = v_tel
    ) then
      raise exception 'O destinatário precisa ser o próprio cliente desta mensagem.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rascunho_destinatario on public.rascunhos_mensagens;
create trigger rascunho_destinatario before insert or update on public.rascunhos_mensagens
  for each row execute function public.fn_rascunho_destinatario();

-- 4) Notas rápidas e ideias; estado dos alertas (dispensar/adiar) ------------

create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  tipo text not null default 'nota' check (tipo in ('nota', 'ideia')),
  texto text not null check (length(trim(texto)) > 0),
  arquivada boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notas_autor_idx on public.notas(autor_id, created_at desc);

create table if not exists public.alertas_estado (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  chave text not null,
  situacao text not null check (situacao in ('dispensado', 'adiado')),
  ate timestamptz,
  created_at timestamptz not null default now(),
  unique (usuario_id, chave)
);

-- 5) Regras de acesso ---------------------------------------------------------

alter table public.compromissos enable row level security;
alter table public.compromissos_historico enable row level security;
alter table public.modelos_mensagens enable row level security;
alter table public.rascunhos_mensagens enable row level security;
alter table public.notas enable row level security;
alter table public.alertas_estado enable row level security;
alter table public.tarefas enable row level security;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array['compromissos', 'compromissos_historico', 'modelos_mensagens', 'rascunhos_mensagens',
                           'notas', 'alertas_estado', 'tarefas'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- Compromissos: admin e secretária veem todos. Cria quem é da equipe (para si; admin e
-- secretária para qualquer pessoa). Edita/exclui: admin, ou quem é o responsável, ou quem criou.
create policy compromissos_select on public.compromissos for select using (
  public.fn_ve_tudo() or responsavel_id = auth.uid() or criado_por = auth.uid()
);
create policy compromissos_insert on public.compromissos for insert with check (
  (public.fn_equipe_ativa() or public.fn_is_admin())
  and (criado_por = auth.uid() or public.fn_is_admin())
  and (responsavel_id = auth.uid() or public.fn_ve_tudo())
);
create policy compromissos_update on public.compromissos for update
  using (public.fn_is_admin() or criado_por = auth.uid() or (responsavel_id = auth.uid() and not public.fn_eh_secretaria()))
  with check (public.fn_is_admin() or criado_por = auth.uid() or (responsavel_id = auth.uid() and not public.fn_eh_secretaria()));
create policy compromissos_delete on public.compromissos for delete using (
  public.fn_is_admin() or criado_por = auth.uid() or (responsavel_id = auth.uid() and not public.fn_eh_secretaria())
);
create policy compromissos_historico_select on public.compromissos_historico for select using (
  compromisso_id in (select id from public.compromissos)
);

-- Tarefas: mesma lógica dos compromissos.
create policy tarefas_select on public.tarefas for select using (
  public.fn_ve_tudo() or responsavel_id = auth.uid() or criado_por = auth.uid()
);
create policy tarefas_insert on public.tarefas for insert with check (
  (public.fn_equipe_ativa() or public.fn_is_admin())
  and (criado_por = auth.uid() or public.fn_is_admin())
  and (responsavel_id = auth.uid() or public.fn_ve_tudo())
);
create policy tarefas_update on public.tarefas for update
  using (public.fn_is_admin() or criado_por = auth.uid() or (responsavel_id = auth.uid() and not public.fn_eh_secretaria()))
  with check (public.fn_is_admin() or criado_por = auth.uid() or (responsavel_id = auth.uid() and not public.fn_eh_secretaria()));
create policy tarefas_delete on public.tarefas for delete using (
  public.fn_is_admin() or criado_por = auth.uid() or (responsavel_id = auth.uid() and not public.fn_eh_secretaria())
);

-- Modelos: a equipe usa; só o admin edita.
create policy modelos_select on public.modelos_mensagens for select using (public.fn_is_admin() or public.fn_equipe_ativa());
create policy modelos_admin on public.modelos_mensagens for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- Rascunhos: admin e secretária veem todos; cada um edita os seus; admin edita qualquer um.
create policy rascunhos_select on public.rascunhos_mensagens for select using (public.fn_ve_tudo() or autor_id = auth.uid());
create policy rascunhos_insert on public.rascunhos_mensagens for insert with check (
  autor_id = auth.uid() and (public.fn_equipe_ativa() or public.fn_is_admin())
);
create policy rascunhos_update on public.rascunhos_mensagens for update
  using (autor_id = auth.uid() or public.fn_is_admin()) with check (autor_id = auth.uid() or public.fn_is_admin());
create policy rascunhos_delete on public.rascunhos_mensagens for delete using (autor_id = auth.uid() or public.fn_is_admin());

-- Notas: admin e secretária veem todas; cada um escreve as suas; admin edita qualquer uma.
create policy notas_select on public.notas for select using (public.fn_ve_tudo() or autor_id = auth.uid());
create policy notas_insert on public.notas for insert with check (autor_id = auth.uid());
create policy notas_update on public.notas for update
  using (autor_id = auth.uid() or public.fn_is_admin()) with check (autor_id = auth.uid() or public.fn_is_admin());
create policy notas_delete on public.notas for delete using (autor_id = auth.uid() or public.fn_is_admin());

-- Alertas dispensados/adiados: estado de tela de cada um.
create policy alertas_dono on public.alertas_estado for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Secretária lê o CRM comercial inteiro (só leitura: estas regras somam às existentes,
-- e ela não ganha nenhuma permissão de alterar).
do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'leads', 'negociacoes', 'conversas', 'mensagens', 'propostas', 'documentos', 'imoveis'] loop
    continue when to_regclass('public.' || t) is null;
    execute format('drop policy if exists %I on public.%I', 'secretaria_le_' || t, t);
    execute format('create policy %I on public.%I for select using (public.fn_eh_secretaria())', 'secretaria_le_' || t, t);
  end loop;
end $$;

-- 6) Tempo real ---------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['compromissos', 'tarefas', 'rascunhos_mensagens', 'notas'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;

-- Conferência: 10 modelos de mensagem e as tabelas novas.
select (select count(*) from public.modelos_mensagens) as modelos,
       to_regclass('public.compromissos') is not null as agenda,
       to_regclass('public.notas') is not null as notas;
