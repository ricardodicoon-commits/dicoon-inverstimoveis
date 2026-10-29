-- Dicoon CRM: lembretes de confirmação (mínimo 60 min antes) e follow-up de não comparecimento.
-- Rodar DEPOIS do 06. SQL Editor > New query > colar tudo > Run. Só acrescenta; pode rodar de novo.
-- Para desfazer: 07-lembretes-e-follow-up-desfazer.sql.
--
-- MODO ASSISTIDO: o sistema planeja o lembrete, monta a mensagem e avisa na hora; QUEM ENVIA é uma
-- pessoa (Copiar / Abrir no WhatsApp) e registra o envio e a resposta. Nada é enviado sozinho e
-- nada consta como enviado sem alguém registrar. No start, só o "enviador" muda (canal whatsapp).
-- Sigilo: o destinatário é sempre o telefone do próprio cliente/lead do compromisso.

begin;

-- 1) Situações novas do compromisso ------------------------------------------

alter table public.compromissos drop constraint if exists compromissos_status_check;
alter table public.compromissos add constraint compromissos_status_check check (status in (
  'a_confirmar', 'aguardando_confirmacao', 'confirmado', 'solicitou_remarcacao', 'cancelamento_solicitado',
  'reagendado', 'realizado', 'nao_compareceu', 'follow_up_pendente', 'cancelado'));

create or replace function public.fn_compromisso_antes_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if (new.inicio is distinct from old.inicio or new.fim is distinct from old.fim)
     and new.status = old.status
     and old.status in ('a_confirmar', 'aguardando_confirmacao', 'confirmado', 'solicitou_remarcacao') then
    new.status := 'reagendado';
  end if;
  return new;
end;
$$;

-- 2) Preferência de contato (LGPD): quem pediu para não receber mensagens -----

alter table public.clientes add column if not exists aceita_mensagens boolean not null default true;
alter table public.leads add column if not exists aceita_mensagens boolean not null default true;

-- 3) Modelos de mensagem (editáveis pelo admin em Integrações) ----------------

insert into public.modelos_mensagens (tipo, titulo, texto) values
('lembrete_confirmacao', 'Lembrete de confirmação',
 'Olá, {nome}! Tudo bem? Aqui é a secretária virtual da Dicoon Invest. Estou entrando em contato para confirmar seu agendamento de {tipo}, marcado para {data} às {hora}. Podemos confirmar sua presença? Responda: 1 - Confirmo; 2 - Preciso remarcar; 3 - Não poderei comparecer.'),
('follow_up_falta', 'Follow-up de não comparecimento',
 'Olá, {nome}! Sentimos sua falta no agendamento com a Dicoon Invest. Está tudo bem? Gostaríamos de saber se aconteceu algum imprevisto ou se você precisa de ajuda para encontrar outro horário. Podemos ajudar?'),
('follow_up_pergunta_1', 'Follow-up: pergunta 1',
 'O que aconteceu para você não conseguir comparecer ao agendamento? (Tive um imprevisto / Esqueci do horário / Preciso de outro horário / Não tenho mais interesse neste momento / Prefiro explicar por mensagem)'),
('follow_up_pergunta_2', 'Follow-up: pergunta 2',
 'Você ainda deseja receber atendimento sobre o assunto que conversamos? (Sim / Sim, mas em outra data / Tenho dúvidas antes de continuar / Não neste momento)'),
('follow_up_pergunta_3', 'Follow-up: pergunta 3',
 'Se desejar remarcar, qual período costuma ser melhor para você? (Manhã / Tarde / Fim do dia / Quero informar uma data e horário específicos)'),
('follow_up_remarcar', 'Follow-up: remarcar',
 'Sem problemas, {nome}. Podemos verificar um novo horário para você. Qual dia e período seriam mais convenientes?'),
('follow_up_encerramento', 'Follow-up: encerramento',
 'Obrigado por nos dar um retorno, {nome}. Quando precisar, a equipe da Dicoon Invest estará à disposição para ajudar.'),
('pedido_esclarecimento', 'Pedido de esclarecimento',
 'Desculpe, {nome}, não entendi bem. Você pode responder 1 para confirmar, 2 para remarcar ou 3 se não puder comparecer?')
on conflict (tipo) do nothing;

-- 4) Registro de cada lembrete/contato (no máximo um por etapa e horário) ------

