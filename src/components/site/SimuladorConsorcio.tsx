import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { linkWhatsApp } from '../../config'
import { consorcios } from '../../data/parceiros'
import { registrarEvento, useEventoSimulacao } from '../../lib/eventos'

// Pedido de simulação de consórcio: a pessoa escolhe o objetivo e a faixa de crédito ou de
// parcela, e a mensagem pronta segue para o WhatsApp da Dicoon. Não calculamos parcela aqui:
// taxa de administração, fundo de reserva e seguro variam por administradora e grupo, e o
// especialista responde com os valores reais. Nada fica gravado no site.
type Objetivo = 'veiculo' | 'imovel' | 'patrimonio'
type Modo = 'credito' | 'parcela'

const objetivos: Record<Objetivo, { rotulo: string; frase: string; icone: ReactNode }> = {
  veiculo: {
    rotulo: 'Comprar um veículo',
    frase: 'comprar um veículo',
    icone: <path d="M5 17h14M6.5 17a1.5 1.5 0 1 1-3 0m17 0a1.5 1.5 0 1 1-3 0M3 17v-4l2-5h14l2 5v4M5 13h14" />,
  },
  imovel: {
    rotulo: 'Comprar um imóvel',
    frase: 'comprar um imóvel',
    icone: <path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6" />,
  },
  patrimonio: {
    rotulo: 'Aumentar patrimônio',
    frase: 'aumentar meu patrimônio',
    icone: <path d="M4 20V10m6 10V4m6 16v-8m-14 8h18" />,
  },
}

