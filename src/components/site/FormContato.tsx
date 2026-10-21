import { useRef, useState, type FormEvent } from 'react'
import { empresa, linkWhatsApp } from '../../config'

// Por enquanto o pedido segue pelo WhatsApp ou e-mail; na Fase 4 passa a gravar
// como lead no CRM. Nada é guardado no site.
const servicos = [
  'Financiamento imobiliário',
  'Financiamento veicular',
  'Crédito consignado',
  'Crédito empresarial',
  'Consórcios',
  'Seguros',
  'Ainda não sei',
]
const canais = ['WhatsApp', 'Ligação', 'E-mail']

type Erros = Partial<Record<'nome' | 'contato' | 'servico' | 'aviso', string>>

export default function FormContato({ servicoInicial = '' }: { servicoInicial?: string }) {
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [servico, setServico] = useState(servicos.includes(servicoInicial) ? servicoInicial : '')
  const [canal, setCanal] = useState(canais[0])
  const [aviso, setAviso] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [enviado, setEnviado] = useState(false)
  const armadilha = useRef<HTMLInputElement>(null)
  const abertoEm = useRef(Date.now())

  function validar(): Erros {
    const e: Erros = {}
    if (nome.trim().length < 3) e.nome = 'Informe seu nome.'
    const digitos = contato.replace(/\D/g, '')
    const ehEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contato.trim())
    if (!ehEmail && (digitos.length < 10 || digitos.length > 13)) e.contato = 'Informe um telefone com DDD ou um e-mail válido.'
    if (!servico) e.servico = 'Escolha o serviço de interesse.'
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

    const texto = `Olá! Meu nome é ${nome.trim()}. Tenho interesse em: ${servico}. Contato: ${contato.trim()}. Prefiro ser atendido por: ${canal}.`
    if (canal === 'E-mail') {
      window.location.href = `mailto:${empresa.email}?subject=${encodeURIComponent(`Contato pelo site: ${servico}`)}&body=${encodeURIComponent(texto)}`
    } else {
      window.open(linkWhatsApp(texto), '_blank', 'noopener')
    }
    setEnviado(true)
  }

  const campo = (erro?: string) =>
    `w-full rounded-lg border bg-white px-4 py-3 text-text placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-blue/30 ${erro ? 'border-red-600' : 'border-border focus:border-blue'}`

  if (enviado) {
    return (
      <div className="rounded-[14px] border border-border bg-white p-8 text-center" role="status">
        <p className="font-heading text-xl font-bold text-navy">Pedido enviado!</p>
        <p className="mt-2 text-muted">
          {canal === 'E-mail'
            ? 'Abrimos o seu aplicativo de e-mail com a mensagem pronta. É só enviar.'
            : 'Abrimos o WhatsApp com a sua mensagem pronta. É só enviar que retornamos em seguida.'}
        </p>
        <button onClick={() => setEnviado(false)} className="mt-6 font-semibold text-blue underline">
          Enviar outro pedido
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5 rounded-[14px] border border-border bg-white p-6 sm:p-8">
      <div className="hidden" aria-hidden="true">
        <label>
          Não preencha
          <input ref={armadilha} type="text" name="empresa_site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="f-nome" className="mb-1.5 block text-sm font-semibold text-navy">
          Nome
        </label>
        <input id="f-nome" className={campo(erros.nome)} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" aria-invalid={!!erros.nome} aria-describedby="e-nome" />
        {erros.nome && <p id="e-nome" className="mt-1 text-sm text-red-700">{erros.nome}</p>}
      </div>

      <div>
        <label htmlFor="f-contato" className="mb-1.5 block text-sm font-semibold text-navy">
          Telefone ou e-mail
        </label>
        <input id="f-contato" className={campo(erros.contato)} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(51) 99999-9999 ou voce@email.com" aria-invalid={!!erros.contato} aria-describedby="e-contato" />
        {erros.contato && <p id="e-contato" className="mt-1 text-sm text-red-700">{erros.contato}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="f-servico" className="mb-1.5 block text-sm font-semibold text-navy">
            Serviço de interesse
          </label>
          <select id="f-servico" className={campo(erros.servico)} value={servico} onChange={(e) => setServico(e.target.value)} aria-invalid={!!erros.servico} aria-describedby="e-servico">
            <option value="">Selecione</option>
            {servicos.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {erros.servico && <p id="e-servico" className="mt-1 text-sm text-red-700">{erros.servico}</p>}
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-navy">Como prefere ser atendido?</legend>
          <div className="flex flex-wrap gap-2">
            {canais.map((c) => (
              <label key={c} className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm ${canal === c ? 'border-navy bg-navy text-white' : 'border-border bg-white text-text'}`}>
                <input type="radio" name="canal" value={c} checked={canal === c} onChange={() => setCanal(c)} className="sr-only" />
                {c}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={aviso} onChange={(e) => setAviso(e.target.checked)} className="mt-1 h-4 w-4 accent-navy" aria-describedby="e-aviso" />
          <span>
            Concordo que a Dicoon Invest use estes dados apenas para responder ao meu pedido de atendimento. Nada fica gravado neste site.
          </span>
        </label>
        {erros.aviso && <p id="e-aviso" className="mt-1 text-sm text-red-700">{erros.aviso}</p>}
      </div>

      <button className="w-full rounded-full bg-gold px-6 py-3.5 font-bold text-navy hover:bg-gold-dark">Enviar pedido</button>
    </form>
  )
}
