import { useState } from 'react'
import { linkWhatsApp } from '../../config'

// Simulação ILUSTRATIVA: juros compostos pela tabela Price ou SAC, sem IOF,
// seguros, tarifas e correção por índice. A taxa é só um exemplo editável;
// condições reais dependem da instituição e da análise de crédito.
const TAXA_EXEMPLO = 1.5
const LIMITE_REFERENCIA = 0.6
const prazos = [60, 120, 180, 240]

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const moedaCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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

export default function SimuladorHomeEquity() {
  const [imovel, setImovel] = useState(500_000)
  const [valor, setValor] = useState(200_000)
  const [prazo, setPrazo] = useState(120)
  const [taxaTexto, setTaxaTexto] = useState(String(TAXA_EXEMPLO).replace('.', ','))
  const [sistema, setSistema] = useState<'price' | 'sac'>('price')

  const taxa = Number(taxaTexto.replace(',', '.')) / 100
  const valido = imovel > 0 && valor > 0 && taxa > 0 && taxa < 0.2
  const percentual = imovel ? valor / imovel : 0

  let primeira = 0
  let ultima = 0
  let total = 0
  if (valido) {
    if (sistema === 'price') {
      primeira = ultima = (valor * taxa) / (1 - Math.pow(1 + taxa, -prazo))
      total = primeira * prazo
    } else {
      const amortizacao = valor / prazo
      primeira = amortizacao + valor * taxa
      ultima = amortizacao + amortizacao * taxa
      total = valor + (taxa * valor * (prazo + 1)) / 2
    }
  }

  const resumo = `Olá! Fiz uma simulação de Home Equity no site: imóvel de ${moeda.format(imovel)}, quero ${moeda.format(valor)} em ${prazo} meses (${sistema === 'price' ? 'Price' : 'SAC'}). Gostaria de ver as condições reais.`

  return (
    <div className="grid gap-6 rounded-[14px] border border-border bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-5">
        <CampoReais id="s-imovel" rotulo="Valor do imóvel" valor={imovel} aoMudar={setImovel} />
        <CampoReais id="s-valor" rotulo="De quanto você precisa?" valor={valor} aoMudar={setValor} />
        {percentual > LIMITE_REFERENCIA && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            O valor pedido é {Math.round(percentual * 100)}% do imóvel. Muitas instituições liberam até cerca de 60% do valor de avaliação; o limite exato depende da instituição.
          </p>
        )}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-navy">Prazo</legend>
          <div className="flex flex-wrap gap-2">
            {prazos.map((p) => (
              <label key={p} className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm ${prazo === p ? 'border-navy bg-navy text-white' : 'border-border text-text'}`}>
                <input type="radio" name="prazo" className="sr-only" checked={prazo === p} onChange={() => setPrazo(p)} />
                {p} meses
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="s-taxa" className="mb-1.5 block text-sm font-semibold text-navy">
              Taxa de juros ao mês (%)
            </label>
            <input
              id="s-taxa"
              inputMode="decimal"
              className="w-full rounded-lg border border-border bg-white px-4 py-3 text-text focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/30"
              value={taxaTexto}
              onChange={(e) => setTaxaTexto(e.target.value.replace(/[^\d,]/g, '').slice(0, 5))}
              aria-describedby="s-taxa-ajuda"
            />
            <p id="s-taxa-ajuda" className="mt-1 text-xs text-muted">
              Taxa de exemplo. Troque pela taxa da sua proposta.
            </p>
          </div>
          <fieldset>
            <legend className="mb-1.5 block text-sm font-semibold text-navy">Sistema</legend>
            <div className="flex gap-2">
              {(['price', 'sac'] as const).map((s) => (
                <label key={s} className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm ${sistema === s ? 'border-navy bg-navy text-white' : 'border-border text-text'}`}>
                  <input type="radio" name="sistema" className="sr-only" checked={sistema === s} onChange={() => setSistema(s)} />
                  {s === 'price' ? 'Price' : 'SAC'}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-[14px] bg-navy p-6 text-white" aria-live="polite">
        {valido ? (
          <div>
            <p className="text-sm text-white/70">{sistema === 'price' ? 'Parcela mensal estimada' : 'Primeira parcela estimada'}</p>
            <p className="mt-1 font-heading text-4xl font-extrabold text-gold">{moedaCentavos.format(primeira)}</p>
            {sistema === 'sac' && <p className="mt-2 text-sm text-white/80">Última parcela: {moedaCentavos.format(ultima)}</p>}
            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
                <dt className="text-white/70">Valor solicitado</dt>
                <dd className="font-semibold">{moeda.format(valor)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
                <dt className="text-white/70">Prazo</dt>
                <dd className="font-semibold">{prazo} meses</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
                <dt className="text-white/70">Total estimado pago</dt>
                <dd className="font-semibold">{moeda.format(total)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
                <dt className="text-white/70">Percentual do imóvel</dt>
                <dd className="font-semibold">{Math.round(percentual * 100)}%</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-white/80">Preencha o valor do imóvel, o valor desejado e uma taxa para ver a simulação.</p>
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
            Simulação ilustrativa, não é proposta de crédito. Não inclui IOF, seguros, tarifas, custos de cartório nem correção por índice. Taxa, prazo e valor dependem da
            instituição financeira e da análise de crédito.
          </p>
        </div>
      </div>
    </div>
  )
}
