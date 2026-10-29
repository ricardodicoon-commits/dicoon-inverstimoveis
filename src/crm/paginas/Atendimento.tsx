import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, useAoVivo } from '../dados'
import { interesses, rotulo, rotuloConexao, statusLead, type Canal, type Lead, type Tarefa } from '../tipos'
import { Aviso, Botao, Cabecalho, Campo, Carregando, Modal, Vazio, estiloCampo } from '../ui'

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const hoje = () => new Date().toISOString().slice(0, 10)

// Atendimento da Secretária: enquanto o WhatsApp não estiver conectado ao sistema,
// quem atende no celular cadastra aqui o lead, e o CRM cria negociação e tarefa sozinho.
export function Atendimento() {
  const { ehAdmin } = useAuth()
  const qc = useQueryClient()
  const [cadastrando, setCadastrando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

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
      const { data, error } = await supabase
        .from('tarefas')
        .select('*')
        .eq('status', 'pendente')
        .order('data_tarefa')
        .limit(100)
      if (error) throw error
      return data as Tarefa[]
    },
  })

  const leads = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return data as Lead[]
    },
  })
  useAoVivo('tarefas', ['tarefas'])
  useAoVivo('leads', ['leads'])

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tarefas').update({ status: 'concluida' }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tarefas'] }),
  })

  const mudarStatus = useMutation({
    mutationFn: async ({ id, ...campos }: { id: string; status?: string; aceita_mensagens?: boolean }) => {
      const { error } = await supabase.from('leads').update(campos).eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })

  const erro = canal.error || tarefas.error || leads.error || concluir.error || mudarStatus.error

  return (
    <>
      <Cabecalho titulo="Atendimento">
        <Botao onClick={() => setCadastrando(true)}>+ Novo lead do WhatsApp</Botao>
      </Cabecalho>

      {canal.data && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-coal px-5 py-4 text-sm">
          <span className="font-semibold text-white">{canal.data.nome}</span>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
            {rotuloConexao[canal.data.conexao]}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
            {canal.data.modo === 'standby' ? 'Standby' : 'Ativo'}
          </span>
          <span className="text-muted">
            {canal.data.conexao === 'conectado'
              ? 'As mensagens entram sozinhas no CRM.'
              : 'O atendimento é feito no celular. Cadastre aqui cada novo lead.'}
          </span>
        </div>
      )}

      {aviso && (
        <div className="mb-4">
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}
      {erro && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(erro)}</Aviso>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Tarefas pendentes</h2>
          {tarefas.isPending ? (
            <Carregando />
          ) : !tarefas.data?.length ? (
            <Vazio>Nenhuma tarefa pendente.</Vazio>
          ) : (
            <ul className="space-y-2">
              {tarefas.data.map((t) => {
                const atrasada = t.data_tarefa < hoje()
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-coal p-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{t.titulo}</p>
                      <p className={`text-xs ${atrasada ? 'text-red-300' : 'text-muted'}`}>
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
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Leads recentes</h2>
          {leads.isPending ? (
            <Carregando />
          ) : !leads.data?.length ? (
            <Vazio>Nenhum lead ainda. Use “+ Novo lead do WhatsApp” quando alguém chamar no celular.</Vazio>
          ) : (
            <ul className="space-y-2">
              {leads.data.map((l) => (
                <li key={l.id} className="rounded-xl border border-line bg-coal p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{l.nome}</p>
                      <p className="text-xs text-muted">
                        {rotulo(interesses, l.tipo_interesse)} · {l.origem_lead} · {dataCurta.format(new Date(l.created_at))}
                      </p>
                    </div>
                    <a
                      href={`https://wa.me/${l.telefone.startsWith('55') ? l.telefone : `55${l.telefone}`}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-gold hover:underline"
                    >
                      Abrir no WhatsApp
                    </a>
                  </div>
                  {l.observacoes && <p className="mt-2 line-clamp-2 text-xs text-muted">{l.observacoes}</p>}
                  <select
                    className={`${estiloCampo} mt-3 py-1.5 text-xs`}
                    value={l.status}
                    onChange={(e) => mudarStatus.mutate({ id: l.id, status: e.target.value })}
                    aria-label="Situação do lead"
                  >
                    {statusLead.map((s) => (
                      <option key={s.valor} value={s.valor}>
                        {s.rotulo}
                      </option>
                    ))}
                  </select>
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={l.aceita_mensagens !== false}
                      onChange={(e) => mudarStatus.mutate({ id: l.id, aceita_mensagens: e.target.checked })}
                    />
                    Aceita mensagens (lembretes e retornos)
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
