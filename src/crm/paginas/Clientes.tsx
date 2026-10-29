import { useDeferredValue, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Download, Handshake, ListTodo, Search, UserCheck, UserPlus, Users, UserX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, limparBusca, moeda, useAoVivo } from '../dados'
import { rotuloEtapa, statusCliente, tomEtapa, type Cliente } from '../tipos'
import { Aviso, Botao, Cabecalho, Campo, Carregando, CartaoIndicador, Etiqueta, PainelLateral, Vazio, estiloCampo, type Tom } from '../ui'

const POR_PAGINA = 50
const vazio = {
  nome_completo: '',
  cpf_cnpj: '',
  telefone: '',
  email: '',
  data_nascimento: '',
  cep: '',
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  status: 'Ativo',
  observacoes: '',
  aceita_mensagens: 'sim',
}
type Formulario = typeof vazio
type Filtros = { termo: string; status: string; responsavel: string; mensagens: string }

const tomStatus: Record<string, Tom> = { Ativo: 'verde', 'Em atendimento': 'ambar', Inativo: 'cinza' }
const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Mesma consulta para a lista e para a exportação, com os filtros aplicados.
function consulta(f: Filtros, colunas: string, contar = false) {
  let q = supabase.from('clientes').select(colunas, contar ? { count: 'exact' } : undefined)
  if (f.termo) q = q.or(`nome_completo.ilike.%${f.termo}%,cpf_cnpj.ilike.%${f.termo}%,telefone.ilike.%${f.termo}%,email.ilike.%${f.termo}%`)
  if (f.status) q = q.eq('status', f.status)
  if (f.responsavel) q = q.eq('responsavel_id', f.responsavel)
  if (f.mensagens) q = q.eq('aceita_mensagens', f.mensagens === 'sim')
  return q.order('created_at', { ascending: false })
}

