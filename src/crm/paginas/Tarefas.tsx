import { useDeferredValue, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, limparBusca, useAoVivo } from '../dados'
import { categoriasTarefa, prioridades, recorrencias, rotulo, statusTarefa, type Tarefa } from '../tipos'
import { Aviso, Botao, Cabecalho, Campo, Carregando, Modal, Vazio, estiloCampo } from '../ui'

const FUSO = 'America/Sao_Paulo'
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date())
function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dataCurta = (dia: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(`${dia}T00:00:00Z`))

const corPrioridade: Record<string, string> = {
  urgente: 'bg-red-500/15 text-red-300',
  alta: 'bg-amber-500/15 text-amber-300',
  media: 'bg-white/10 text-white/80',
  baixa: 'bg-white/5 text-muted',
}
const abertas = ['pendente', 'em_andamento', 'aguardando_terceiro']
const pesoPrioridade: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }

// tarefas.responsavel_id não tem chave estrangeira no banco: os nomes vêm da equipe à parte.
function useNomesEquipe(ativo: boolean) {
  return useQuery({
    queryKey: ['equipe', 'nomes'],
    enabled: ativo,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email')
      if (error) throw error
      return Object.fromEntries((data as { id: string; nome: string | null; email: string }[]).map((p) => [p.id, p.nome || p.email]))
    },
  })
}

