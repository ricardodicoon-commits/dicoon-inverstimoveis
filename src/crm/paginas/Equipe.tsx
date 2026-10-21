import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, useAoVivo } from '../dados'
import type { Papel, Perfil } from '../tipos'
import { Aviso, Botao, Cabecalho, Carregando, estiloCampo } from '../ui'

const chave = ['equipe']

export function Equipe() {
  const { perfil: eu } = useAuth()
  const qc = useQueryClient()
  const { data, isPending, error } = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('aprovado').order('created_at', { ascending: false })
      if (error) throw error
      return data as Perfil[]
    },
  })
  useAoVivo('profiles', chave)

  const alterar = useMutation({
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<Perfil> }) => {
      const { error } = await supabase.from('profiles').update(campos).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<Perfil[]>(chave)
      qc.setQueryData<Perfil[]>(chave, (l) => l?.map((p) => (p.id === id ? { ...p, ...campos } : p)))
      return { antes }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(chave, ctx?.antes),
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })

  const pendentes = data?.filter((p) => !p.aprovado) ?? []
  const aprovados = data?.filter((p) => p.aprovado) ?? []

  function Linha({ p }: { p: Perfil }) {
    const souEu = p.id === eu?.id
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-coal p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">
            {p.nome || p.email} {souEu && <span className="text-xs text-gold">(você)</span>}
          </p>
          <p className="truncate text-sm text-muted">{p.email}</p>
        </div>
        <select
          className={`${estiloCampo} w-36`}
          value={p.role}
          disabled={souEu}
          onChange={(e) => alterar.mutate({ id: p.id, campos: { role: e.target.value as Papel } })}
          aria-label="Função"
        >
          <option value="atendente">Atendente</option>
          <option value="corretor">Corretor</option>
          <option value="admin">Administrador</option>
        </select>
        {!p.aprovado ? (
          <>
            <Botao onClick={() => alterar.mutate({ id: p.id, campos: { aprovado: true, ativo: true } })}>Aprovar</Botao>
            <Botao variante="perigo" onClick={() => alterar.mutate({ id: p.id, campos: { ativo: false } })} disabled={!p.ativo}>
              {p.ativo ? 'Recusar' : 'Recusado'}
            </Botao>
          </>
        ) : (
          !souEu && (
            <Botao
              variante={p.ativo ? 'perigo' : 'secundario'}
              onClick={() => alterar.mutate({ id: p.id, campos: { ativo: !p.ativo } })}
            >
              {p.ativo ? 'Desativar' : 'Reativar'}
            </Botao>
          )
        )}
      </div>
    )
  }

  return (
    <>
      <Cabecalho titulo="Equipe" />
      {error && <Aviso>{erroAmigavel(error)}</Aviso>}
      {alterar.error && <Aviso>{erroAmigavel(alterar.error)}</Aviso>}
      {isPending ? (
        <Carregando />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-bold text-gold">Aguardando aprovação ({pendentes.length})</h2>
            <div className="space-y-3">
              {pendentes.length ? pendentes.map((p) => <Linha key={p.id} p={p} />) : <p className="text-sm text-muted">Nenhum pedido de acesso.</p>}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-bold text-gold">Com acesso ({aprovados.length})</h2>
            <div className="space-y-3">
              {aprovados.map((p) => (
                <Linha key={p.id} p={p} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