// CSV com ";" e BOM, que o Excel em português abre com acentos e colunas certas.
function baixarCsv(nome: string, linhas: (string | number | null | undefined)[][]) {
  const celula = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const texto = '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export function Clientes() {
  const { sessao, ehAdmin, ehSecretaria } = useAuth()
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const termo = limparBusca(useDeferredValue(busca))
  const [status, setStatus] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [mensagens, setMensagens] = useState('')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null)
  const [exportando, setExportando] = useState(false)
  const [erroExportar, setErroExportar] = useState<unknown>(null)
  const filtros: Filtros = { termo, status, responsavel, mensagens }
  const veEquipe = ehAdmin || ehSecretaria

  const chave = ['clientes', filtros, pagina]
  const { data, isPending, error, isPlaceholderData } = useQuery({
    queryKey: chave,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, count } = await consulta(filtros, '*, responsavel:profiles(nome, email)', true).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)
      if (error) throw error
      return { lista: data as unknown as Cliente[], total: count ?? 0 }
    },
  })
  const resumo = useQuery({
    queryKey: ['clientes', 'resumo'],
    queryFn: async () => {
      const contar = async (filtro?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
        const q = filtro ? filtro(base()) : base()
        const { count, error } = await q
        if (error) throw error
        return count ?? 0
      }
      const base = () => supabase.from('clientes').select('id', { count: 'exact', head: true })
      const [total, ativos, emAtendimento, novos] = await Promise.all([
        contar(),
        contar((q) => q.eq('status', 'Ativo')),
        contar((q) => q.eq('status', 'Em atendimento')),
        contar((q) => q.gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString())),
      ])
      return { total, ativos, emAtendimento, novos }
    },
  })
  const equipe = useQuery({
    queryKey: ['equipe', 'opcoes'],
    enabled: veEquipe,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email').eq('ativo', true).eq('aprovado', true).order('nome')
      if (error) throw error
      return data as { id: string; nome: string | null; email: string }[]
    },
  })
  useAoVivo('clientes', ['clientes'])

  const salvar = useMutation({
    mutationFn: async ({ id, campos }: { id?: string; campos: Formulario }) => {
      const linha = {
        ...campos,
        data_nascimento: campos.data_nascimento || null,
        estado: campos.estado.toUpperCase() || null,
        aceita_mensagens: campos.aceita_mensagens !== 'nao',
      }
      const { error } = id ? await supabase.from('clientes').update(linha).eq('id', id) : await supabase.from('clientes').insert({ ...linha, responsavel_id: sessao!.user.id })
      if (error) throw error
    },
    // Mostra na lista na hora; se o banco recusar, volta como estava.
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: ['clientes'] })
      const antes = qc.getQueriesData({ queryKey: ['clientes'] })
      qc.setQueriesData<{ lista: Cliente[]; total: number }>({ queryKey: chave }, (atual) => {
        if (!atual) return atual
        const visivel = { ...campos, aceita_mensagens: campos.aceita_mensagens !== 'nao' }
        if (id) return { ...atual, lista: atual.lista.map((c) => (c.id === id ? { ...c, ...visivel } : c)) }
        const temporario = { ...visivel, id: `tmp-${Date.now()}`, responsavel_id: sessao!.user.id, created_at: new Date().toISOString() } as Cliente
        return { lista: [temporario, ...atual.lista], total: atual.total + 1 }
      })
      setEditando(null)
      return { antes }
    },
    onError: (_e, _v, ctx) => ctx?.antes.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => setEditando(null),
    onSettled: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  })

  // Exporta todos os clientes do filtro atual (não só a página aberta). Somente o administrador.
  async function exportar() {
    setExportando(true)
    setErroExportar(null)
    try {
      const { data, error } = await consulta(filtros, '*, responsavel:profiles(nome, email)').limit(5000)
      if (error) throw error
      const lista = data as unknown as Cliente[]
      baixarCsv(`clientes-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Nome', 'CPF/CNPJ', 'Telefone', 'E-mail', 'Nascimento', 'CEP', 'Endereço', 'Bairro', 'Cidade', 'UF', 'Status', 'Aceita mensagens', 'Responsável', 'Cadastro', 'Observações'],
        ...lista.map((c) => [
          c.nome_completo,
          c.cpf_cnpj,
          c.telefone,
          c.email,
          c.data_nascimento ? c.data_nascimento.split('-').reverse().join('/') : '',
          c.cep,
          c.endereco,
          c.bairro,
          c.cidade,
          c.estado,
          c.status,
          c.aceita_mensagens === false ? 'Não' : 'Sim',
          c.responsavel?.nome || c.responsavel?.email,
          dataCurta.format(new Date(c.created_at)),
          c.observacoes,
        ]),
      ])
    } catch (e) {
      setErroExportar(e)
    } finally {
      setExportando(false)
    }
  }

  const total = data?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const filtrando = !!(termo || status || responsavel || mensagens)
  const erro = error || salvar.error || excluir.error || resumo.error || erroExportar

  return (
    <>
      <Cabecalho titulo="Clientes">
        {ehAdmin && (
          <Botao variante="secundario" onClick={exportar} disabled={exportando || !total}>
            <span className="inline-flex items-center gap-1.5">
              <Download className="h-4 w-4" /> {exportando ? 'Exportando…' : 'Exportar planilha'}
            </span>
          </Botao>
        )}
        <Botao onClick={() => setEditando('novo')}>
          <span className="inline-flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" /> Novo cliente
          </span>
        </Botao>
      </Cabecalho>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoIndicador rotulo="Clientes" valor={resumo.data?.total ?? '–'} icone={Users} tom="ciano" />
        <CartaoIndicador rotulo="Ativos" valor={resumo.data?.ativos ?? '–'} icone={UserCheck} tom="verde" />
        <CartaoIndicador rotulo="Em atendimento" valor={resumo.data?.emAtendimento ?? '–'} icone={UserX} tom="ambar" />
        <CartaoIndicador rotulo="Novos em 30 dias" valor={resumo.data?.novos ?? '–'} icone={UserPlus} tom="azul" />
      </div>

      <div className={`mb-4 grid gap-2 sm:grid-cols-2 ${veEquipe ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className={`${estiloCampo} pl-9`}
            placeholder="Nome, CPF/CNPJ, telefone ou e-mail"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(0)
            }}
          />
        </label>
        <select
          className={estiloCampo}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPagina(0)
          }}
          aria-label="Status"
        >
          <option value="">Todos os status</option>
          {statusCliente.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {veEquipe && (
          <select
            className={estiloCampo}
            value={responsavel}
            onChange={(e) => {
              setResponsavel(e.target.value)
              setPagina(0)
            }}
            aria-label="Responsável"
          >
            <option value="">Todos os responsáveis</option>
            {equipe.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome || p.email}
              </option>
            ))}
          </select>
        )}
        <select
          className={estiloCampo}
          value={mensagens}
          onChange={(e) => {
            setMensagens(e.target.value)
            setPagina(0)
          }}
          aria-label="Aceita mensagens"
        >
          <option value="">Mensagens: todos</option>
          <option value="sim">Aceitam mensagens</option>
          <option value="nao">Não aceitam mensagens</option>
        </select>
      </div>

      {erro && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(erro)}</Aviso>
        </div>
      )}

      {isPending ? (
        <Carregando />
      ) : !data?.lista.length ? (
        <Vazio>{filtrando ? 'Nenhum cliente com esses filtros.' : 'Nenhum cliente cadastrado ainda.'}</Vazio>
      ) : (
        <div className={`overflow-hidden rounded-2xl border border-line transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <table className="w-full text-left text-sm">
            <thead className="hidden bg-coal text-xs uppercase tracking-wider text-muted md:table-header-group">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Status</th>
                {veEquipe && <th className="px-4 py-3">Responsável</th>}
                <th className="px-4 py-3">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.lista.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => !c.id.startsWith('tmp-') && setEditando(c)}
                  className={`block cursor-pointer px-4 py-3 hover:bg-white/5 md:table-row md:p-0 ${c.id.startsWith('tmp-') ? 'opacity-60' : ''}`}
                >
                  <td className="block md:table-cell md:px-4 md:py-3">
                    <span className="font-semibold text-white">{c.nome_completo}</span>
                    {c.aceita_mensagens === false && (
                      <span className="ml-2">
                        <Etiqueta tom="vermelho">Não aceita mensagens</Etiqueta>
                      </span>
                    )}
                  </td>
                  <td className="inline-block pr-3 text-muted md:table-cell md:px-4 md:py-3">{c.telefone}</td>
                  <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{[c.cidade, c.estado].filter(Boolean).join('/')}</td>
                  <td className="inline-block md:table-cell md:px-4 md:py-3">
                    <Etiqueta tom={tomStatus[c.status ?? ''] ?? 'cinza'}>{c.status || '—'}</Etiqueta>
                  </td>
                  {veEquipe && <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{c.responsavel?.nome || c.responsavel?.email}</td>}
                  <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{dataCurta.format(new Date(c.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!!total && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>
            {total} cliente{total > 1 ? 's' : ''}
            {filtrando ? ' no filtro' : ''}
            {total > POR_PAGINA ? ` · página ${pagina + 1} de ${paginas}` : ''}
          </span>
          {total > POR_PAGINA && (
            <div className="flex gap-2">
              <Botao variante="secundario" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                Anterior
              </Botao>
              <Botao variante="secundario" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>
                Próxima
              </Botao>
            </div>
          )}
        </div>
      )}

      {editando && (
        <FormCliente
          cliente={editando === 'novo' ? null : editando}
          somenteLeitura={!ehAdmin && editando !== 'novo'}
          aoFechar={() => setEditando(null)}
          aoSalvar={(campos) => salvar.mutate({ id: editando === 'novo' ? undefined : editando.id, campos })}
          aoExcluir={
            ehAdmin && editando !== 'novo'
              ? () => {
                  if (confirm(`Excluir o cliente ${editando.nome_completo}? Esta ação não pode ser desfeita.`)) excluir.mutate(editando.id)
                }
              : undefined
          }
        />
      )}
    </>
  )
}

// Comercial cadastra, mas só o admin altera depois de salvo (o banco também bloqueia).
function FormCliente({
  cliente,
  somenteLeitura,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  cliente: Cliente | null
  somenteLeitura: boolean
  aoFechar: () => void
  aoSalvar: (campos: Formulario) => void
  aoExcluir?: () => void
}) {
  const [f, setF] = useState<Formulario>(() =>
    cliente
      ? ({
          ...(Object.fromEntries(Object.keys(vazio).map((k) => [k, (cliente as unknown as Record<string, unknown>)[k] ?? ''])) as Formulario),
          aceita_mensagens: cliente.aceita_mensagens === false ? 'nao' : 'sim',
        } as Formulario)
      : vazio,
  )
  const muda = (campo: keyof Formulario) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [campo]: e.target.value }))

  function enviar(e: FormEvent) {
    e.preventDefault()
    aoSalvar(f)
  }

  return (
    <PainelLateral
      titulo={!cliente ? 'Novo cliente' : cliente.nome_completo}
      aoFechar={aoFechar}
      subtitulo={
        cliente && (
          <div className="flex flex-wrap gap-1.5">
            <Etiqueta tom={tomStatus[cliente.status ?? ''] ?? 'cinza'}>{cliente.status || 'Sem status'}</Etiqueta>
            {cliente.responsavel && <Etiqueta tom="dourado">{cliente.responsavel.nome || cliente.responsavel.email}</Etiqueta>}
            {cliente.usuario_id && <Etiqueta tom="verde">Acesso ao portal</Etiqueta>}
          </div>
        )
      }
    >
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={somenteLeitura} className="contents">
          <div className="sm:col-span-2">
            <Campo rotulo="Nome completo *">
              <input className={estiloCampo} value={f.nome_completo} onChange={muda('nome_completo')} required autoFocus={!cliente} />
            </Campo>
          </div>
          <Campo rotulo="CPF / CNPJ">
            <input className={estiloCampo} value={f.cpf_cnpj} onChange={muda('cpf_cnpj')} inputMode="numeric" />
          </Campo>
          <Campo rotulo="Telefone *">
            <input className={estiloCampo} value={f.telefone} onChange={muda('telefone')} required inputMode="tel" />
          </Campo>
          <Campo rotulo="E-mail (libera o acesso ao portal)">
            <input className={estiloCampo} type="email" value={f.email} onChange={muda('email')} />
          </Campo>
          <Campo rotulo="Data de nascimento">
            <input className={estiloCampo} type="date" value={f.data_nascimento} onChange={muda('data_nascimento')} />
          </Campo>
          <Campo rotulo="CEP">
            <input className={estiloCampo} value={f.cep} onChange={muda('cep')} inputMode="numeric" />
          </Campo>
          <Campo rotulo="Endereço">
            <input className={estiloCampo} value={f.endereco} onChange={muda('endereco')} />
          </Campo>
          <Campo rotulo="Bairro">
            <input className={estiloCampo} value={f.bairro} onChange={muda('bairro')} />
          </Campo>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <Campo rotulo="Cidade">
              <input className={estiloCampo} value={f.cidade} onChange={muda('cidade')} />
            </Campo>
            <Campo rotulo="UF">
              <input className={estiloCampo} value={f.estado} onChange={muda('estado')} maxLength={2} />
            </Campo>
          </div>
          <Campo rotulo="Status">
            <select className={estiloCampo} value={f.status} onChange={muda('status')}>
              {statusCliente.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Aceita mensagens (lembretes e retornos)">
            <select className={estiloCampo} value={f.aceita_mensagens} onChange={muda('aceita_mensagens')}>
              <option value="sim">Sim</option>
              <option value="nao">Não — pediu para não receber</option>
            </select>
          </Campo>
          <div className="sm:col-span-2">
            <Campo rotulo="Observações">
              <textarea className={`${estiloCampo} min-h-20`} value={f.observacoes} onChange={muda('observacoes')} />
            </Campo>
          </div>
        </fieldset>
        {somenteLeitura ? (
          <p className="text-xs text-muted sm:col-span-2">Somente o administrador pode alterar ou excluir este cadastro.</p>
        ) : (
          <div className="flex flex-wrap justify-between gap-3 sm:col-span-2">
            {aoExcluir ? (
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
        )}
      </form>
      {cliente && <AtividadesCliente id={cliente.id} />}
    </PainelLateral>
  )
}

// Negociações, compromissos e tarefas ligados ao cliente.
function AtividadesCliente({ id }: { id: string }) {
  const atividades = useQuery({
    queryKey: ['cliente-atividades', id],
    queryFn: async () => {
      const [n, c, t] = await Promise.all([
        supabase.from('negociacoes').select('id, etapa, valor_estimado').eq('cliente_id', id).limit(20),
        supabase.from('compromissos').select('id, titulo, status, inicio').eq('cliente_id', id).order('inicio', { ascending: false }).limit(20),
        supabase.from('tarefas').select('id, titulo, status, data_tarefa').eq('cliente_id', id).order('data_tarefa', { ascending: false }).limit(20),
      ])
      const erro = n.error || c.error || t.error
      if (erro) throw erro
      return {
        negociacoes: (n.data ?? []) as { id: string; etapa: string; valor_estimado: number | null }[],
        compromissos: (c.data ?? []) as { id: string; titulo: string; status: string; inicio: string }[],
        tarefas: (t.data ?? []) as { id: string; titulo: string; status: string; data_tarefa: string }[],
      }
    },
  })
  const d = atividades.data

  return (
    <section className="mt-8 border-t border-line pt-5">
      <h3 className="mb-3 text-sm font-bold normal-case tracking-normal text-white">Atividades</h3>
      {atividades.isPending ? (
        <Carregando />
      ) : atividades.error ? (
        <Aviso>{erroAmigavel(atividades.error)}</Aviso>
      ) : !d?.negociacoes.length && !d?.compromissos.length && !d?.tarefas.length ? (
        <p className="text-sm text-muted">Nada ligado a este cliente ainda.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {d?.negociacoes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-xl bg-ink p-3">
              <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white">Negociação</span>
                <Etiqueta tom={tomEtapa[n.etapa] ?? 'cinza'}>{rotuloEtapa(n.etapa)}</Etiqueta>
                {n.valor_estimado ? <span className="text-xs text-gold">{moeda.format(n.valor_estimado)}</span> : null}
              </div>
            </li>
          ))}
          {d?.compromissos.map((c) => (
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
          {d?.tarefas.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-xl bg-ink p-3">
              <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0">
                <p className={t.status === 'concluida' ? 'text-muted line-through' : 'text-white'}>{t.titulo}</p>
                <p className="text-xs text-muted">
                  {t.data_tarefa.split('-').reverse().join('/')} · {t.status.replace(/_/g, ' ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
