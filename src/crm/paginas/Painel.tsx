import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { moeda, useAoVivo } from '../dados'
import { etapaFinal, etapas } from '../tipos'
import { Cabecalho, Carregando } from '../ui'

const SEMANAS = 8
const DIA = 24 * 60 * 60 * 1000

// Conta quantos registros entraram em cada uma das últimas semanas (a última é a atual).
function porSemana(datas: string[]) {
  const agora = Date.now()
  const contagem = Array<number>(SEMANAS).fill(0)
  for (const d of datas) {
    const semanasAtras = Math.floor((agora - new Date(d).getTime()) / (7 * DIA))
    if (semanasAtras >= 0 && semanasAtras < SEMANAS) contagem[SEMANAS - 1 - semanasAtras]++
  }
  return contagem
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
  const { data, isPending } = useQuery({
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
  if (isPending || !data) {
    return (
      <>
        <Cabecalho titulo={`Olá, ${nome}`} />
        <Carregando />
      </>
    )
  }

  const datasLeads = data.leads.map((l) => l.created_at)
  const pendentes = data.tarefas.filter((t) => t.status === 'pendente')
  const hoje = new Date().toISOString().slice(0, 10)
  const datasClientes = data.clientes.map((c) => c.created_at)
  const datasNegociacoes = data.negociacoes.map((n) => n.created_at)
  const abertas = data.negociacoes.filter((n) => n.etapa !== etapaFinal)
  const valorAberto = abertas.reduce((s, n) => s + (n.valor_estimado ?? 0), 0)
  const porEtapa = etapas.map((e) => ({ ...e, total: data.negociacoes.filter((n) => n.etapa === e.valor).length }))

  return (
    <>
      <Cabecalho titulo={`Olá, ${nome}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CartaoAba
          titulo="Atendimento"
          link="/app/atendimento"
          numeros={[
            { rotulo: 'Leads novos sem atendimento', valor: data.leads.filter((l) => l.status === 'novo').length },
            { rotulo: 'Tarefas pendentes', valor: pendentes.length },
            { rotulo: 'Atrasadas', valor: pendentes.filter((t) => t.data_tarefa < hoje).length },
          ]}
        >
          <Semanas valores={porSemana(datasLeads)} legenda="Leads por semana" />
        </CartaoAba>

        <CartaoAba
          titulo="Clientes"
          link="/app/clientes"
          numeros={[
            { rotulo: 'Total', valor: data.clientes.length },
            { rotulo: 'Novos em 30 dias', valor: ultimos30(datasClientes) },
          ]}
        >
          <Semanas valores={porSemana(datasClientes)} legenda="Cadastros por semana" />
        </CartaoAba>

        <CartaoAba
          titulo="Negociações"
          link="/app/negociacoes"
          numeros={[
            { rotulo: 'Em aberto', valor: abertas.length },
            { rotulo: 'Novas em 30 dias', valor: ultimos30(datasNegociacoes) },
          ]}
          extra={valorAberto > 0 ? `${moeda.format(valorAberto)} estimados em aberto` : undefined}
        >
          <Semanas valores={porSemana(datasNegociacoes)} legenda="Negociações criadas por semana" />
          <Etapas itens={porEtapa} />
        </CartaoAba>

        {ehAdmin && (
          <CartaoAba
            titulo="Equipe"
            link="/app/equipe"
            numeros={[
              { rotulo: 'Ativos', valor: data.equipe.filter((p) => p.ativo && p.aprovado).length },
              { rotulo: 'Aguardando aprovação', valor: data.equipe.filter((p) => !p.aprovado).length },
            ]}
          />
        )}
      </div>
    </>
  )
}

function CartaoAba({
  titulo,
  link,
  numeros,
  extra,
  children,
}: {
  titulo: string
  link: string
  numeros: { rotulo: string; valor: number }[]
  extra?: string
  children?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-coal p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gold">{titulo}</h2>
        <Link to={link} className="text-xs font-semibold text-muted hover:text-gold">
          Abrir →
        </Link>
      </div>
      <div className="flex flex-wrap gap-8">
        {numeros.map((n) => (
          <div key={n.rotulo}>
            <p className="text-4xl font-bold text-white">{n.valor}</p>
            <p className="mt-1 text-xs text-muted">{n.rotulo}</p>
          </div>
        ))}
      </div>
      {extra && <p className="mt-3 text-sm text-gold">{extra}</p>}
      {children && <div className="mt-6 space-y-6">{children}</div>}
    </section>
  )
}

// Barras das últimas semanas; sem movimento, explica em vez de desenhar barras vazias.
function Semanas({ valores, legenda }: { valores: number[]; legenda: string }) {
  const maior = Math.max(...valores)
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{legenda}</p>
      {maior === 0 ? (
        <p className="text-sm text-muted">Sem movimento nas últimas {SEMANAS} semanas.</p>
      ) : (
        <>
          <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`${legenda}: ${valores.join(', ')}`}>
            {valores.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${v}`}>
                {v > 0 && <span className="text-[10px] text-muted">{v}</span>}
                <div
                  className={`w-full rounded-t ${i === valores.length - 1 ? 'bg-gold' : 'bg-gold/50'}`}
                  style={{ height: `${Math.max((v / maior) * 100, v > 0 ? 6 : 2)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>{SEMANAS} semanas atrás</span>
            <span>esta semana</span>
          </div>
        </>
      )}
    </div>
  )
}

function Etapas({ itens }: { itens: { valor: string; rotulo: string; total: number }[] }) {
  const maior = Math.max(...itens.map((i) => i.total))
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Por etapa</p>
      {maior === 0 ? (
        <p className="text-sm text-muted">Nenhuma negociação cadastrada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((i) => (
            <li key={i.valor} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
              <span className="text-white">{i.rotulo}</span>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-gold" style={{ width: `${(i.total / maior) * 100}%` }} />
              </div>
              <span className="text-right text-muted">{i.total}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
