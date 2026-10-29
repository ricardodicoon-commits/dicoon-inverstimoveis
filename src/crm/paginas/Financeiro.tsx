import { lazy, Suspense, useDeferredValue, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlarmClock,
  ArrowDownCircle,
  ArrowUpCircle,
  Columns3,
  Download,
  Landmark,
  LayoutDashboard,
  List,
  Plus,
  Repeat,
  Search,
  Settings2,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { baixarCsv, erroAmigavel, moeda, useAoVivo } from '../dados'
import { Kanban } from '../Kanban'
import { Abas, Aviso, Botao, Cabecalho, Campo, Carregando, CartaoIndicador, Etiqueta, PainelLateral, Vazio, estiloCampo, type Tom } from '../ui'

// Financeiro da Dicoon (só o admin: o banco bloqueia os demais, ver supabase/10-financeiro.sql).
// Sem integração com bancos: tudo é lançado aqui. DRE pela competência, caixa pela data do pagamento.

const GraficoCaixa = lazy(() => import('../Graficos').then((m) => ({ default: m.GraficoCaixa })))

interface Categoria {
  id: string
  nome: string
  tipo: 'receita' | 'despesa'
  linha_dre: string
  grupo_dfc: string
  ordem: number
  ativa: boolean
}
interface Conta {
  id: string
  nome: string
  tipo: 'banco' | 'caixa' | 'aplicacao'
  saldo_inicial: number
  data_saldo_inicial: string
  ativa: boolean
}
interface Saldo {
  conta_id: string
  saldo_atual: number
}
interface Lancamento {
  id: string
  tipo: 'receber' | 'pagar'
  descricao: string
  categoria_id: string
  conta_id: string | null
  valor: number
  competencia: string
  vencimento: string
  status: 'pendente' | 'pago' | 'cancelado'
  pago_em: string | null
  valor_pago: number | null
  forma_pagamento: string | null
  parceiro: string | null
  cliente_id: string | null
  negociacao_id: string | null
  recorrencia: string | null
  observacoes: string | null
}

const linhasDre = [
  { valor: 'receita_bruta', rotulo: 'Receita bruta' },
  { valor: 'deducoes', rotulo: 'Deduções (impostos)' },
  { valor: 'custo_servico', rotulo: 'Custo do serviço' },
  { valor: 'despesa_operacional', rotulo: 'Despesa operacional' },
  { valor: 'depreciacao', rotulo: 'Depreciação' },
  { valor: 'resultado_financeiro', rotulo: 'Resultado financeiro' },
  { valor: 'fora_dre', rotulo: 'Fora da DRE' },
]
const gruposDfc = [
  { valor: 'operacional', rotulo: 'Operacional' },
  { valor: 'investimento', rotulo: 'Investimento' },
  { valor: 'financiamento', rotulo: 'Financiamento' },
]
const formas = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'debito_automatico', rotulo: 'Débito automático' },
  { valor: 'outro', rotulo: 'Outro' },
]
const tiposConta = [
  { valor: 'banco', rotulo: 'Banco' },
  { valor: 'caixa', rotulo: 'Caixa (dinheiro)' },
  { valor: 'aplicacao', rotulo: 'Aplicação' },
]
const rot = (lista: { valor: string; rotulo: string }[], v: string | null) => lista.find((i) => i.valor === v)?.rotulo ?? v ?? ''

const FUSO = 'America/Sao_Paulo'
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date())
function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dataBR = (dia: string | null) => (dia ? dia.split('-').reverse().join('/') : '')
const mesAno = (mes: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short', year: '2-digit' }).format(new Date(`${mes}-01T00:00:00Z`))
// Os últimos 12 meses (AAAA-MM), do mais antigo ao atual.
function ultimosMeses(n = 12) {
  const [a, m] = hojeSP().split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1))
    return d.toISOString().slice(0, 7)
  })
}
const valorEfetivo = (l: Lancamento) => (l.status === 'pago' ? (l.valor_pago ?? l.valor) : l.valor)

function useDadosFinanceiros() {
  const desde = `${ultimosMeses(13)[0]}-01`
  const categorias = useQuery({
    queryKey: ['fin', 'categorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fin_categorias').select('*').order('tipo').order('ordem').order('nome')
      if (error) throw error
      return data as Categoria[]
    },
  })
  const contas = useQuery({
    queryKey: ['fin', 'contas'],
    queryFn: async () => {
      const [c, s] = await Promise.all([supabase.from('fin_contas').select('*').order('nome'), supabase.from('fin_saldos').select('conta_id, saldo_atual')])
      if (c.error) throw c.error
      if (s.error) throw s.error
      const saldos = Object.fromEntries((s.data as Saldo[]).map((x) => [x.conta_id, Number(x.saldo_atual)]))
      return (c.data as Conta[]).map((x) => ({ ...x, saldo_atual: saldos[x.id] ?? Number(x.saldo_inicial) }))
    },
  })
  // Tudo que está em aberto mais o que aconteceu nos últimos 13 meses.
  const lancamentos = useQuery({
    queryKey: ['fin', 'lancamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_lancamentos')
        .select('*')
        .or(`status.eq.pendente,competencia.gte.${desde},pago_em.gte.${desde}`)
        .order('vencimento')
        .limit(5000)
      if (error) throw error
      return (data as Lancamento[]).map((l) => ({ ...l, valor: Number(l.valor), valor_pago: l.valor_pago === null ? null : Number(l.valor_pago) }))
    },
  })
  useAoVivo('fin_lancamentos', ['fin'])
  return { categorias, contas, lancamentos }
}

