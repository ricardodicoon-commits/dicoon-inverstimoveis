import { lazy, Suspense, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlarmClock, CircleDollarSign, Handshake, ListTodo, UserCheck, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, moeda, useAoVivo } from '../dados'
import { etapaFinal, etapas, tomEtapa } from '../tipos'
import { Aviso, Cabecalho, Carregando, CartaoIndicador, tons } from '../ui'

// Gráficos carregados sob demanda (a biblioteca de gráficos não pesa a abertura do app).
const GraficoLinhas = lazy(() => import('../Graficos').then((m) => ({ default: m.GraficoLinhas })))
const GraficoRosca = lazy(() => import('../Graficos').then((m) => ({ default: m.GraficoRosca })))

const SEMANAS = 8
const DIA = 24 * 60 * 60 * 1000

// Quantos registros entraram em cada uma das últimas semanas (a última é a atual).
function porSemana(datas: string[]) {
  const agora = Date.now()
  const contagem = Array<number>(SEMANAS).fill(0)
  for (const d of datas) {
    const semanasAtras = Math.floor((agora - new Date(d).getTime()) / (7 * DIA))
    if (semanasAtras >= 0 && semanasAtras < SEMANAS) contagem[SEMANAS - 1 - semanasAtras]++
  }
  return contagem
}
const rotuloSemana = (i: number) => {
  if (i === SEMANAS - 1) return 'Esta'
  const d = new Date(Date.now() - (SEMANAS - 1 - i) * 7 * DIA)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d)
}
function ultimos30(datas: string[]) {
  const limite = Date.now() - 30 * DIA
  return datas.filter((d) => new Date(d).getTime() >= limite).length
}

async function linhas<T>(tabela: string, colunas: string) {
  const { data, error } = await supabase.from(tabela).select(colunas).limit(5000)
  if (error) throw error
  return (data ?? []) as T[]
}

