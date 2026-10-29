// Edge Function calcom-agenda: SINCRONIA TOTAL da Agenda com o Cal.com.
// Toda ação do CRM com cliente (agendar, remarcar, cancelar, excluir) é feita NO Cal.com — que envia os
// e-mails ao cliente — e o resultado é gravado NA HORA no nosso banco (fn_receber_agendamento, a mesma
// do webhook; quando o webhook chegar depois, é reconhecido como repetido e não duplica).
// Quem chama é o CRM com o login da pessoa (JWT ligado). Só equipe ativa ou admin; o que cada um pode
// alterar é decidido pelas regras do banco (RLS) usando o login de quem chamou.
// Segredos: CALCOM_API_KEY; SUPABASE_URL, SUPABASE_ANON_KEY e a chave de servidor vêm do Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  emailValido,
  escolherSugestoes,
  listarHorarios,
  localParaCalcom,
  mensagemSugestao,
  telefoneInternacional,
  tituloEmPortugues,
  type Local,
} from './logica.ts'

const CAL = 'https://api.cal.com/v2'
const ORIGENS = ['https://www.dicooninvest.com.br', 'https://dicooninvest.com.br', 'http://localhost:4321', 'http://localhost:4322']

function cabecalhos(origem: string | null) {
  return {
    'Access-Control-Allow-Origin': origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

class ErroCal extends Error {
  constructor(msg: string, public status: number) {
    super(msg)
  }
}

async function cal(caminho: string, versao: string, init: RequestInit = {}) {
  const r = await fetch(`${CAL}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${Deno.env.get('CALCOM_API_KEY') ?? ''}`, 'cal-api-version': versao, 'Content-Type': 'application/json' },
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.status !== 'success') throw new ErroCal(j?.error?.message ?? `Cal.com respondeu ${r.status}`, r.status)
  return j.data
}

async function tipos() {
  const lista = (await cal('/event-types', '2024-06-14')) as { id: number; title: string; slug: string; lengthInMinutes: number; hidden?: boolean }[]
  return lista.filter((t) => !t.hidden && t.slug !== 'secret').map((t) => ({ id: t.id, titulo: t.title, minutos: t.lengthInMinutes }))
}

interface Reserva {
  uid: string
  title?: string
  start: string
  end: string
  location?: string
  attendees?: { name?: string; email?: string; phoneNumber?: string }[]
}

// Banco com a chave de servidor: só para gravar o resultado de uma ação que JÁ passou pelas regras.
const servidor = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '', {
  auth: { persistSession: false },
})

async function gravar(evento: string, r: Reserva, uidAnterior: string | null, telefone: string | null, notas: string | null, localTexto: string | null) {
  const a = r.attendees?.[0]
  const { data, error } = await servidor.rpc('fn_receber_agendamento', {
    p_evento: evento,
    p_uid: r.uid,
    p_uid_anterior: uidAnterior,
    p_titulo: tituloEmPortugues(r.title ?? null, a?.name ?? null),
    p_inicio: r.start,
    p_fim: r.end,
    p_nome: a?.name ?? null,
    p_telefone: telefone ?? a?.phoneNumber ?? null,
    p_email: a?.email ?? null,
    p_local: localTexto,
    p_observacoes: notas,
  })
  if (error) throw new Error(`Agendado no Cal.com, mas não gravou na Agenda: ${error.message}`)
  return data as { compromisso_id?: string }
}

