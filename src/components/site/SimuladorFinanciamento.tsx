import { useEffect, useState } from 'react'
import { linkWhatsApp } from '../../config'

// Simulação ILUSTRATIVA com a taxa média de mercado publicada pelo Banco Central
// (SGS: 20773 = financiamento imobiliário com taxas reguladas; 20749 = aquisição
// de veículos, ambas em % ao ano). Sem IOF, seguros, tarifas e correção por índice.
type Tipo = 'imovel' | 'veiculo'

const config: Record<Tipo, { rotulo: string; serie: number; taxaReserva: number; prazos: number[]; valor: number; entrada: number; prazo: number }> = {
  imovel: { rotulo: 'Imóvel', serie: 20773, taxaReserva: 10.91, prazos: [120, 240, 360, 420], valor: 400_000, entrada: 80_000, prazo: 360 },
  veiculo: { rotulo: 'Veículo', serie: 20749, taxaReserva: 26.42, prazos: [24, 36, 48, 60], valor: 80_000, entrada: 20_000, prazo: 48 },
}
// Referência das taxas de reserva acima, usadas se o Banco Central não responder.
const REFERENCIA_RESERVA = 'ago/2026'
const ENTRADA_MINIMA_IMOVEL = 0.2

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const moedaCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function lerReais(texto: string) {
  const digitos = texto.replace(/\D/g, '')
  return digitos ? Number(digitos) : 0
}

function CampoReais({ id, rotulo, valor, aoMudar }: { id: string; rotulo: string; valor: number; aoMudar: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy">
        {rotulo}
      </label>
      <input
        id={id}
        inputMode="numeric"
        className="w-full rounded-lg border border-border bg-white px-4 py-3 text-lg font-semibold text-text focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/30"
        value={valor ? moeda.format(valor) : ''}
        placeholder="R$ 0"
        onChange={(e) => aoMudar(Math.min(lerReais(e.target.value), 99_999_999))}
      />
    </div>
  )
}