// Faixas em reais: [mínimo, máximo, passo, início da faixa, fim da faixa].
const faixas: Record<Modo, Record<Objetivo, [number, number, number, number, number]>> = {
  credito: {
    veiculo: [30_000, 300_000, 5_000, 60_000, 150_000],
    imovel: [100_000, 1_500_000, 10_000, 250_000, 600_000],
    patrimonio: [50_000, 1_000_000, 10_000, 150_000, 400_000],
  },
  parcela: {
    veiculo: [500, 5_000, 100, 900, 2_000],
    imovel: [1_000, 15_000, 250, 2_000, 5_000],
    patrimonio: [500, 10_000, 250, 1_500, 4_000],
  },
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const SEM_PREFERENCIA = 'Sem preferência'

type Erros = Partial<Record<'nome' | 'telefone' | 'aviso', string>>

export default function SimuladorConsorcio() {
  const [objetivo, setObjetivo] = useState<Objetivo>('imovel')
  const [modo, setModo] = useState<Modo>('credito')
  const [faixa, setFaixa] = useState<[number, number]>([faixas.credito.imovel[3], faixas.credito.imovel[4]])
  const [administradora, setAdministradora] = useState(SEM_PREFERENCIA)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidade, setCidade] = useState('')
  const [aviso, setAviso] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [enviado, setEnviado] = useState(false)
  const armadilha = useRef<HTMLInputElement>(null)
  const abertoEm = useRef(Date.now())

  useEventoSimulacao('consorcio', [objetivo, modo, faixa[0], faixa[1]])

  const [min, max, passo] = faixas[modo][objetivo]

  function trocar(novoObjetivo: Objetivo, novoModo: Modo) {
    const f = faixas[novoModo][novoObjetivo]
    setObjetivo(novoObjetivo)
    setModo(novoModo)
    setFaixa([f[3], f[4]])
  }

  // As duas alças nunca se cruzam: sempre ao menos um passo entre elas.
  function mover(alca: 0 | 1, valor: number) {
    setFaixa(([de, ate]) => (alca === 0 ? [Math.min(valor, ate - passo), ate] : [de, Math.max(valor, de + passo)]))
  }

  const rotuloFaixa = modo === 'credito' ? 'Valor do crédito (carta)' : 'Valor da parcela mensal'
  const textoFaixa = `${moeda.format(faixa[0])} a ${moeda.format(faixa[1])}${modo === 'parcela' ? ' por mês' : ''}`
  const pct = (v: number) => ((v - min) / (max - min)) * 100

  function validar(): Erros {
    const e: Erros = {}
    if (nome.trim().length < 3) e.nome = 'Informe seu nome.'
    const digitos = telefone.replace(/\D/g, '')
    if (digitos.length < 10 || digitos.length > 13) e.telefone = 'Informe um WhatsApp com DDD.'
    if (!aviso) e.aviso = 'É preciso concordar com o aviso de privacidade.'
    return e
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    // Proteção contra robôs: campo invisível preenchido ou envio rápido demais.
    if (armadilha.current?.value || Date.now() - abertoEm.current < 2500) return
    const e = validar()
    setErros(e)
    if (Object.keys(e).length) return

    const linhas = [
      'Olá! Fiz uma simulação de consórcio no site da Dicoon Invest.',
      `Nome: ${nome.trim()}`,
      `Objetivo: ${objetivos[objetivo].frase}`,
      `${modo === 'credito' ? 'Crédito desejado' : 'Parcela desejada'}: ${textoFaixa}`,
      `Administradora: ${administradora}`,
      cidade.trim() && `Cidade: ${cidade.trim()}`,
      `WhatsApp: ${telefone.trim()}`,
    ].filter(Boolean)
    window.open(linkWhatsApp(linhas.join('\n')), '_blank', 'noopener')
    registrarEvento('pedido_enviado', { servico: 'Consórcios (simulador)', canal: 'WhatsApp' })
    setEnviado(true)
  }

  const campo = (erro?: string) =>
    `w-full rounded-lg border bg-white px-4 py-3 text-text placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-blue/30 ${erro ? 'border-red-600' : 'border-border focus:border-blue'}`

  if (enviado) {
    return (
      <div className="rounded-[1.5rem] cartao-ouro bg-white p-8 text-center" role="status">
        <p className="font-heading text-xl font-bold text-navy">Simulação enviada!</p>
        <p className="mt-2 text-muted">Abrimos o WhatsApp com a sua simulação pronta. É só tocar em enviar que um especialista responde com as opções.</p>
        <button onClick={() => setEnviado(false)} className="mt-6 font-semibold text-blue underline">
          Fazer outra simulação
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="grid overflow-hidden rounded-[1.5rem] cartao-ouro bg-white lg:grid-cols-[1.35fr_1fr]">
      <div className="hidden" aria-hidden="true">
        <label>
          Não preencha
          <input ref={armadilha} type="text" name="empresa_site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="space-y-7 p-6 sm:p-8">
        <fieldset>
          <legend className="font-heading text-lg font-bold text-navy">O que você deseja conquistar?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(Object.keys(objetivos) as Objetivo[]).map((o) => (
              <label
                key={o}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition sm:flex-col sm:items-start ${objetivo === o ? 'border-navy bg-navy text-white' : 'border-gold/45 bg-white text-navy hover:border-gold'}`}
              >
                <input type="radio" name="objetivo" value={o} checked={objetivo === o} onChange={() => trocar(o, modo)} className="sr-only" />
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={objetivo === o ? 'text-gold' : 'text-blue'} aria-hidden="true">
                  {objetivos[o].icone}
                </svg>
                <span className="text-sm font-bold">{objetivos[o].rotulo}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <legend className="font-heading text-lg font-bold text-navy">Simular o plano por</legend>
            <div className="flex rounded-full border border-gold/45 bg-bg p-1">
              {(['credito', 'parcela'] as Modo[]).map((m) => (
                <label key={m} className={`cursor-pointer rounded-full px-5 py-2 text-sm font-bold ${modo === m ? 'bg-gold text-navy' : 'text-muted hover:text-navy'}`}>
                  <input type="radio" name="modo" value={m} checked={modo === m} onChange={() => trocar(objetivo, m)} className="sr-only" />
                  {m === 'credito' ? 'Crédito' : 'Parcela'}
                </label>
              ))}
            </div>
          </div>

          <p className="mt-5 text-sm font-semibold text-navy">{rotuloFaixa}</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-navy" aria-live="polite">
            {textoFaixa}
          </p>
          <div className="faixa-dupla relative mt-4 h-8">
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-border" />
            <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-blue" style={{ left: `${pct(faixa[0])}%`, right: `${100 - pct(faixa[1])}%` }} />
            <input type="range" min={min} max={max} step={passo} value={faixa[0]} onChange={(e) => mover(0, Number(e.target.value))} aria-label={`${rotuloFaixa}: mínimo`} aria-valuetext={moeda.format(faixa[0])} />
            <input type="range" min={min} max={max} step={passo} value={faixa[1]} onChange={(e) => mover(1, Number(e.target.value))} aria-label={`${rotuloFaixa}: máximo`} aria-valuetext={moeda.format(faixa[1])} />
          </div>
          <div className="mt-1 flex justify-between text-xs font-semibold text-muted">
            <span>{moeda.format(min)}</span>
            <span>{moeda.format(max)}</span>
          </div>
        </fieldset>

        <div>
          <label htmlFor="c-adm" className="mb-1.5 block text-sm font-semibold text-navy">
            Administradora de preferência
          </label>
          <select id="c-adm" className={campo()} value={administradora} onChange={(e) => setAdministradora(e.target.value)}>
            <option>{SEM_PREFERENCIA}</option>
            {consorcios.map((c) => (
              <option key={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-5 bg-navy p-6 text-white sm:p-8">
        <p className="font-heading text-lg font-bold">Receba a simulação no WhatsApp</p>
        <div>
          <label htmlFor="c-nome" className="mb-1.5 block text-sm font-semibold">
            Nome
          </label>
          <input id="c-nome" className={campo(erros.nome)} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" aria-invalid={!!erros.nome} aria-describedby="ce-nome" />
          {erros.nome && <p id="ce-nome" className="mt-1 text-sm text-red-300">{erros.nome}</p>}
        </div>
        <div>
          <label htmlFor="c-tel" className="mb-1.5 block text-sm font-semibold">
            WhatsApp
          </label>
          <input id="c-tel" className={campo(erros.telefone)} value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(51) 99999-9999" aria-invalid={!!erros.telefone} aria-describedby="ce-tel" />
          {erros.telefone && <p id="ce-tel" className="mt-1 text-sm text-red-300">{erros.telefone}</p>}
        </div>
        <div>
          <label htmlFor="c-cidade" className="mb-1.5 block text-sm font-semibold">
            Cidade <span className="font-normal text-white/60">(opcional)</span>
          </label>
          <input id="c-cidade" className={campo()} value={cidade} onChange={(e) => setCidade(e.target.value)} autoComplete="address-level2" />
        </div>
        <div>
          <label className="flex items-start gap-3 text-sm text-white/80">
            <input type="checkbox" checked={aviso} onChange={(e) => setAviso(e.target.checked)} className="mt-1 h-4 w-4 accent-gold" aria-describedby="ce-aviso" />
            <span>
              Concordo que a Dicoon Invest use estes dados apenas para responder à minha simulação, conforme a{' '}
              <a href="/politica-de-privacidade" target="_blank" className="font-semibold text-gold underline">
                Política de privacidade
              </a>
              . Nada fica gravado neste site.
            </span>
          </label>
          {erros.aviso && <p id="ce-aviso" className="mt-1 text-sm text-red-300">{erros.aviso}</p>}
        </div>
        <button className="w-full rounded-full bg-gold px-6 py-3.5 font-bold text-navy hover:bg-gold-dark">Receber simulação no WhatsApp</button>
        <p className="text-xs leading-relaxed text-white/60">
          Pedido de simulação, não é proposta. Parcelas, taxa de administração, fundo de reserva e seguro variam conforme a administradora e o grupo; a contemplação ocorre por sorteio ou lance.
        </p>
      </div>
    </form>
  )
}
