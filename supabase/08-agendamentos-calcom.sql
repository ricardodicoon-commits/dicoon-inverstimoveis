-- Dicoon CRM: agendamentos feitos pelo link do Cal.com entram sozinhos na Agenda da Secretária.
-- Rodar DEPOIS do 07. SQL Editor > New query > colar tudo > Run. Só acrescenta; pode rodar de novo.
-- Para desfazer: 08-agendamentos-calcom-desfazer.sql.
--
-- Quem chama fn_receber_agendamento é SOMENTE a função do servidor (Edge Function calcom-webhook),
-- depois de conferir a assinatura do Cal.com. Navegador nenhum consegue chamar (só service_role).
-- Idempotente: o mesmo aviso repetido não duplica compromisso nem lead.

begin;

-- Registro de cada agendamento externo (um por uid do Cal.com) e do último evento processado.
create table if not exists public.agendamentos_externos (
  id uuid primary key default gen_random_uuid(),
  provedor text not null default 'calcom' check (provedor in ('calcom')),
  uid text not null,
  compromisso_id uuid references public.compromissos(id) on delete set null,
  ultimo_evento text not null,
  recebido_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (provedor, uid)
);

alter table public.agendamentos_externos enable row level security;
drop policy if exists agendamentos_externos_select on public.agendamentos_externos;
create policy agendamentos_externos_select on public.agendamentos_externos for select using (public.fn_ve_tudo());