export function Financeiro() {
  const [aba, setAba] = useState<'resumo' | 'receber' | 'pagar' | 'cadastros'>('resumo')
  const { categorias, contas, lancamentos } = useDadosFinanceiros()
  const [editando, setEditando] = useState<Lancamento | { novo: 'receber' | 'pagar' } | null>(null)

  const cats = categorias.data ?? []
  const catPorId = Object.fromEntries(cats.map((c) => [c.id, c]))
  const erro = categorias.error || contas.error || lancamentos.error

  function exportar() {
    const contaPorId = Object.fromEntries((contas.data ?? []).map((c) => [c.id, c.nome]))
    baixarCsv(`financeiro-${hojeSP()}.csv`, [
      ['Tipo', 'Descrição', 'Categoria', 'Linha da DRE', 'Grupo do caixa', 'Valor', 'Competência', 'Vencimento', 'Situação', 'Pago em', 'Valor pago', 'Conta', 'Forma', 'Quem paga ou recebe', 'Repete', 'Observações'],
      ...(lancamentos.data ?? []).map((l) => {
        const c = catPorId[l.categoria_id]
        return [
          l.tipo === 'receber' ? 'A receber' : 'A pagar',
          l.descricao,
          c?.nome,
          rot(linhasDre, c?.linha_dre ?? null),
          rot(gruposDfc, c?.grupo_dfc ?? null),
          l.valor.toFixed(2).replace('.', ','),
          dataBR(l.competencia),
          dataBR(l.vencimento),
          l.status === 'pago' ? 'Pago' : l.status === 'cancelado' ? 'Cancelado' : 'Pendente',
          dataBR(l.pago_em),
          l.valor_pago?.toFixed(2).replace('.', ',') ?? '',
          l.conta_id ? contaPorId[l.conta_id] : '',
          rot(formas, l.forma_pagamento),
          l.parceiro,
          l.recorrencia ? 'Todo mês' : '',
          l.observacoes,
        ]
      }),
    ])
  }

  return (
    <>
      <Cabecalho titulo="Financeiro">
        <Botao variante="secundario" onClick={exportar} disabled={!lancamentos.data?.length}>
          <span className="inline-flex items-center gap-1.5">
            <Download className="h-4 w-4" /> Exportar planilha
          </span>
        </Botao>
        <Botao variante="secundario" onClick={() => setEditando({ novo: 'pagar' })}>
          <span className="inline-flex items-center gap-1.5">
            <ArrowUpCircle className="h-4 w-4" /> A pagar
          </span>
        </Botao>
        <Botao onClick={() => setEditando({ novo: 'receber' })}>
          <span className="inline-flex items-center gap-1.5">
            <ArrowDownCircle className="h-4 w-4" /> A receber
          </span>
        </Botao>
      </Cabecalho>

      <Abas
        abas={[
          { valor: 'resumo', rotulo: 'Resumo', icone: LayoutDashboard },
          { valor: 'receber', rotulo: 'A receber', icone: ArrowDownCircle },
          { valor: 'pagar', rotulo: 'A pagar', icone: ArrowUpCircle },
          { valor: 'cadastros', rotulo: 'Contas e categorias', icone: Settings2 },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {erro && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(erro)}</Aviso>
        </div>
      )}

      {categorias.isPending || contas.isPending || lancamentos.isPending ? (
        <Carregando />
      ) : aba === 'resumo' ? (
        <Resumo lancamentos={lancamentos.data ?? []} contas={contas.data ?? []} catPorId={catPorId} aoAbrir={setEditando} />
      ) : aba === 'cadastros' ? (
        <Cadastros categorias={cats} contas={contas.data ?? []} />
      ) : (
        <Lancamentos key={aba} tipo={aba} lancamentos={(lancamentos.data ?? []).filter((l) => l.tipo === aba)} catPorId={catPorId} aoAbrir={setEditando} aoCriar={() => setEditando({ novo: aba })} />
      )}

      {editando && (
        <FormLancamento
          lancamento={'novo' in editando ? null : editando}
          tipo={'novo' in editando ? editando.novo : editando.tipo}
          categorias={cats}
          contas={contas.data ?? []}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------- Resumo

function Resumo({
  lancamentos,
  contas,
  catPorId,
  aoAbrir,
}: {
  lancamentos: Lancamento[]
  contas: (Conta & { saldo_atual: number })[]
  catPorId: Record<string, Categoria>
  aoAbrir: (l: Lancamento) => void
}) {
  const hoje = hojeSP()
  const em30 = somarDias(hoje, 30)
  const mesAtual = hoje.slice(0, 7)
  const pendentes = lancamentos.filter((l) => l.status === 'pendente')
  const soma = (ls: Lancamento[]) => ls.reduce((s, l) => s + valorEfetivo(l), 0)

  const saldo = contas.filter((c) => c.ativa).reduce((s, c) => s + c.saldo_atual, 0)
  const receber30 = pendentes.filter((l) => l.tipo === 'receber' && l.vencimento >= hoje && l.vencimento <= em30)
  const pagar30 = pendentes.filter((l) => l.tipo === 'pagar' && l.vencimento >= hoje && l.vencimento <= em30)
  const receberAtrasado = pendentes.filter((l) => l.tipo === 'receber' && l.vencimento < hoje)
  const pagarAtrasado = pendentes.filter((l) => l.tipo === 'pagar' && l.vencimento < hoje)
  const pagosMes = lancamentos.filter((l) => l.status === 'pago' && l.pago_em?.startsWith(mesAtual))
  const caixaMes = soma(pagosMes.filter((l) => l.tipo === 'receber')) - soma(pagosMes.filter((l) => l.tipo === 'pagar'))

  // Caixa realizado por mês (data do pagamento).
  const meses = ultimosMeses(12).map((mes) => {
    const doMes = lancamentos.filter((l) => l.status === 'pago' && l.pago_em?.startsWith(mes))
    const entradas = soma(doMes.filter((l) => l.tipo === 'receber'))
    const saidas = soma(doMes.filter((l) => l.tipo === 'pagar'))
    return { mes: mesAno(mes), entradas, saidas, resultado: entradas - saidas }
  })
  const temMovimento = meses.some((m) => m.entradas || m.saidas)

  // Receita bruta por categoria nos últimos 12 meses (competência, sem cancelados).
  const inicio12 = `${ultimosMeses(12)[0]}-01`
  const receitas = lancamentos.filter((l) => l.tipo === 'receber' && l.status !== 'cancelado' && l.competencia >= inicio12 && catPorId[l.categoria_id]?.linha_dre === 'receita_bruta')
  const porCategoria = Object.entries(
    receitas.reduce<Record<string, number>>((acc, l) => {
      const curto = catPorId[l.categoria_id]?.nome.replace(/^Comissão: /, '') ?? 'Sem categoria'
      const nome = curto.charAt(0).toUpperCase() + curto.slice(1)
      acc[nome] = (acc[nome] ?? 0) + valorEfetivo(l)
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])
  const maiorReceita = Math.max(1, ...porCategoria.map(([, v]) => v))
  const proximos = pendentes.filter((l) => l.vencimento >= hoje).slice(0, 8)

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <CartaoIndicador rotulo="Saldo nas contas" valor={moeda.format(saldo)} icone={Wallet} tom="dourado" detalhe={contas.length ? `${contas.filter((c) => c.ativa).length} conta(s) ativa(s)` : 'Cadastre suas contas'} />
        <CartaoIndicador rotulo="Caixa do mês (entrou − saiu)" valor={moeda.format(caixaMes)} icone={TrendingUp} tom={caixaMes >= 0 ? 'verde' : 'vermelho'} />
        <CartaoIndicador rotulo="A receber em 30 dias" valor={moeda.format(soma(receber30))} icone={ArrowDownCircle} tom="azul" detalhe={`${receber30.length} lançamento(s)`} />
        <CartaoIndicador rotulo="A pagar em 30 dias" valor={moeda.format(soma(pagar30))} icone={ArrowUpCircle} tom="ambar" detalhe={`${pagar30.length} lançamento(s)`} />
        <CartaoIndicador rotulo="Recebimentos atrasados" valor={moeda.format(soma(receberAtrasado))} icone={AlarmClock} tom="vermelho" detalhe={`${receberAtrasado.length} lançamento(s)`} />
        <CartaoIndicador rotulo="Pagamentos atrasados" valor={moeda.format(soma(pagarAtrasado))} icone={AlarmClock} tom="vermelho" detalhe={`${pagarAtrasado.length} lançamento(s)`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Bloco titulo="Caixa nos últimos 12 meses" className="xl:col-span-2">
          {temMovimento ? (
            <Suspense fallback={<Carregando />}>
              <GraficoCaixa dados={meses} />
            </Suspense>
          ) : (
            <p className="py-10 text-center text-sm text-muted">Nenhum pagamento ou recebimento registrado ainda.</p>
          )}
        </Bloco>

        <Bloco titulo="Receita por produto (12 meses)">
          {porCategoria.length ? (
            <ul className="space-y-3">
              {porCategoria.map(([nome, v]) => (
                <li key={nome}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="text-white/80">{nome}</span>
                    <span className="font-semibold text-white">{moeda.format(v)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(v / maiorReceita) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-muted">Nenhuma receita lançada ainda.</p>
          )}
        </Bloco>

        <Bloco titulo="Próximos vencimentos" className="xl:col-span-3">
          {proximos.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {proximos.map((l) => (
                <li key={l.id}>
                  <button onClick={() => aoAbrir(l)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-ink p-3 text-left hover:bg-white/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{l.descricao}</p>
                      <p className="text-xs text-muted">
                        {dataBR(l.vencimento)} · {catPorId[l.categoria_id]?.nome}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${l.tipo === 'receber' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {l.tipo === 'receber' ? '+' : '−'} {moeda.format(l.valor)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Nada vencendo daqui para a frente.</p>
          )}
        </Bloco>
      </div>
    </>
  )
}

function Bloco({ titulo, className = '', children }: { titulo: string; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-coal p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-bold normal-case tracking-normal text-white">{titulo}</h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------- A receber / A pagar

const colunasPrazo = [
  { valor: 'vencidas', rotulo: 'Vencidas', tom: 'vermelho' as Tom },
  { valor: 'semana', rotulo: 'Próximos 7 dias', tom: 'ambar' as Tom },
  { valor: 'depois', rotulo: 'Depois', tom: 'azul' as Tom },
  { valor: 'pagas', rotulo: 'Pagas no mês', tom: 'verde' as Tom },
]

function Lancamentos({
  tipo,
  lancamentos,
  catPorId,
  aoAbrir,
  aoCriar,
}: {
  tipo: 'receber' | 'pagar'
  lancamentos: Lancamento[]
  catPorId: Record<string, Categoria>
  aoAbrir: (l: Lancamento) => void
  aoCriar: () => void
}) {
  const [visao, setVisao] = useState<'kanban' | 'lista'>('kanban')
  const [busca, setBusca] = useState('')
  const termo = useDeferredValue(busca).trim().toLowerCase()
  const [situacao, setSituacao] = useState<'pendente' | 'pago' | 'cancelado' | 'todos'>('pendente')
  const [categoria, setCategoria] = useState('')
  const hoje = hojeSP()
  const mesAtual = hoje.slice(0, 7)
  const pago = tipo === 'receber' ? 'Recebido' : 'Pago'

  const filtrados = lancamentos.filter(
    (l) =>
      (!categoria || l.categoria_id === categoria) &&
      (!termo || l.descricao.toLowerCase().includes(termo) || (l.parceiro ?? '').toLowerCase().includes(termo) || (catPorId[l.categoria_id]?.nome ?? '').toLowerCase().includes(termo)),
  )
  const colunaDe = (l: Lancamento) =>
    l.status === 'pago' ? 'pagas' : l.vencimento < hoje ? 'vencidas' : l.vencimento <= somarDias(hoje, 7) ? 'semana' : 'depois'
  const doKanban = filtrados.filter((l) => l.status === 'pendente' || (l.status === 'pago' && l.pago_em?.startsWith(mesAtual)))
  const daLista = filtrados.filter((l) => situacao === 'todos' || l.status === situacao)
  const somaColuna = (c: string) => doKanban.filter((l) => colunaDe(l) === c).reduce((s, l) => s + valorEfetivo(l), 0)
  const categoriasDoTipo = Object.values(catPorId).filter((c) => c.tipo === (tipo === 'receber' ? 'receita' : 'despesa'))

  const cartao = (l: Lancamento) => (
    <button onClick={() => aoAbrir(l)} className="block w-full p-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug text-white">{l.descricao}</p>
        <span className={`shrink-0 text-sm font-bold ${tipo === 'receber' ? 'text-emerald-300' : 'text-rose-300'}`}>{moeda.format(valorEfetivo(l))}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Etiqueta tom="cinza">{catPorId[l.categoria_id]?.nome.replace(/^Comissão: /, 'Comissão · ') ?? 'Sem categoria'}</Etiqueta>
        {l.recorrencia && (
          <Etiqueta tom="roxo">
            <Repeat className="h-3 w-3" /> Todo mês
          </Etiqueta>
        )}
      </div>
      {l.parceiro && <p className="mt-2 text-xs text-muted">{l.parceiro}</p>}
      <p className={`mt-2 text-[11px] ${l.status === 'pendente' && l.vencimento < hoje ? 'font-semibold text-rose-300' : 'text-white/50'}`}>
        {l.status === 'pago' ? `${pago} em ${dataBR(l.pago_em)}` : `Vence em ${dataBR(l.vencimento)}`}
      </p>
    </button>
  )

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Abas
          abas={[
            { valor: 'kanban', rotulo: 'Kanban', icone: Columns3 },
            { valor: 'lista', rotulo: 'Lista', icone: List },
          ]}
          ativa={visao}
          aoMudar={setVisao}
        />
      </div>
      <div className={`mb-4 grid gap-2 sm:grid-cols-2 ${visao === 'lista' ? 'lg:grid-cols-3' : ''}`}>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className={`${estiloCampo} pl-9`} placeholder="Descrição, categoria ou quem paga" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <select className={estiloCampo} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categoriasDoTipo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        {visao === 'lista' && (
          <select className={estiloCampo} value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} aria-label="Situação">
            <option value="pendente">Pendentes</option>
            <option value="pago">{tipo === 'receber' ? 'Recebidos' : 'Pagos'}</option>
            <option value="cancelado">Cancelados</option>
            <option value="todos">Todos</option>
          </select>
        )}
      </div>

      {visao === 'kanban' ? (
        <Kanban
          colunas={colunasPrazo.map((c) => ({ ...c, rotulo: c.valor === 'pagas' ? `${tipo === 'receber' ? 'Recebidas' : 'Pagas'} no mês` : c.rotulo, extra: moeda.format(somaColuna(c.valor)) }))}
          itens={doKanban}
          colunaDe={colunaDe}
          card={cartao}
          podeMover={() => false}
          aoMover={() => {}}
          aoCriar={aoCriar}
          podeCriar={(c) => c !== 'pagas' && c !== 'vencidas'}
          vazioColuna="Nada aqui."
        />
      ) : !daLista.length ? (
        <Vazio>Nenhum lançamento com esses filtros.</Vazio>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="hidden bg-coal text-xs uppercase tracking-wider text-muted md:table-header-group">
                <tr>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {daLista.map((l) => (
                  <tr key={l.id} onClick={() => aoAbrir(l)} className="block cursor-pointer px-4 py-3 hover:bg-white/5 md:table-row md:p-0">
                    <td className="block md:table-cell md:px-4 md:py-3">
                      <span className="font-semibold text-white">{l.descricao}</span>
                      {l.parceiro && <span className="block text-xs text-muted">{l.parceiro}</span>}
                    </td>
                    <td className="hidden text-muted md:table-cell md:px-4 md:py-3">{catPorId[l.categoria_id]?.nome}</td>
                    <td className="inline-block pr-3 text-muted md:table-cell md:px-4 md:py-3">{dataBR(l.vencimento)}</td>
                    <td className="inline-block md:table-cell md:px-4 md:py-3">
                      <Etiqueta tom={l.status === 'pago' ? 'verde' : l.status === 'cancelado' ? 'cinza' : l.vencimento < hoje ? 'vermelho' : 'ambar'}>
                        {l.status === 'pago' ? `${pago} ${dataBR(l.pago_em)}` : l.status === 'cancelado' ? 'Cancelado' : l.vencimento < hoje ? 'Vencido' : 'Pendente'}
                      </Etiqueta>
                    </td>
                    <td className={`block font-semibold md:table-cell md:px-4 md:py-3 md:text-right ${tipo === 'receber' ? 'text-emerald-300' : 'text-rose-300'}`}>{moeda.format(valorEfetivo(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-right text-sm text-muted">
            {daLista.length} lançamento(s) · total <span className="font-semibold text-white">{moeda.format(daLista.reduce((s, l) => s + valorEfetivo(l), 0))}</span>
          </p>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Lançamento (novo, editar, pagar)

function FormLancamento({
  lancamento: l,
  tipo,
  categorias,
  contas,
  aoFechar,
}: {
  lancamento: Lancamento | null
  tipo: 'receber' | 'pagar'
  categorias: Categoria[]
  contas: Conta[]
  aoFechar: () => void
}) {
  const qc = useQueryClient()
  const hoje = hojeSP()
  const doTipo = categorias.filter((c) => c.tipo === (tipo === 'receber' ? 'receita' : 'despesa') && (c.ativa || c.id === l?.categoria_id))
  const contasAtivas = contas.filter((c) => c.ativa || c.id === l?.conta_id)
  const [f, setF] = useState({
    descricao: l?.descricao ?? '',
    categoria_id: l?.categoria_id ?? '',
    valor: l ? String(l.valor) : '',
    competencia: l?.competencia ?? hoje,
    vencimento: l?.vencimento ?? hoje,
    parceiro: l?.parceiro ?? '',
    forma_pagamento: l?.forma_pagamento ?? '',
    conta_id: l?.conta_id ?? (contasAtivas.length === 1 ? contasAtivas[0].id : ''),
    recorrencia: l?.recorrencia ?? '',
    cliente_id: l?.cliente_id ?? '',
    negociacao_id: l?.negociacao_id ?? '',
    observacoes: l?.observacoes ?? '',
  })
  const [pagando, setPagando] = useState(false)
  const [pg, setPg] = useState({ pago_em: hoje, valor_pago: l ? String(l.valor) : '', conta_id: f.conta_id })
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const verbo = tipo === 'receber' ? 'recebido' : 'pago'

  const clientes = useQuery({
    queryKey: ['clientes', 'opcoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id, nome_completo').order('nome_completo').limit(1000)
      if (error) throw error
      return data as { id: string; nome_completo: string }[]
    },
  })
  const negociacoes = useQuery({
    queryKey: ['negociacoes', 'opcoes-fin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('negociacoes').select('id, cliente:clientes(nome_completo), lead:leads(nome)').order('updated_at', { ascending: false }).limit(300)
      if (error) throw error
      return data as unknown as { id: string; cliente: { nome_completo: string } | null; lead: { nome: string } | null }[]
    },
  })

  const pronto = () => qc.invalidateQueries({ queryKey: ['fin'] })
  const salvar = useMutation({
    mutationFn: async () => {
      const linha = {
        tipo,
        descricao: f.descricao.trim(),
        categoria_id: f.categoria_id,
        valor: Number(f.valor.replace(',', '.')),
        competencia: f.competencia,
        vencimento: f.vencimento,
        parceiro: f.parceiro.trim() || null,
        forma_pagamento: f.forma_pagamento || null,
        conta_id: f.conta_id || null,
        recorrencia: f.recorrencia || null,
        cliente_id: f.cliente_id || null,
        negociacao_id: f.negociacao_id || null,
        observacoes: f.observacoes.trim() || null,
      }
      const { error } = l ? await supabase.from('fin_lancamentos').update(linha).eq('id', l.id) : await supabase.from('fin_lancamentos').insert(linha)
      if (error) throw error
    },
    onSuccess: () => {
      pronto()
      aoFechar()
    },
  })
  const mudarStatus = useMutation({
    mutationFn: async (campos: Partial<Lancamento>) => {
      const { error } = await supabase.from('fin_lancamentos').update(campos).eq('id', l!.id)
      if (error) throw error
    },
    onSuccess: () => {
      pronto()
      aoFechar()
    },
  })
  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('fin_lancamentos').delete().eq('id', l!.id)
      if (error) throw error
    },
    onSuccess: () => {
      pronto()
      aoFechar()
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    salvar.mutate()
  }
  const erro = salvar.error || mudarStatus.error || excluir.error

  return (
    <PainelLateral
      titulo={l ? l.descricao : tipo === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'}
      aoFechar={aoFechar}
      subtitulo={
        l && (
          <div className="flex flex-wrap gap-1.5">
            <Etiqueta tom={tipo === 'receber' ? 'verde' : 'vermelho'}>{tipo === 'receber' ? 'A receber' : 'A pagar'}</Etiqueta>
            <Etiqueta tom={l.status === 'pago' ? 'verde' : l.status === 'cancelado' ? 'cinza' : l.vencimento < hoje ? 'vermelho' : 'ambar'}>
              {l.status === 'pago' ? `${verbo[0].toUpperCase()}${verbo.slice(1)} em ${dataBR(l.pago_em)}` : l.status === 'cancelado' ? 'Cancelado' : l.vencimento < hoje ? 'Vencido' : 'Pendente'}
            </Etiqueta>
            <Etiqueta tom="dourado">{moeda.format(valorEfetivo(l))}</Etiqueta>
          </div>
        )
      }
    >
      {erro && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(erro)}</Aviso>
        </div>
      )}

      {l?.status === 'pendente' && (
        <div className="mb-5 rounded-2xl border border-line bg-ink p-4">
          {!pagando ? (
            <div className="flex flex-wrap gap-2">
              <Botao onClick={() => setPagando(true)}>Marcar como {verbo}</Botao>
              <Botao variante="perigo" onClick={() => confirm('Cancelar este lançamento? Ele deixa de contar nos totais.') && mudarStatus.mutate({ status: 'cancelado' })}>
                Cancelar lançamento
              </Botao>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo={`Data em que foi ${verbo}`}>
                <input type="date" className={estiloCampo} value={pg.pago_em} onChange={(e) => setPg({ ...pg, pago_em: e.target.value })} />
              </Campo>
              <Campo rotulo="Valor">
                <input className={estiloCampo} inputMode="decimal" value={pg.valor_pago} onChange={(e) => setPg({ ...pg, valor_pago: e.target.value })} />
              </Campo>
              <Campo rotulo="Conta">
                <select className={estiloCampo} value={pg.conta_id} onChange={(e) => setPg({ ...pg, conta_id: e.target.value })}>
                  <option value="">Escolha</option>
                  {contasAtivas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              {!contasAtivas.length && <p className="text-xs text-amber-300 sm:col-span-3">Cadastre uma conta em "Contas e categorias" antes de registrar o pagamento.</p>}
              <div className="flex gap-2 sm:col-span-3">
                <Botao
                  disabled={!pg.conta_id || !pg.pago_em || !Number(pg.valor_pago.replace(',', '.')) || mudarStatus.isPending}
                  onClick={() => mudarStatus.mutate({ status: 'pago', pago_em: pg.pago_em, conta_id: pg.conta_id, valor_pago: Number(pg.valor_pago.replace(',', '.')) })}
                >
                  Confirmar
                </Botao>
                <Botao variante="secundario" onClick={() => setPagando(false)}>
                  Voltar
                </Botao>
              </div>
              {l.recorrencia && <p className="text-xs text-muted sm:col-span-3">Por ser mensal, o lançamento do mês seguinte será criado automaticamente.</p>}
            </div>
          )}
        </div>
      )}
      {l && l.status !== 'pendente' && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => mudarStatus.mutate({ status: 'pendente', pago_em: null })}>
            {l.status === 'pago' ? 'Desfazer pagamento' : 'Reativar lançamento'}
          </Botao>
        </div>
      )}

      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Descrição *">
            <input className={estiloCampo} value={f.descricao} onChange={muda('descricao')} required autoFocus={!l} placeholder={tipo === 'receber' ? 'Ex.: Comissão financiamento João Silva' : 'Ex.: Aluguel da sala'} />
          </Campo>
        </div>
        <Campo rotulo="Categoria *">
          <select className={estiloCampo} value={f.categoria_id} onChange={muda('categoria_id')} required>
            <option value="">Escolha</option>
            {doTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Valor (R$) *">
          <input className={estiloCampo} inputMode="decimal" value={f.valor} onChange={muda('valor')} required placeholder="0,00" pattern="[0-9]+([.,][0-9]{1,2})?" />
        </Campo>
        <Campo rotulo="Vencimento *">
          <input type="date" className={estiloCampo} value={f.vencimento} onChange={muda('vencimento')} required />
        </Campo>
        <Campo rotulo="Competência (mês do fato) *">
          <input type="date" className={estiloCampo} value={f.competencia} onChange={muda('competencia')} required />
        </Campo>
        <Campo rotulo={tipo === 'receber' ? 'Quem paga (banco, administradora…)' : 'Fornecedor ou favorecido'}>
          <input className={estiloCampo} value={f.parceiro} onChange={muda('parceiro')} />
        </Campo>
        <Campo rotulo="Forma de pagamento">
          <select className={estiloCampo} value={f.forma_pagamento} onChange={muda('forma_pagamento')}>
            <option value="">Não informada</option>
            {formas.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Conta prevista">
          <select className={estiloCampo} value={f.conta_id} onChange={muda('conta_id')}>
            <option value="">Não definida</option>
            {contasAtivas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Repetir">
          <select className={estiloCampo} value={f.recorrencia} onChange={muda('recorrencia')}>
            <option value="">Não repete</option>
            <option value="mensal">Todo mês</option>
          </select>
        </Campo>
        <Campo rotulo="Cliente ligado">
          <select className={estiloCampo} value={f.cliente_id} onChange={muda('cliente_id')}>
            <option value="">Nenhum</option>
            {clientes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_completo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Negociação ligada">
          <select className={estiloCampo} value={f.negociacao_id} onChange={muda('negociacao_id')}>
            <option value="">Nenhuma</option>
            {negociacoes.data?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.cliente?.nome_completo ?? n.lead?.nome ?? 'Negociação'}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2">
          <Campo rotulo="Observações">
            <textarea className={`${estiloCampo} min-h-16`} value={f.observacoes} onChange={muda('observacoes')} />
          </Campo>
        </div>
        <div className="flex flex-wrap justify-between gap-3 sm:col-span-2">
          {l ? (
            <Botao type="button" variante="perigo" onClick={() => confirm('Excluir este lançamento? Esta ação não pode ser desfeita.') && excluir.mutate()}>
              Excluir
            </Botao>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Botao type="button" variante="secundario" onClick={aoFechar}>
              Fechar
            </Botao>
            <Botao type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar'}
            </Botao>
          </div>
        </div>
      </form>
    </PainelLateral>
  )
}

// ---------------------------------------------------------------- Contas e categorias

function Cadastros({ categorias, contas }: { categorias: Categoria[]; contas: (Conta & { saldo_atual: number })[] }) {
  const [conta, setConta] = useState<Conta | 'nova' | null>(null)
  const [categoria, setCategoria] = useState<Categoria | 'nova' | null>(null)

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold normal-case tracking-normal text-white">
            <Landmark className="h-4 w-4 text-gold" /> Contas
          </h2>
          <Botao variante="secundario" onClick={() => setConta('nova')}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nova conta
            </span>
          </Botao>
        </div>
        {!contas.length ? (
          <Vazio>Cadastre a conta do banco e o caixa para registrar pagamentos e ver o saldo.</Vazio>
        ) : (
          <ul className="space-y-2">
            {contas.map((c) => (
              <li key={c.id}>
                <button onClick={() => setConta(c)} className={`flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-coal p-4 text-left hover:bg-white/5 ${c.ativa ? '' : 'opacity-60'}`}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-white">
                      {c.nome} <Etiqueta tom="cinza">{rot(tiposConta, c.tipo)}</Etiqueta>
                      {!c.ativa && <Etiqueta tom="vermelho">Inativa</Etiqueta>}
                    </p>
                    <p className="text-xs text-muted">
                      Saldo inicial {moeda.format(Number(c.saldo_inicial))} em {dataBR(c.data_saldo_inicial)}
                    </p>
                  </div>
                  <span className={`shrink-0 font-bold ${c.saldo_atual >= 0 ? 'text-white' : 'text-rose-300'}`}>{moeda.format(c.saldo_atual)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold normal-case tracking-normal text-white">
            <Settings2 className="h-4 w-4 text-gold" /> Categorias
          </h2>
          <Botao variante="secundario" onClick={() => setCategoria('nova')}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nova categoria
            </span>
          </Botao>
        </div>
        {(['receita', 'despesa'] as const).map((t) => (
          <div key={t} className="mb-4">
            <p className={`mb-2 text-xs font-bold uppercase tracking-wider ${t === 'receita' ? 'text-emerald-300' : 'text-rose-300'}`}>{t === 'receita' ? 'Receitas' : 'Despesas'}</p>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {categorias
                .filter((c) => c.tipo === t)
                .map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setCategoria(c)} className={`flex w-full flex-wrap items-center justify-between gap-2 bg-coal px-4 py-2.5 text-left text-sm hover:bg-white/5 ${c.ativa ? '' : 'opacity-50'}`}>
                      <span className="text-white">{c.nome}</span>
                      <span className="flex gap-1.5">
                        <Etiqueta tom="azul">{rot(linhasDre, c.linha_dre)}</Etiqueta>
                        <Etiqueta tom="cinza">{rot(gruposDfc, c.grupo_dfc)}</Etiqueta>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      {conta && <FormConta conta={conta === 'nova' ? null : conta} aoFechar={() => setConta(null)} />}
      {categoria && <FormCategoria categoria={categoria === 'nova' ? null : categoria} aoFechar={() => setCategoria(null)} />}
    </div>
  )
}

function FormConta({ conta: c, aoFechar }: { conta: Conta | null; aoFechar: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    nome: c?.nome ?? '',
    tipo: c?.tipo ?? 'banco',
    saldo_inicial: c ? String(c.saldo_inicial) : '0',
    data_saldo_inicial: c?.data_saldo_inicial ?? hojeSP(),
    ativa: c?.ativa ?? true,
  })
  const salvar = useMutation({
    mutationFn: async () => {
      const linha = { ...f, nome: f.nome.trim(), saldo_inicial: Number(f.saldo_inicial.replace(',', '.')) || 0 }
      const { error } = c ? await supabase.from('fin_contas').update(linha).eq('id', c.id) : await supabase.from('fin_contas').insert(linha)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin'] })
      aoFechar()
    },
  })
  return (
    <PainelLateral titulo={c ? c.nome : 'Nova conta'} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
        className="grid gap-4"
      >
        {salvar.error && <Aviso>{erroAmigavel(salvar.error)}</Aviso>}
        <Campo rotulo="Nome *">
          <input className={estiloCampo} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required autoFocus placeholder="Ex.: Sicredi, Caixa do escritório" />
        </Campo>
        <Campo rotulo="Tipo">
          <select className={estiloCampo} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Conta['tipo'] })}>
            {tiposConta.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Saldo inicial (R$)">
            <input className={estiloCampo} inputMode="decimal" value={f.saldo_inicial} onChange={(e) => setF({ ...f, saldo_inicial: e.target.value })} pattern="-?[0-9]+([.,][0-9]{1,2})?" />
          </Campo>
          <Campo rotulo="Na data de">
            <input type="date" className={estiloCampo} value={f.data_saldo_inicial} onChange={(e) => setF({ ...f, data_saldo_inicial: e.target.value })} required />
          </Campo>
        </div>
        <p className="text-xs text-muted">Use o saldo do extrato nessa data. Os pagamentos registrados a partir dela movimentam o saldo.</p>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={f.ativa} onChange={(e) => setF({ ...f, ativa: e.target.checked })} /> Conta ativa
        </label>
        <div className="flex justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvar.isPending}>
            Salvar
          </Botao>
        </div>
      </form>
    </PainelLateral>
  )
}

function FormCategoria({ categoria: c, aoFechar }: { categoria: Categoria | null; aoFechar: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    nome: c?.nome ?? '',
    tipo: c?.tipo ?? 'despesa',
    linha_dre: c?.linha_dre ?? 'despesa_operacional',
    grupo_dfc: c?.grupo_dfc ?? 'operacional',
    ativa: c?.ativa ?? true,
  })
  const salvar = useMutation({
    mutationFn: async () => {
      const linha = { ...f, nome: f.nome.trim() }
      const { error } = c ? await supabase.from('fin_categorias').update(linha).eq('id', c.id) : await supabase.from('fin_categorias').insert(linha)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin'] })
      aoFechar()
    },
  })
  return (
    <PainelLateral titulo={c ? c.nome : 'Nova categoria'} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
        className="grid gap-4"
      >
        {salvar.error && <Aviso>{erroAmigavel(salvar.error)}</Aviso>}
        <Campo rotulo="Nome *">
          <input className={estiloCampo} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required autoFocus />
        </Campo>
        <Campo rotulo="Tipo">
          <select className={estiloCampo} value={f.tipo} disabled={!!c} onChange={(e) => setF({ ...f, tipo: e.target.value as Categoria['tipo'] })}>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </Campo>
        <Campo rotulo="Linha da DRE">
          <select className={estiloCampo} value={f.linha_dre} onChange={(e) => setF({ ...f, linha_dre: e.target.value })}>
            {linhasDre.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Grupo do fluxo de caixa">
          <select className={estiloCampo} value={f.grupo_dfc} onChange={(e) => setF({ ...f, grupo_dfc: e.target.value })}>
            {gruposDfc.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <p className="text-xs text-muted">A Filó usa a linha da DRE e o grupo do caixa para montar os relatórios. Na dúvida, mantenha a sugestão.</p>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={f.ativa} onChange={(e) => setF({ ...f, ativa: e.target.checked })} /> Categoria ativa (aparece nos lançamentos novos)
        </label>
        <div className="flex justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvar.isPending}>
            Salvar
          </Botao>
        </div>
      </form>
    </PainelLateral>
  )
}
