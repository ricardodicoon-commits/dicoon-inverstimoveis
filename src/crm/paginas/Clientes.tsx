import { useDeferredValue, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, limparBusca, useAoVivo } from '../dados'
import { statusCliente, type Cliente } from '../tipos'
import { Aviso, Botao, Cabecalho, Campo, Carregando, Modal, Vazio, estiloCampo } from '../ui'

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
}
type Formulario = typeof vazio

export function Clientes() {
  const { sessao, ehAdmin } = useAuth()
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const termo = limparBusca(useDeferredValue(busca))
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null)

  const chave = ['clientes', termo, pagina]
  const { data, isPending, error, isPlaceholderData } = useQuery({
    queryKey: chave,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from('clientes')
        .select('*, responsavel:profiles(nome, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)
      if (termo) q = q.or(`nome_completo.ilike.%${termo}%,cpf_cnpj.ilike.%${termo}%,telefone.ilike.%${termo}%,email.ilike.%${termo}%`)
      const { data, error, count } = await q
      if (error) throw error
      return { lista: data as Cliente[], total: count ?? 0 }
    },
  })
  useAoVivo('clientes', ['clientes'])

  const salvar = useMutation({
    mutationFn: async ({ id, campos }: { id?: string; campos: Formulario }) => {
      const linha = {
        ...campos,
        data_nascimento: campos.data_nascimento || null,
        estado: campos.estado.toUpperCase() || null,
      }
      const { error } = id
        ? await supabase.from('clientes').update(linha).eq('id', id)
        : await supabase.from('clientes').insert({ ...linha, responsavel_id: sessao!.user.id })
      if (error) throw error
    },
    // Mostra na lista na hora; se o banco recusar, volta como estava.
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: ['clientes'] })
      const antes = qc.getQueriesData({ queryKey: ['clientes'] })
      qc.setQueriesData<{ lista: Cliente[]; total: number }>({ queryKey: ['clientes'] }, (atual) => {
        if (!atual) return atual
        if (id) return { ...atual, lista: atual.lista.map((c) => (c.id === id ? { ...c, ...campos } : c)) }
        const temporario = { ...campos, id: `tmp-${Date.now()}`, responsavel_id: sessao!.user.id, created_at: new Date().toISOString() } as Cliente
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

  const total = data?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <>
      <Cabecalho titulo="Clientes">
        <Botao onClick={() => setEditando('novo')}>+ Novo cliente</Botao>
      </Cabecalho>

      <input
        className={`${estiloCampo} mb-4`}
        placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value)
          setPagina(0)
        }}
      />
      {(error || salvar.error || excluir.error) && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(error || salvar.error || excluir.error)}</Aviso>
        </div>
      )}

      {isPending ? (
        <Carregando />
      ) : !data?.lista.length ? (
        <Vazio>{termo ? 'Nenhum cliente encontrado para essa busca.' : 'Nenhum cliente cadastrado ainda.'}</Vazio>
      ) : (
        <div className={`overflow-hidden rounded-2xl border border-line transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <table className="w-full text-left text-sm">
            <thead className="hidden bg-coal text-xs uppercase tracking-wider text-muted md:table-header-group">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Status</th>
                {ehAdmin && <th className="px-4 py-3">Responsável</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.lista.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => !c.id.startsWith('tmp-') && setEditando(c)}
                  className={`block cursor-pointer px-4 py-3 hover:bg-white/5 md:table-row md:p-0 ${c.id.startsWith('tmp-') ? 'opacity-60' : ''}`}
                >
                  <td className="block font-semibold text-white md:table-cell md:px-4 md:py-3">{c.nome_completo}</td>
                  <td className="block text-muted md:table-cell md:px-4 md:py-3">{c.telefone}</td>
                  <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{[c.cidade, c.estado].filter(Boolean).join('/')}</td>
                  <td className="hidden md:table-cell md:px-4 md:py-3">
                    <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs text-gold">{c.status || '—'}</span>
                  </td>
                  {ehAdmin && (
                    <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{c.responsavel?.nome || c.responsavel?.email}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > POR_PAGINA && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {total} clientes · página {pagina + 1} de {paginas}
          </span>
          <div className="flex gap-2">
            <Botao variante="secundario" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Botao>
            <Botao variante="secundario" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>
              Próxima
            </Botao>
          </div>
        </div>
      )}

      {editando && (
        <FormCliente
          cliente={editando === 'novo' ? null : editando}
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

function FormCliente({
  cliente,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  cliente: Cliente | null
  aoFechar: () => void
  aoSalvar: (campos: Formulario) => void
  aoExcluir?: () => void
}) {
  const [f, setF] = useState<Formulario>(() =>
    cliente
      ? (Object.fromEntries(Object.keys(vazio).map((k) => [k, (cliente as unknown as Record<string, unknown>)[k] ?? ''])) as Formulario)
      : vazio,
  )
  const muda = (campo: keyof Formulario) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [campo]: e.target.value }))

  function enviar(e: FormEvent) {
    e.preventDefault()
    aoSalvar(f)
  }

  return (
    <Modal titulo={cliente ? 'Editar cliente' : 'Novo cliente'} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Nome completo *">
            <input className={estiloCampo} value={f.nome_completo} onChange={muda('nome_completo')} required autoFocus />
          </Campo>
        </div>
        <Campo rotulo="CPF / CNPJ">
          <input className={estiloCampo} value={f.cpf_cnpj} onChange={muda('cpf_cnpj')} inputMode="numeric" />
        </Campo>
        <Campo rotulo="Telefone *">
          <input className={estiloCampo} value={f.telefone} onChange={muda('telefone')} required inputMode="tel" />
        </Campo>
        <Campo rotulo="E-mail">
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
        <div className="sm:col-span-2">
          <Campo rotulo="Observações">
            <textarea className={`${estiloCampo} min-h-20`} value={f.observacoes} onChange={muda('observacoes')} />
          </Campo>
        </div>
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
      </form>
    </Modal>
  )
}
