import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { erroAmigavel, useAoVivo } from '../dados'
import { BellRing, CircleHelp, MessageCircleQuestion, UserX } from 'lucide-react'
import { rotulo, statusAtivosCompromisso, statusCompromisso, tomStatusCompromisso, type LembreteEnvio } from '../tipos'
import { Aviso, Botao, Cabecalho, Carregando, CartaoIndicador, Etiqueta, Vazio, estiloCampo } from '../ui'

// MODO ASSISTIDO: a Secretária prepara e avisa; quem envia é uma pessoa, que registra o envio
// e a resposta. Nada aqui envia mensagem sozinho nem marca envio sem alguém registrar.

const FUSO = 'America/Sao_Paulo'
const quando = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const linkWhats = (tel: string, texto: string) => `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${encodeURIComponent(texto)}`
const primeiroNome = (texto: string | null) => (texto?.match(/^Olá, ([^!,]+)/)?.[1] ?? '').trim()

const SELECT = '*, compromisso:compromissos(titulo, inicio, fim, status)'

interface CompromissoAberto {
  id: string
  titulo: string
  inicio: string
  fim: string
  status: string
}

export function Confirmacoes() {
  const qc = useQueryClient()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const lembretes = useQuery({
    queryKey: ['lembretes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lembretes_envios')
        .select(SELECT)
        .in('status', ['pendente', 'enviado_manual', 'sem_resposta', 'sem_contato', 'sem_permissao', 'respondido'])
        .order('enviar_em')
        .limit(300)
      if (error) throw error
      return data as LembreteEnvio[]
    },
    refetchInterval: 60_000, // a lista "na hora de enviar" anda sozinha com o relógio
  })

  // Já passou do horário e ninguém disse se aconteceu.
  const semValidacao = useQuery({
    queryKey: ['compromissos', 'sem-validacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compromissos')
        .select('id, titulo, inicio, fim, status')
        .lt('fim', new Date().toISOString())
        .in('status', [...statusAtivosCompromisso, 'cancelamento_solicitado'])
        .order('inicio')
        .limit(100)
      if (error) throw error
      return data as CompromissoAberto[]
    },
    refetchInterval: 60_000,
  })

  const modelos = useQuery({
    queryKey: ['modelos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modelos_mensagens').select('tipo, texto')
      if (error) throw error
      return Object.fromEntries((data as { tipo: string; texto: string }[]).map((m) => [m.tipo, m.texto]))
    },
  })
  useAoVivo('lembretes_envios', ['lembretes'])
  useAoVivo('compromissos', ['compromissos'])

  const acao = useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown>; ok: string }) => {
      const { error } = await supabase.rpc(fn, args)
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      setMsg({ tipo: 'ok', texto: v.ok })
      qc.invalidateQueries({ queryKey: ['lembretes'] })
      qc.invalidateQueries({ queryKey: ['compromissos'] })
      qc.invalidateQueries({ queryKey: ['tarefas'] })
    },
    onError: (e) => setMsg({ tipo: 'erro', texto: /permissão|Registre|pendente|validado|aconteceu|inválid/.test((e as Error).message) ? (e as Error).message : erroAmigavel(e) }),
  })

  const todos = lembretes.data ?? []
  const agora = Date.now()
  const confirmacao = todos.filter((l) => l.etapa === 'confirmacao')
  const aEnviar = confirmacao.filter((l) => l.status === 'pendente')
  const aguardando = confirmacao.filter((l) => l.status === 'enviado_manual' || l.status === 'sem_resposta')
  const followUps = todos.filter((l) => l.etapa === 'follow_up_falta' && ['pendente', 'enviado_manual', 'respondido'].includes(l.status) && l.compromisso?.status === 'follow_up_pendente')
  const semCanal = todos.filter((l) => (l.status === 'sem_contato' || l.status === 'sem_permissao') && (l.compromisso?.status ?? '') !== 'cancelado')
  const modelo = (tipo: string, nome: string) => (modelos.data?.[tipo] ?? '').replaceAll('{nome}', nome)

  if (lembretes.isPending || semValidacao.isPending) return <Carregando />

  return (
    <>
      <Cabecalho titulo="Confirmações" />
      <p className="mb-6 max-w-3xl text-sm text-muted">
        Lembretes de confirmação (pelo menos 1 hora antes) e follow-up de quem faltou. Modo assistido: você envia pelo seu WhatsApp e registra aqui.
        Nada é enviado sozinho. Os avisos só aparecem com o CRM aberto.
      </p>
      {msg && (
        <div className="mb-4">
          <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>
        </div>
      )}
      {(lembretes.error || semValidacao.error) && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(lembretes.error || semValidacao.error)}</Aviso>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoIndicador rotulo="Lembretes a enviar" valor={aEnviar.length} icone={BellRing} tom="dourado" detalhe={`${aEnviar.filter((l) => new Date(l.enviar_em).getTime() <= agora).length} para agora`} />
        <CartaoIndicador rotulo="Aguardando resposta" valor={aguardando.length} icone={MessageCircleQuestion} tom="azul" />
        <CartaoIndicador rotulo="Sem validação de comparecimento" valor={semValidacao.data?.length ?? 0} icone={CircleHelp} tom="ambar" />
        <CartaoIndicador rotulo="Follow-up de falta" valor={followUps.length} icone={UserX} tom="vermelho" />
      </div>

      <div className="space-y-8">
        <Secao titulo="Lembretes a enviar" total={aEnviar.length} vazio="Nenhum lembrete a enviar.">
          {aEnviar.map((l) => {
            const naHora = new Date(l.enviar_em).getTime() <= agora
            return (
              <Cartao key={l.id} l={l} destaque={naHora ? 'Enviar agora' : `Enviar a partir de ${quando(l.enviar_em)}`} destaqueCor={naHora ? 'text-gold' : 'text-muted'}>
                <Mensagem l={l} texto={l.mensagem ?? ''} />
                <Botao disabled={acao.isPending} onClick={() => acao.mutate({ fn: 'fn_lembrete_enviado', args: { p_lembrete: l.id }, ok: 'Envio registrado. Agora aguarde a resposta do cliente.' })}>
                  Já enviei
                </Botao>
              </Cartao>
            )
          })}
        </Secao>

        <Secao titulo="Aguardando resposta" total={aguardando.length} vazio="Ninguém aguardando resposta.">
          {aguardando.map((l) => (
            <RespostaConfirmacao key={l.id} l={l} esclarecimento={modelo('pedido_esclarecimento', primeiroNome(l.mensagem))} ocupado={acao.isPending} aoResponder={(opcao, texto, ok) => acao.mutate({ fn: 'fn_lembrete_resposta', args: { p_lembrete: l.id, p_opcao: opcao, p_texto: texto || null }, ok })} />
          ))}
        </Secao>

        <Secao titulo="Confirmar se o atendimento aconteceu" total={semValidacao.data?.length ?? 0} vazio="Nenhum compromisso passado sem validação.">
          {semValidacao.data?.map((c) => (
            <Validacao key={c.id} c={c} ocupado={acao.isPending} aoValidar={(compareceu, obs) => acao.mutate({ fn: 'fn_validar_comparecimento', args: { p_compromisso: c.id, p_compareceu: compareceu, p_obs: obs || null }, ok: compareceu ? 'Marcado como concluído.' : 'Registrado o não comparecimento. O follow-up foi preparado abaixo.' })} />
          ))}
        </Secao>

        <Secao titulo="Follow-up de não comparecimento" total={followUps.length} vazio="Nenhum follow-up em andamento.">
          {followUps.map((l) => (
            <FollowUp key={l.id} l={l} modelo={modelo} ocupado={acao.isPending}
              aoEnviar={() => acao.mutate({ fn: 'fn_lembrete_enviado', args: { p_lembrete: l.id }, ok: 'Envio registrado. Faça as perguntas uma de cada vez.' })}
              aoResponder={(pergunta, resposta, desfecho) => acao.mutate({ fn: 'fn_follow_up_resposta', args: { p_lembrete: l.id, p_pergunta: pergunta, p_resposta: resposta, p_desfecho: desfecho }, ok: desfecho ? 'Follow-up concluído.' : 'Resposta registrada.' })}
            />
          ))}
        </Secao>

        {!!semCanal.length && (
          <Secao titulo="Sem canal para avisar" total={semCanal.length} vazio="">
            {semCanal.map((l) => (
              <Cartao key={l.id} l={l} destaque={l.status === 'sem_permissao' ? 'O contato pediu para não receber mensagens' : 'Contato sem telefone válido'} destaqueCor="text-amber-300">
                <p className="text-xs text-muted">Foi criada uma tarefa para o responsável confirmar por outro meio.</p>
              </Cartao>
            ))}
          </Secao>
        )}
      </div>
    </>
  )
}

