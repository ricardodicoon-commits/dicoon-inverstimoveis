import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, useAoVivo } from '../dados'
import {
  categoriasCompromisso,
  prioridades,
  rotulo,
  statusAtivosCompromisso,
  statusCompromisso,
  tomStatusCompromisso,
  type Compromisso,
} from '../tipos'
import { CalendarDays, CalendarPlus, List } from 'lucide-react'
import { chamarCalcom } from '../AgendarCalcom'
import { Abas, Aviso, Botao, Cabecalho, Campo, Carregando, Etiqueta, Modal, Vazio, estiloCampo } from '../ui'

// Horários sempre no fuso de Brasília (sem horário de verão desde 2019: -03:00).
const FUSO = 'America/Sao_Paulo'
const OFFSET = '-03:00'
const diaSP = (iso: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(iso))
const horaSP = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const dataLonga = (dia: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(`${dia}T00:00:00Z`))
const paraISO = (dia: string, hora: string) => `${dia}T${hora}:00${OFFSET}`
function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function segundaDaSemana(dia: string) {
  const semana = new Date(`${dia}T00:00:00Z`).getUTCDay() // 0 = domingo
  return somarDias(dia, semana === 0 ? -6 : 1 - semana)
}

const corStatus: Record<string, string> = {
  a_confirmar: 'border-amber-500/50',
  aguardando_confirmacao: 'border-amber-500/50',
  confirmado: 'border-green-500/50',
  solicitou_remarcacao: 'border-orange-500/60',
  cancelamento_solicitado: 'border-red-500/50',
  reagendado: 'border-sky-500/50',
  realizado: 'border-line opacity-70',
  nao_compareceu: 'border-red-500/40 opacity-70',
  follow_up_pendente: 'border-orange-500/60',
  cancelado: 'border-red-500/40 opacity-60',
}
const encerrados = ['cancelado', 'realizado', 'nao_compareceu', 'follow_up_pendente']

const SELECT = '*, responsavel:profiles!compromissos_responsavel_id_fkey(nome, email)'

