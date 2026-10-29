import { useDeferredValue, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CalendarPlus, Columns3, Handshake, List, ListTodo, MessageCircle, Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, useAoVivo } from '../dados'
import { Kanban } from '../Kanban'
import { interesses, origensLead, rotulo, rotuloConexao, rotuloEtapa, statusLead, tomStatusLead, type Canal, type Lead, type Tarefa } from '../tipos'
import { AgendarCalcom } from '../AgendarCalcom'
import { Abas, Aviso, Botao, Cabecalho, Campo, Carregando, Etiqueta, Modal, PainelLateral, Vazio, estiloCampo, type Tom } from '../ui'

const DIA = 86_400_000
const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const hoje = () => new Date().toISOString().slice(0, 10)
const dias = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DIA) : 0)
const linkWhats = (tel: string) => `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}`
const tomInteresse: Record<string, Tom> = { financiamento: 'azul', seguro: 'verde', imovel: 'roxo', consorcio: 'ambar', investimento: 'ciano' }
const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

// Atendimento da Secretária: leads em kanban pela situação. Enquanto o WhatsApp não estiver conectado
// ao sistema, quem atende no celular cadastra aqui o lead, e o CRM cria negociação e tarefa sozinho.
export function Atendimento() {
  const { perfil, ehAdmin, ehSecretaria } = useAuth()
  const qc = useQueryClient()
  const [visao, setVisao] = useState<'kanban' | 'lista' | 'tarefas'>('kanban')
  const [cadastrando, setCadastrando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [agendando, setAgendando] = useState<Lead | null>(null)
  const [aberto, setAberto] = useState<Lead | null>(null)
  const [busca, setBusca] = useState('')
  const termo = useDeferredValue(busca).trim().toLowerCase()

  const canal = useQuery({
    queryKey: ['canal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('canais').select('*').limit(1).maybeSingle()
      if (error) throw error
      return data as Canal | null
    },
  })

  const tarefas = useQuery({
    queryKey: ['tarefas', 'pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tarefas').select('*').eq('status', 'pendente').order('data_tarefa').limit(100)
      if (error) throw error
      return data as Tarefa[]
    },
  })

  const leads = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      return data as Lead[]
    },
  })
  const nomes = useQuery({
    queryKey: ['equipe', 'nomes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email')
      if (error) throw error
      return Object.fromEntries((data as { id: string; nome: string | null; email: string }[]).map((p) => [p.id, p.nome || p.email]))
    },
  })
  useAoVivo('tarefas', ['tarefas'])
  useAoVivo('leads', ['leads'])

  // Mesma regra do banco: admin ou o responsável (a secretária só consulta o comercial).
  const podeEditar = (l: Lead) => ehAdmin || (l.responsavel_id === perfil?.id && !ehSecretaria)

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tarefas').update({ status: 'concluida' }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tarefas'] }),
  })

  // Atualiza na hora; se o banco recusar, volta como estava.
  const atualizar = useMutation({
    mutationFn: async ({ id, ...campos }: { id: string } & Partial<Lead>) => {
      const { error } = await supabase.from('leads').update(campos).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...campos }) => {
      await qc.cancelQueries({ queryKey: ['leads'] })
      const antes = qc.getQueryData<Lead[]>(['leads'])
      qc.setQueryData<Lead[]>(['leads'], (l) => l?.map((x) => (x.id === id ? { ...x, ...campos } : x)))
      return { antes }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['leads'], ctx?.antes),
    onSettled: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })

  const lista = (leads.data ?? []).filter((l) => !termo || l.nome.toLowerCase().includes(termo) || l.telefone.includes(termo.replace(/\D/g, '') || '§') || (l.observacoes ?? '').toLowerCase().includes(termo))
  const colunas = statusLead.map((s) => ({ valor: s.valor, rotulo: s.rotulo, tom: tomStatusLead[s.valor] ?? ('cinza' as Tom) }))
  const erro = canal.error || tarefas.error || leads.error || concluir.error || atualizar.error

  const cartao = (l: Lead) => {
    const idade = dias(l.created_at)
    const resp = l.responsavel_id ? nomes.data?.[l.responsavel_id] : undefined
    return (
      <button onClick={() => setAberto(l)} className="block w-full p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-snug text-white">{l.nome}</p>
          {resp && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold" title={`Responsável: ${resp}`}>
              {iniciais(resp)}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Etiqueta tom={tomInteresse[l.tipo_interesse] ?? 'cinza'}>{rotulo(interesses, l.tipo_interesse)}</Etiqueta>
          <Etiqueta tom="cinza">{rotulo(origensLead, l.origem_lead)}</Etiqueta>
          {l.status === 'novo' && idade >= 1 && <Etiqueta tom="vermelho">Sem atendimento há {idade} dia{idade > 1 ? 's' : ''}</Etiqueta>}
          {l.aceita_mensagens === false && <Etiqueta tom="ambar">Não aceita mensagens</Etiqueta>}
        </div>
        {l.observacoes && <p className="mt-2 line-clamp-2 text-xs text-muted">{l.observacoes}</p>}
        <p className="mt-2 text-[11px] text-white/45">Chegou em {dataCurta.format(new Date(l.created_at))}</p>
      </button>
    )
  }

  return (
    <>
      <Cabecalho titulo="Atendimento">
        <Botao onClick={() => setCadastrando(true)}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Novo lead do WhatsApp
          </span>
        </Botao>
      </Cabecalho>

      {canal.data && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-coal px-4 py-3 text-sm">
          <MessageCircle className="h-4 w-4 text-gold" />
          <span className="font-semibold text-white">{canal.data.nome}</span>
          <Etiqueta tom="ambar">{rotuloConexao[canal.data.conexao]}</Etiqueta>
          <Etiqueta tom="cinza">{canal.data.modo === 'standby' ? 'Standby' : 'Ativo'}</Etiqueta>
          <span className="text-xs text-muted">{canal.data.conexao === 'conectado' ? 'As mensagens entram sozinhas no CRM.' : 'O atendimento é feito no celular. Cadastre aqui cada novo lead.'}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Abas
          abas={[
            { valor: 'kanban', rotulo: 'Kanban', icone: Columns3 },
            { valor: 'lista', rotulo: 'Lista', icone: List },
            { valor: 'tarefas', rotulo: `Tarefas${tarefas.data?.length ? ` (${tarefas.data.length})` : ''}`, icone: ListTodo },
          ]}
          ativa={visao}
          aoMudar={setVisao}
        />
        {visao !== 'tarefas' && (
          <label className="relative mb-4 w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className={`${estiloCampo} pl-9`} placeholder="Buscar nome, telefone ou pedido" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
        )}
      </div>

      {aviso && (
        <div className="mb-4">
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}
      {erro && (
        <div className="mb-4">
          <Aviso>{/row-level|permission/i.test(String((atualizar.error as Error)?.message)) ? 'Você não pode alterar este lead; ele voltou para a situação anterior.' : erroAmigavel(erro)}</Aviso>
        </div>
      )}

      {visao === 'tarefas' ? (
        tarefas.isPending ? (
          <Carregando />
        ) : !tarefas.data?.length ? (
          <Vazio>Nenhuma tarefa pendente.</Vazio>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {tarefas.data.map((t) => {
              const atrasada = t.data_tarefa < hoje()
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-coal p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{t.titulo}</p>
                    <p className={`text-xs ${atrasada ? 'text-rose-300' : 'text-muted'}`}>
                      {atrasada ? 'Atrasada · ' : ''}
                      {dataCurta.format(new Date(`${t.data_tarefa}T12:00:00`))} · prioridade {t.prioridade}
                      {t.origem === 'secretaria' ? ' · criada pela secretária' : ''}
                    </p>
                  </div>
                  <Botao variante="secundario" onClick={() => concluir.mutate(t.id)} disabled={concluir.isPending}>
                    Concluir
                  </Botao>
                </li>
              )
            })}
          </ul>
        )
      ) : leads.isPending ? (
        <Carregando />
      ) : !leads.data?.length ? (
        <Vazio>Nenhum lead ainda. Use “Novo lead do WhatsApp” quando alguém chamar no celular.</Vazio>
      ) : visao === 'kanban' ? (
        <Kanban
          colunas={colunas}
          itens={lista}
          colunaDe={(l) => l.status}
          card={cartao}
          podeMover={podeEditar}
          aoMover={(l, status) => atualizar.mutate({ id: l.id, status })}
          aoCriar={() => setCadastrando(true)}
          podeCriar={(c) => c === 'novo'}
          vazioColuna="Nenhum lead nesta situação."
        />
      ) : !lista.length ? (
        <Vazio>Nenhum lead encontrado.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="hidden bg-coal text-xs uppercase tracking-wider text-muted md:table-header-group">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Interesse</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Chegou</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lista.map((l) => (
                <tr key={l.id} onClick={() => setAberto(l)} className="block cursor-pointer px-4 py-3 hover:bg-white/5 md:table-row md:p-0">
                  <td className="block font-semibold text-white md:table-cell md:px-4 md:py-3">{l.nome}</td>
                  <td className="inline-block pr-2 md:table-cell md:px-4 md:py-3">
                    <Etiqueta tom={tomStatusLead[l.status] ?? 'cinza'}>{rotulo(statusLead, l.status)}</Etiqueta>
                  </td>
                  <td className="inline-block md:table-cell md:px-4 md:py-3">
                    <Etiqueta tom={tomInteresse[l.tipo_interesse] ?? 'cinza'}>{rotulo(interesses, l.tipo_interesse)}</Etiqueta>
                  </td>
                  <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{rotulo(origensLead, l.origem_lead)}</td>
                  <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{(l.responsavel_id && nomes.data?.[l.responsavel_id]) || '–'}</td>
                  <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{dataCurta.format(new Date(l.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aberto && (
        <DetalheLead
          lead={(leads.data ?? []).find((l) => l.id === aberto.id) ?? aberto}
          podeEditar={podeEditar(aberto)}
          nomeResponsavel={aberto.responsavel_id ? nomes.data?.[aberto.responsavel_id] : undefined}
          aoFechar={() => setAberto(null)}
          aoSalvar={(campos) => {
            atualizar.mutate({ id: aberto.id, ...campos })
            setAberto(null)
          }}
          aoAgendar={() => {
            setAgendando(aberto)
            setAberto(null)
          }}
        />
      )}
      {agendando && (
        <AgendarCalcom
          contato={{ tipo: 'lead', id: agendando.id, nome: agendando.nome, telefone: agendando.telefone, email: agendando.email ?? null }}
          aoFechar={() => setAgendando(null)}
        />
      )}
      {cadastrando && (
        <NovoLead
          ehAdmin={ehAdmin}
          aoFechar={() => setCadastrando(false)}
          aoConcluir={(texto, tipo) => {
            setAviso({ texto, tipo })
            setCadastrando(false)
            qc.invalidateQueries({ queryKey: ['leads'] })
            qc.invalidateQueries({ queryKey: ['tarefas'] })
          }}
        />
      )}
    </>
  )
}

// Detalhe do lead no painel lateral: situação, dados, ações (WhatsApp, agendar) e atividades ligadas.
function DetalheLead({
  lead: l,
  podeEditar,
  nomeResponsavel,
  aoFechar,
  aoSalvar,
  aoAgendar,
}: {
  lead: Lead
  podeEditar: boolean
  nomeResponsavel?: string
  aoFechar: () => void
  aoSalvar: (campos: Partial<Lead>) => void
  aoAgendar: () => void
}) {
  const [status, setStatus] = useState(l.status)
  const [interesse, setInteresse] = useState(l.tipo_interesse)
  const [email, setEmail] = useState(l.email ?? '')
  const [obs, setObs] = useState(l.observacoes ?? '')
  const [aceita, setAceita] = useState(l.aceita_mensagens !== false)

  const atividades = useQuery({
    queryKey: ['lead-atividades', l.id],
    queryFn: async () => {
      const [t, c, n] = await Promise.all([
        supabase.from('tarefas').select('id, titulo, status, data_tarefa').eq('lead_id', l.id).order('data_tarefa', { ascending: false }).limit(30),
        supabase.from('compromissos').select('id, titulo, status, inicio').eq('lead_id', l.id).order('inicio', { ascending: false }).limit(30),
        supabase.from('negociacoes').select('id, etapa, valor_estimado').eq('lead_id', l.id).limit(10),
      ])
      return {
        tarefas: (t.data ?? []) as { id: string; titulo: string; status: string; data_tarefa: string }[],
        compromissos: (c.data ?? []) as { id: string; titulo: string; status: string; inicio: string }[],
        negociacoes: (n.data ?? []) as { id: string; etapa: string; valor_estimado: number | null }[],
      }
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    aoSalvar({ status, tipo_interesse: interesse, email: email.trim() || null, observacoes: obs || null, aceita_mensagens: aceita })
  }

  return (
    <PainelLateral
      titulo={l.nome}
      aoFechar={aoFechar}
      subtitulo={
        <div className="flex flex-wrap gap-1.5">
          <Etiqueta tom={tomStatusLead[l.status] ?? 'cinza'}>{rotulo(statusLead, l.status)}</Etiqueta>
          <Etiqueta tom={tomInteresse[l.tipo_interesse] ?? 'cinza'}>{rotulo(interesses, l.tipo_interesse)}</Etiqueta>
          <Etiqueta tom="cinza">{rotulo(origensLead, l.origem_lead)}</Etiqueta>
          {nomeResponsavel && <Etiqueta tom="dourado">{nomeResponsavel}</Etiqueta>}
        </div>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        <a href={linkWhats(l.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-white hover:border-gold hover:text-gold">
          <MessageCircle className="h-4 w-4" /> Abrir no WhatsApp
        </a>
        <button onClick={aoAgendar} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-white hover:border-gold hover:text-gold">
          <CalendarPlus className="h-4 w-4" /> Agendar pelo Cal.com
        </button>
      </div>

      <form onSubmit={enviar} className="grid gap-4">
        <fieldset disabled={!podeEditar} className="contents">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Situação">
              <select className={estiloCampo} value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusLead.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Interesse">
              <select className={estiloCampo} value={interesse} onChange={(e) => setInteresse(e.target.value)}>
                {interesses.map((i) => (
                  <option key={i.valor} value={i.valor}>
                    {i.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="WhatsApp">
              <input className={`${estiloCampo} opacity-70`} value={l.telefone} readOnly />
            </Campo>
            <Campo rotulo="E-mail">
              <input className={estiloCampo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@exemplo.com" />
            </Campo>
          </div>
          <Campo rotulo="O que a pessoa pediu">
            <textarea className={`${estiloCampo} min-h-20`} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={aceita} onChange={(e) => setAceita(e.target.checked)} />
            Aceita mensagens (lembretes e retornos)
          </label>
        </fieldset>
        {podeEditar ? (
          <div className="flex justify-end gap-3">
            <Botao type="button" variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit">Salvar</Botao>
          </div>
        ) : (
          <p className="text-xs text-muted">Somente o administrador ou o responsável altera este lead.</p>
        )}
      </form>

      <section className="mt-8 border-t border-line pt-5">
        <h3 className="mb-3 text-sm font-bold normal-case tracking-normal text-white">Atividades</h3>
        {atividades.isPending ? (
          <Carregando />
        ) : !atividades.data?.tarefas.length && !atividades.data?.compromissos.length && !atividades.data?.negociacoes.length ? (
          <p className="text-sm text-muted">Nada ligado a este lead ainda.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {atividades.data?.negociacoes.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-xl bg-ink p-3">
                <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <p className="text-white">
                  Negociação em <span className="font-semibold">{rotuloEtapa(n.etapa)}</span>
                </p>
              </li>
            ))}
            {atividades.data?.compromissos.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-xl bg-ink p-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                <div className="min-w-0">
                  <p className="text-white">{c.titulo}</p>
                  <p className="text-xs text-muted">
                    {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(c.inicio))} · {c.status.replace(/_/g, ' ')}
                  </p>
                </div>
              </li>
            ))}
            {atividades.data?.tarefas.map((t) => (
              <li key={t.id} className="flex items-start gap-3 rounded-xl bg-ink p-3">
                <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className={t.status === 'concluida' ? 'text-muted line-through' : 'text-white'}>{t.titulo}</p>
                  <p className="text-xs text-muted">
                    {new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short' }).format(new Date(`${t.data_tarefa}T00:00:00Z`))} · {t.status.replace(/_/g, ' ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PainelLateral>
  )
}

function NovoLead({
  ehAdmin,
  aoFechar,
  aoConcluir,
}: {
  ehAdmin: boolean
  aoFechar: () => void
  aoConcluir: (texto: string, tipo: 'ok' | 'erro') => void
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [interesse, setInteresse] = useState(interesses[0].valor)
  const [obs, setObs] = useState('')
  const [responsavel, setResponsavel] = useState('')

  // Só o admin distribui o lead para outra pessoa (o banco também garante isso).
  const equipe = useQuery({
    queryKey: ['equipe', 'opcoes'],
    enabled: ehAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email').eq('ativo', true).eq('aprovado', true).order('nome')
      if (error) throw error
      return data as { id: string; nome: string | null; email: string }[]
    },
  })

  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('fn_novo_lead_whatsapp', {
        p_nome: nome,
        p_telefone: telefone,
        p_interesse: interesse,
        p_observacao: obs || null,
        p_responsavel: responsavel || null,
      })
      if (error) throw error
      return data as { duplicado: boolean }
    },
    onSuccess: (r) =>
      r.duplicado
        ? aoConcluir('Já existe um lead em aberto com esse telefone. Nada foi duplicado.', 'erro')
        : aoConcluir('Lead cadastrado. Negociação e tarefa de retorno criadas.', 'ok'),
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    salvar.mutate()
  }

  // Mensagens de validação da função do banco já vêm em português.
  const msgErro = salvar.error
    ? /Informe|permissão/.test((salvar.error as Error).message)
      ? (salvar.error as Error).message
      : erroAmigavel(salvar.error)
    : null

  return (
    <Modal titulo="Novo lead do WhatsApp" aoFechar={aoFechar}>
      <form onSubmit={enviar} className="grid gap-4">
        {msgErro && <Aviso>{msgErro}</Aviso>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome *">
            <input className={estiloCampo} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
          </Campo>
          <Campo rotulo="WhatsApp com DDD *">
            <input className={estiloCampo} value={telefone} onChange={(e) => setTelefone(e.target.value)} required inputMode="tel" placeholder="(51) 99999-9999" />
          </Campo>
        </div>
        <Campo rotulo="Assunto">
          <select className={estiloCampo} value={interesse} onChange={(e) => setInteresse(e.target.value)}>
            {interesses.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        {ehAdmin && (
          <Campo rotulo="Responsável">
            <select className={estiloCampo} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Eu mesmo</option>
              {equipe.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome || p.email}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo rotulo="O que a pessoa pediu">
          <textarea className={`${estiloCampo} min-h-20`} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: quer financiar apartamento de R$ 300 mil em Canoas" />
        </Campo>
        <p className="text-xs text-muted">Não registre senhas nem documentos aqui.</p>
        <div className="flex justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Cadastrar'}
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
