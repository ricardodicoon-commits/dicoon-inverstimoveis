import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, useAoVivo } from '../dados'
import { categoriasTarefa, rotulo, statusAtivosCompromisso, statusCompromisso, type Compromisso, type Tarefa } from '../tipos'
import { Aviso, Botao, Cabecalho, Carregando, estiloCampo } from '../ui'

// Resumo do dia da Secretária: só números reais, calculados ao abrir a página.

const FUSO = 'America/Sao_Paulo'
const diaSP = (d: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(d))
const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const diaCurto = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(iso))
const dataExtenso = () => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'full' }).format(new Date())
function saudacao() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
const pesoPrioridade: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }
const abertas = ['pendente', 'em_andamento', 'aguardando_terceiro']
const DIA = 86_400_000

interface Nota {
  id: string
  tipo: 'nota' | 'ideia'
  texto: string
  created_at: string
}

export function Secretaria() {
  const { perfil } = useAuth()
  const [periodo, setPeriodo] = useState<7 | 30>(7)

  const dados = useQuery({
    queryKey: ['secretaria', 'resumo'],
    queryFn: async () => {
      const agora = Date.now()
      const desde = new Date(agora - 30 * DIA).toISOString()
      const ate = new Date(agora + 8 * DIA).toISOString()
      const [comp, tarAbertas, tarFeitas, lemb] = await Promise.all([
        supabase.from('compromissos').select('*').gte('inicio', desde).lt('inicio', ate).order('inicio').limit(1000),
        supabase.from('tarefas').select('*').in('status', abertas).limit(1000),
        supabase.from('tarefas').select('id, tipo, categoria, concluida_em').eq('status', 'concluida').gte('concluida_em', desde).limit(2000),
        supabase.from('lembretes_envios').select('id, enviar_em').eq('status', 'pendente').lte('enviar_em', new Date(agora).toISOString()),
      ])
      for (const r of [comp, tarAbertas, tarFeitas, lemb]) if (r.error) throw r.error
      return {
        compromissos: comp.data as Compromisso[],
        abertas: tarAbertas.data as Tarefa[],
        feitas: tarFeitas.data as { id: string; tipo: string; categoria: string; concluida_em: string }[],
        lembretesAgora: (lemb.data ?? []).length,
      }
    },
    refetchInterval: 60_000,
  })
  useAoVivo('compromissos', ['secretaria'])
  useAoVivo('tarefas', ['secretaria'])
  useAoVivo('lembretes_envios', ['secretaria'])

  const nome = perfil?.nome?.split(' ')[0] || ''
  if (dados.isPending) return <Carregando />
  if (dados.error || !dados.data) {
    return (
      <>
        <Cabecalho titulo="Resumo do dia" />
        <Aviso>Não foi possível carregar o resumo: {erroAmigavel(dados.error)}</Aviso>
      </>
    )
  }

  const { compromissos, abertas: tarefas, feitas, lembretesAgora } = dados.data
  const agora = Date.now()
  const hoje = diaSP(new Date())
  const ativos = compromissos.filter((c) => statusAtivosCompromisso.includes(c.status))
  const deHoje = ativos.filter((c) => diaSP(c.inicio) === hoje)
  const proximos = ativos.filter((c) => new Date(c.inicio).getTime() > agora).slice(0, 8)
  const aConfirmar = ativos.filter((c) => (c.status === 'a_confirmar' || c.status === 'aguardando_confirmacao') && new Date(c.inicio).getTime() > agora)
  const visitas = ativos.filter((c) => c.categoria === 'visita_imobiliaria' && new Date(c.inicio).getTime() > agora)
  const semPreparo = ativos.filter((c) => {
    const t = new Date(c.inicio).getTime()
    return t > agora && t < agora + 2 * DIA && !c.objetivo?.trim()
  })
  const semValidacao = compromissos.filter((c) => [...statusAtivosCompromisso, 'cancelamento_solicitado'].includes(c.status) && new Date(c.fim).getTime() < agora)

  const atrasadas = tarefas.filter((t) => t.data_tarefa < hoje)
  const followUps = tarefas.filter((t) => t.tipo === 'follow_up')
  const followHoje = followUps.filter((t) => t.data_tarefa === hoje)
  const followAtrasados = followUps.filter((t) => t.data_tarefa < hoje)
  const proximosPrazos = tarefas.filter((t) => t.data_tarefa >= hoje && t.data_tarefa <= diaSP(new Date(agora + 3 * DIA)))
  // Sugestão (não altera nada): atrasadas primeiro, depois prioridade e prazo.
  const prioritarias = [...tarefas]
    .sort((a, b) => Number(b.data_tarefa < hoje) - Number(a.data_tarefa < hoje) || (pesoPrioridade[a.prioridade] ?? 9) - (pesoPrioridade[b.prioridade] ?? 9) || a.data_tarefa.localeCompare(b.data_tarefa))
    .slice(0, 3)
  const porCategoria = categoriasTarefa.map((c) => ({ ...c, total: tarefas.filter((t) => t.categoria === c.valor).length })).filter((c) => c.total)
  const maiorCategoria = Math.max(1, ...porCategoria.map((c) => c.total))

  const inicioPeriodo = agora - periodo * DIA
  const noPeriodo = (iso: string) => new Date(iso).getTime() >= inicioPeriodo && new Date(iso).getTime() <= agora
  const resumo = [
    { r: 'Compromissos realizados', v: compromissos.filter((c) => c.status === 'realizado' && noPeriodo(c.inicio)).length },
    { r: 'Não compareceram', v: compromissos.filter((c) => ['nao_compareceu', 'follow_up_pendente'].includes(c.status) && noPeriodo(c.inicio)).length },
    { r: 'Cancelados', v: compromissos.filter((c) => c.status === 'cancelado' && noPeriodo(c.inicio)).length },
    { r: 'Tarefas concluídas', v: feitas.filter((t) => t.tipo !== 'follow_up' && noPeriodo(t.concluida_em)).length },
    { r: 'Follow-ups concluídos', v: feitas.filter((t) => t.tipo === 'follow_up' && noPeriodo(t.concluida_em)).length },
  ]

  const indicadores = [
    { r: 'Compromissos hoje', v: deHoje.length, link: '/app/agenda', cor: 'text-white' },
    { r: 'A confirmar', v: aConfirmar.length, link: '/app/confirmacoes', cor: 'text-amber-300' },
    { r: 'Lembretes para enviar agora', v: lembretesAgora, link: '/app/confirmacoes', cor: 'text-gold' },
    { r: 'Sem validação de comparecimento', v: semValidacao.length, link: '/app/confirmacoes', cor: 'text-amber-300' },
    { r: 'Tarefas pendentes', v: tarefas.length, link: '/app/tarefas', cor: 'text-white' },
    { r: 'Tarefas atrasadas', v: atrasadas.length, link: '/app/tarefas', cor: 'text-red-300' },
    { r: 'Follow-ups de hoje', v: followHoje.length, link: '/app/follow-up', cor: 'text-gold' },
    { r: 'Retornos atrasados', v: followAtrasados.length, link: '/app/follow-up', cor: 'text-red-300' },
  ]

  return (
    <>
      <Cabecalho titulo={nome ? `${saudacao()}, ${nome}` : 'Resumo do dia'} />
      <p className="-mt-4 mb-6 text-sm capitalize text-muted">{dataExtenso()}</p>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {indicadores.map((i) => (
          <Link key={i.r} to={i.link} className="rounded-2xl border border-line bg-coal p-4 hover:border-gold/60">
            <p className={`text-3xl font-bold ${i.cor}`}>{i.v}</p>
            <p className="mt-1 text-xs text-muted">{i.r}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Bloco titulo="Agenda de hoje" link="/app/agenda">
          {deHoje.length ? (
            <ul className="space-y-2">
              {deHoje.map((c) => (
                <LinhaCompromisso key={c.id} c={c} />
              ))}
            </ul>
          ) : (
            <Nada>Nenhum compromisso hoje.</Nada>
          )}
        </Bloco>

        <Bloco titulo="As 3 prioridades" link="/app/tarefas">
          {prioritarias.length ? (
            <ol className="space-y-2">
              {prioritarias.map((t, i) => (
                <li key={t.id} className="flex items-start gap-3 rounded-xl bg-ink p-3">
                  <span className="text-lg font-bold text-gold">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{t.titulo}</p>
                    <p className={`text-xs ${t.data_tarefa < hoje ? 'text-red-300' : 'text-muted'}`}>
                      {t.data_tarefa < hoje ? 'Atrasada · ' : ''}
                      prazo {diaCurto(`${t.data_tarefa}T12:00:00-03:00`)} · prioridade {t.prioridade} · {rotulo(categoriasTarefa, t.categoria)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Nada>Nenhuma tarefa em aberto.</Nada>
          )}
          <p className="mt-2 text-[11px] text-muted">Sugestão por prazo e prioridade; nada é alterado automaticamente.</p>
        </Bloco>

        <Bloco titulo="Próximas reuniões e visitas" link="/app/agenda">
          {proximos.length ? (
            <ul className="space-y-2">
              {proximos.map((c) => (
                <LinhaCompromisso key={c.id} c={c} comDia />
              ))}
            </ul>
          ) : (
            <Nada>Nada marcado nos próximos 7 dias.</Nada>
          )}
          {!!visitas.length && <p className="mt-2 text-xs text-muted">{visitas.length} visita(s) a imobiliária programada(s).</p>}
        </Bloco>

        <Bloco titulo="Precisa de atenção" link="/app/confirmacoes">
          <ul className="space-y-2 text-sm">
            <Alerta n={semPreparo.length} texto="reunião(ões) nas próximas 48 h sem objetivo definido (preparar)" link="/app/agenda" />
            <Alerta n={aConfirmar.length} texto="compromisso(s) aguardando confirmação do cliente" link="/app/confirmacoes" />
            <Alerta n={semValidacao.length} texto="compromisso(s) passado(s) sem dizer se aconteceu" link="/app/confirmacoes" />
            <Alerta n={followAtrasados.length} texto="retorno(s) comercial(is) atrasado(s)" link="/app/follow-up" />
            <Alerta n={proximosPrazos.length} texto="tarefa(s) com prazo nos próximos 3 dias" link="/app/tarefas" />
            {!semPreparo.length && !aConfirmar.length && !semValidacao.length && !followAtrasados.length && !proximosPrazos.length && (
              <li className="text-muted">Tudo em dia.</li>
            )}
          </ul>
        </Bloco>

        <Bloco titulo="Tarefas abertas por área" link="/app/tarefas">
          {porCategoria.length ? (
            <ul className="space-y-2">
              {porCategoria.map((c) => (
                <li key={c.valor} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
                  <span className="text-white">{c.rotulo}</span>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gold" style={{ width: `${(c.total / maiorCategoria) * 100}%` }} />
                  </div>
                  <span className="text-right text-muted">{c.total}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Nada>Nenhuma tarefa em aberto.</Nada>
          )}
        </Bloco>

        <Bloco
          titulo="Resumo do período"
          extra={
            <select className={`${estiloCampo} w-auto py-1 text-xs`} value={periodo} onChange={(e) => setPeriodo(Number(e.target.value) as 7 | 30)} aria-label="Período">
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
            </select>
          }
        >
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {resumo.map((x) => (
              <div key={x.r} className="rounded-xl bg-ink p-3">
                <dt className="text-xs text-muted">{x.r}</dt>
                <dd className="text-2xl font-bold text-white">{x.v}</dd>
              </div>
            ))}
          </dl>
        </Bloco>
      </div>

      <Notas />
      <p className="mt-8 text-xs text-muted">Os avisos aparecem quando o CRM está aberto. Lembretes automáticos fora do sistema dependem do start da Secretária.</p>
    </>
  )
}

function Bloco({ titulo, link, extra, children }: { titulo: string; link?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-coal p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gold">{titulo}</h2>
        {extra ?? (link && (
          <Link to={link} className="text-xs font-semibold text-muted hover:text-gold">
            Abrir →
          </Link>
        ))}
      </div>
      {children}
    </section>
  )
}

const Nada = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted">{children}</p>

function LinhaCompromisso({ c, comDia }: { c: Compromisso; comDia?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-3 rounded-xl bg-ink p-3">
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">{c.titulo}</p>
        <p className="text-xs text-muted">
          {rotulo(statusCompromisso, c.status)}
          {c.local ? ` · ${c.local}` : ''}
        </p>
      </div>
      <p className="shrink-0 text-xs font-semibold text-gold">
        {comDia ? `${diaCurto(c.inicio)} ` : ''}
        {hora(c.inicio)}
      </p>
    </li>
  )
}

function Alerta({ n, texto, link }: { n: number; texto: string; link: string }) {
  if (!n) return null
  return (
    <li>
      <Link to={link} className="flex items-center gap-3 rounded-xl bg-ink p-3 hover:bg-white/5">
        <span className="min-w-8 rounded-full bg-amber-500/15 px-2 py-0.5 text-center text-xs font-bold text-amber-300">{n}</span>
        <span className="text-white/90">{texto}</span>
      </Link>
    </li>
  )
}

// Anotações rápidas e ideias para depois (cada um vê as suas; admin e secretária veem todas).
function Notas() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [tipo, setTipo] = useState<'nota' | 'ideia'>('nota')

  const notas = useQuery({
    queryKey: ['notas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notas').select('id, tipo, texto, created_at').eq('arquivada', false).eq('autor_id', perfil!.id).order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return data as Nota[]
    },
    enabled: Boolean(perfil?.id),
  })
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notas').insert({ tipo, texto: texto.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['notas'] })
    },
  })
  const arquivar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notas').update({ arquivada: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas'] }),
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (texto.trim()) salvar.mutate()
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-coal p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Anotações e ideias</h2>
      {(notas.error || salvar.error || arquivar.error) && (
        <div className="mb-3">
          <Aviso>{erroAmigavel(notas.error || salvar.error || arquivar.error)}</Aviso>
        </div>
      )}
      <form onSubmit={enviar} className="mb-4 flex flex-wrap gap-2">
        <select className={`${estiloCampo} w-auto`} value={tipo} onChange={(e) => setTipo(e.target.value as 'nota' | 'ideia')} aria-label="Tipo">
          <option value="nota">Anotação</option>
          <option value="ideia">Ideia</option>
        </select>
        <input className={`${estiloCampo} min-w-48 flex-1`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva e pressione Enter (não registre senhas nem documentos)" />
        <Botao type="submit" disabled={salvar.isPending || !texto.trim()}>
          Guardar
        </Botao>
      </form>
      {notas.isPending ? null : !notas.data?.length ? (
        <p className="text-sm text-muted">Nenhuma anotação.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {notas.data.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 rounded-xl bg-ink p-3 text-sm">
              <div className="min-w-0">
                <p className={`text-[11px] font-bold uppercase tracking-wider ${n.tipo === 'ideia' ? 'text-sky-300' : 'text-muted'}`}>{n.tipo === 'ideia' ? 'Ideia' : 'Anotação'}</p>
                <p className="whitespace-pre-line text-white/90">{n.texto}</p>
              </div>
              <button onClick={() => arquivar.mutate(n.id)} className="shrink-0 text-xs text-muted hover:text-gold" aria-label="Arquivar">
                Arquivar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