export function Agenda() {
  const { perfil, ehAdmin, ehSecretaria } = useAuth()
  const [modo, setModo] = useState<'semana' | 'lista'>('semana')
  const [semana, setSemana] = useState(() => segundaDaSemana(diaSP(new Date())))
  const [historico, setHistorico] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [editando, setEditando] = useState<Compromisso | 'novo' | null>(null)
  const [abrindo, setAbrindo] = useState<Compromisso | null>(null)
  const hoje = diaSP(new Date())

  // Semana: de segunda a domingo. Lista: próximos (ou histórico) em ordem.
  const chave = ['compromissos', modo, semana, historico]
  const { data, isPending, error } = useQuery({
    queryKey: chave,
    queryFn: async () => {
      let q = supabase.from('compromissos').select(SELECT)
      if (modo === 'semana') {
        q = q.gte('inicio', paraISO(semana, '00:00')).lt('inicio', paraISO(somarDias(semana, 7), '00:00')).order('inicio')
      } else if (historico) {
        q = q.lt('inicio', paraISO(hoje, '00:00')).order('inicio', { ascending: false }).limit(200)
      } else {
        q = q.gte('inicio', paraISO(hoje, '00:00')).order('inicio').limit(200)
      }
      const { data, error } = await q
      if (error) throw error
      return data as Compromisso[]
    },
  })
  useAoVivo('compromissos', ['compromissos'])

  const lista = (data ?? []).filter((c) => !filtroStatus || c.status === filtroStatus)
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(semana, i))
  const podeEditar = (c: Compromisso) =>
    ehAdmin || c.criado_por === perfil?.id || (c.responsavel_id === perfil?.id && !ehSecretaria)

  return (
    <>
      <Cabecalho titulo="Agenda">
        <Botao onClick={() => setEditando('novo')}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarPlus className="h-4 w-4" /> Novo compromisso
          </span>
        </Botao>
      </Cabecalho>

      <Abas
        abas={[
          { valor: 'semana', rotulo: 'Semana', icone: CalendarDays },
          { valor: 'lista', rotulo: 'Lista', icone: List },
        ]}
        ativa={modo}
        aoMudar={setModo}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {modo === 'semana' ? (
          <>
            <Botao variante="secundario" onClick={() => setSemana(somarDias(semana, -7))} aria-label="Semana anterior">
              ←
            </Botao>
            <Botao variante="secundario" onClick={() => setSemana(segundaDaSemana(hoje))}>
              Hoje
            </Botao>
            <Botao variante="secundario" onClick={() => setSemana(somarDias(semana, 7))} aria-label="Próxima semana">
              →
            </Botao>
            <span className="text-sm text-muted">
              {dataLonga(semana)} a {dataLonga(somarDias(semana, 6))}
            </span>
          </>
        ) : (
          <>
            <Botao variante="secundario" onClick={() => setHistorico(!historico)}>
              {historico ? 'Ver próximos' : 'Ver histórico'}
            </Botao>
            <select className={`${estiloCampo} w-auto py-2`} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} aria-label="Filtrar por situação">
              <option value="">Todas as situações</option>
              {statusCompromisso.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(error)}</Aviso>
        </div>
      )}

      {isPending ? (
        <Carregando />
      ) : modo === 'semana' ? (
        <div className="grid gap-3 md:grid-cols-7">
          {dias.map((dia) => {
            const doDia = lista.filter((c) => diaSP(c.inicio) === dia)
            return (
              <section key={dia} className={`min-h-28 rounded-2xl border bg-coal p-3 ${dia === hoje ? 'border-gold/60' : 'border-line'}`}>
                <p className={`mb-2 text-xs font-bold uppercase tracking-wider ${dia === hoje ? 'text-gold' : 'text-muted'}`}>{dataLonga(dia)}</p>
                <div className="space-y-2">
                  {doDia.map((c) => (
                    <CartaoCompromisso key={c.id} c={c} aoAbrir={() => setAbrindo(c)} />
                  ))}
                  {!doDia.length && <p className="text-xs text-muted/60">—</p>}
                </div>
              </section>
            )
          })}
        </div>
      ) : !lista.length ? (
        <Vazio>{historico ? 'Nenhum compromisso anterior.' : 'Nenhum compromisso marcado daqui para a frente.'}</Vazio>
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <button onClick={() => setAbrindo(c)} className={`w-full rounded-xl border-l-4 bg-coal p-4 text-left hover:bg-white/5 ${corStatus[c.status] ?? 'border-line'}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-white">{c.titulo}</p>
                  <p className="text-xs text-muted">
                    {dataLonga(diaSP(c.inicio))} · {horaSP(c.inicio)}–{horaSP(c.fim)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <Etiqueta tom={tomStatusCompromisso[c.status] ?? 'cinza'}>{rotulo(statusCompromisso, c.status)}</Etiqueta>
                  <Etiqueta tom="cinza">{rotulo(categoriasCompromisso, c.categoria)}</Etiqueta>
                  {c.local && <span>{c.local}</span>}
                  {(ehAdmin || ehSecretaria) && c.responsavel && <span>· {c.responsavel.nome || c.responsavel.email}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abrindo && (
        <Detalhe
          c={abrindo}
          podeEditar={podeEditar(abrindo)}
          aoFechar={() => setAbrindo(null)}
          aoEditar={() => {
            setEditando(abrindo)
            setAbrindo(null)
          }}
        />
      )}
      {editando && (
        <FormCompromisso
          compromisso={editando === 'novo' ? null : editando}
          escolheResponsavel={ehAdmin || ehSecretaria}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  )
}

function CartaoCompromisso({ c, aoAbrir }: { c: Compromisso; aoAbrir: () => void }) {
  return (
    <button onClick={aoAbrir} className={`w-full rounded-lg border-l-4 bg-ink p-2 text-left hover:bg-white/5 ${corStatus[c.status] ?? 'border-line'}`}>
      <p className="text-xs font-semibold text-gold">
        {horaSP(c.inicio)}–{horaSP(c.fim)}
      </p>
      <p className="line-clamp-2 text-sm font-semibold text-white">{c.titulo}</p>
      <div className="mt-1">
        <Etiqueta tom={tomStatusCompromisso[c.status] ?? 'cinza'}>{rotulo(statusCompromisso, c.status)}</Etiqueta>
      </div>
    </button>
  )
}

// Preparação da reunião: objetivo, participantes, local, tarefas ligadas e histórico.
function Detalhe({ c, podeEditar, aoFechar, aoEditar }: { c: Compromisso; podeEditar: boolean; aoFechar: () => void; aoEditar: () => void }) {
  const qc = useQueryClient()
  const [resultado, setResultado] = useState(c.resultado ?? '')

  const extras = useQuery({
    queryKey: ['compromisso-extras', c.id],
    queryFn: async () => {
      const [tarefas, historico] = await Promise.all([
        supabase.from('tarefas').select('id, titulo, status').eq('compromisso_id', c.id),
        supabase.from('compromissos_historico').select('*').eq('compromisso_id', c.id).order('alterado_em', { ascending: false }),
      ])
      if (tarefas.error) throw tarefas.error
      if (historico.error) throw historico.error
      return {
        tarefas: tarefas.data as { id: string; titulo: string; status: string }[],
        historico: historico.data as { id: string; inicio_anterior: string; inicio_novo: string; status_anterior: string; status_novo: string; alterado_em: string }[],
      }
    },
  })

  const mudar = useMutation({
    mutationFn: async (campos: Partial<Compromisso>) => {
      const { error } = await supabase.from('compromissos').update(campos).eq('id', c.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos'] })
      aoFechar()
    },
  })
  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('compromissos').delete().eq('id', c.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos'] })
      aoFechar()
    },
  })
  // Veio do Cal.com: cancelar é feito no Cal.com (o cliente é avisado); o webhook atualiza a Agenda.
  const cancelarCalcom = useMutation({
    mutationFn: () => chamarCalcom({ acao: 'cancelar', compromisso_id: c.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos'] })
      aoFechar()
    },
  })
  // Excluir agendamento do Cal.com: cancela lá (o cliente recebe o e-mail) e remove da Agenda.
  const excluirCalcom = useMutation({
    mutationFn: () => chamarCalcom({ acao: 'excluir', compromisso_id: c.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos'] })
      aoFechar()
    },
  })

  const ativo = !encerrados.includes(c.status)
  const linhas: [string, string | null][] = [
    ['Quando', `${dataLonga(diaSP(c.inicio))}, ${horaSP(c.inicio)} às ${horaSP(c.fim)}`],
    ['Situação', rotulo(statusCompromisso, c.status)],
    ['Categoria', rotulo(categoriasCompromisso, c.categoria)],
    ['Prioridade', rotulo(prioridades, c.prioridade)],
    ['Local', c.local],
    ['Endereço', c.endereco],
    ['Participantes', c.participantes],
    ['Objetivo', c.objetivo],
    ['Observações', c.observacoes],
    ['Responsável', c.responsavel ? c.responsavel.nome || c.responsavel.email : null],
  ]

  return (
    <Modal titulo={c.titulo} aoFechar={aoFechar}>
      {(mudar.error || excluir.error) && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(mudar.error || excluir.error)}</Aviso>
        </div>
      )}
      {(cancelarCalcom.error || excluirCalcom.error) && (
        <div className="mb-4">
          <Aviso>{((cancelarCalcom.error || excluirCalcom.error) as Error).message}</Aviso>
        </div>
      )}
      {c.calcom_uid && (
        <p className="mb-4 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">
          Sincronizado com o Cal.com: o cliente recebeu a confirmação por e-mail e recebe o lembrete 1 hora antes. Remarcar, cancelar e excluir avisam o cliente.
        </p>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {linhas
          .filter(([, v]) => v)
          .map(([r, v]) => (
            <div key={r} className={r === 'Objetivo' || r === 'Observações' ? 'sm:col-span-2' : ''}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{r}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-white">{v}</dd>
            </div>
          ))}
      </dl>

      {!!extras.data?.tarefas.length && (
        <div className="mt-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Tarefas ligadas</p>
          <ul className="space-y-1 text-sm text-white">
            {extras.data.tarefas.map((t) => (
              <li key={t.id}>
                {t.status === 'concluida' ? '✓ ' : '• '}
                {t.titulo}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!extras.data?.historico.length && (
        <div className="mt-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Histórico</p>
          <ul className="space-y-1 text-xs text-muted">
            {extras.data.historico.map((h) => (
              <li key={h.id}>
                {new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }).format(new Date(h.alterado_em))}:{' '}
                {h.inicio_anterior !== h.inicio_novo
                  ? `horário ${dataLonga(diaSP(h.inicio_anterior))} ${horaSP(h.inicio_anterior)} → ${dataLonga(diaSP(h.inicio_novo))} ${horaSP(h.inicio_novo)}`
                  : ''}
                {h.status_anterior !== h.status_novo
                  ? ` situação ${rotulo(statusCompromisso, h.status_anterior)} → ${rotulo(statusCompromisso, h.status_novo)}`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {podeEditar ? (
        <div className="mt-6 space-y-4 border-t border-line pt-4">
          {ativo && (
            <Campo rotulo="Resultado (ao marcar como realizado)">
              <textarea className={`${estiloCampo} min-h-16`} value={resultado} onChange={(e) => setResultado(e.target.value)} />
            </Campo>
          )}
          <div className="flex flex-wrap gap-2">
            {c.status !== 'confirmado' && ativo && (
              <Botao variante="secundario" onClick={() => mudar.mutate({ status: 'confirmado' })}>
                Confirmar
              </Botao>
            )}
            {ativo && (
              <Botao variante="secundario" onClick={() => mudar.mutate({ status: 'realizado', resultado: resultado || null })}>
                Marcar realizado
              </Botao>
            )}
            {ativo && <Botao onClick={aoEditar}>Editar / reagendar</Botao>}
            {ativo &&
              (c.calcom_uid ? (
                <Botao
                  variante="perigo"
                  disabled={cancelarCalcom.isPending}
                  onClick={() => confirm('Cancelar este agendamento no Cal.com? O cliente recebe o aviso de cancelamento por e-mail.') && cancelarCalcom.mutate()}
                >
                  {cancelarCalcom.isPending ? 'Cancelando…' : 'Cancelar (avisa o cliente)'}
                </Botao>
              ) : (
                <Botao
                  variante="perigo"
                  onClick={() => confirm('Cancelar este compromisso? Ele continua no histórico.') && mudar.mutate({ status: 'cancelado' })}
                >
                  Cancelar
                </Botao>
              ))}
            {c.calcom_uid ? (
              <Botao
                variante="perigo"
                disabled={excluirCalcom.isPending}
                onClick={() =>
                  confirm('Excluir este agendamento? Ele é cancelado no Cal.com (o cliente recebe o aviso por e-mail) e sai da Agenda. Não dá para desfazer.') &&
                  excluirCalcom.mutate()
                }
              >
                {excluirCalcom.isPending ? 'Excluindo…' : 'Excluir (cancela no Cal.com)'}
              </Botao>
            ) : (
              <Botao
                variante="perigo"
                onClick={() => confirm('Excluir este compromisso de vez? Esta ação não pode ser desfeita.') && excluir.mutate()}
              >
                Excluir
              </Botao>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">Somente o administrador ou quem criou pode alterar este compromisso.</p>
      )}
    </Modal>
  )
}

// Endereço do escritório (o mesmo cadastrado nos eventos do Cal.com).
const ENDERECO_ESCRITORIO = 'Rua Capistrano de Abreu, 163 - Sala 2 - Niterói, Canoas/RS'
type TipoLocal = 'escritorio' | 'cliente' | 'video'

function localInicial(c: Compromisso | null): TipoLocal {
  const t = `${c?.local ?? ''} ${c?.endereco ?? ''}`.toLowerCase()
  if (!c || t.includes('escritório') || t.includes('capistrano')) return 'escritorio'
  if (t.includes('videochamada') || t.includes('cal.com') || t.includes('meet') || t.includes('zoom')) return 'video'
  return c.endereco || c.local ? 'cliente' : 'escritorio'
}
const textoLocal = (tipo: TipoLocal, endereco: string) =>
  tipo === 'escritorio' ? `Escritório Dicoon Invest - ${ENDERECO_ESCRITORIO}` : tipo === 'video' ? 'Videochamada (Cal.com)' : endereco.trim()

// Regras de sincronia com o Cal.com:
// - NOVO com cliente: agenda NO Cal.com (o cliente recebe a confirmação e o lembrete) e grava na hora.
// - Já vindo do Cal.com: mudar data/horário remarca NO Cal.com; cancelar/excluir cancela NO Cal.com.
// - Sem cliente: compromisso interno, só no CRM.
function FormCompromisso({
  compromisso,
  escolheResponsavel,
  aoFechar,
}: {
  compromisso: Compromisso | null
  escolheResponsavel: boolean
  aoFechar: () => void
}) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const c = compromisso
  const duracaoAtual = c ? Math.round((new Date(c.fim).getTime() - new Date(c.inicio).getTime()) / 60000) : 0
  const [f, setF] = useState({
    titulo: c?.titulo ?? '',
    categoria: c?.categoria ?? 'atendimento_agendado',
    dia: c ? diaSP(c.inicio) : diaSP(new Date()),
    horaInicio: c ? horaSP(c.inicio) : '09:00',
    horaFim: c ? horaSP(c.fim) : '10:00',
    localTipo: localInicial(c),
    endereco: c && localInicial(c) === 'cliente' ? (c.endereco ?? c.local ?? '') : '',
    participantes: c?.participantes ?? '',
    objetivo: c?.objetivo ?? '',
    observacoes: c?.observacoes ?? '',
    prioridade: c?.prioridade ?? 'media',
    lembrete: String(c?.lembrete_minutos ?? 60),
    responsavel: c?.responsavel_id ?? perfil?.id ?? '',
    contato: c?.cliente_id ? `cliente:${c.cliente_id}` : c?.lead_id ? `lead:${c.lead_id}` : '',
    email: '',
    tipoCalcom: '',
    vincularNeg: c?.negociacao_id ? 'sim' : 'nao',
  })
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const novoCalcom = !c && Boolean(f.contato)
  const editCalcom = Boolean(c?.calcom_uid)
  const usaCalcom = novoCalcom || editCalcom
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())

  const tiposCalcom = useQuery({
    queryKey: ['calcom', 'tipos'],
    enabled: usaCalcom,
    queryFn: () => chamarCalcom<{ tipos: { id: number; titulo: string; minutos: number }[] }>({ acao: 'tipos' }),
    staleTime: 5 * 60_000,
  })
  const tipoEscolhido =
    tiposCalcom.data?.tipos.find((t) => String(t.id) === f.tipoCalcom) ??
    (editCalcom ? tiposCalcom.data?.tipos.find((t) => t.minutos === duracaoAtual) : undefined) ??
    tiposCalcom.data?.tipos[0]

  // Horários que o Cal.com aceita no dia escolhido (já com antecedência mínima e agenda ocupada).
  const livres = useQuery({
    queryKey: ['calcom', 'livres', tipoEscolhido?.id, f.dia],
    enabled: usaCalcom && Boolean(tipoEscolhido),
    queryFn: () => chamarCalcom<{ livres: string[] }>({ acao: 'horarios', eventTypeId: tipoEscolhido!.id, dia: f.dia }),
  })
  const opcoesHorario = (livres.data?.livres ?? []).map((s) => horaSP(s))
  const horarioOriginal = c ? horaSP(c.inicio) : ''
  const mesmoHorario = editCalcom && c && f.dia === diaSP(c.inicio) && f.horaInicio === horarioOriginal
  const horaEscolhidaOk = !usaCalcom || mesmoHorario || opcoesHorario.includes(f.horaInicio)

  const horaFimCalculada = (() => {
    const minutos = usaCalcom ? (tipoEscolhido?.minutos ?? duracaoAtual) : 0
    if (!minutos) return f.horaFim
    const [h, m] = f.horaInicio.split(':').map(Number)
    const total = h * 60 + m + minutos
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  })()
  const inicio = paraISO(f.dia, f.horaInicio)
  const fim = paraISO(f.dia, usaCalcom ? horaFimCalculada : f.horaFim)
  const horarioValido = usaCalcom ? horaEscolhidaOk : f.horaFim > f.horaInicio

  const equipe = useQuery({
    queryKey: ['equipe', 'opcoes'],
    enabled: escolheResponsavel,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email').eq('ativo', true).eq('aprovado', true).order('nome')
      if (error) throw error
      return data as { id: string; nome: string | null; email: string }[]
    },
  })

  // Clientes (cadastro) e leads (inclusive os que chegaram pelo WhatsApp), pelo nome.
  const contatos = useQuery({
    queryKey: ['contatos', 'opcoes'],
    queryFn: async () => {
      const [cl, ld] = await Promise.all([
        supabase.from('clientes').select('id, nome_completo, email').order('nome_completo').limit(300),
        supabase.from('leads').select('id, nome, email').order('nome').limit(300),
      ])
      if (cl.error) throw cl.error
      if (ld.error) throw ld.error
      return [
        ...(cl.data as { id: string; nome_completo: string; email: string | null }[]).map((x) => ({ valor: `cliente:${x.id}`, nome: x.nome_completo, email: x.email })),
        ...(ld.data as { id: string; nome: string; email: string | null }[]).map((x) => ({ valor: `lead:${x.id}`, nome: x.nome, email: x.email })),
      ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    },
  })

  // Negociação aberta mais recente do cliente (para "Negociação ligada: Sim").
  const negociacaoDoCliente = useQuery({
    queryKey: ['negociacao-do-cliente', f.contato],
    enabled: Boolean(f.contato) && !novoCalcom,
    queryFn: async () => {
      const col = f.contato.startsWith('cliente:') ? 'cliente_id' : 'lead_id'
      const { data } = await supabase.from('negociacoes').select('id').eq(col, f.contato.split(':')[1]).neq('etapa', 'concluido').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      return (data as { id: string } | null)?.id ?? null
    },
  })

  const conflitos = useQuery({
    queryKey: ['conflitos', f.responsavel, inicio, fim, c?.id],
    enabled: !usaCalcom && horarioValido && Boolean(f.responsavel),
    queryFn: async () => {
      let q = supabase.from('compromissos').select('id, titulo, inicio, fim').eq('responsavel_id', f.responsavel).in('status', statusAtivosCompromisso).lt('inicio', fim).gt('fim', inicio)
      if (c) q = q.neq('id', c.id)
      const { data, error } = await q
      if (error) throw error
      return data as { id: string; titulo: string; inicio: string; fim: string }[]
    },
  })

  const [agendadoCalcom, setAgendadoCalcom] = useState(false)
  const salvar = useMutation({
    mutationFn: async () => {
      const local = textoLocal(f.localTipo, f.endereco)
      if (novoCalcom) {
        if (!tipoEscolhido) throw new Error('Os tipos de reunião não carregaram. Tente de novo.')
        await chamarCalcom({
          acao: 'agendar',
          eventTypeId: tipoEscolhido.id,
          inicio,
          email: f.email.trim(),
          lead_id: f.contato.startsWith('lead:') ? f.contato.slice(5) : null,
          cliente_id: f.contato.startsWith('cliente:') ? f.contato.slice(8) : null,
          notas: [f.titulo.trim(), f.objetivo.trim(), f.observacoes.trim()].filter(Boolean).join('\n'),
          local: { tipo: f.localTipo, endereco: f.endereco },
          extras: {
            titulo: f.titulo,
            categoria: f.categoria,
            prioridade: f.prioridade,
            lembrete_minutos: f.lembrete === '' ? null : Number(f.lembrete),
            participantes: f.participantes,
            objetivo: f.objetivo,
            responsavel_id: f.responsavel,
            vincular_negociacao: f.vincularNeg === 'sim',
          },
        })
        return
      }
      if (editCalcom && !mesmoHorario) await chamarCalcom({ acao: 'remarcar', compromisso_id: c!.id, inicio })
      const linha = {
        titulo: f.titulo.trim(),
        categoria: f.categoria,
        inicio,
        fim,
        local: local || null,
        endereco: f.localTipo === 'video' ? null : local || null,
        participantes: f.participantes || null,
        objetivo: f.objetivo || null,
        observacoes: f.observacoes || null,
        prioridade: f.prioridade,
        lembrete_minutos: f.lembrete === '' ? null : Number(f.lembrete),
        responsavel_id: f.responsavel || perfil!.id,
        negociacao_id: f.vincularNeg === 'sim' ? (c?.negociacao_id ?? negociacaoDoCliente.data ?? null) : null,
      }
      // Do Cal.com, horário, contato e local são do Cal.com: aqui só os demais campos.
      const { inicio: _i, fim: _f, local: _lo, endereco: _en, ...semCalcom } = linha
      const { error } = c
        ? await supabase.from('compromissos').update(editCalcom ? semCalcom : linha).eq('id', c.id)
        : await supabase.from('compromissos').insert(linha)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos'] })
      if (novoCalcom) {
        setAgendadoCalcom(true)
        return
      }
      aoFechar()
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!horarioValido) return
    if (novoCalcom && !emailOk) return
    if (f.localTipo === 'cliente' && !f.endereco.trim()) return
    if (conflitos.data?.length && !confirm('Este horário bate com outro compromisso. Salvar mesmo assim?')) return
    salvar.mutate()
  }

  if (agendadoCalcom) {
    return (
      <Modal titulo="Agendado" aoFechar={aoFechar}>
        <div className="space-y-4">
          <Aviso tipo="ok">
            Agendado para {dataLonga(f.dia)} às {f.horaInicio}. O Cal.com enviou a confirmação para {f.email.trim()} e envia o lembrete 1 hora antes. O compromisso já está na Agenda.
          </Aviso>
          <div className="flex justify-end">
            <Botao onClick={aoFechar}>Fechar</Botao>
          </div>
        </div>
      </Modal>
    )
  }

  const erroSalvar = salvar.error
    ? /Cal\.com|horário|e-mail|WhatsApp|permissão|Cliente|tipos|endereço|Agenda/i.test((salvar.error as Error).message)
      ? (salvar.error as Error).message
      : erroAmigavel(salvar.error)
    : null
  const nomeContato = contatos.data?.find((x) => x.valor === f.contato)?.nome

  return (
    <Modal titulo={c ? 'Editar compromisso' : 'Novo compromisso'} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="grid gap-4">
        {erroSalvar && <Aviso>{erroSalvar}</Aviso>}
        {usaCalcom && (
          <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">
            {novoCalcom
              ? 'Com cliente, o agendamento vai para o Cal.com: o cliente recebe a confirmação por e-mail agora e o lembrete 1 hora antes.'
              : 'Agendamento sincronizado com o Cal.com: mudar data ou horário remarca no Cal.com e avisa o cliente.'}
          </p>
        )}

        <Campo rotulo="Cliente">
          {c ? (
            <input className={`${estiloCampo} opacity-70`} value={nomeContato ?? (f.contato ? 'Cliente' : 'Nenhum (compromisso interno)')} readOnly />
          ) : (
            <select
              className={estiloCampo}
              value={f.contato}
              onChange={(e) => {
                const escolhido = contatos.data?.find((x) => x.valor === e.target.value)
                setF({ ...f, contato: e.target.value, email: escolhido?.email ?? '', titulo: f.titulo || (escolhido ? `Reunião com ${escolhido.nome}` : '') })
              }}
            >
              <option value="">Nenhum (compromisso interno)</option>
              {contatos.data?.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>

        <Campo rotulo={usaCalcom ? 'Assunto' : 'Título *'}>
          <input className={estiloCampo} value={f.titulo} onChange={muda('titulo')} required={!usaCalcom} placeholder="Ex.: Financiamento do apartamento" />
        </Campo>

        {usaCalcom && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Tipo de reunião *">
              <select
                className={estiloCampo}
                value={String(tipoEscolhido?.id ?? '')}
                onChange={(e) => setF({ ...f, tipoCalcom: e.target.value, horaInicio: editCalcom ? f.horaInicio : '' })}
                disabled={editCalcom}
              >
                {tiposCalcom.isPending && <option>Carregando…</option>}
                {tiposCalcom.data?.tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.titulo}
                  </option>
                ))}
              </select>
            </Campo>
            {novoCalcom && (
              <Campo rotulo="E-mail do cliente *">
                <input className={estiloCampo} type="email" value={f.email} onChange={muda('email')} required placeholder="cliente@exemplo.com" />
              </Campo>
            )}
            {tiposCalcom.error && (
              <div className="sm:col-span-2">
                <Aviso>{(tiposCalcom.error as Error).message}</Aviso>
              </div>
            )}
            {novoCalcom && f.email && !emailOk && <p className="text-xs text-amber-300 sm:col-span-2">E-mail inválido.</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Data *">
            <input type="date" className={estiloCampo} value={f.dia} min={diaSP(new Date())} onChange={(e) => setF({ ...f, dia: e.target.value, horaInicio: usaCalcom ? '' : f.horaInicio })} required />
          </Campo>
          <Campo rotulo="Início *">
            {usaCalcom ? (
              <select className={estiloCampo} value={f.horaInicio} onChange={muda('horaInicio')} required>
                <option value="">{livres.isPending ? 'Buscando horários…' : opcoesHorario.length ? 'Escolha um horário livre' : 'Sem horários livres neste dia'}</option>
                {mesmoHorario && !opcoesHorario.includes(horarioOriginal) && <option value={horarioOriginal}>{horarioOriginal} (atual)</option>}
                {opcoesHorario.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            ) : (
              <input type="time" className={estiloCampo} value={f.horaInicio} onChange={muda('horaInicio')} required />
            )}
          </Campo>
          <Campo rotulo="Fim *">
            {usaCalcom ? (
              <input type="time" className={`${estiloCampo} opacity-60`} value={horaFimCalculada} readOnly title="Definido pela duração da reunião" />
            ) : (
              <input type="time" className={estiloCampo} value={f.horaFim} onChange={muda('horaFim')} required />
            )}
          </Campo>
        </div>
        {usaCalcom && <p className="-mt-2 text-xs text-muted">Só aparecem os horários livres no Cal.com (respeitando a antecedência mínima de 2 horas).</p>}
        {livres.error && <Aviso>{(livres.error as Error).message}</Aviso>}
        {!usaCalcom && !horarioValido && <Aviso>O fim precisa ser depois do início.</Aviso>}
        {!!conflitos.data?.length && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Conflito de horário com: {conflitos.data.map((x) => `${x.titulo} (${horaSP(x.inicio)}–${horaSP(x.fim)})`).join('; ')}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Local">
            <select className={estiloCampo} value={f.localTipo} onChange={muda('localTipo')} disabled={editCalcom}>
              <option value="escritorio">Escritório</option>
              <option value="cliente">Local do cliente</option>
              <option value="video">Videochamada</option>
            </select>
          </Campo>
          <Campo rotulo={f.localTipo === 'cliente' ? 'Endereço do local *' : 'Endereço'}>
            {f.localTipo === 'escritorio' ? (
              <input className={`${estiloCampo} opacity-70`} value={ENDERECO_ESCRITORIO} readOnly />
            ) : f.localTipo === 'cliente' ? (
              <input className={estiloCampo} value={f.endereco} onChange={muda('endereco')} required readOnly={editCalcom} placeholder="Rua, número, bairro, cidade" />
            ) : (
              <input className={`${estiloCampo} opacity-70`} value="Link enviado pelo Cal.com" readOnly />
            )}
          </Campo>
          <Campo rotulo="Categoria">
            <select className={estiloCampo} value={f.categoria} onChange={muda('categoria')}>
              {categoriasCompromisso.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Prioridade">
            <select className={estiloCampo} value={f.prioridade} onChange={muda('prioridade')}>
              {prioridades.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          {escolheResponsavel && (
            <Campo rotulo="Agenda de">
              <select className={estiloCampo} value={f.responsavel} onChange={muda('responsavel')}>
                {equipe.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome || p.email}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo rotulo="Lembrete interno">
            <select className={estiloCampo} value={f.lembrete} onChange={muda('lembrete')}>
              <option value="">Sem lembrete</option>
              <option value="60">1 hora antes</option>
              <option value="1440">1 dia antes</option>
            </select>
          </Campo>
          {f.contato && (
            <Campo rotulo="Negociação ligada">
              <select className={estiloCampo} value={f.vincularNeg} onChange={muda('vincularNeg')}>
                <option value="nao">Não</option>
                <option value="sim">Sim (negociação aberta do cliente)</option>
              </select>
            </Campo>
          )}
        </div>
        {editCalcom && <p className="-mt-2 text-xs text-muted">Para mudar o local de um agendamento do Cal.com, cancele e agende de novo (o cliente é avisado nos dois casos).</p>}

        <Campo rotulo="Participantes">
          <input className={estiloCampo} value={f.participantes} onChange={muda('participantes')} placeholder="Nomes de quem participa" />
        </Campo>
        <Campo rotulo="Objetivo">
          <textarea className={`${estiloCampo} min-h-16`} value={f.objetivo} onChange={muda('objetivo')} />
        </Campo>
        <Campo rotulo="Observações">
          <textarea className={`${estiloCampo} min-h-16`} value={f.observacoes} onChange={muda('observacoes')} />
        </Campo>
        <p className="text-xs text-muted">
          {novoCalcom
            ? 'Ao salvar, o Cal.com envia a confirmação por e-mail ao cliente e o lembrete 1 hora antes. Tudo fica gravado na Agenda na hora.'
            : editCalcom
              ? 'Alterações de data e horário vão para o Cal.com, que avisa o cliente por e-mail.'
              : 'Compromisso interno: nada é enviado a participantes.'}
        </p>
        <div className="flex justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvar.isPending || !horarioValido || (novoCalcom && !emailOk)}>
            {salvar.isPending ? 'Salvando…' : novoCalcom ? 'Agendar e confirmar com o cliente' : 'Salvar'}
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