function Secao({ titulo, total, vazio, children }: { titulo: string; total: number; vazio: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">
        {titulo} <span className="text-muted">({total})</span>
      </h2>
      {total ? <div className="grid gap-3 lg:grid-cols-2">{children}</div> : <Vazio>{vazio}</Vazio>}
    </section>
  )
}

function Cartao({ l, destaque, destaqueCor, children }: { l: LembreteEnvio; destaque: string; destaqueCor: string; children: ReactNode }) {
  return (
    <article className="space-y-3 rounded-2xl border border-line bg-coal p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-white">{l.compromisso?.titulo ?? 'Compromisso'}</p>
        <p className={`text-xs font-semibold ${destaqueCor}`}>{destaque}</p>
      </div>
      {l.compromisso && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {quando(l.compromisso.inicio)}
          <Etiqueta tom={tomStatusCompromisso[l.compromisso.status] ?? 'cinza'}>{rotulo(statusCompromisso, l.compromisso.status)}</Etiqueta>
        </p>
      )}
      {children}
    </article>
  )
}

// Texto pronto para copiar ou abrir no WhatsApp do próprio contato do compromisso.
function Mensagem({ l, texto }: { l: LembreteEnvio; texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-line rounded-lg bg-ink p-3 text-sm text-white/90">{texto}</p>
      <div className="flex flex-wrap gap-2">
        <Botao
          type="button"
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
        {l.destinatario_telefone && (
          <a href={linkWhats(l.destinatario_telefone, texto)} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-white hover:border-gold hover:text-gold">
            Abrir no WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}

function RespostaConfirmacao({ l, esclarecimento, ocupado, aoResponder }: { l: LembreteEnvio; esclarecimento: string; ocupado: boolean; aoResponder: (opcao: string, texto: string, ok: string) => void }) {
  const [texto, setTexto] = useState('')
  const [pedirEsclarecimento, setPedirEsclarecimento] = useState(false)
  return (
    <Cartao l={l} destaque={l.status === 'sem_resposta' ? 'Sem resposta até agora' : 'Lembrete enviado'} destaqueCor={l.status === 'sem_resposta' ? 'text-amber-300' : 'text-muted'}>
      <input className={`${estiloCampo} py-2`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que o cliente respondeu (opcional)" />
      <div className="flex flex-wrap gap-2">
        <Botao disabled={ocupado} onClick={() => aoResponder('confirmo', texto, 'Confirmado.')}>1 · Confirmou</Botao>
        <Botao disabled={ocupado} variante="secundario" onClick={() => aoResponder('remarcar', texto, 'Pedido de remarcação registrado. Tarefa criada.')}>2 · Remarcar</Botao>
        <Botao disabled={ocupado} variante="secundario" onClick={() => aoResponder('nao_comparecer', texto, 'Registrado que não poderá comparecer. Tarefa para oferecer novo horário.')}>3 · Não poderá</Botao>
        <Botao disabled={ocupado} variante="secundario" onClick={() => setPedirEsclarecimento(true)}>Resposta confusa</Botao>
        {l.status !== 'sem_resposta' && (
          <Botao disabled={ocupado} variante="secundario" onClick={() => aoResponder('sem_resposta', texto, 'Sem resposta registrada. Tarefa de acompanhamento criada.')}>Sem resposta</Botao>
        )}
      </div>
      {pedirEsclarecimento && (
        <>
          <Mensagem l={l} texto={esclarecimento} />
          <Botao variante="secundario" disabled={ocupado} onClick={() => aoResponder('ambigua', texto, 'Resposta registrada; o compromisso segue aguardando confirmação.')}>
            Registrar resposta confusa
          </Botao>
        </>
      )}
    </Cartao>
  )
}

function Validacao({ c, ocupado, aoValidar }: { c: CompromissoAberto; ocupado: boolean; aoValidar: (compareceu: boolean, obs: string) => void }) {
  const [obs, setObs] = useState('')
  return (
    <article className="space-y-3 rounded-2xl border border-line bg-coal p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-white">{c.titulo}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs text-amber-300">
          {quando(c.inicio)}
          <Etiqueta tom={tomStatusCompromisso[c.status] ?? 'cinza'}>{rotulo(statusCompromisso, c.status)}</Etiqueta>
        </p>
      </div>
      <input className={`${estiloCampo} py-2`} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" />
      <div className="flex flex-wrap gap-2">
        <Botao disabled={ocupado} onClick={() => aoValidar(true, obs)}>Aconteceu</Botao>
        <Botao disabled={ocupado} variante="perigo" onClick={() => confirm('Confirmar que o cliente não compareceu? Será preparado o follow-up.') && aoValidar(false, obs)}>
          Não compareceu
        </Botao>
      </div>
    </article>
  )
}

// Uma pergunta por vez; a pessoa registra cada resposta e escolhe o desfecho.
function FollowUp({
  l,
  modelo,
  ocupado,
  aoEnviar,
  aoResponder,
}: {
  l: LembreteEnvio
  modelo: (tipo: string, nome: string) => string
  ocupado: boolean
  aoEnviar: () => void
  aoResponder: (pergunta: number, resposta: string, desfecho: string | null) => void
}) {
  const [resposta, setResposta] = useState('')
  const nome = primeiroNome(l.mensagem)
  const respondidas = Object.keys(l.respostas ?? {}).length
  const proxima = Math.min(respondidas + 1, 3)

  if (l.status === 'pendente') {
    return (
      <Cartao l={l} destaque="Enviar a primeira mensagem" destaqueCor="text-gold">
        <Mensagem l={l} texto={l.mensagem ?? ''} />
        <Botao disabled={ocupado} onClick={aoEnviar}>Já enviei</Botao>
      </Cartao>
    )
  }
  return (
    <Cartao l={l} destaque={`Pergunta ${proxima} de 3`} destaqueCor="text-gold">
      {respondidas > 0 && (
        <ul className="space-y-1 text-xs text-muted">
          {Object.entries(l.respostas).map(([k, v]) => (
            <li key={k}>
              Resposta {k.slice(1)}: <span className="text-white/90">{v}</span>
            </li>
          ))}
        </ul>
      )}
      {respondidas < 3 && <Mensagem l={l} texto={modelo(`follow_up_pergunta_${proxima}`, nome)} />}
      <input className={`${estiloCampo} py-2`} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Resposta do cliente (com as palavras dele)" />
      <div className="flex flex-wrap gap-2">
        {respondidas < 3 && (
          <Botao disabled={ocupado || !resposta.trim()} onClick={() => { aoResponder(proxima, resposta, null); setResposta('') }}>
            Registrar e seguir
          </Botao>
        )}
        <Botao disabled={ocupado} variante="secundario" onClick={() => aoResponder(proxima, resposta, 'remarcar')}>Quer remarcar</Botao>
        <Botao disabled={ocupado} variante="secundario" onClick={() => aoResponder(proxima, resposta, 'encerrar')}>Encerrar</Botao>
        <Botao disabled={ocupado} variante="secundario" onClick={() => aoResponder(proxima, resposta, 'humano')}>Precisa de atendente</Botao>
        <Botao disabled={ocupado} variante="secundario" onClick={() => aoResponder(proxima, resposta, 'sem_resposta')}>Sem resposta</Botao>
      </div>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Mensagens de fechamento</summary>
        <div className="mt-2 space-y-2">
          <Mensagem l={l} texto={modelo('follow_up_remarcar', nome)} />
          <Mensagem l={l} texto={modelo('follow_up_encerramento', nome)} />
        </div>
      </details>
    </Cartao>
  )
}
