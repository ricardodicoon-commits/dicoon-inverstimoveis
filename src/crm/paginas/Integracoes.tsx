import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { erroAmigavel } from '../dados'
import { rotuloConexao, type Canal, type RespostaAprovada } from '../tipos'
import { Aviso, Botao, Cabecalho, Carregando, estiloCampo } from '../ui'

// Só o admin: estado do canal de WhatsApp e respostas aprovadas da Secretária.
export function Integracoes() {
  const qc = useQueryClient()

  const canal = useQuery({
    queryKey: ['canal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('canais').select('*').limit(1).maybeSingle()
      if (error) throw error
      return data as Canal | null
    },
  })

  const respostas = useQuery({
    queryKey: ['respostas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('respostas_aprovadas').select('*').order('ordem')
      if (error) throw error
      return data as RespostaAprovada[]
    },
  })

  const salvar = useMutation({
    mutationFn: async (r: Pick<RespostaAprovada, 'id' | 'texto' | 'ativa'>) => {
      const { error } = await supabase
        .from('respostas_aprovadas')
        .update({ texto: r.texto, ativa: r.ativa, updated_at: new Date().toISOString() })
        .eq('id', r.id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['respostas'] }),
  })

  const c = canal.data
  return (
    <>
      <Cabecalho titulo="Integrações" />
      {(canal.error || respostas.error || salvar.error) && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(canal.error || respostas.error || salvar.error)}</Aviso>
        </div>
      )}

      <section className="mb-8 rounded-2xl border border-line bg-coal p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gold">WhatsApp da Secretária</h2>
        {canal.isPending ? (
          <Carregando />
        ) : !c ? (
          <p className="text-sm text-muted">Canal ainda não criado no banco (rode o script 05).</p>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-3 sm:grid-cols-4">
              <Item rotulo="Conexão" valor={rotuloConexao[c.conexao]} />
              <Item rotulo="Modo" valor={c.modo === 'standby' ? 'Standby' : 'Ativo'} />
              <Item rotulo="Número" valor={c.numero || 'A definir'} />
              <Item rotulo="Provedor" valor={c.provedor || 'A definir no start'} />
            </dl>
            <p className="text-muted">
              Enquanto estiver em standby, nada é enviado ou recebido automaticamente: o atendimento acontece no
              WhatsApp Business do celular, e os leads são cadastrados em Atendimento. A ativação acontece no dia do
              start, depois de escolher o provedor e configurar as chaves no servidor (nunca aqui).
            </p>
            <Botao disabled title="Disponível no dia do start">
              Ativar Secretária
            </Botao>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-gold">Respostas aprovadas</h2>
        <p className="mb-4 text-sm text-muted">
          Os mesmos textos das respostas rápidas do celular. Não prometa aprovação, taxas ou valores.
        </p>
        {respostas.isPending ? (
          <Carregando />
        ) : (
          <div className="space-y-3">
            {respostas.data?.map((r) => (
              <Resposta key={r.id} resposta={r} salvando={salvar.isPending} aoSalvar={(texto, ativa) => salvar.mutate({ id: r.id, texto, ativa })} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{rotulo}</dt>
      <dd className="mt-1 font-semibold text-white">{valor}</dd>
    </div>
  )
}

function Resposta({
  resposta,
  salvando,
  aoSalvar,
}: {
  resposta: RespostaAprovada
  salvando: boolean
  aoSalvar: (texto: string, ativa: boolean) => void
}) {
  const [texto, setTexto] = useState(resposta.texto)
  const [ativa, setAtiva] = useState(resposta.ativa)
  const mudou = texto !== resposta.texto || ativa !== resposta.ativa
  return (
    <article className="rounded-xl border border-line bg-coal p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-white">
          {resposta.titulo} <span className="text-xs font-normal text-muted">/{resposta.atalho}</span>
        </p>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
          Ativa
        </label>
      </div>
      <textarea className={`${estiloCampo} min-h-24`} value={texto} onChange={(e) => setTexto(e.target.value)} />
      {mudou && (
        <div className="mt-2 flex justify-end gap-2">
          <Botao
            variante="secundario"
            onClick={() => {
              setTexto(resposta.texto)
              setAtiva(resposta.ativa)
            }}
          >
            Desfazer
          </Botao>
          <Botao onClick={() => aoSalvar(texto, ativa)} disabled={salvando || !texto.trim()}>
            Salvar
          </Botao>
        </div>
      )}
    </article>
  )
}
