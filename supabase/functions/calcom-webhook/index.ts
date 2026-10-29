// Edge Function: recebe os avisos do Cal.com e cria/atualiza o compromisso na Agenda da Secretária.
// Segredos (nunca no código): CALCOM_WEBHOOK_SECRET; SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY vêm do próprio Supabase.
// Publicar sem exigir login (quem chama é o Cal.com; a segurança é a assinatura): --no-verify-jwt.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { assinaturaValida, extrair } from './logica.ts'

const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const responder = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder(405, { erro: 'use POST' })

  const corpo = await req.text()
  if (!(await assinaturaValida(corpo, req.headers.get('x-cal-signature-256'), Deno.env.get('CALCOM_WEBHOOK_SECRET') ?? ''))) {
    return responder(401, { erro: 'assinatura inválida' })
  }

  let aviso: Record<string, unknown>
  try {
    aviso = JSON.parse(corpo)
  } catch {
    return responder(400, { erro: 'corpo inválido' })
  }

  const dados = extrair(aviso)
  if (!dados) return responder(200, { ignorado: true, evento: aviso.triggerEvent ?? null }) // ex.: PING de teste

  const { data, error } = await banco.rpc('fn_receber_agendamento', dados)
  if (error) {
    // Registro de falha sem dados pessoais (só o identificador do agendamento).
    await banco.from('integracao_falhas').insert({ origem: 'calcom', detalhe: `${dados.p_evento}: ${error.message}`.slice(0, 500), id_externo: dados.p_uid })
    return responder(500, { erro: 'falha ao registrar o agendamento' })
  }
  return responder(200, { ok: true, resultado: data })
})
