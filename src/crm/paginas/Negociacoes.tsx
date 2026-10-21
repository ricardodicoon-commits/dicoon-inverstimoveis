import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, moeda, useAoVivo } from '../dados'
import { etapas, type Negociacao } from '../tipos'
import { Aviso, Botao, Cabecalho, Campo, Carregando, Modal, Vazio, estiloCampo } from '../ui'

const chave = ['negociacoes']

export function Negociacoes() {
  const { sessao, ehAdmin } = useAuth()
  const qc = useQueryClient()
  const [editando, setEditando] = useState<Negociacao | 'nova' | null>(null)

  const { data, isPending, error } = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('negociacoes')
        .select('*, cliente:clientes(nome_completo)')
        .order('updated_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as Negociacao[]
    },
  })
  useAoVivo('negociacoes', chave)

  const salvar = useMutation({
    mutationFn: async ({ id, campos }: { id?: string; campos: Partial<Negociacao> }) => {
      const { error } = id
        ? await supabase.from('negociacoes').update(campos).eq('id', id)
        : await supabase.from('negociacoes').insert({ ...campos, responsavel_id: sessao!.user.id })
      if (error) throw error
    },
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<Negociacao[]>(chave)
      if (id) qc.setQueryData<Negociacao[]>(chave, (l) => l?.map((n) => (n.id === id ? { ...n, ...campos } : n)))
      setEditando(null)
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
    onSuccess: () => setEditando(null),
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })

  return (
    <>
      <Cabecalho titulo="Negociações">
        <Botao onClick={() => setEditando('nova')}>+ Nova negociação</Botao>
      </Cabecalho>
      {(error || salvar.error || excluir.error) && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(error || salvar.error || excluir.error)}</Aviso>
        </div>
      )}

      {isPending ? (
        <Carregando />
      ) : !data?.length ? (
        <Vazio>Nenhuma negociação ainda. Cadastre um cliente e crie a primeira.</Vazio>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {etapas.map((etapa) => {
            const itens = data.filter((n) => n.etapa === etapa)
            const soma = itens.reduce((s, n) => s + (n.valor_estimado ?? 0), 0)
            return (
              <section key={etapa} className="w-72 shrink-0 rounded-2xl border border-line bg-coal p-3">
                <header className="mb-3 px-1">
                  <p className="text-sm font-bold text-white">
                    {etapa} <span className="text-muted">({itens.length})</span>
                  </p>
                  {soma > 0 && <p className="text-xs text-gold">{moeda.format(soma)}</p>}
                </header>
                <div className="space-y-2">
                  {itens.map((n) => (
                    <article key={n.id} className="rounded-xl border border-line bg-ink p-3">
                      <button onClick={() => setEditando(n)} className="w-full text-left">
                        <p className="font-semibold text-white">{n.cliente?.nome_completo ?? 'Cliente'}</p>
                        {n.valor_estimado != null && <p className="text-sm text-gold">{moeda.format(n.valor_estimado)}</p>}
                        {n.observacoes && <p className="mt-1 line-clamp-2 text-xs text-muted">{n.observacoes}</p>}
                      </button>
                      <select
                        className={`${estiloCampo} mt-2 py-1.5 text-xs`}
                        value={n.etapa}
                        onChange={(e) => salvar.mutate({ id: n.id, campos: { etapa: e.target.value } })}
                        aria-label="Mudar etapa"
                      >
                        {etapas.map((et) => (
                          <option key={et}>{et}</option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {editando && (
        <FormNegociacao
          negociacao={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(campos) => salvar.mutate({ id: editando === 'nova' ? undefined : editando.id, campos })}
          aoExcluir={
            ehAdmin && editando !== 'nova'
              ? () => {
                  if (confirm('Excluir esta negociação? Esta ação não pode ser desfeita.')) excluir.mutate(editando.id)
                }
              : undefined
          }
        />
      )}
    </>
  )
}

function FormNegociacao({
  negociacao,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  negociacao: Negociacao | null
  aoFechar: () => void
  aoSalvar: (campos: Partial<Negociacao>) => void
  aoExcluir?: () => void
}) {
  const [clienteId, setClienteId] = useState(negociacao?.cliente_id ?? '')
  const [valor, setValor] = useState(negociacao?.valor_estimado?.toString() ?? '')
  const [etapa, setEtapa] = useState(negociacao?.etapa ?? etapas[0])
  const [obs, setObs] = useState(negociacao?.observacoes ?? '')

  const clientes = useQuery({
    queryKey: ['clientes', 'opcoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id, nome_completo').order('nome_completo').limit(1000)
      if (error) throw error
      return data as { id: string; nome_completo: string }[]
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    aoSalvar({
      cliente_id: clienteId,
      valor_estimado: valor ? Number(valor.replace(/\./g, '').replace(',', '.')) : null,
      etapa,
      observacoes: obs || null,
    })
  }

  return (
    <Modal titulo={negociacao ? 'Editar negociação' : 'Nova negociação'} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="grid gap-4">
        <Campo rotulo="Cliente *">
          <select className={estiloCampo} value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
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
                <option key={et}>{et}</option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Observações">
          <textarea className={`${estiloCampo} min-h-24`} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
        <div className="flex flex-wrap justify-between gap-3">
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