// Taxa média do Banco Central (% ao ano) e o mês de referência; null enquanto carrega ou se falhar.
function useTaxaBancoCentral(serie: number) {
  const [taxa, setTaxa] = useState<{ anual: number; referencia: string } | null>(null)
  useEffect(() => {
    let ativo = true
    setTaxa(null)
    fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`)
      .then((r) => r.json())
      .then((d: { data: string; valor: string }[]) => {
        const anual = Number(d[0]?.valor)
        const [, mes, ano] = (d[0]?.data ?? '').split('/')
        if (ativo && anual > 0 && anual < 100 && mes) setTaxa({ anual, referencia: `${meses[Number(mes) - 1]}/${ano}` })
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [serie])
  return taxa
}

export function calcular(financiado: number, taxaMensal: number, prazo: number) {
  const parcelaPrice = (financiado * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -prazo))
  const amortizacao = financiado / prazo
  return {
    price: { primeira: parcelaPrice, ultima: parcelaPrice, total: parcelaPrice * prazo },
    sac: {
      primeira: amortizacao + financiado * taxaMensal,
      ultima: amortizacao * (1 + taxaMensal),
      total: financiado + (taxaMensal * financiado * (prazo + 1)) / 2,
    },
  }
}

export default function SimuladorFinanciamento({ tipoInicial = 'imovel', escolherTipo = true }: { tipoInicial?: Tipo; escolherTipo?: boolean }) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial)
  const c = config[tipo]
  const [valor, setValor] = useState(c.valor)
  const [entrada, setEntrada] = useState(c.entrada)
  const [prazo, setPrazo] = useState(c.prazo)

  const bc = useTaxaBancoCentral(c.serie)
  const taxaAnual = bc?.anual ?? c.taxaReserva
  const referencia = bc?.referencia ?? REFERENCIA_RESERVA
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1

  function trocarTipo(novo: Tipo) {
    setTipo(novo)
    setValor(config[novo].valor)
    setEntrada(config[novo].entrada)
    setPrazo(config[novo].prazo)
  }

  const financiado = valor - entrada
  const valido = valor > 0 && financiado > 0
  const r = valido ? calcular(financiado, taxaMensal, prazo) : null
  const entradaBaixa = tipo === 'imovel' && valor > 0 && entrada / valor < ENTRADA_MINIMA_IMOVEL

  const resumo = r
    ? `Olá! Simulei um financiamento de ${c.rotulo.toLowerCase()} no site: valor de ${moeda.format(valor)}, entrada de ${moeda.format(entrada)}, ${prazo} meses. ` +
      `SAC: 1ª parcela ${moedaCentavos.format(r.sac.primeira)}. Price: parcela ${moedaCentavos.format(r.price.primeira)}. Quero ver as condições reais.`
    : `Olá! Quero simular um financiamento de ${c.rotulo.toLowerCase()}.`

  const colunas = r
    ? [
        { nome: 'SAC', dica: 'Parcelas que diminuem', ...r.sac },
        { nome: 'Price', dica: 'Parcelas fixas', ...r.price },
      ]
    : []

  return (
    <div className="grid gap-6 rounded-[14px] border border-border bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-5">
        {escolherTipo && (
          <fieldset>
            <legend className="mb-1.5 block text-sm font-semibold text-navy">O que você quer financiar?</legend>
            <div className="flex gap-2">
              {(Object.keys(config) as Tipo[]).map((t) => (
                <label key={t} className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm ${tipo === t ? 'border-navy bg-navy text-white' : 'border-border text-text'}`}>
                  <input type="radio" name="f-tipo" className="sr-only" checked={tipo === t} onChange={() => trocarTipo(t)} />
                  {config[t].rotulo}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <CampoReais id="f-valor" rotulo={`Valor do ${c.rotulo.toLowerCase()}`} valor={valor} aoMudar={setValor} />
        <CampoReais id="f-entrada" rotulo="Entrada" valor={entrada} aoMudar={setEntrada} />
        {entradaBaixa && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            A entrada é {Math.round((entrada / valor) * 100)}% do imóvel. A maioria dos bancos pede pelo menos 20%; o mínimo exato depende da instituição e do programa.
          </p>
        )}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-navy">Prazo</legend>
          <div className="flex flex-wrap gap-2">
            {c.prazos.map((p) => (
              <label key={p} className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm ${prazo === p ? 'border-navy bg-navy text-white' : 'border-border text-text'}`}>
                <input type="radio" name="f-prazo" className="sr-only" checked={prazo === p} onChange={() => setPrazo(p)} />
                {p} meses
              </label>
            ))}
          </div>
        </fieldset>
        <p className="rounded-lg bg-bg px-4 py-3 text-sm text-muted">
          Taxa média de mercado: <strong className="text-navy">{percentual.format(taxaAnual)}% ao ano</strong> ({percentual.format(taxaMensal * 100)}% ao mês), segundo o
          Banco Central, referência {referencia}.
        </p>
      </div>

      <div className="flex flex-col justify-between rounded-[14px] bg-navy p-6 text-white" aria-live="polite">
        {r ? (
          <div>
            <p className="text-sm text-white/70">Valor financiado: {moeda.format(financiado)}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {colunas.map((col) => (
                <div key={col.nome} className="rounded-xl border border-white/10 p-4">
                  <p className="font-heading text-lg font-extrabold">{col.nome}</p>
                  <p className="text-xs text-white/60">{col.dica}</p>
                  <p className="mt-3 text-xs text-white/70">{col.nome === 'SAC' ? '1ª parcela' : 'Parcela'}</p>
                  <p className="font-heading text-2xl font-extrabold text-gold">{moedaCentavos.format(col.primeira)}</p>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3 border-t border-white/10 pt-1.5">
                      <dt className="text-white/70">Última</dt>
                      <dd className="font-semibold">{moedaCentavos.format(col.ultima)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-white/10 pt-1.5">
                      <dt className="text-white/70">Total pago</dt>
                      <dd className="font-semibold">{moeda.format(col.total)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-white/10 pt-1.5">
                      <dt className="text-white/70">Juros</dt>
                      <dd className="font-semibold">{moeda.format(col.total - financiado)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-white/80">Informe o valor e uma entrada menor que ele para ver a simulação.</p>
        )}
        <div className="mt-6">
          <a
            href={linkWhatsApp(resumo)}
            target="_blank"
            rel="noopener"
            className="block rounded-full bg-gold px-6 py-3.5 text-center font-bold text-navy hover:bg-gold-dark"
          >
            Ver condições reais com um especialista
          </a>
          <p className="mt-3 text-xs leading-relaxed text-white/60">
            Simulação ilustrativa com a taxa média de mercado, não é proposta de crédito. Não inclui IOF, seguros, tarifas, custos de cartório nem correção por índice. A taxa
            final depende da instituição financeira e da análise de crédito.
          </p>
        </div>
      </div>
    </div>
  )
}
