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
  type Compromisso,
} from '../tipos'
import { Aviso, Botao, Cabecalho, Campo, Carregando, Modal, Vazio, estiloCampo } from '../ui'

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
        <Botao onClick={() => setEditando('novo')}>+ Novo compromisso</Botao>
      </Cabecalho>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['semana', 'lista'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${modo === m ? 'bg-gold/15 text-gold' : 'text-white/70 hover:text-white'}`}
          >
            {m === 'semana' ? 'Semana' : 'Lista'}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-line" />
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
                <p className="mt-1 text-xs text-muted">
                  {rotulo(categoriasCompromisso, c.categoria)} · {rotulo(statusCompromisso, c.status)}
                  {c.local ? ` · ${c.local}` : ''}
                  {(ehAdmin || ehSecretaria) && c.responsavel ? ` · ${c.responsavel.nome || c.responsavel.email}` : ''}
                </p>
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
      <p className="text-[11px] text-muted">{rotulo(statusCompromisso, c.status)}</p>
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
            {ativo && (
              <Botao
                variante="perigo"
                onClick={() => confirm('Cancelar este compromisso? Ele continua no histórico.') && mudar.mutate({ status: 'cancelado' })}
              >
                Cancelar
              </Botao>
            )}
            <Botao
              variante="perigo"
              onClick={() => confirm('Excluir este compromisso de vez? Esta ação não pode ser desfeita.') && excluir.mutate()}
            >
              Excluir
            </Botao>
          </div>
        </div>
      ) : (
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">Somente o administrador ou quem criou pode alterar este compromisso.</p>
      )}
    </Modal>
  )
}

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
  const [f, setF] = useState({
    titulo: c?.titulo ?? '',
    categoria: c?.categoria ?? 'reuniao_comercial',
    dia: c ? diaSP(c.inicio) : diaSP(new Date()),
    horaInicio: c ? horaSP(c.inicio) : '09:00',
    horaFim: c ? horaSP(c.fim) : '10:00',
    local: c?.local ?? '',
    endereco: c?.endereco ?? '',
    participantes: c?.participantes ?? '',
    objetivo: c?.objetivo ?? '',
    observacoes: c?.observacoes ?? '',
    prioridade: c?.prioridade ?? 'media',
    lembrete: String(c?.lembrete_minutos ?? 30),
    responsavel: c?.responsavel_id ?? perfil?.id ?? '',
    negociacao: c?.negociacao_id ?? '',
    contato: c?.cliente_id ? `cliente:${c.cliente_id}` : c?.lead_id ? `lead:${c.lead_id}` : '',
  })
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const inicio = paraISO(f.dia, f.horaInicio)
  const fim = paraISO(f.dia, f.horaFim)
  const horarioValido = f.horaFim > f.horaInicio

  const equipe = useQuery({
    queryKey: ['equipe', 'opcoes'],
    enabled: escolheResponsavel,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email').eq('ativo', true).eq('aprovado', true).order('nome')
      if (error) throw error
      return data as { id: string; nome: string | null; email: string }[]
    },
  })
  const negociacoes = useQuery({
    queryKey: ['negociacoes', 'opcoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('negociacoes')
        .select('id, cliente:clientes(nome_completo), lead:leads(nome)')
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as unknown as { id: string; cliente: { nome_completo: string } | null; lead: { nome: string } | null }[]
    },
  })

  // Cliente ou lead do compromisso: é para o telefone dele (e só dele) que vai o lembrete.
  const contatos = useQuery({
    queryKey: ['contatos', 'opcoes'],
    queryFn: async () => {
      const [cl, ld] = await Promise.all([
        supabase.from('clientes').select('id, nome_completo').order('nome_completo').limit(300),
        supabase.from('leads').select('id, nome').order('created_at', { ascending: false }).limit(300),
      ])
      if (cl.error) throw cl.error
      if (ld.error) throw ld.error
      return [
        ...(cl.data as { id: string; nome_completo: string }[]).map((x) => ({ valor: `cliente:${x.id}`, rotulo: `${x.nome_completo} (cliente)` })),
        ...(ld.data as { id: string; nome: string }[]).map((x) => ({ valor: `lead:${x.id}`, rotulo: `${x.nome} (lead)` })),
      ]
    },
  })

  // Conflitos na agenda do responsável (as regras do banco limitam o que cada um enxerga).
  const conflitos = useQuery({
    queryKey: ['conflitos', f.responsavel, inicio, fim, c?.id],
    enabled: horarioValido && Boolean(f.responsavel),
    queryFn: async () => {
      let q = supabase
        .from('compromissos')
        .select('id, titulo, inicio, fim')
        .eq('responsavel_id', f.responsavel)
        .in('status', statusAtivosCompromisso)
        .lt('inicio', fim)
        .gt('fim', inicio)
      if (c) q = q.neq('id', c.id)
      const { data, error } = await q
      if (error) throw error
      return data as { id: string; titulo: string; inicio: string; fim: string }[]
    },
  })

  const salvar = useMutation({
    mutationFn: async () => {
      const linha = {
        titulo: f.titulo.trim(),
        categoria: f.categoria,
        inicio,
        fim,
        local: f.local || null,
        endereco: f.endereco || null,
        participantes: f.participantes || null,
        objetivo: f.objetivo || null,
        observacoes: f.observacoes || null,
        prioridade: f.prioridade,
        lembrete_minutos: f.lembrete === '' ? null : Number(f.lembrete),
        responsavel_id: f.responsavel || perfil!.id,
        negociacao_id: f.negociacao || null,
        cliente_id: f.contato.startsWith('cliente:') ? f.contato.slice(8) : null,
        lead_id: f.contato.startsWith('lead:') ? f.contato.slice(5) : null,
      }
      const { error } = c
        ? await supabase.from('compromissos').update(linha).eq('id', c.id)
        : await supabase.from('compromissos').insert(linha)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos'] })
      aoFechar()
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!horarioValido) return
    if (conflitos.data?.length && !confirm('Este horário bate com outro compromisso. Salvar mesmo assim?')) return
    salvar.mutate()
  }

  return (
    <Modal titulo={c ? 'Editar compromisso' : 'Novo compromisso'} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="grid gap-4">
        {salvar.error && <Aviso>{erroAmigavel(salvar.error)}</Aviso>}
        <Campo rotulo="Título *">
          <input className={estiloCampo} value={f.titulo} onChange={muda('titulo')} required autoFocus placeholder="Ex.: Reunião com a construtora X" />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Data *">
            <input type="date" className={estiloCampo} value={f.dia} onChange={muda('dia')} required />
          </Campo>
          <Campo rotulo="Início *">
            <input type="time" className={estiloCampo} value={f.horaInicio} onChange={muda('horaInicio')} required />
          </Campo>
          <Campo rotulo="Fim *">
            <input type="time" className={estiloCampo} value={f.horaFim} onChange={muda('horaFim')} required />
          </Campo>
        </div>
        {!horarioValido && <Aviso>O fim precisa ser depois do início.</Aviso>}
        {!!conflitos.data?.length && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Conflito de horário com:{' '}
            {conflitos.data.map((x) => `${x.titulo} (${horaSP(x.inicio)}–${horaSP(x.fim)})`).join('; ')}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
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
          <Campo rotulo="Local">
            <input className={estiloCampo} value={f.local} onChange={muda('local')} placeholder="Ex.: Escritório, imobiliária, online" />
          </Campo>
          <Campo rotulo="Endereço">
            <input className={estiloCampo} value={f.endereco} onChange={muda('endereco')} />
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
          <Campo rotulo="Lembrete">
            <select className={estiloCampo} value={f.lembrete} onChange={muda('lembrete')}>
              <option value="">Sem lembrete</option>
              <option value="15">15 min antes</option>
              <option value="30">30 min antes</option>
              <option value="60">1 hora antes</option>
              <option value="1440">1 dia antes</option>
            </select>
          </Campo>
          <Campo rotulo="Cliente ou lead">
            <select className={estiloCampo} value={f.contato} onChange={muda('contato')}>
              <option value="">Nenhum (compromisso interno)</option>
              {contatos.data?.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Negociação ligada">
            <select className={estiloCampo} value={f.negociacao} onChange={muda('negociacao')}>
              <option value="">Nenhuma</option>
              {negociacoes.data?.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.cliente?.nome_completo ?? n.lead?.nome ?? 'Negociação'}
                </option>
              ))}
            </select>
          </Campo>
        </div>
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
          {f.contato || f.negociacao
            ? 'Com cliente ou lead ligado, a Secretária prepara o lembrete de confirmação para pelo menos 1 hora antes (em Confirmações). Nada é enviado sozinho.'
            : 'Nada é enviado aos participantes: a agenda é interna.'}
        </p>
        <div className="flex justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvar.isPending || !horarioValido}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