Deno.serve(async (req) => {
  const h = cabecalhos(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: h })
  if (req.method !== 'POST') return responder(405, { erro: 'use POST' })

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const [equipe, admin, veTudo, eu] = await Promise.all([banco.rpc('fn_equipe_ativa'), banco.rpc('fn_is_admin'), banco.rpc('fn_ve_tudo'), banco.auth.getUser()])
  if (!equipe.data && !admin.data) return responder(403, { erro: 'Você não tem permissão para agendar.' })
  const meuId = eu.data.user?.id ?? null

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return responder(400, { erro: 'Pedido inválido.' })
  }

  try {
    // ---- Ações sobre um compromisso que já veio do Cal.com ----------------------------------------
    if (corpo.acao === 'remarcar' || corpo.acao === 'cancelar' || corpo.acao === 'excluir') {
      // "Atualização vazia" com o login da pessoa: se a regra do banco não deixar alterar, não volta nada.
      const { data: c } = await banco
        .from('compromissos')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', String(corpo.compromisso_id ?? ''))
        .select('id, calcom_uid, status')
        .maybeSingle()
      if (!c) return responder(403, { erro: 'Compromisso não encontrado ou você não pode alterá-lo.' })
      const comp = c as { id: string; calcom_uid: string | null; status: string }
      const motivo = String(corpo.motivo ?? '').trim().slice(0, 300) || 'Alterado pela equipe da Dicoon Invest'
      const ativo = !['cancelado', 'realizado', 'nao_compareceu', 'follow_up_pendente'].includes(comp.status)

      if (corpo.acao === 'remarcar') {
        if (!comp.calcom_uid) return responder(400, { erro: 'Este compromisso não veio do Cal.com.' })
        const inicio = String(corpo.inicio ?? '')
        if (Number.isNaN(new Date(inicio).getTime()) || new Date(inicio).getTime() < Date.now()) return responder(400, { erro: 'Horário inválido.' })
        const nova = (await cal(`/bookings/${comp.calcom_uid}/reschedule`, '2024-08-13', {
          method: 'POST',
          body: JSON.stringify({ start: new Date(inicio).toISOString(), reschedulingReason: motivo }),
        })) as Reserva
        await gravar('BOOKING_RESCHEDULED', nova, comp.calcom_uid, null, null, null)
        return responder(200, { ok: true })
      }

      // cancelar / excluir: cancela no Cal.com (o cliente recebe o e-mail de cancelamento) e grava.
      if (comp.calcom_uid && ativo) {
        await cal(`/bookings/${comp.calcom_uid}/cancel`, '2024-08-13', { method: 'POST', body: JSON.stringify({ cancellationReason: motivo }) })
        await servidor.rpc('fn_receber_agendamento', {
          p_evento: 'BOOKING_CANCELLED', p_uid: comp.calcom_uid, p_uid_anterior: null, p_titulo: null,
          p_inicio: new Date().toISOString(), p_fim: new Date().toISOString(), p_nome: null, p_telefone: null, p_email: null, p_local: null,
        })
      } else if (corpo.acao === 'cancelar') {
        await banco.from('compromissos').update({ status: 'cancelado' }).eq('id', comp.id)
      }
      if (corpo.acao === 'excluir') {
        // Exclui com o login da pessoa (a regra do banco decide). Se não puder, fica cancelado.
        const { error } = await banco.from('compromissos').delete().eq('id', comp.id)
        if (error) return responder(200, { ok: true, aviso: 'Cancelado no Cal.com; você não tem permissão para excluir, ficou como cancelado.' })
      }
      return responder(200, { ok: true })
    }

    // ---- Tipos, horários livres e novo agendamento -------------------------------------------------
    const permitidos = await tipos()
    if (corpo.acao === 'tipos') return responder(200, { tipos: permitidos })

    const tipo = permitidos.find((t) => t.id === Number(corpo.eventTypeId))
    if (!tipo) return responder(400, { erro: 'Tipo de reunião inválido.' })

    if (corpo.acao === 'horarios') {
      const agora = new Date()
      const dia = typeof corpo.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(corpo.dia) ? corpo.dia : null
      // Com "dia": só os horários livres daquele dia (o Cal.com já aplica a antecedência mínima).
      const ini = dia ? `${dia}T00:00:00-03:00` : agora.toISOString()
      const fim = dia ? `${dia}T23:59:59-03:00` : new Date(agora.getTime() + 10 * 86_400_000).toISOString()
      const q = new URLSearchParams({ eventTypeId: String(tipo.id), start: ini, end: fim, timeZone: 'America/Sao_Paulo' })
      const porDia = await cal(`/slots?${q}`, '2024-09-04')
      if (dia) return responder(200, { livres: listarHorarios(porDia, agora) })
      const livres = listarHorarios(porDia, new Date(agora.getTime() + 2 * 3600_000))
      const sugestoes = escolherSugestoes(livres, 3)
      return responder(200, { sugestoes, livres: livres.slice(0, 60), mensagem: mensagemSugestao(String(corpo.nome ?? ''), sugestoes, tipo.minutos) })
    }

    if (corpo.acao === 'agendar') {
      const email = String(corpo.email ?? '').trim()
      if (!emailValido(email)) return responder(400, { erro: 'Informe um e-mail válido do cliente (obrigatório).' })
      const inicio = String(corpo.inicio ?? '')
      if (Number.isNaN(new Date(inicio).getTime()) || new Date(inicio).getTime() < Date.now()) return responder(400, { erro: 'Horário inválido.' })

      // Sigilo: nome e telefone vêm do PRÓPRIO cadastro (lead ou cliente) que a pessoa pode ver.
      const tabela = corpo.cliente_id ? 'clientes' : 'leads'
      const id = String(corpo.cliente_id ?? corpo.lead_id ?? '')
      const { data: contato } = await banco.from(tabela).select(tabela === 'clientes' ? 'nome_completo, telefone' : 'nome, telefone').eq('id', id).maybeSingle()
      if (!contato) return responder(404, { erro: 'Cliente não encontrado ou sem permissão.' })
      const ct = contato as { nome?: string; nome_completo?: string; telefone: string | null }
      const telefone = telefoneInternacional(ct.telefone)
      if (!telefone) return responder(400, { erro: 'O cadastro do cliente não tem WhatsApp válido.' })
      const nome = ct.nome_completo ?? ct.nome ?? 'Cliente'

      const local = (corpo.local ?? { tipo: 'video' }) as Local
      if (local.tipo === 'cliente' && !String(local.endereco ?? '').trim()) return responder(400, { erro: 'Informe o endereço do local do cliente.' })
      const { calcom: localCal, texto: localTexto } = localParaCalcom(local)
      const notas = String(corpo.notas ?? '').trim().slice(0, 1000)

      const base = {
        start: new Date(inicio).toISOString(),
        eventTypeId: tipo.id,
        attendee: { name: nome, email, timeZone: 'America/Sao_Paulo', phoneNumber: telefone, language: 'pt' },
        bookingFieldsResponses: { attendeePhoneNumber: telefone, ...(notas ? { notes: notas } : {}) },
        metadata: { origem: 'crm-secretaria' },
      }
      let reserva: Reserva
      try {
        reserva = (await cal('/bookings', '2024-08-13', { method: 'POST', body: JSON.stringify({ ...base, location: localCal }) })) as Reserva
      } catch (e) {
        // Se o Cal.com não aceitar o formato do local, agenda sem ele e leva o local nas observações.
        if (!(e instanceof ErroCal) || e.status !== 400 || !/location/i.test(e.message)) throw e
        const notasComLocal = [notas, `Local: ${localTexto}`].filter(Boolean).join('\n')
        reserva = (await cal('/bookings', '2024-08-13', {
          method: 'POST',
          body: JSON.stringify({ ...base, bookingFieldsResponses: { attendeePhoneNumber: telefone, notes: notasComLocal } }),
        })) as Reserva
      }

      // Grava na hora e completa com os dados do formulário.
      const r = await gravar('BOOKING_CREATED', reserva, null, telefone, notas || null, localTexto)
      if (r.compromisso_id) {
        const extras = (corpo.extras ?? {}) as Record<string, unknown>
        let negociacao: string | null = null
        if (extras.vincular_negociacao === true) {
          const { data: n } = await banco
            .from('negociacoes')
            .select('id')
            .eq(tabela === 'clientes' ? 'cliente_id' : 'lead_id', id)
            .neq('etapa', 'concluido')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          negociacao = (n as { id: string } | null)?.id ?? null
        }
        const responsavel = veTudo.data && typeof extras.responsavel_id === 'string' ? extras.responsavel_id : meuId
        const lembrete = Number(extras.lembrete_minutos)
        await servidor
          .from('compromissos')
          .update({
            ...(typeof extras.titulo === 'string' && extras.titulo.trim() ? { titulo: extras.titulo.trim().slice(0, 200) } : {}),
            ...(typeof extras.categoria === 'string' ? { categoria: extras.categoria } : {}),
            ...(typeof extras.prioridade === 'string' ? { prioridade: extras.prioridade } : {}),
            ...(Number.isFinite(lembrete) ? { lembrete_minutos: lembrete } : {}),
            participantes: typeof extras.participantes === 'string' ? extras.participantes || null : null,
            objetivo: typeof extras.objetivo === 'string' ? extras.objetivo || null : null,
            local: localTexto,
            endereco: local.tipo === 'video' ? null : localTexto,
            ...(negociacao ? { negociacao_id: negociacao } : {}),
            ...(responsavel ? { responsavel_id: responsavel, criado_por: meuId ?? responsavel } : {}),
          })
          .eq('id', r.compromisso_id)
      }
      await banco.from(tabela).update({ email }).eq('id', id).is('email', null)
      return responder(200, { ok: true, uid: reserva.uid, compromisso_id: r.compromisso_id ?? null })
    }

    return responder(400, { erro: 'Ação desconhecida.' })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (/no longer available|not available|already has booking|busy|outside|out of bounds|no available users|minimum|notice/i.test(msg)) {
      return responder(409, { erro: 'Esse horário não está mais livre no Cal.com. Escolha outro da lista de horários livres.' })
    }
    if (msg.startsWith('Agendado no Cal.com')) return responder(500, { erro: msg })
    return responder(502, { erro: 'O Cal.com não respondeu como esperado. Tente de novo.', detalhe: msg.slice(0, 200) })
  }
})
