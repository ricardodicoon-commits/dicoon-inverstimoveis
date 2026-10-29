// Edge Function calcom-agenda: a Secretária sugere horários livres do Cal.com e agenda pelo CRM.
// Quem chama é o CRM, com o login da pessoa (verificação de JWT LIGADA). Só equipe ativa ou admin.
// O agendamento criado aqui volta pelo webhook (calcom-webhook) e entra na Agenda com o lembrete.
// Segredos: CALCOM_API_KEY (painel da Supabase); SUPABASE_URL e SUPABASE_ANON_KEY vêm do Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { emailValido, escolherSugestoes, listarHorarios, mensagemSugestao, telefoneInternacional } from './logica.ts'

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

async function cal(caminho: string, versao: string, init: RequestInit = {}) {
  const r = await fetch(`${CAL}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${Deno.env.get('CALCOM_API_KEY') ?? ''}`, 'cal-api-version': versao, 'Content-Type': 'application/json' },
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.status !== 'success') throw new Error(j?.error?.message ?? `Cal.com respondeu ${r.status}`)
  return j.data
}

// Tipos de reunião oferecidos: ativos e não secretos.
async function tipos() {
  const lista = (await cal('/event-types', '2024-06-14')) as { id: number; title: string; slug: string; lengthInMinutes: number; hidden?: boolean }[]
  return lista.filter((t) => !t.hidden && t.slug !== 'secret').map((t) => ({ id: t.id, titulo: t.title, minutos: t.lengthInMinutes }))
}

Deno.serve(async (req) => {
  const h = cabecalhos(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: h })
  if (req.method !== 'POST') return responder(405, { erro: 'use POST' })

  // Banco com o login de quem chamou: as regras de acesso (RLS) valem para tudo que for lido.
  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const [equipe, admin] = await Promise.all([banco.rpc('fn_equipe_ativa'), banco.rpc('fn_is_admin')])
  if (!equipe.data && !admin.data) return responder(403, { erro: 'Você não tem permissão para agendar.' })

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return responder(400, { erro: 'Pedido inválido.' })
  }

  try {
    // Remarcar / cancelar um compromisso que veio do Cal.com: feito NO Cal.com (o cliente é avisado);
    // o webhook atualiza a Agenda. Só quem pode editar o compromisso (a regra do banco decide).
    if (corpo.acao === 'remarcar' || corpo.acao === 'cancelar') {
      const { data: c } = await banco
        .from('compromissos')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', String(corpo.compromisso_id ?? ''))
        .select('id, calcom_uid, inicio')
        .maybeSingle()
      if (!c) return responder(403, { erro: 'Compromisso não encontrado ou você não pode alterá-lo.' })
      const uid = (c as { calcom_uid: string | null }).calcom_uid
      if (!uid) return responder(400, { erro: 'Este compromisso não veio do Cal.com.' })
      const motivo = String(corpo.motivo ?? '').trim().slice(0, 300) || 'Alterado pela equipe da Dicoon Invest'
      if (corpo.acao === 'cancelar') {
        await cal(`/bookings/${uid}/cancel`, '2024-08-13', { method: 'POST', body: JSON.stringify({ cancellationReason: motivo }) })
        return responder(200, { ok: true })
      }
      const inicio = String(corpo.inicio ?? '')
      if (Number.isNaN(new Date(inicio).getTime()) || new Date(inicio).getTime() < Date.now()) return responder(400, { erro: 'Horário inválido.' })
      await cal(`/bookings/${uid}/reschedule`, '2024-08-13', {
        method: 'POST',
        body: JSON.stringify({ start: new Date(inicio).toISOString(), reschedulingReason: motivo }),
      })
      return responder(200, { ok: true })
    }

    const permitidos = await tipos()
    if (corpo.acao === 'tipos') return responder(200, { tipos: permitidos })

    const tipo = permitidos.find((t) => t.id === Number(corpo.eventTypeId))
    if (!tipo) return responder(400, { erro: 'Tipo de reunião inválido.' })

    if (corpo.acao === 'horarios') {
      const agora = new Date()
      const fim = new Date(agora.getTime() + 10 * 86_400_000)
      const q = new URLSearchParams({ eventTypeId: String(tipo.id), start: agora.toISOString(), end: fim.toISOString(), timeZone: 'America/Sao_Paulo' })
      const porDia = await cal(`/slots?${q}`, '2024-09-04')
      // Sugestões a partir de 2 h para dar tempo de o cliente responder.
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
      if (!contato) return responder(404, { erro: 'Contato não encontrado ou sem permissão.' })
      const c = contato as { nome?: string; nome_completo?: string; telefone: string | null }
      const telefone = telefoneInternacional(c.telefone)
      if (!telefone) return responder(400, { erro: 'O cadastro não tem WhatsApp válido.' })
      const nome = c.nome_completo ?? c.nome ?? 'Cliente'

      const notas = String(corpo.notas ?? '').trim().slice(0, 1000)
      const reserva = await cal('/bookings', '2024-08-13', {
        method: 'POST',
        body: JSON.stringify({
          start: new Date(inicio).toISOString(),
          eventTypeId: tipo.id,
          attendee: { name: nome, email, timeZone: 'America/Sao_Paulo', phoneNumber: telefone, language: 'pt' },
          bookingFieldsResponses: { attendeePhoneNumber: telefone, ...(notas ? { notes: notas } : {}) },
          metadata: { origem: 'crm-secretaria' },
        }),
      })
      // Guarda o e-mail no cadastro, se estiver vazio (se a regra de acesso não deixar, segue sem).
      await banco.from(tabela).update({ email }).eq('id', id).is('email', null)
      return responder(200, { ok: true, uid: (reserva as { uid?: string }).uid ?? null })
    }

    return responder(400, { erro: 'Ação desconhecida.' })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (/no longer available|not available|already has booking|busy|outside|out of bounds|no available users/i.test(msg)) {
      return responder(409, { erro: 'Esse horário não está livre no Cal.com (ocupado ou fora da sua disponibilidade). Use "Ver horários livres" e escolha outro.' })
    }
    return responder(502, { erro: 'O Cal.com não respondeu como esperado. Tente de novo.', detalhe: msg.slice(0, 200) })
  }
})