// Central de tarefas: complementa (não substitui) os funis do CRM.
export function Tarefas() {
  const { perfil, ehAdmin, ehSecretaria } = useAuth()
  const [busca, setBusca] = useState('')
  const termo = limparBusca(useDeferredValue(busca))
  const [situacao, setSituacao] = useState<'abertas' | 'concluidas' | 'todas'>('abertas')
  const [categoria, setCategoria] = useState('')
  const [prioridade, setPrioridade] = useState('')
  const [editando, setEditando] = useState<Tarefa | 'nova' | null>(null)
  const [abrindo, setAbrindo] = useState<Tarefa | null>(null)
  const hoje = hojeSP()

  const { data, isPending, error } = useQuery({
    queryKey: ['tarefas', 'central', situacao, categoria, prioridade, termo],
    queryFn: async () => {
      let q = supabase.from('tarefas').select('*').is('tarefa_pai_id', null)
      if (situacao === 'abertas') q = q.in('status', abertas)
      if (situacao === 'concluidas') q = q.in('status', ['concluida', 'cancelada'])
      if (categoria) q = q.eq('categoria', categoria)
      if (prioridade) q = q.eq('prioridade', prioridade)
      if (termo) q = q.ilike('titulo', `%${termo}%`)
      q = q.order('data_tarefa', { ascending: situacao === 'abertas' })
      const { data, error } = await q.limit(300)
      if (error) throw error
      // Mesmo prazo: urgente primeiro (o banco ordenaria a prioridade por ordem alfabética).
      return (data as Tarefa[]).sort(
        (a, b) => (a.data_tarefa === b.data_tarefa ? (pesoPrioridade[a.prioridade] ?? 9) - (pesoPrioridade[b.prioridade] ?? 9) : 0),
      )
    },
  })
  useAoVivo('tarefas', ['tarefas'])
  const nomes = useNomesEquipe(ehAdmin || ehSecretaria)

  const lista = data ?? []
  const podeEditar = (t: Tarefa) => ehAdmin || t.criado_por === perfil?.id || (t.responsavel_id === perfil?.id && !ehSecretaria)

  // Na visão de abertas, agrupa pelo prazo para destacar o que está atrasado.
  const grupos =
    situacao === 'abertas'
      ? [
          { titulo: 'Atrasadas', cor: 'text-red-300', itens: lista.filter((t) => t.data_tarefa < hoje) },
          { titulo: 'Hoje', cor: 'text-gold', itens: lista.filter((t) => t.data_tarefa === hoje) },
          { titulo: 'Próximos 7 dias', cor: 'text-white', itens: lista.filter((t) => t.data_tarefa > hoje && t.data_tarefa <= somarDias(hoje, 7)) },
          { titulo: 'Depois', cor: 'text-muted', itens: lista.filter((t) => t.data_tarefa > somarDias(hoje, 7)) },
        ]
      : [{ titulo: situacao === 'concluidas' ? 'Concluídas e canceladas' : 'Todas', cor: 'text-white', itens: lista }]

  const porArea = categoriasTarefa
    .map((c) => ({ ...c, total: lista.filter((t) => t.categoria === c.valor).length }))
    .filter((c) => c.total > 0)

  return (
    <>
      <Cabecalho titulo="Tarefas">
        <Botao onClick={() => setEditando('nova')}>+ Nova tarefa</Botao>
      </Cabecalho>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input className={estiloCampo} placeholder="Buscar pelo título" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className={estiloCampo} value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} aria-label="Situação">
          <option value="abertas">Em aberto</option>
          <option value="concluidas">Concluídas e canceladas</option>
          <option value="todas">Todas</option>
        </select>
        <select className={estiloCampo} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Área">
          <option value="">Todas as áreas</option>
          {categoriasTarefa.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
        <select className={estiloCampo} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} aria-label="Prioridade">
          <option value="">Todas as prioridades</option>
          {prioridades.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </div>

      {!!porArea.length && !categoria && (
        <div className="mb-4 flex flex-wrap gap-2">
          {porArea.map((c) => (
            <button key={c.valor} onClick={() => setCategoria(c.valor)} className="rounded-full border border-line px-3 py-1 text-xs text-white/80 hover:border-gold hover:text-gold">
              {c.rotulo} <span className="text-muted">({c.total})</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(error)}</Aviso>
        </div>
      )}

      {isPending ? (
        <Carregando />
      ) : !lista.length ? (
        <Vazio>{termo || categoria || prioridade ? 'Nenhuma tarefa com esses filtros.' : 'Nenhuma tarefa por aqui.'}</Vazio>
      ) : (
        <div className="space-y-6">
          {grupos
            .filter((g) => g.itens.length)
            .map((g) => (
              <section key={g.titulo}>
                <h2 className={`mb-2 text-sm font-bold uppercase tracking-wider ${g.cor}`}>
                  {g.titulo} <span className="text-muted">({g.itens.length})</span>
                </h2>
                <ul className="space-y-2">
                  {g.itens.map((t) => (
                    <li key={t.id}>
                      <button onClick={() => setAbrindo(t)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-coal p-4 text-left hover:bg-white/5">
                        <div className="min-w-0">
                          <p className={`font-semibold ${t.status === 'concluida' ? 'text-muted line-through' : 'text-white'}`}>{t.titulo}</p>
                          <p className="text-xs text-muted">
                            {dataCurta(t.data_tarefa)}
                            {t.hora_inicio ? ` · ${t.hora_inicio.slice(0, 5)}` : ''} · {rotulo(categoriasTarefa, t.categoria)} · {rotulo(statusTarefa, t.status)}
                            {t.recorrencia ? ` · repete ${rotulo(recorrencias, t.recorrencia).toLowerCase()}` : ''}
                            {t.responsavel_id && nomes.data?.[t.responsavel_id] ? ` · ${nomes.data[t.responsavel_id]}` : ''}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${corPrioridade[t.prioridade] ?? ''}`}>{rotulo(prioridades, t.prioridade)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      {abrindo && (
        <Detalhe
          t={abrindo}
          nomeResponsavel={abrindo.responsavel_id ? nomes.data?.[abrindo.responsavel_id] : undefined}
          podeEditar={podeEditar(abrindo)}
          aoFechar={() => setAbrindo(null)}
          aoEditar={() => {
            setEditando(abrindo)
            setAbrindo(null)
          }}
        />
      )}
      {editando && <FormTarefa tarefa={editando === 'nova' ? null : editando} escolheResponsavel={ehAdmin || ehSecretaria} aoFechar={() => setEditando(null)} />}
    </>
  )
}

function Detalhe({
  t,
  nomeResponsavel,
  podeEditar,
  aoFechar,
  aoEditar,
}: {
  t: Tarefa
  nomeResponsavel?: string
  podeEditar: boolean
  aoFechar: () => void
  aoEditar: () => void
}) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [resultado, setResultado] = useState(t.resultado ?? '')
  const [novaSub, setNovaSub] = useState('')

  const subtarefas = useQuery({
    queryKey: ['tarefas', 'sub', t.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tarefas').select('id, titulo, status').eq('tarefa_pai_id', t.id).order('created_at')
      if (error) throw error
      return data as { id: string; titulo: string; status: string }[]
    },
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<Tarefa> }) => {
      const { error } = await supabase.from('tarefas').update(campos).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      if (v.id === t.id) aoFechar()
    },
  })
  const criarSub = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tarefas').insert({
        titulo: novaSub.trim(),
        tarefa_pai_id: t.id,
        categoria: t.categoria,
        data_tarefa: t.data_tarefa,
        responsavel_id: t.responsavel_id ?? perfil!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setNovaSub('')
      qc.invalidateQueries({ queryKey: ['tarefas', 'sub', t.id] })
    },
  })
  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tarefas').delete().eq('id', t.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      aoFechar()
    },
  })

  const aberta = abertas.includes(t.status)
  const erro = atualizar.error || criarSub.error || excluir.error || subtarefas.error

  return (
    <Modal titulo={t.titulo} aoFechar={aoFechar}>
      {erro && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(erro)}</Aviso>
        </div>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {(
          [
            ['Prazo', `${dataCurta(t.data_tarefa)}${t.hora_inicio ? ` às ${t.hora_inicio.slice(0, 5)}` : ''}`],
            ['Situação', rotulo(statusTarefa, t.status)],
            ['Prioridade', rotulo(prioridades, t.prioridade)],
            ['Área', rotulo(categoriasTarefa, t.categoria)],
            ['Repete', t.recorrencia ? rotulo(recorrencias, t.recorrencia) : null],
            ['Responsável', nomeResponsavel ?? null],
            ['Concluída em', t.concluida_em ? new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }).format(new Date(t.concluida_em)) : null],
          ] as [string, string | null][]
        )
          .filter(([, v]) => v)
          .map(([r, v]) => (
            <div key={r}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{r}</dt>
              <dd className="mt-0.5 text-white">{v}</dd>
            </div>
          ))}
      </dl>
      {t.descricao && <p className="mt-4 whitespace-pre-line text-sm text-white/90">{t.descricao}</p>}
      {t.resultado && !aberta && <p className="mt-3 text-sm text-muted">Resultado: {t.resultado}</p>}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Subtarefas</p>
        <ul className="space-y-1">
          {subtarefas.data?.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.status === 'concluida'}
                disabled={!podeEditar}
                onChange={(e) => atualizar.mutate({ id: s.id, campos: { status: e.target.checked ? 'concluida' : 'pendente' } })}
                aria-label={`Concluir ${s.titulo}`}
              />
              <span className={s.status === 'concluida' ? 'text-muted line-through' : 'text-white'}>{s.titulo}</span>
            </li>
          ))}
          {!subtarefas.data?.length && <li className="text-xs text-muted">Nenhuma subtarefa.</li>}
        </ul>
        {podeEditar && aberta && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (novaSub.trim()) criarSub.mutate()
            }}
          >
            <input className={`${estiloCampo} py-2`} value={novaSub} onChange={(e) => setNovaSub(e.target.value)} placeholder="Nova subtarefa" />
            <Botao type="submit" variante="secundario" disabled={criarSub.isPending}>
              Adicionar
            </Botao>
          </form>
        )}
      </div>

      {podeEditar ? (
        <div className="mt-6 space-y-4 border-t border-line pt-4">
          {aberta && (
            <Campo rotulo="Resultado (ao concluir)">
              <textarea className={`${estiloCampo} min-h-16`} value={resultado} onChange={(e) => setResultado(e.target.value)} />
            </Campo>
          )}
          <div className="flex flex-wrap gap-2">
            {aberta ? (
              <>
                <Botao onClick={() => atualizar.mutate({ id: t.id, campos: { status: 'concluida', resultado: resultado || null } })}>Concluir</Botao>
                {t.status !== 'em_andamento' && (
                  <Botao variante="secundario" onClick={() => atualizar.mutate({ id: t.id, campos: { status: 'em_andamento' } })}>
                    Em andamento
                  </Botao>
                )}
                {t.status !== 'aguardando_terceiro' && (
                  <Botao variante="secundario" onClick={() => atualizar.mutate({ id: t.id, campos: { status: 'aguardando_terceiro' } })}>
                    Aguardando terceiro
                  </Botao>
                )}
                <Botao variante="secundario" onClick={aoEditar}>
                  Editar
                </Botao>
                <Botao variante="perigo" onClick={() => confirm('Cancelar esta tarefa?') && atualizar.mutate({ id: t.id, campos: { status: 'cancelada' } })}>
                  Cancelar
                </Botao>
              </>
            ) : (
              <Botao variante="secundario" onClick={() => atualizar.mutate({ id: t.id, campos: { status: 'pendente' } })}>
                Reabrir
              </Botao>
            )}
            <Botao variante="perigo" onClick={() => confirm('Excluir esta tarefa e as subtarefas? Esta ação não pode ser desfeita.') && excluir.mutate()}>
              Excluir
            </Botao>
          </div>
        </div>
      ) : (
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">Somente o administrador ou quem criou pode alterar esta tarefa.</p>
      )}
    </Modal>
  )
}

function FormTarefa({ tarefa, escolheResponsavel, aoFechar }: { tarefa: Tarefa | null; escolheResponsavel: boolean; aoFechar: () => void }) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const t = tarefa
  const [f, setF] = useState({
    titulo: t?.titulo ?? '',
    descricao: t?.descricao ?? '',
    categoria: t?.categoria ?? 'comercial',
    prioridade: t?.prioridade ?? 'media',
    data: t?.data_tarefa ?? hojeSP(),
    hora: t?.hora_inicio?.slice(0, 5) ?? '',
    recorrencia: t?.recorrencia ?? '',
    responsavel: t?.responsavel_id ?? perfil?.id ?? '',
    negociacao: t?.negociacao_id ?? '',
  })
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

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

  const salvar = useMutation({
    mutationFn: async () => {
      const linha = {
        titulo: f.titulo.trim(),
        descricao: f.descricao || null,
        categoria: f.categoria,
        prioridade: f.prioridade,
        data_tarefa: f.data,
        hora_inicio: f.hora || null,
        recorrencia: f.recorrencia || null,
        responsavel_id: f.responsavel || perfil!.id,
        negociacao_id: f.negociacao || null,
      }
      const { error } = t ? await supabase.from('tarefas').update(linha).eq('id', t.id) : await supabase.from('tarefas').insert(linha)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      aoFechar()
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    salvar.mutate()
  }

  return (
    <Modal titulo={t ? 'Editar tarefa' : 'Nova tarefa'} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="grid gap-4">
        {salvar.error && <Aviso>{erroAmigavel(salvar.error)}</Aviso>}
        <Campo rotulo="Título *">
          <input className={estiloCampo} value={f.titulo} onChange={muda('titulo')} required autoFocus />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Prazo *">
            <input type="date" className={estiloCampo} value={f.data} onChange={muda('data')} required />
          </Campo>
          <Campo rotulo="Hora">
            <input type="time" className={estiloCampo} value={f.hora} onChange={muda('hora')} />
          </Campo>
          <Campo rotulo="Repetir">
            <select className={estiloCampo} value={f.recorrencia} onChange={muda('recorrencia')}>
              {recorrencias.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Área">
            <select className={estiloCampo} value={f.categoria} onChange={muda('categoria')}>
              {categoriasTarefa.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Prioridade">
            <select className={estiloCampo} value={f.prioridade} onChange={muda('prioridade')}>
              {prioridades.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          {escolheResponsavel && (
            <Campo rotulo="Responsável">
              <select className={estiloCampo} value={f.responsavel} onChange={muda('responsavel')}>
                {equipe.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome || p.email}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
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
        <Campo rotulo="Descrição">
          <textarea className={`${estiloCampo} min-h-20`} value={f.descricao} onChange={muda('descricao')} />
        </Campo>
        <div className="flex justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