export function Painel() {
  const { perfil, ehAdmin } = useAuth()
  const { data, isPending, error } = useQuery({
    queryKey: ['painel', ehAdmin],
    queryFn: async () => {
      const [leads, tarefas, clientes, negociacoes, equipe] = await Promise.all([
        linhas<{ created_at: string; status: string }>('leads', 'created_at, status'),
        linhas<{ status: string; data_tarefa: string }>('tarefas', 'status, data_tarefa'),
        linhas<{ created_at: string }>('clientes', 'created_at'),
        linhas<{ created_at: string; etapa: string; valor_estimado: number | null }>('negociacoes', 'created_at, etapa, valor_estimado'),
        ehAdmin ? linhas<{ aprovado: boolean; ativo: boolean }>('profiles', 'aprovado, ativo') : Promise.resolve([]),
      ])
      return { leads, tarefas, clientes, negociacoes, equipe }
    },
  })
  useAoVivo('leads', ['painel'])
  useAoVivo('tarefas', ['painel'])
  useAoVivo('clientes', ['painel'])
  useAoVivo('negociacoes', ['painel'])

  const nome = perfil?.nome?.split(' ')[0] || 'bem-vindo'
  if (isPending) {
    return (
      <>
        <Cabecalho titulo={`Olá, ${nome}`} />
        <Carregando />
      </>
    )
  }
  if (error || !data) {
    return (
      <>
        <Cabecalho titulo={`Olá, ${nome}`} />
        <Aviso>Não foi possível carregar o painel: {erroAmigavel(error)}</Aviso>
      </>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const pendentes = data.tarefas.filter((t) => t.status === 'pendente')
  const abertas = data.negociacoes.filter((n) => n.etapa !== etapaFinal)
  const valorAberto = abertas.reduce((s, n) => s + (n.valor_estimado ?? 0), 0)

  const sLeads = porSemana(data.leads.map((l) => l.created_at))
  const sClientes = porSemana(data.clientes.map((c) => c.created_at))
  const sNeg = porSemana(data.negociacoes.map((n) => n.created_at))
  const semanas = sLeads.map((_, i) => ({ semana: rotuloSemana(i), leads: sLeads[i], clientes: sClientes[i], negociacoes: sNeg[i] }))
  const temMovimento = [...sLeads, ...sClientes, ...sNeg].some((v) => v > 0)
  const porEtapa = etapas.map((e) => ({ rotulo: e.rotulo, valor: data.negociacoes.filter((n) => n.etapa === e.valor).length, cor: tons[tomEtapa[e.valor] ?? 'cinza'].hex }))

  const indicadores: { rotulo: string; valor: ReactNode; icone: typeof Users; tom: keyof typeof tons; para: string; detalhe?: string }[] = [
    { rotulo: 'Leads novos sem atendimento', valor: data.leads.filter((l) => l.status === 'novo').length, icone: UserPlus, tom: 'azul', para: '/app/atendimento' },
    { rotulo: 'Tarefas pendentes', valor: pendentes.length, icone: ListTodo, tom: 'ambar', para: '/app/tarefas' },
    { rotulo: 'Tarefas atrasadas', valor: pendentes.filter((t) => t.data_tarefa < hoje).length, icone: AlarmClock, tom: 'vermelho', para: '/app/tarefas' },
    { rotulo: 'Negociações em aberto', valor: abertas.length, icone: Handshake, tom: 'roxo', para: '/app/negociacoes', detalhe: `${ultimos30(data.negociacoes.map((n) => n.created_at))} novas em 30 dias` },
    { rotulo: 'Clientes', valor: data.clientes.length, icone: Users, tom: 'ciano', para: '/app/clientes', detalhe: `${ultimos30(data.clientes.map((c) => c.created_at))} novos em 30 dias` },
    { rotulo: 'Valor estimado em aberto', valor: valorAberto > 0 ? moeda.format(valorAberto) : '–', icone: CircleDollarSign, tom: 'dourado', para: '/app/negociacoes' },
  ]

  return (
    <>
      <Cabecalho titulo={`Olá, ${nome}`} />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {indicadores.map((i) => (
          <Link key={i.rotulo} to={i.para}>
            <CartaoIndicador rotulo={i.rotulo} valor={i.valor} icone={i.icone} tom={i.tom} detalhe={i.detalhe} />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Bloco titulo="Movimento nas últimas 8 semanas" className="xl:col-span-2">
          {temMovimento ? (
            <Suspense fallback={<Carregando />}>
              <GraficoLinhas
                dados={semanas}
                series={[
                  { chave: 'leads', rotulo: 'Leads', cor: tons.azul.hex },
                  { chave: 'clientes', rotulo: 'Clientes', cor: tons.ciano.hex },
                  { chave: 'negociacoes', rotulo: 'Negociações', cor: tons.dourado.hex },
                ]}
              />
            </Suspense>
          ) : (
            <p className="py-10 text-center text-sm text-muted">Sem movimento nas últimas 8 semanas.</p>
          )}
        </Bloco>

        <Bloco titulo="Negociações por etapa" link="/app/negociacoes">
          {data.negociacoes.length ? (
            <Suspense fallback={<Carregando />}>
              <GraficoRosca dados={porEtapa} total={data.negociacoes.length} legendaTotal="no total" />
            </Suspense>
          ) : (
            <p className="py-10 text-center text-sm text-muted">Nenhuma negociação cadastrada ainda.</p>
          )}
        </Bloco>

        {ehAdmin && (
          <Bloco titulo="Equipe" link="/app/equipe">
            <div className="grid grid-cols-2 gap-3">
              <CartaoIndicador rotulo="Ativos" valor={data.equipe.filter((p) => p.ativo && p.aprovado).length} icone={UserCheck} tom="verde" />
              <CartaoIndicador rotulo="Aguardando aprovação" valor={data.equipe.filter((p) => !p.aprovado).length} icone={AlarmClock} tom="ambar" />
            </div>
          </Bloco>
        )}
      </div>
    </>
  )
}

function Bloco({ titulo, link, className = '', children }: { titulo: string; link?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-coal p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold normal-case tracking-normal text-white">{titulo}</h2>
        {link && (
          <Link to={link} className="text-xs font-semibold text-muted hover:text-gold">
            Abrir →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
