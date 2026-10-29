// Lógica pura do webhook do Cal.com (roda igual no Deno do Supabase e no Node dos testes).

export interface Agendamento {
  p_evento: string
  p_uid: string
  p_uid_anterior: string | null
  p_titulo: string | null
  p_inicio: string
  p_fim: string
  p_nome: string | null
  p_telefone: string | null
  p_email: string | null
  p_local: string | null
  p_observacoes: string | null
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

// O Cal.com assina o corpo com HMAC-SHA256 (cabeçalho x-cal-signature-256, em hexadecimal).
export async function assinaturaValida(corpo: string, assinatura: string | null, segredo: string): Promise<boolean> {
  if (!assinatura || !segredo) return false
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const esperado = hex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)))
  const recebido = assinatura.trim().toLowerCase().replace(/^sha256=/, '')
  if (recebido.length !== esperado.length) return false
  let diferenca = 0
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i)
  return diferenca === 0
}

type Json = Record<string, unknown>
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const resposta = (r: unknown) => (r && typeof r === 'object' ? texto((r as Json).value) : texto(r))

// "integrations:daily" e parecidos viram um texto legível; endereço ou link ficam como vieram.
function local(v: unknown): string | null {
  const t = texto(v)
  if (!t) return null
  if (t.startsWith('integrations:')) return t.includes('google') ? 'Google Meet' : t.includes('zoom') ? 'Zoom' : 'Videochamada (Cal.com)'
  return t
}

export const EVENTOS = ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED']

// Converte o aviso do Cal.com nos parâmetros de fn_receber_agendamento. Devolve null se não for de agendamento.
export function extrair(aviso: Json): Agendamento | null {
  const evento = texto(aviso.triggerEvent)
  const p = (aviso.payload ?? {}) as Json
  if (!evento || !EVENTOS.includes(evento)) return null
  const uid = texto(p.uid)
  const inicio = texto(p.startTime)
  const fim = texto(p.endTime)
  if (!uid || !inicio || !fim) return null
  const respostas = (p.responses ?? {}) as Json
  const participante = (Array.isArray(p.attendees) ? p.attendees[0] : null) as Json | null
  return {
    p_evento: evento,
    p_uid: uid,
    p_uid_anterior: texto(p.rescheduleUid) ?? texto(p.fromReschedule),
    p_titulo: texto(p.title) ?? texto(p.eventTitle),
    p_inicio: inicio,
    p_fim: fim,
    p_nome: resposta(respostas.name) ?? texto(participante?.name),
    p_telefone: resposta(respostas.attendeePhoneNumber) ?? texto(participante?.phoneNumber) ?? texto(p.smsReminderNumber),
    p_email: resposta(respostas.email) ?? texto(participante?.email),
    p_local: local(p.location),
    p_observacoes: resposta(respostas.notes) ?? texto(p.additionalNotes),
  }
}