create table if not exists public.lembretes_envios (
  id uuid primary key default gen_random_uuid(),
  compromisso_id uuid not null references public.compromissos(id) on delete cascade,
  etapa text not null check (etapa in ('confirmacao', 'follow_up_falta')),
  inicio_ref timestamptz not null,
  enviar_em timestamptz not null,
  canal text not null default 'manual' check (canal in ('manual', 'whatsapp')),
  modo text not null default 'assistido' check (modo in ('assistido', 'automatico')),
  status text not null default 'pendente' check (status in (
    'pendente', 'enviado_manual', 'enviado', 'sem_contato', 'sem_permissao', 'falhou',
    'respondido', 'sem_resposta', 'cancelado')),
  destinatario_telefone text,
  mensagem text,
  resposta_opcao text,
  resposta_texto text,
  respostas jsonb not null default '{}'::jsonb,
  enviado_em timestamptz,
  respondido_em timestamptz,
  registrado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (compromisso_id, etapa, inicio_ref),
  check ((status in ('enviado_manual', 'enviado')) <= (enviado_em is not null))
);
create index if not exists lembretes_pendentes_idx on public.lembretes_envios(status, enviar_em);

-- Nome, telefone e permissão do PRÓPRIO contato do compromisso (cliente tem prioridade; senão lead,
-- direto ou via negociação). Nunca de outra pessoa.
create or replace function public.fn_contato_compromisso(c public.compromissos)
returns table (nome text, telefone text, aceita boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with neg as (select cliente_id, lead_id from public.negociacoes where id = c.negociacao_id)
  select x.nome, x.telefone, x.aceita from (
    select cl.nome_completo as nome, public.fn_so_digitos(cl.telefone) as telefone, cl.aceita_mensagens as aceita, 1 as ordem
    from public.clientes cl where cl.id = coalesce(c.cliente_id, (select cliente_id from neg))
    union all
    select l.nome, public.fn_so_digitos(l.telefone), l.aceita_mensagens, 2
    from public.leads l where l.id = coalesce(c.lead_id, (select lead_id from neg))
  ) x order by x.ordem limit 1;
$$;

-- Troca {nome}, {tipo}, {data}, {hora} pelos dados do compromisso.
create or replace function public.fn_montar_mensagem(p_tipo text, c public.compromissos, p_nome text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select replace(replace(replace(replace(m.texto,
    '{nome}', coalesce(split_part(trim(p_nome), ' ', 1), '')),
    '{tipo}', case c.categoria
      when 'visita_imobiliaria' then 'visita' when 'atendimento_agendado' then 'atendimento'
      when 'reuniao_com_construtora' then 'reunião' when 'reuniao_com_parceiro' then 'reunião'
      when 'reuniao_comercial' then 'reunião' else 'compromisso' end),
    '{data}', to_char(c.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')),
    '{hora}', to_char(c.inicio at time zone 'America/Sao_Paulo', 'HH24:MI'))
  from public.modelos_mensagens m where m.tipo = p_tipo and m.ativo;
$$;

-- Planeja (ou replaneja) o lembrete de confirmação quando o compromisso nasce ou muda.
create or replace function public.fn_planejar_lembrete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contato record;
  v_status text;
begin
  -- Horário mudou ou o compromisso saiu do caminho da confirmação: cancela lembretes pendentes antigos.
  update public.lembretes_envios
     set status = 'cancelado', updated_at = now()
   where compromisso_id = new.id and etapa = 'confirmacao' and status = 'pendente'
     and (inicio_ref <> new.inicio or new.status not in ('a_confirmar', 'reagendado'));

  -- Só agenda lembrete para compromisso futuro, ainda não confirmado e ligado a um cliente/lead.
  if new.status not in ('a_confirmar', 'reagendado') or new.inicio <= now()
     or (new.cliente_id is null and new.lead_id is null and new.negociacao_id is null) then
    return new;
  end if;

  select * into v_contato from public.fn_contato_compromisso(new);
  v_status := case
    when v_contato.telefone is null or length(v_contato.telefone) < 10 then 'sem_contato'
    when not coalesce(v_contato.aceita, true) then 'sem_permissao'
    else 'pendente' end;

  insert into public.lembretes_envios (compromisso_id, etapa, inicio_ref, enviar_em, status, destinatario_telefone, mensagem)
  values (new.id, 'confirmacao', new.inicio,
          -- pelo menos 60 min antes; se já está em cima da hora, agora.
          greatest(now(), new.inicio - make_interval(mins => greatest(60, coalesce(new.lembrete_minutos, 60)))),
          v_status, v_contato.telefone,
          public.fn_montar_mensagem('lembrete_confirmacao', new, v_contato.nome))
  on conflict (compromisso_id, etapa, inicio_ref) do nothing;

  -- Sem como avisar: vira tarefa para o responsável confirmar por outro meio (uma só).
  if v_status <> 'pendente' and not exists (
    select 1 from public.tarefas where compromisso_id = new.id and origem = 'lembrete' and status not in ('concluida', 'cancelada')
  ) then
    insert into public.tarefas (titulo, tipo, categoria, prioridade, data_tarefa, responsavel_id, compromisso_id,
                                negociacao_id, origem, descricao, criado_por)
    values ('Confirmar compromisso: ' || new.titulo, 'confirmacao', 'agenda', 'alta',
            (new.inicio at time zone 'America/Sao_Paulo')::date, new.responsavel_id, new.id, new.negociacao_id, 'lembrete',
            case v_status when 'sem_contato' then 'O contato não tem telefone válido para o lembrete.'
                          else 'O contato pediu para não receber mensagens.' end,
            new.responsavel_id);
  end if;
  return new;
end;
$$;

drop trigger if exists compromisso_planejar_lembrete on public.compromissos;
create trigger compromisso_planejar_lembrete after insert or update of inicio, fim, status, cliente_id, lead_id, negociacao_id, lembrete_minutos
  on public.compromissos for each row execute function public.fn_planejar_lembrete();

-- 5) Ações registradas por uma pessoa (admin, secretária, responsável ou quem criou) --

create or replace function public.fn_pode_operar(c public.compromissos)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.fn_is_admin() or public.fn_eh_secretaria() or c.responsavel_id = auth.uid() or c.criado_por = auth.uid();
$$;

-- Tarefa única por compromisso e motivo (não duplica a cada clique).
create or replace function public.fn_tarefa_compromisso(c public.compromissos, p_titulo text, p_origem text, p_desc text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.tarefas where compromisso_id = c.id and origem = p_origem and status not in ('concluida', 'cancelada')) then
    insert into public.tarefas (titulo, tipo, categoria, prioridade, data_tarefa, responsavel_id, compromisso_id,
                                negociacao_id, lead_id, cliente_id, origem, descricao, criado_por)
    values (p_titulo, 'follow_up', 'agenda', 'alta', (now() at time zone 'America/Sao_Paulo')::date, c.responsavel_id,
            c.id, c.negociacao_id, c.lead_id, c.cliente_id, p_origem, p_desc, c.responsavel_id);
  end if;
end;
$$;

create or replace function public.fn_lembrete_enviado(p_lembrete uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_l public.lembretes_envios;
  v_c public.compromissos;
begin
  select * into v_l from public.lembretes_envios where id = p_lembrete for update;
  select * into v_c from public.compromissos where id = v_l.compromisso_id;
  if v_l.id is null or not public.fn_pode_operar(v_c) then raise exception 'Você não tem permissão para esta ação.'; end if;
  if v_l.status <> 'pendente' then raise exception 'Este lembrete não está mais pendente.'; end if;
  update public.lembretes_envios set status = 'enviado_manual', enviado_em = now(), registrado_por = auth.uid(), updated_at = now()
   where id = p_lembrete;
  if v_l.etapa = 'confirmacao' and v_c.status in ('a_confirmar', 'reagendado') then
    update public.compromissos set status = 'aguardando_confirmacao' where id = v_c.id;
  end if;
end;
$$;

-- Resposta do cliente ao lembrete: confirmo | remarcar | nao_comparecer | sem_resposta | ambigua
create or replace function public.fn_lembrete_resposta(p_lembrete uuid, p_opcao text, p_texto text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_l public.lembretes_envios;
  v_c public.compromissos;
begin
  select * into v_l from public.lembretes_envios where id = p_lembrete for update;
  select * into v_c from public.compromissos where id = v_l.compromisso_id;
  if v_l.id is null or not public.fn_pode_operar(v_c) then raise exception 'Você não tem permissão para esta ação.'; end if;
  if v_l.etapa <> 'confirmacao' then raise exception 'Use o registro de follow-up para esta etapa.'; end if;
  if p_opcao not in ('confirmo', 'remarcar', 'nao_comparecer', 'sem_resposta', 'ambigua') then raise exception 'Resposta inválida.'; end if;
  if v_l.status not in ('enviado_manual', 'enviado', 'sem_resposta') then raise exception 'Registre primeiro o envio do lembrete.'; end if;

  update public.lembretes_envios
     set status = case p_opcao when 'sem_resposta' then 'sem_resposta' when 'ambigua' then v_l.status else 'respondido' end,
         resposta_opcao = p_opcao, resposta_texto = coalesce(nullif(trim(p_texto), ''), resposta_texto),
         respondido_em = case when p_opcao in ('sem_resposta', 'ambigua') then respondido_em else now() end,
         registrado_por = auth.uid(), updated_at = now()
   where id = p_lembrete;

  if p_opcao = 'confirmo' then
    update public.compromissos set status = 'confirmado' where id = v_c.id;
  elsif p_opcao = 'remarcar' then
    update public.compromissos set status = 'solicitou_remarcacao' where id = v_c.id;
    perform public.fn_tarefa_compromisso(v_c, 'Remarcar: ' || v_c.titulo, 'remarcacao',
      'O cliente pediu para remarcar. Verifique a agenda antes de oferecer horários.' || coalesce(' Resposta: ' || p_texto, ''));
  elsif p_opcao = 'nao_comparecer' then
    update public.compromissos set status = 'cancelamento_solicitado' where id = v_c.id;
    perform public.fn_tarefa_compromisso(v_c, 'Oferecer novo horário: ' || v_c.titulo, 'remarcacao',
      'O cliente avisou que não poderá comparecer.' || coalesce(' Resposta: ' || p_texto, ''));
  elsif p_opcao = 'sem_resposta' then
    perform public.fn_tarefa_compromisso(v_c, 'Sem resposta ao lembrete: ' || v_c.titulo, 'sem_resposta',
      'O cliente não respondeu à confirmação. Não presuma confirmação nem cancelamento.');
  end if;
end;
$$;

-- Depois do horário, o responsável valida se o atendimento aconteceu.
create or replace function public.fn_validar_comparecimento(p_compromisso uuid, p_compareceu boolean, p_obs text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_c public.compromissos;
  v_contato record;
  v_status text;
begin
  select * into v_c from public.compromissos where id = p_compromisso for update;
  if v_c.id is null or not public.fn_pode_operar(v_c) then raise exception 'Você não tem permissão para esta ação.'; end if;
  if v_c.inicio > now() then raise exception 'O compromisso ainda não aconteceu.'; end if;
  if v_c.status in ('realizado', 'cancelado', 'nao_compareceu', 'follow_up_pendente') then raise exception 'Este compromisso já foi validado.'; end if;

  if p_compareceu then
    update public.compromissos set status = 'realizado', resultado = coalesce(nullif(trim(p_obs), ''), resultado) where id = v_c.id;
    return;
  end if;

  update public.compromissos
     set status = 'follow_up_pendente',
         observacoes = concat_ws(chr(10), observacoes, 'Não compareceu (' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || ')' || coalesce(': ' || nullif(trim(p_obs), ''), ''))
   where id = v_c.id;

  select * into v_contato from public.fn_contato_compromisso(v_c);
  v_status := case
    when v_contato.telefone is null or length(v_contato.telefone) < 10 then 'sem_contato'
    when not coalesce(v_contato.aceita, true) then 'sem_permissao'
    else 'pendente' end;
  insert into public.lembretes_envios (compromisso_id, etapa, inicio_ref, enviar_em, status, destinatario_telefone, mensagem)
  values (v_c.id, 'follow_up_falta', v_c.inicio, now(), v_status, v_contato.telefone,
          public.fn_montar_mensagem('follow_up_falta', v_c, v_contato.nome))
  on conflict (compromisso_id, etapa, inicio_ref) do nothing;

  perform public.fn_tarefa_compromisso(v_c, 'Follow-up de falta: ' || v_c.titulo, 'nao_compareceu',
    case v_status when 'pendente' then 'Enviar a mensagem de follow-up e fazer as perguntas, uma de cada vez.'
                  when 'sem_contato' then 'Sem telefone válido: fazer o follow-up por outro meio.'
                  else 'O contato pediu para não receber mensagens: não enviar.' end);
end;
$$;

-- Respostas do follow-up (uma pergunta por vez) e desfecho: remarcar | encerrar | humano | sem_resposta
create or replace function public.fn_follow_up_resposta(p_lembrete uuid, p_pergunta integer, p_resposta text, p_desfecho text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_l public.lembretes_envios;
  v_c public.compromissos;
begin
  select * into v_l from public.lembretes_envios where id = p_lembrete for update;
  select * into v_c from public.compromissos where id = v_l.compromisso_id;
  if v_l.id is null or not public.fn_pode_operar(v_c) then raise exception 'Você não tem permissão para esta ação.'; end if;
  if v_l.etapa <> 'follow_up_falta' then raise exception 'Este registro não é de follow-up.'; end if;
  if v_l.status not in ('enviado_manual', 'enviado', 'respondido', 'sem_resposta') then raise exception 'Registre primeiro o envio da mensagem.'; end if;
  if p_desfecho is not null and p_desfecho not in ('remarcar', 'encerrar', 'humano', 'sem_resposta') then raise exception 'Desfecho inválido.'; end if;

  update public.lembretes_envios
     set respostas = case when p_pergunta between 1 and 3 and nullif(trim(p_resposta), '') is not null
                          then respostas || jsonb_build_object('p' || p_pergunta, trim(p_resposta)) else respostas end,
         status = case when p_desfecho = 'sem_resposta' then 'sem_resposta' else 'respondido' end,
         resposta_opcao = coalesce(p_desfecho, resposta_opcao),
         respondido_em = now(), registrado_por = auth.uid(), updated_at = now()
   where id = p_lembrete;

  if p_desfecho = 'remarcar' then
    perform public.fn_tarefa_compromisso(v_c, 'Remarcar após falta: ' || v_c.titulo, 'remarcacao',
      'O cliente quer remarcar. Verifique a agenda real antes de oferecer horários.' || coalesce(' Preferência: ' || nullif(trim(p_resposta), ''), ''));
    update public.compromissos set status = 'nao_compareceu' where id = v_c.id;
  elsif p_desfecho = 'humano' then
    perform public.fn_tarefa_compromisso(v_c, 'Atendimento humano após falta: ' || v_c.titulo, 'humano',
      'O follow-up precisa de uma pessoa.' || coalesce(' Último retorno: ' || nullif(trim(p_resposta), ''), ''));
    update public.compromissos set status = 'nao_compareceu' where id = v_c.id;
  elsif p_desfecho in ('encerrar', 'sem_resposta') then
    update public.compromissos set status = 'nao_compareceu' where id = v_c.id;
  end if;
end;
$$;

-- Quem pode chamar.
do $$
declare
  f text;
begin
  foreach f in array array[
    'fn_lembrete_enviado(uuid)', 'fn_lembrete_resposta(uuid, text, text)',
    'fn_validar_comparecimento(uuid, boolean, text)', 'fn_follow_up_resposta(uuid, integer, text, text)'] loop
    execute 'revoke execute on function public.' || f || ' from public';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  foreach f in array array[
    'fn_contato_compromisso(public.compromissos)', 'fn_montar_mensagem(text, public.compromissos, text)',
    'fn_pode_operar(public.compromissos)', 'fn_tarefa_compromisso(public.compromissos, text, text, text)'] loop
    execute 'revoke execute on function public.' || f || ' from public';
  end loop;
end $$;

-- 6) Regras de acesso dos lembretes: segue a visibilidade do compromisso; só muda via funções acima.

alter table public.lembretes_envios enable row level security;
drop policy if exists lembretes_select on public.lembretes_envios;
drop policy if exists lembretes_admin on public.lembretes_envios;
create policy lembretes_select on public.lembretes_envios for select using (compromisso_id in (select id from public.compromissos));
create policy lembretes_admin on public.lembretes_envios for all using (public.fn_is_admin()) with check (public.fn_is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lembretes_envios') then
    alter publication supabase_realtime add table public.lembretes_envios;
  end if;
end $$;

commit;

select (select count(*) from public.modelos_mensagens) as modelos,
       to_regclass('public.lembretes_envios') is not null as lembretes;
