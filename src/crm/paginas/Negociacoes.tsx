import { useDeferredValue, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Columns3, List, ListTodo, Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, moeda, useAoVivo } from '../dados'
import { Kanban } from '../Kanban'
import { etapas, interesses, rotulo, rotuloEtapa, tomEtapa, type Negociacao } from '../tipos'
import { Abas, Aviso, Botao, Cabecalho, Campo, Carregando, Etiqueta, PainelLateral, Vazio, estiloCampo, type Tom } from '../ui'

const chave = ['negociacoes']
const DIA = 86_400_000
const diasParada = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DIA) : 0)
const nomeDe = (n: Negociacao) => n.cliente?.nome_completo ?? n.lead?.nome ?? 'Cliente'
const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
const tomInteresse: Record<string, Tom> = { financiamento: 'azul', seguro: 'verde', imovel: 'roxo', consorcio: 'ambar', investimento: 'ciano' }

export function Negociacoes() {
  const { sessao, perfil, ehAdmin, ehSecretaria } = useAuth()
  const qc = useQueryClient()
  const [visao, setVisao] = useState<'kanban' | 'lista'>('kanban')
  const [aberta, setAberta] = useState<Negociacao | null>(null)
  const [nova, setNova] = useState<string | null>(null) // etapa inicial da nova negociação
  const [busca, setBusca] = useState('')
  const termo = useDeferredValue(busca).trim().toLowerCase()

  const { data, isPending, error } = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('negociacoes')
        .select('*, cliente:clientes(nome_completo), lead:leads(nome, tipo_interesse)')
        .order('updated_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as Negociacao[]
    },
  })
  useAoVivo('negociacoes', chave)

  // Nomes da equipe (para o responsável no card).
  const nomes = useQuery({
    queryKey: ['equipe', 'nomes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email')
      if (error) throw error
      return Object.fromEntries((data as { id: string; nome: string | null; email: string }[]).map((p) => [p.id, p.nome || p.email]))
    },
  })

  // Mesma regra do banco: admin, ou o responsável (a secretária só consulta o comercial).
  const podeEditar = (n: Negociacao) => ehAdmin || (n.responsavel_id === perfil?.id && !ehSecretaria)

  const salvar = useMutation({
    mutationFn: async ({ id, campos }: { id?: string; campos: Partial<Negociacao> }) => {
      const { error } = id ? await supabase.from('negociacoes').update(campos).eq('id', id) : await supabase.from('negociacoes').insert({ ...campos, responsavel_id: sessao!.user.id })
      if (error) throw error
    },
    // Move na hora; se o banco recusar, o card volta para onde estava.
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<Negociacao[]>(chave)
      if (id) qc.setQueryData<Negociacao[]>(chave, (l) => l?.map((n) => (n.id === id ? { ...n, ...campos } : n)))
      return { antes }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(chave, ctx?.antes),
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('negociacoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => setAberta(null),
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })

  const lista = (data ?? []).filter((n) => !termo || nomeDe(n).toLowerCase().includes(termo) || (n.observacoes ?? '').toLowerCase().includes(termo))
  const colunas = etapas.map((e) => {
    const soma = lista.filter((n) => n.etapa === e.valor).reduce((s, n) => s + (n.valor_estimado ?? 0), 0)
    return { valor: e.valor, rotulo: e.rotulo, tom: tomEtapa[e.valor] ?? ('cinza' as Tom), extra: soma > 0 ? moeda.format(soma) : undefined }
  })

  const cartao = (n: Negociacao) => {
    const parada = diasParada(n.updated_at)
    const resp = nomes.data?.[n.responsavel_id]
    return (
      <button onClick={() => setAberta(n)} className="block w-full p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-snug text-white">{nomeDe(n)}</p>
          {resp && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold" title={`Responsável: ${resp}`}>
              {iniciais(resp)}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {n.lead?.tipo_interesse && <Etiqueta tom={tomInteresse[n.lead.tipo_interesse] ?? 'cinza'}>{rotulo(interesses, n.lead.tipo_interesse)}</Etiqueta>}
          {!n.cliente_id && n.lead_id && <Etiqueta tom="cinza">Lead</Etiqueta>}
          {parada >= 7 && n.etapa !== 'concluido' && <Etiqueta tom="vermelho">Parada há {parada} dias</Etiqueta>}
        </div>
        {n.valor_estimado != null && <p className="mt-2 text-sm font-semibold text-gold">{moeda.format(n.valor_estimado)}</p>}
        {n.observacoes && <p className="mt-1 line-clamp-2 text-xs text-muted">{n.observacoes}</p>}
        <p className="mt-2 text-[11px] text-white/45">{parada === 0 ? 'Atualizada hoje' : `Atualizada há ${parada} dia${parada > 1 ? 's' : ''}`}</p>
      </button>
    )
  }

  return (
    <>
      <Cabecalho titulo="Negociações">
        <Botao onClick={() => setNova(etapas[0].valor)}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Nova negociação
          </span>
        </Botao>
      </Cabecalho>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Abas
          abas={[
            { valor: 'kanban', rotulo: 'Kanban', icone: Columns3 },
            { valor: 'lista', rotulo: 'Lista', icone: List },
          ]}
          ativa={visao}
          aoMudar={setVisao}
        />
        <label className="relative mb-4 w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className={`${estiloCampo} pl-9`} placeholder="Buscar cliente ou observação" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>

      {(error || salvar.error || excluir.error) && (
        <div className="mb-4">
          <Aviso>{/row-level|permission/i.test(String((salvar.error as Error)?.message)) ? 'Você não pode mover esta negociação; ela voltou para a etapa anterior.' : erroAmigavel(error || salvar.error || excluir.error)}</Aviso>
        </div>
      )}

      {isPending ? (
        <Carregando />
      ) : !data?.length ? (
        <Vazio>Nenhuma negociação ainda. Use “Nova negociação” ou o “+” de uma etapa.</Vazio>
      ) : visao === 'kanban' ? (
        <Kanban
          colunas={colunas}
          itens={lista}
          colunaDe={(n) => n.etapa}
          card={cartao}
          podeMover={podeEditar}
          aoMover={(n, etapa) => salvar.mutate({ id: n.id, campos: { etapa } })}
          aoCriar={(etapa) => setNova(etapa)}
          vazioColuna="Nenhuma negociação nesta etapa."
        />
      ) : (
        <Lista itens={lista} nomes={nomes.data ?? {}} aoAbrir={setAberta} />
      )}

      {(aberta || nova) && (
        <Detalhe
          negociacao={aberta}
          etapaInicial={nova ?? undefined}
          podeEditar={aberta ? podeEditar(aberta) : true}
          podeExcluir={ehAdmin && Boolean(aberta)}
          nomeResponsavel={aberta ? nomes.data?.[aberta.responsavel_id] : undefined}
          aoFechar={() => {
            setAberta(null)
            setNova(null)
          }}
          aoSalvar={(campos) => {
            salvar.mutate({ id: aberta?.id, campos })
            setAberta(null)
            setNova(null)
          }}
          aoExcluir={() => aberta && confirm('Excluir esta negociação? Esta ação não pode ser desfeita.') && excluir.mutate(aberta.id)}
        />
      )}
    </>
  )
}

// Visão em lista: tabela no computador, cartões no celular.
function Lista({ itens, nomes, aoAbrir }: { itens: Negociacao[]; nomes: Record<string, string>; aoAbrir: (n: Negociacao) => void }) {
  if (!itens.length) return <Vazio>Nenhuma negociação encontrada.</Vazio>
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="hidden bg-coal text-xs uppercase tracking-wider text-muted md:table-header-group">
          <tr>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Etapa</th>
            <th className="px-4 py-3">Interesse</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Responsável</th>
            <th className="px-4 py-3">Atualizada</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {itens.map((n) => (
            <tr key={n.id} onClick={() => aoAbrir(n)} className="block cursor-pointer px-4 py-3 hover:bg-white/5 md:table-row md:p-0">
              <td className="block font-semibold text-white md:table-cell md:px-4 md:py-3">{nomeDe(n)}</td>
              <td className="inline-block pr-2 md:table-cell md:px-4 md:py-3">
                <Etiqueta tom={tomEtapa[n.etapa] ?? 'cinza'}>{rotuloEtapa(n.etapa)}</Etiqueta>
              </td>
              <td className="inline-block md:table-cell md:px-4 md:py-3">
                {n.lead?.tipo_interesse ? <Etiqueta tom={tomInteresse[n.lead.tipo_interesse] ?? 'cinza'}>{rotulo(interesses, n.lead.tipo_interesse)}</Etiqueta> : <span className="hidden text-muted md:inline">–</span>}
              </td>
              <td className="block text-gold md:table-cell md:px-4 md:py-3 md:text-right">{n.valor_estimado != null ? moeda.format(n.valor_estimado) : <span className="text-muted">–</span>}</td>
              <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{nomes[n.responsavel_id] ?? '–'}</td>
              <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{n.updated_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(n.updated_at)) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Detalhe no painel lateral: dados editáveis e as atividades ligadas (tarefas e compromissos).
function Detalhe({
  negociacao,
  etapaInicial,
  podeEditar,
  podeExcluir,
  nomeResponsavel,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  negociacao: Negociacao | null
  etapaInicial?: string
  podeEditar: boolean
  podeExcluir: boolean
  nomeResponsavel?: string
  aoFechar: () => void
  aoSalvar: (campos: Partial<Negociacao>) => void
  aoExcluir: () => void
}) {
  const n = negociacao
  const [clienteId, setClienteId] = useState(n?.cliente_id ?? '')
  const [valor, setValor] = useState(n?.valor_estimado?.toString().replace('.', ',') ?? '')
  const [etapa, setEtapa] = useState(n?.etapa ?? etapaInicial ?? etapas[0].valor)
  const [obs, setObs] = useState(n?.observacoes ?? '')

  const clientes = useQuery({
    queryKey: ['clientes', 'opcoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id, nome_completo').order('nome_completo').limit(1000)
      if (error) throw error
      return data as { id: string; nome_completo: string }[]
    },
  })

  const atividades = useQuery({
    queryKey: ['negociacao-atividades', n?.id],
    enabled: Boolean(n),
    queryFn: async () => {
      const [t, c] = await Promise.all([
        supabase.from('tarefas').select('id, titulo, status, data_tarefa').eq('negociacao_id', n!.id).order('data_tarefa', { ascending: false }).limit(30),
        supabase.from('compromissos').select('id, titulo, status, inicio').eq('negociacao_id', n!.id).order('inicio', { ascending: false }).limit(30),
      ])
      return {
        tarefas: (t.data ?? []) as { id: string; titulo: string; status: string; data_tarefa: string }[],
        compromissos: (c.data ?? []) as { id: string; titulo: string; status: string; inicio: string }[],
      }
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    aoSalvar({
      cliente_id: clienteId || null,
      valor_estimado: valor ? Number(valor.replace(/\./g, '').replace(',', '.')) : null,
      etapa,
      observacoes: obs || null,
    })
  }

  const titulo = n ? nomeDe(n) : 'Nova negociação'
  return (
    <PainelLateral
      titulo={titulo}
      aoFechar={aoFechar}
      subtitulo={
        n && (
          <div className="flex flex-wrap gap-1.5">
            <Etiqueta tom={tomEtapa[n.etapa] ?? 'cinza'}>{rotuloEtapa(n.etapa)}</Etiqueta>
            {n.lead?.tipo_interesse && <Etiqueta tom={tomInteresse[n.lead.tipo_interesse] ?? 'cinza'}>{rotulo(interesses, n.lead.tipo_interesse)}</Etiqueta>}
            {nomeResponsavel && <Etiqueta tom="dourado">{nomeResponsavel}</Etiqueta>}
          </div>
        )
      }
    >
      <form onSubmit={enviar} className="grid gap-4">
        <fieldset disabled={!podeEditar} className="contents">
          {n?.lead && (
            <p className="text-sm text-muted">
              Lead: <span className="font-semibold text-white">{n.lead.nome}</span>
            </p>
          )}
          <Campo rotulo={n?.lead_id ? 'Cliente (quando virar cliente)' : 'Cliente *'}>
            <select className={estiloCampo} value={clienteId} onChange={(e) => setClienteId(e.target.value)} required={!n?.lead_id}>
              <option value="">{clientes.isPending ? 'Carregando…' : 'Selecione o cliente'}</option>
              {clientes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome_completo}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor estimado (R$)">
              <input className={estiloCampo} value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="250000,00" />
            </Campo>
            <Campo rotulo="Etapa">
              <select className={estiloCampo} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                {etapas.map((et) => (
                  <option key={et.valor} value={et.valor}>
                    {et.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo rotulo="Observações">
            <textarea className={`${estiloCampo} min-h-24`} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
        </fieldset>
        {podeEditar ? (
          <div className="flex flex-wrap justify-between gap-3">
            {podeExcluir ? (
              <Botao type="button" variante="perigo" onClick={aoExcluir}>
                Excluir
              </Botao>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <Botao type="button" variante="secundario" onClick={aoFechar}>
                Cancelar
              </Botao>
              <Botao type="submit">Salvar</Botao>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted">Somente o administrador ou o responsável altera esta negociação.</p>
        )}
      </form>

      {n && (
        <section className="mt-8 border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-bold normal-case tracking-normal text-white">Atividades</h3>
          {atividades.isPending ? (
            <Carregando />
          ) : !atividades.data?.tarefas.length && !atividades.data?.compromissos.length ? (
            <p className="text-sm text-muted">Nenhuma tarefa ou compromisso ligado a esta negociação.</p>
          ) : (
            <ul className="space-y-2 text-sm">
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
      )}
    </PainelLateral>
  )
}
