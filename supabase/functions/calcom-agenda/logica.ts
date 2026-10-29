// Lógica pura da função calcom-agenda (sugestão de horários e dados do agendamento). Testada com node --test.

export interface Horario {
  start: string
}

const FUSO = 'America/Sao_Paulo'
const dia = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(iso))
const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const diaSemana = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(iso)).replace('.', '')

// "qui, 30/10 às 09:00"
export function rotuloHorario(iso: string) {
  return `${diaSemana(iso)} às ${hora(iso)}`
}

// Achata o retorno do Cal.com ({ "2026-10-30": [{start}] }) em ordem, só a partir de "aPartirDe".
export function listarHorarios(porDia: Record<string, Horario[]>, aPartirDe: Date): string[] {
  return Object.keys(porDia)
    .sort()
    .flatMap((d) => (porDia[d] ?? []).map((h) => h.start))
    .filter((s) => new Date(s).getTime() >= aPartirDe.getTime())
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
}

// Até "quantidade" sugestões espalhadas: o primeiro horário de cada dia; se faltar, outros horários
// do mesmo dia com pelo menos 2 h de distância das sugestões já escolhidas.
export function escolherSugestoes(horarios: string[], quantidade = 3): string[] {
  const escolhidos: string[] = []
  const diasUsados = new Set<string>()
  for (const h of horarios) {
    if (escolhidos.length >= quantidade) break
    if (!diasUsados.has(dia(h))) {
      escolhidos.push(h)
      diasUsados.add(dia(h))
    }
  }
  for (const h of horarios) {
    if (escolhidos.length >= quantidade) break
    if (escolhidos.includes(h)) continue
    if (escolhidos.every((e) => Math.abs(new Date(e).getTime() - new Date(h).getTime()) >= 2 * 3600_000)) escolhidos.push(h)
  }
  return escolhidos.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
}

// Mensagem para o WhatsApp: opções numeradas e o pedido de e-mail (obrigatório para confirmar).
export function mensagemSugestao(nome: string | null, sugestoes: string[], duracaoMin: number) {
  const primeiro = (nome ?? '').trim().split(/\s+/)[0]
  const linhas = sugestoes.map((s, i) => `${i + 1} - ${rotuloHorario(s)}`).join('\n')
  return (
    `Olá${primeiro ? `, ${primeiro}` : ''}! Tenho estes horários para a sua reunião de ${duracaoMin} minutos com a Dicoon Invest (videochamada):\n` +
    `${linhas}\n` +
    `Responda com o número da opção que preferir e me informe o seu e-mail, para enviarmos a confirmação e o link da reunião.`
  )
}

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

// Telefone do cadastro (DDD + número, com ou sem 55) no formato internacional que o Cal.com exige.
export function telefoneInternacional(digitos: string | null): string | null {
  const d = (digitos ?? '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `+55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return `+${d}`
  return null
}
