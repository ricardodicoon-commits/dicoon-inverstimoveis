import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, CalendarCheck, CalendarClock, CalendarX, Columns3, List } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, useAoVivo } from '../dados'
import { Kanban } from '../Kanban'
import { categoriasTarefa, etapaFinal, interesses, rotulo, rotuloEtapa, tomEtapa, type Tarefa } from '../tipos'
import { Abas, Aviso, Botao, Cabecalho, Campo, Carregando, CartaoIndicador, Etiqueta, Modal, Vazio, estiloCampo, type Tom } from '../ui'

// Follow-up comercial: retornos ligados às negociações do CRM. Não cria funil novo
// e nunca muda a etapa da negociação. Mensagens são rascunhos: quem envia é uma pessoa.

const FUSO = 'America/Sao_Paulo'
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date())
const dataCurta = (dia: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${dia}T00:00:00Z`))
const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
const linkWhats = (tel: string, texto: string) => `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${encodeURIComponent(texto)}`
const digitos = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '')

const motivos = ['Pediu simulação', 'Aguardando documentos', 'Proposta sem retorno', 'Aguardando retorno da instituição', 'Retomar negociação', 'Outro']
const abertas = ['pendente', 'em_andamento', 'aguardando_terceiro']

interface Neg {
  id: string
  etapa: string
  updated_at: string
  responsavel_id: string | null
  cliente: { nome_completo: string; telefone: string | null } | null
  lead: {
    nome: string
    telefone: string | null
    tipo_interesse: string
  } | null
}
const nomeNeg = (n?: Neg) => n?.cliente?.nome_completo ?? n?.lead?.nome ?? 'Negociação'
const telNeg = (n?: Neg) => digitos(n?.cliente?.telefone ?? n?.lead?.telefone) || null

// Kanban por prazo (não se arrasta: o prazo muda pelo próprio follow-up).
const colunasPrazo = [
  { valor: 'vencidos', rotulo: 'Vencidos', tom: 'vermelho' as Tom },
  { valor: 'hoje', rotulo: 'Hoje', tom: 'dourado' as Tom },
  { valor: 'proximos', rotulo: 'Próximos', tom: 'azul' as Tom },
  {
    valor: 'sem_retorno',
    rotulo: 'Sem retorno (7+ dias)',
    tom: 'ambar' as Tom,
  },
]
type ItemKanban = { id: string; coluna: string; t?: Tarefa; n?: Neg }

export function FollowUp() {
  const { perfil, ehAdmin, ehSecretaria } = useAuth()
  const qc = useQueryClient()
  const [visao, setVisao] = useState<'kanban' | 'lista'>('kanban')
  const [novo, setNovo] = useState<string | null>(null) // id da negociação ('' = escolher)
  const [abrindo, setAbrindo] = useState<Tarefa | null>(null)
  const [aviso, setAviso] = useState<{
    tipo: 'ok' | 'erro'
    texto: string
  } | null>(null)
  const hoje = hojeSP()

  const followUps = useQuery({
    queryKey: ['tarefas', 'follow-up'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tarefas').select('*').eq('tipo', 'follow_up').in('status', abertas).order('data_tarefa').limit(300)
      if (error) throw error
      return data as Tarefa[]
    },
  })
  const negociacoes = useQuery({
    queryKey: ['negociacoes', 'follow-up'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('negociacoes')
        .select('id, etapa, updated_at, responsavel_id, cliente:clientes(nome_completo, telefone), lead:leads(nome, telefone, tipo_interesse)')
        .order('updated_at')
        .limit(500)
      if (error) throw error
      return data as unknown as Neg[]
    },
  })
  useAoVivo('tarefas', ['tarefas'])
  useAoVivo('negociacoes', ['negociacoes'])

  const negs = Object.fromEntries((negociacoes.data ?? []).map((n) => [n.id, n]))
  const lista = followUps.data ?? []
  const comFollowUp = new Set(lista.map((t) => t.negociacao_id).filter(Boolean))
  // Negociações em aberto, sem follow-up programado e paradas há 7 dias ou mais.
  const esquecidas = (negociacoes.data ?? []).filter((n) => n.etapa !== etapaFinal && !comFollowUp.has(n.id) && diasDesde(n.updated_at) >= 7)

  const grupos = [
    {
      titulo: 'Vencidos',
      cor: 'text-red-300',
      itens: lista.filter((t) => t.data_tarefa < hoje),
    },
    {
      titulo: 'Hoje',
      cor: 'text-gold',
      itens: lista.filter((t) => t.data_tarefa === hoje),
    },
    {
      titulo: 'Próximos',
      cor: 'text-white',
      itens: lista.filter((t) => t.data_tarefa > hoje),
    },
  ]

  const itensKanban: ItemKanban[] = [
    ...grupos.flatMap((g, i) =>
      g.itens.map((t) => ({
        id: t.id,
        coluna: colunasPrazo[i].valor,
        t,
        n: t.negociacao_id ? negs[t.negociacao_id] : undefined,
      })),
    ),
    ...esquecidas.map((n) => ({ id: `neg-${n.id}`, coluna: 'sem_retorno', n })),
  ]

  const cartao = ({ t, n }: ItemKanban) =>
    t ? (
      <button onClick={() => setAbrindo(t)} className="block w-full p-3 text-left">
        <p className="font-semibold leading-snug text-white">{n ? nomeNeg(n) : t.titulo}</p>
        <p className="mt-1 text-xs text-muted">{t.motivo ?? t.titulo}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {n && <Etiqueta tom={tomEtapa[n.etapa] ?? 'cinza'}>{rotuloEtapa(n.etapa)}</Etiqueta>}
          <Etiqueta tom="cinza">{rotulo(categoriasTarefa, t.categoria)}</Etiqueta>
        </div>
        {t.proxima_acao && <p className="mt-2 line-clamp-2 text-xs text-white/70">Próxima ação: {t.proxima_acao}</p>}
        <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${t.data_tarefa < hoje ? 'font-semibold text-rose-300' : 'text-white/50'}`}>
          <CalendarClock className="h-3.5 w-3.5" />
          {dataCurta(t.data_tarefa)}
        </p>
      </button>
    ) : (
      <div className="p-3">
        <p className="font-semibold leading-snug text-white">{nomeNeg(n)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {n && <Etiqueta tom={tomEtapa[n.etapa] ?? 'cinza'}>{rotuloEtapa(n.etapa)}</Etiqueta>}
          {n?.lead && <Etiqueta tom="cinza">{rotulo(interesses, n.lead.tipo_interesse)}</Etiqueta>}
          {n && <Etiqueta tom="vermelho">Parada há {diasDesde(n.updated_at)} dias</Etiqueta>}
        </div>
        <button
          onClick={() => n && setNovo(n.id)}
          className="mt-3 w-full rounded-lg border border-line py-1.5 text-xs font-semibold text-white/80 hover:border-gold hover:text-gold"
        >
          Criar follow-up
        </button>
      </div>
    )

  if (followUps.isPending || negociacoes.isPending) return <Carregando />

  return (
    <>
      <Cabecalho titulo="Follow-up">
        <Botao onClick={() => setNovo('')}>+ Novo follow-up</Botao>
      </Cabecalho>
      <p className="mb-6 max-w-3xl text-sm text-muted">
        Retornos programados das negociações. Concluir um follow-up não muda a etapa da negociação. As mensagens são rascunhos: você envia pelo seu WhatsApp e registra aqui.
      </p>
      {aviso && (
        <div className="mb-4">
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}
      {(followUps.error || negociacoes.error) && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(followUps.error || negociacoes.error)}</Aviso>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoIndicador rotulo="Vencidos" valor={grupos[0].itens.length} icone={CalendarX} tom="vermelho" />
        <CartaoIndicador rotulo="Para hoje" valor={grupos[1].itens.length} icone={AlarmClock} tom="dourado" />
        <CartaoIndicador rotulo="Próximos" valor={grupos[2].itens.length} icone={CalendarCheck} tom="azul" />
        <CartaoIndicador rotulo="Negociações sem retorno" valor={esquecidas.length} icone={CalendarClock} tom="ambar" />
      </div>

      <Abas
        abas={[
          { valor: 'kanban', rotulo: 'Kanban', icone: Columns3 },
          { valor: 'lista', rotulo: 'Lista', icone: List },
        ]}
        ativa={visao}
        aoMudar={setVisao}
      />

      {visao === 'kanban' ? (
        <Kanban
          colunas={colunasPrazo}
          itens={itensKanban}
          colunaDe={(i) => i.coluna}
          card={cartao}
          podeMover={() => false}
          aoMover={() => {}}
          aoCriar={() => setNovo('')}
          podeCriar={(c) => c !== 'sem_retorno'}
          vazioColuna="Nada aqui."
        />
      ) : (
        <div className="space-y-8">
          {grupos.map((g) => (
            <Secao key={g.titulo} titulo={g.titulo} cor={g.cor} total={g.itens.length}>
              {g.itens.map((t) => {
                const n = t.negociacao_id ? negs[t.negociacao_id] : undefined
                return (
                  <li key={t.id}>
                    <button onClick={() => setAbrindo(t)} className="w-full rounded-xl border border-line bg-coal p-4 text-left hover:bg-white/5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-white">{n ? nomeNeg(n) : t.titulo}</p>
                        <p className="text-xs text-muted">{dataCurta(t.data_tarefa)}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {t.motivo ?? t.titulo}
                        {t.proxima_acao ? ` · próxima ação: ${t.proxima_acao}` : ''} · {rotulo(categoriasTarefa, t.categoria)}
                        {n ? ` · etapa: ${rotuloEtapa(n.etapa)}` : ''}
                      </p>
                    </button>
                  </li>
                )
              })}
            </Secao>
          ))}

          <Secao titulo="Negociações sem retorno programado (7+ dias paradas)" cor="text-amber-300" total={esquecidas.length}>
            {esquecidas.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-coal p-4">
                <div>
                  <p className="font-semibold text-white">{nomeNeg(n)}</p>
                  <p className="text-xs text-muted">
                    {rotuloEtapa(n.etapa)} · última atualização há {diasDesde(n.updated_at)} dias
                    {n.lead ? ` · ${rotulo(interesses, n.lead.tipo_interesse)}` : ''}
                  </p>
                </div>
                <Botao variante="secundario" onClick={() => setNovo(n.id)}>
                  Criar follow-up
                </Botao>
              </li>
            ))}
          </Secao>
          {!lista.length && !esquecidas.length && <Vazio>Nenhum follow-up programado.</Vazio>}
        </div>
      )}

      {novo !== null && (
        <NovoFollowUp
          negociacaoInicial={novo}
          negociacoes={(negociacoes.data ?? []).filter((n) => n.etapa !== etapaFinal)}
          escolheResponsavel={ehAdmin || ehSecretaria}
          aoFechar={() => setNovo(null)}
          aoSalvar={() => {
            setNovo(null)
            setAviso({ tipo: 'ok', texto: 'Follow-up programado.' })
            qc.invalidateQueries({ queryKey: ['tarefas'] })
          }}
        />
      )}
      {abrindo && (
        <Detalhe
          t={abrindo}
          n={abrindo.negociacao_id ? negs[abrindo.negociacao_id] : undefined}
          podeEditar={ehAdmin || abrindo.criado_por === perfil?.id || (abrindo.responsavel_id === perfil?.id && !ehSecretaria)}
          aoFechar={() => setAbrindo(null)}
          aoConcluir={(texto) => {
            setAbrindo(null)
            setAviso({ tipo: 'ok', texto })
            qc.invalidateQueries({ queryKey: ['tarefas'] })
          }}
        />
      )}
    </>
  )
}