-- Recebe BOOKING_CREATED / BOOKING_RESCHEDULED / BOOKING_CANCELLED já validados pelo servidor.
create or replace function public.fn_receber_agendamento(
  p_evento text,
  p_uid text,
  p_uid_anterior text,
  p_titulo text,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_nome text,
  p_telefone text,
  p_email text,
  p_local text,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- O Cal.com manda com +55; o CRM guarda sem. Compara e grava no formato do CRM (DDD + número).
  v_tel text := case
    when length(public.fn_so_digitos(p_telefone)) in (12, 13) and public.fn_so_digitos(p_telefone) like '55%'
      then substr(public.fn_so_digitos(p_telefone), 3)
    else public.fn_so_digitos(p_telefone) end;
  v_ext public.agendamentos_externos;
  v_comp uuid;
  v_lead uuid;
  v_cliente uuid;
  v_resp uuid;
begin
  if p_evento not in ('BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED') then
    return jsonb_build_object('ignorado', true, 'motivo', 'evento não tratado');
  end if;
  if coalesce(p_uid, '') = '' then
    raise exception 'Agendamento sem identificador.';
  end if;

  select * into v_ext from public.agendamentos_externos where provedor = 'calcom' and uid = p_uid;

  -- Cancelado: só muda a situação do compromisso que já existe (os lembretes pendentes caem sozinhos).
  if p_evento = 'BOOKING_CANCELLED' then
    if v_ext.compromisso_id is not null then
      update public.compromissos set status = 'cancelado'
       where id = v_ext.compromisso_id and status not in ('cancelado', 'realizado');
      update public.agendamentos_externos set ultimo_evento = p_evento, atualizado_em = now() where id = v_ext.id;
    end if;
    return jsonb_build_object('cancelado', v_ext.compromisso_id is not null, 'compromisso_id', v_ext.compromisso_id);
  end if;

  -- Remarcado no Cal.com: chega com um uid novo apontando para o anterior. Move o mesmo compromisso.
  if p_evento = 'BOOKING_RESCHEDULED' and v_ext.id is null and coalesce(p_uid_anterior, '') <> '' then
    select * into v_ext from public.agendamentos_externos where provedor = 'calcom' and uid = p_uid_anterior;
    if v_ext.compromisso_id is not null then
      update public.compromissos set inicio = p_inicio, fim = p_fim where id = v_ext.compromisso_id;
      insert into public.agendamentos_externos (uid, compromisso_id, ultimo_evento)
      values (p_uid, v_ext.compromisso_id, p_evento) on conflict (provedor, uid) do nothing;
      update public.agendamentos_externos set ultimo_evento = p_evento, atualizado_em = now() where id = v_ext.id;
      return jsonb_build_object('remarcado', true, 'compromisso_id', v_ext.compromisso_id);
    end if;
  end if;

  -- Aviso repetido de algo que já entrou: atualiza horário se mudou e não duplica nada.
  if v_ext.compromisso_id is not null then
    update public.compromissos set inicio = p_inicio, fim = p_fim
     where id = v_ext.compromisso_id and (inicio <> p_inicio or fim <> p_fim);
    update public.agendamentos_externos set ultimo_evento = p_evento, atualizado_em = now() where id = v_ext.id;
    return jsonb_build_object('repetido', true, 'compromisso_id', v_ext.compromisso_id);
  end if;

  -- Novo: liga ao cliente/lead pelo telefone; se não existir, cria o lead (origem site).
  if v_tel is not null and length(v_tel) >= 10 then
    select id into v_cliente from public.clientes where public.fn_so_digitos(telefone) in (v_tel, '55' || v_tel) order by created_at desc limit 1;
    select id into v_lead from public.leads
     where public.fn_so_digitos(telefone) in (v_tel, '55' || v_tel) and status::text not in ('convertido', 'perdido')
     order by created_at desc limit 1;
  end if;

  -- Responsável: o do lead/cliente, senão o primeiro administrador ativo.
  select coalesce(
    (select responsavel_id from public.leads where id = v_lead),
    (select responsavel_id from public.clientes where id = v_cliente),
    (select id from public.profiles where role::text = 'admin' and ativo and aprovado order by created_at limit 1)
  ) into v_resp;
  if v_resp is null then
    raise exception 'Nenhum responsável disponível para o agendamento.';
  end if;

  if v_cliente is null and v_lead is null and v_tel is not null and length(v_tel) >= 10 then
    insert into public.leads (nome, telefone, email, tipo_interesse, origem_lead, status, observacoes, responsavel_id)
    values (coalesce(nullif(trim(p_nome), ''), 'Contato do Cal.com'), v_tel, nullif(trim(p_email), ''),
            'financiamento', 'site', 'novo', 'Agendou pelo link do Cal.com. Confirme o assunto no atendimento.', v_resp)
    returning id into v_lead;
  end if;

  insert into public.compromissos (titulo, categoria, inicio, fim, local, observacoes, status, prioridade,
                                   cliente_id, lead_id, responsavel_id, criado_por)
  values (coalesce(nullif(trim(p_titulo), ''), 'Atendimento agendado'), 'atendimento_agendado', p_inicio, p_fim,
          nullif(trim(p_local), ''),
          concat_ws(chr(10), 'Agendado pelo cliente no Cal.com.', nullif(trim(p_observacoes), ''),
                    case when v_tel is null or length(v_tel) < 10 then 'Sem telefone no agendamento: confirmar por outro meio.' end),
          'a_confirmar', 'media', v_cliente, case when v_cliente is null then v_lead end, v_resp, v_resp)
  returning id into v_comp;

  insert into public.agendamentos_externos (uid, compromisso_id, ultimo_evento) values (p_uid, v_comp, p_evento)
  on conflict (provedor, uid) do update set compromisso_id = excluded.compromisso_id, ultimo_evento = excluded.ultimo_evento, atualizado_em = now();

  return jsonb_build_object('criado', true, 'compromisso_id', v_comp, 'lead_id', v_lead, 'cliente_id', v_cliente);
end;
$$;

-- Só o servidor (service_role) chama; nem anon nem usuários logados.
revoke execute on function public.fn_receber_agendamento(text, text, text, text, timestamptz, timestamptz, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_receber_agendamento(text, text, text, text, timestamptz, timestamptz, text, text, text, text, text) to service_role;

commit;

select to_regclass('public.agendamentos_externos') is not null as tabela,
       to_regprocedure('public.fn_receber_agendamento(text,text,text,text,timestamptz,timestamptz,text,text,text,text,text)') is not null as funcao;