function Secao({ titulo, cor, total, children }: { titulo: string; cor: string; total: number; children: ReactNode }) {
  if (!total) return null
  return (
    <section>
      <h2 className={`mb-2 text-sm font-bold uppercase tracking-wider ${cor}`}>
        {titulo} <span className="text-muted">({total})</span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

function erroFollowUp(e: unknown) {
  return /tarefas_follow_up_unico_idx|duplicate key/i.test((e as Error)?.message ?? '') ? 'Já existe um follow-up em aberto para esta negociação nessa data.' : erroAmigavel(e)
}

function NovoFollowUp({
  negociacaoInicial,
  negociacoes,
  escolheResponsavel,
  aoFechar,
  aoSalvar,
}: {
  negociacaoInicial: string
  negociacoes: Neg[]
  escolheResponsavel: boolean
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const { perfil } = useAuth()
  const inicial = negociacoes.find((n) => n.id === negociacaoInicial)
  const [f, setF] = useState({
    negociacao: negociacaoInicial,
    motivo: motivos[0],
    proxima: '',
    data: hojeSP(),
    categoria:
      inicial?.lead?.tipo_interesse === 'seguro'
        ? 'seguros'
        : inicial?.lead?.tipo_interesse === 'imovel'
          ? 'imobiliaria'
          : inicial?.lead?.tipo_interesse === 'consorcio'
            ? 'consorcios'
            : 'credito',
    responsavel: inicial?.responsavel_id ?? perfil?.id ?? '',
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

  const salvar = useMutation({
    mutationFn: async () => {
      const n = negociacoes.find((x) => x.id === f.negociacao)
      const { error } = await supabase.from('tarefas').insert({
        titulo: `Retorno: ${nomeNeg(n)}`,
        tipo: 'follow_up',
        categoria: f.categoria,
        prioridade: 'alta',
        data_tarefa: f.data,
        motivo: f.motivo,
        proxima_acao: f.proxima || null,
        negociacao_id: f.negociacao,
        responsavel_id: escolheResponsavel ? f.responsavel || perfil!.id : perfil!.id,
        origem: 'follow_up',
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    salvar.mutate()
  }

  return (
    <Modal titulo="Novo follow-up" aoFechar={aoFechar}>
      <form onSubmit={enviar} className="grid gap-4">
        {salvar.error && <Aviso>{erroFollowUp(salvar.error)}</Aviso>}
        <Campo rotulo="Negociação *">
          <select className={estiloCampo} value={f.negociacao} onChange={muda('negociacao')} required>
            <option value="">Selecione</option>
            {negociacoes.map((n) => (
              <option key={n.id} value={n.id}>
                {nomeNeg(n)} · {rotuloEtapa(n.etapa)}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Motivo">
            <select className={estiloCampo} value={f.motivo} onChange={muda('motivo')}>
              {motivos.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data do retorno *">
            <input type="date" className={estiloCampo} value={f.data} onChange={muda('data')} required />
          </Campo>
          <Campo rotulo="Área">
            <select className={estiloCampo} value={f.categoria} onChange={muda('categoria')}>
              {categoriasTarefa
                .filter((c) => ['credito', 'consorcios', 'consignados', 'seguros', 'imobiliaria', 'comercial'].includes(c.valor))
                .map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Próxima ação">
          <input className={estiloCampo} value={f.proxima} onChange={muda('proxima')} placeholder="Ex.: ligar para saber se analisou a simulação" />
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
        <div className="flex justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Programar'}
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

const tiposMensagem = [
  { valor: 'retorno_comercial', rotulo: 'Retorno comercial' },
  {
    valor: 'acompanhamento_de_simulacao',
    rotulo: 'Acompanhamento de simulação',
  },
  { valor: 'solicitacao_de_documentos', rotulo: 'Pedido de documentos' },
]

function Detalhe({ t, n, podeEditar, aoFechar, aoConcluir }: { t: Tarefa; n?: Neg; podeEditar: boolean; aoFechar: () => void; aoConcluir: (texto: string) => void }) {
  const [resultado, setResultado] = useState('')
  const [novaData, setNovaData] = useState(t.data_tarefa)
  const [tipoMsg, setTipoMsg] = useState(
    t.motivo === 'Pediu simulação' ? 'acompanhamento_de_simulacao' : t.motivo === 'Aguardando documentos' ? 'solicitacao_de_documentos' : 'retorno_comercial',
  )
  const [texto, setTexto] = useState<string | null>(null)
  const [rascunhoId, setRascunhoId] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const nome = nomeNeg(n).split(' ')[0]
  const tel = telNeg(n)

  const modelos = useQuery({
    queryKey: ['modelos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modelos_mensagens').select('tipo, texto')
      if (error) throw error
      return Object.fromEntries((data as { tipo: string; texto: string }[]).map((m) => [m.tipo, m.texto]))
    },
  })

  const atualizar = useMutation({
    mutationFn: async ({ campos }: { campos: Partial<Tarefa>; ok: string }) => {
      const { error } = await supabase.from('tarefas').update(campos).eq('id', t.id)
      if (error) throw error
    },
    onSuccess: (_d, v) => aoConcluir(v.ok),
  })

  // Rascunho ligado à negociação: o banco só aceita o telefone do próprio cliente dela.
  const salvarRascunho = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('rascunhos_mensagens')
        .insert({
          tipo: tipoMsg,
          status: 'aprovado',
          destinatario_nome: nomeNeg(n),
          destinatario_telefone: tel,
          conteudo: texto,
          negociacao_id: t.negociacao_id,
        })
        .select('id')
        .single()
      if (error) throw error
      return (data as { id: string }).id
    },
    onSuccess: (id) => setRascunhoId(id),
  })
  const marcarEnviado = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('rascunhos_mensagens')
        .update({
          status: 'enviado_manual',
          enviado_em: new Date().toISOString(),
        })
        .eq('id', rascunhoId!)
      if (error) throw error
    },
  })

  function preparar() {
    const base = modelos.data?.[tipoMsg] ?? ''
    setTexto(base.replaceAll('{nome}', nome).replaceAll('{assunto}', t.proxima_acao || (n?.lead ? rotulo(interesses, n.lead.tipo_interesse).toLowerCase() : 'o seu atendimento')))
    setRascunhoId(null)
  }

  const erro = atualizar.error || salvarRascunho.error || marcarEnviado.error
  return (
    <Modal titulo={n ? `Follow-up: ${nomeNeg(n)}` : t.titulo} aoFechar={aoFechar}>
      {erro && (
        <div className="mb-4">
          <Aviso>{erroFollowUp(erro)}</Aviso>
        </div>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {(
          [
            ['Data prevista', dataCurta(t.data_tarefa)],
            ['Motivo', t.motivo ?? t.titulo],
            ['Próxima ação', t.proxima_acao],
            ['Área', rotulo(categoriasTarefa, t.categoria)],
            ['Etapa da negociação', n ? rotuloEtapa(n.etapa) : null],
            ['Última atualização da negociação', n ? `há ${diasDesde(n.updated_at)} dias` : null],
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
      {t.descricao && <p className="mt-3 whitespace-pre-line text-sm text-white/80">{t.descricao}</p>}

      <div className="mt-6 space-y-3 border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Mensagem para revisão</p>
        {!tel ? (
          <p className="text-sm text-muted">Esta negociação não tem telefone do cliente para preparar mensagem.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <select className={`${estiloCampo} w-auto py-2`} value={tipoMsg} onChange={(e) => setTipoMsg(e.target.value)} aria-label="Tipo de mensagem">
                {tiposMensagem.map((x) => (
                  <option key={x.valor} value={x.valor}>
                    {x.rotulo}
                  </option>
                ))}
              </select>
              <Botao variante="secundario" onClick={preparar} disabled={modelos.isPending}>
                Preparar mensagem
              </Botao>
            </div>
            {texto !== null && (
              <>
                <textarea
                  className={`${estiloCampo} min-h-28`}
                  value={texto}
                  onChange={(e) => {
                    setTexto(e.target.value)
                    setRascunhoId(null)
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {!rascunhoId ? (
                    <Botao onClick={() => salvarRascunho.mutate()} disabled={salvarRascunho.isPending || !texto.trim()}>
                      Aprovar texto
                    </Botao>
                  ) : (
                    <>
                      <Botao
                        variante="secundario"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(texto)
                            setCopiado(true)
                          } catch {
                            setCopiado(false)
                          }
                        }}
                      >
                        {copiado ? 'Copiado' : 'Copiar'}
                      </Botao>
                      <a
                        href={linkWhats(tel, texto)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-white hover:border-gold hover:text-gold"
                      >
                        Abrir no WhatsApp
                      </a>
                      <Botao variante="secundario" onClick={() => marcarEnviado.mutate()} disabled={marcarEnviado.isPending || marcarEnviado.isSuccess}>
                        {marcarEnviado.isSuccess ? 'Envio registrado' : 'Já enviei'}
                      </Botao>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted">O texto só vai para o telefone deste cliente. Nada é enviado sozinho.</p>
              </>
            )}
          </>
        )}
      </div>

      {!podeEditar ? (
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">Somente o administrador, o responsável ou quem criou pode concluir ou mudar este follow-up.</p>
      ) : (
        <div className="mt-6 space-y-3 border-t border-line pt-4">
          <Campo rotulo="Resultado do acompanhamento">
            <textarea
              className={`${estiloCampo} min-h-16`}
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              placeholder="Ex.: cliente vai enviar os documentos na sexta"
            />
          </Campo>
          <div className="flex flex-wrap items-end gap-2">
            <Botao
              onClick={() =>
                atualizar.mutate({
                  campos: { status: 'concluida', resultado: resultado || null },
                  ok: 'Follow-up concluído. A etapa da negociação não foi alterada.',
                })
              }
              disabled={atualizar.isPending}
            >
              Concluir
            </Botao>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Nova data</span>
              <input type="date" className={`${estiloCampo} py-2`} value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            </label>
            <Botao
              variante="secundario"
              disabled={atualizar.isPending || novaData === t.data_tarefa}
              onClick={() =>
                atualizar.mutate({
                  campos: {
                    data_tarefa: novaData,
                    resultado: resultado || t.resultado,
                  },
                  ok: 'Data do retorno alterada.',
                })
              }
            >
              Mudar data
            </Botao>
            <Botao
              variante="perigo"
              onClick={() =>
                confirm('Cancelar este follow-up?') &&
                atualizar.mutate({
                  campos: { status: 'cancelada' },
                  ok: 'Follow-up cancelado.',
                })
              }
            >
              Cancelar
            </Botao>
          </div>
        </div>
      )}
    </Modal>
  )
}
