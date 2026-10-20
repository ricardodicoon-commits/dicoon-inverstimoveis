import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { empresa, linkWhatsApp } from '../config'

const menu = [
  { href: '#inicio', rotulo: 'Home' },
  { href: '#sobre', rotulo: 'A Dicoon Invest Imóveis' },
  { href: '#produtos', rotulo: 'Produtos' },
  { href: '#parceiros', rotulo: 'Parceiros' },
  { href: '#contato', rotulo: 'Contatos' },
]

const produtos = [
  {
    titulo: 'Correspondente Bancário',
    texto: 'Atendimento para crédito junto a instituições financeiras parceiras, com orientação do início ao fim.',
    icone: 'banco',
  },
  {
    titulo: 'Financiamentos',
    texto: 'Financiamento imobiliário e de veículos, com simulação e acompanhamento da proposta.',
    icone: 'casa',
  },
  {
    titulo: 'Consórcios',
    texto: 'Planejamento para conquistar imóvel ou veículo sem juros de financiamento.',
    icone: 'calendario',
  },
  { titulo: 'Seguros', texto: 'Proteção para você, sua família, seu patrimônio e seu negócio.', icone: 'escudo' },
  { titulo: 'Investimentos', texto: 'Orientação para fazer seu dinheiro trabalhar a seu favor.', icone: 'grafico' },
  { titulo: 'Imóveis', texto: 'Compra, venda e locação de imóveis em Canoas e região.', icone: 'predio' },
]

const diferenciais = [
  { titulo: 'Atendimento próximo', texto: 'Você fala direto com quem cuida do seu caso, sem filas e sem robôs.' },
  { titulo: 'Tudo em um lugar', texto: 'Crédito, seguros e imóveis com a mesma equipe, sem precisar ir a vários lugares.' },
  { titulo: 'Transparência', texto: 'Condições explicadas com clareza antes de qualquer assinatura.' },
  { titulo: 'Acompanhamento', texto: 'Seguimos com você até a conclusão do processo.' },
]

const icones: Record<string, ReactNode> = {
  banco: <path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M12 3l9 5H3l9-5z" />,
  casa: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z" />,
  calendario: <path d="M4 6h16v15H4zM4 10h16M8 3v4m8-4v4" />,
  escudo: <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" />,
  grafico: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  predio: <path d="M5 21V4h9v17M14 9h5v12M8 8h3m-3 4h3m-3 4h3M3 21h18" />,
  documento: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6m-6 4h6" />,
  pessoa: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0" />,
}

function Icone({ nome, className = 'h-5 w-5' }: { nome: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icones[nome]}
    </svg>
  )
}

function Titulo({ sobre, titulo, destaque }: { sobre: string; titulo: string; destaque?: string }) {
  return (
    <div className="mb-12">
      <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-gold">
        <span className="h-px w-8 bg-gold" />
        {sobre}
      </p>
      <h2 className="mt-3 text-2xl font-bold normal-case tracking-normal text-white sm:text-4xl">
        {titulo} {destaque && <span className="text-gold">{destaque}</span>}
      </h2>
    </div>
  )
}

const botaoContrate = 'Olá! Quero contratar on-line pelo site da Dicoon Invest.'

function Cabecalho() {
  const [aberto, setAberto] = useState(false)
  const [rolou, setRolou] = useState(false)

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 40)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors ${rolou || aberto ? 'border-b border-line bg-ink/95 backdrop-blur' : 'bg-transparent'}`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4">
        <a href="#inicio" aria-label="Dicoon Invest - início" className="shrink-0">
          <Logo />
        </a>
        <nav className="hidden items-center gap-8 xl:flex">
          {menu.map((m) => (
            <a key={m.href} href={m.href} className="text-sm font-semibold uppercase tracking-wide text-white/90 hover:text-gold">
              {m.rotulo}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 xl:flex">
          <a
            href={linkWhatsApp(botaoContrate)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-5 py-2.5 text-sm font-semibold text-white hover:border-gold hover:text-gold"
          >
            <Icone nome="documento" className="h-4 w-4" /> Contrate On-Line
          </a>
          <a href="/app" className="flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-gold-deep">
            <Icone nome="pessoa" className="h-4 w-4" /> Área do Cliente
          </a>
        </div>
        <button
          className="rounded border border-white/25 p-2 text-gold xl:hidden"
          onClick={() => setAberto(!aberto)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            {aberto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      {aberto && (
        <nav className="border-t border-line px-4 pb-5 xl:hidden">
          {menu.map((m) => (
            <a
              key={m.href}
              href={m.href}
              onClick={() => setAberto(false)}
              className="block py-3 text-sm font-semibold uppercase tracking-wider text-white/90 hover:text-gold"
            >
              {m.rotulo}
            </a>
          ))}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <a
              href={linkWhatsApp(botaoContrate)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-full border border-white/25 px-4 py-3 text-sm font-semibold text-white"
            >
              <Icone nome="documento" className="h-4 w-4" /> Contrate On-Line
            </a>
            <a href="/app" className="flex items-center justify-center gap-2 rounded-full bg-gold px-4 py-3 text-sm font-semibold text-ink">
              <Icone nome="pessoa" className="h-4 w-4" /> Área do Cliente
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section id="inicio" className="relative flex min-h-screen items-center overflow-hidden px-4 pb-16 pt-28">
      <img
        src="/img/hero-cidade.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-right"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/20" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
      <div className="relative mx-auto w-full max-w-7xl">
        <p className="text-6xl font-extrabold leading-none tracking-tight text-white sm:text-8xl lg:text-9xl">DICOON</p>
        <p className="mt-3 text-xl font-medium tracking-[0.6em] text-gold sm:text-3xl">INVEST</p>
        <h1 className="mt-10 max-w-3xl text-3xl font-bold normal-case leading-tight tracking-normal text-white sm:text-5xl">
          Proteção, Crédito e <span className="text-gold">Soluções Financeiras.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-xl">
          Soluções inteligentes para proteger o que importa e conquistar o que você sonha.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href={linkWhatsApp()}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-gold px-8 py-4 text-base font-semibold text-ink hover:bg-gold-deep"
          >
            Fale com um especialista
          </a>
          <a
            href="#produtos"
            className="rounded-full border border-white/25 bg-black/30 px-8 py-4 text-base font-semibold text-white hover:border-gold hover:text-gold"
          >
            Conheça os produtos
          </a>
        </div>
      </div>
    </section>
  )
}

function Contato() {
  const [nome, setNome] = useState('')
  const [interesse, setInteresse] = useState(produtos[0].titulo)
  const [mensagem, setMensagem] = useState('')

  function enviar(e: FormEvent) {
    e.preventDefault()
    const texto = `Olá! Meu nome é ${nome}. Tenho interesse em: ${interesse}.${mensagem ? `\n\n${mensagem}` : ''}`
    window.open(linkWhatsApp(texto), '_blank', 'noreferrer')
  }

  const campo =
    'w-full rounded-lg border border-line bg-ink px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-gold focus:outline-none'

  return (
    <section id="contato" className="px-4 py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <img
            src="/img/ricardo.jpg"
            alt="Ricardo Schimuneck, Dicoon Invest"
            loading="lazy"
            className="aspect-[3/4] w-full rounded-2xl border border-line object-cover"
          />
          <div className="absolute inset-x-4 bottom-4 rounded-xl border border-gold/30 bg-ink/85 p-4 backdrop-blur">
            <p className="font-bold text-white">Ricardo Schimuneck</p>
            <p className="text-sm text-gold">Correspondente Bancário · Seguros · Imóveis</p>
          </div>
        </div>
        <div>
          <Titulo sobre="Vamos conversar?" titulo="Fale com um especialista e descubra a melhor solução para" destaque="você ou sua empresa." />
          <div className="mb-8 grid gap-5 sm:grid-cols-3">
            <Info rotulo="WhatsApp">
              <a href={linkWhatsApp()} target="_blank" rel="noreferrer" className="hover:text-gold">
                {empresa.telefone}
              </a>
            </Info>
            <Info rotulo="E-mail">
              <a href={`mailto:${empresa.email}`} className="break-all hover:text-gold">
                {empresa.email}
              </a>
            </Info>
            <Info rotulo="Endereço">
              {empresa.endereco}, {empresa.bairroCidade}
            </Info>
          </div>
          <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-line bg-coal p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <input className={campo} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              <select className={campo} value={interesse} onChange={(e) => setInteresse(e.target.value)}>
                {produtos.map((p) => (
                  <option key={p.titulo}>{p.titulo}</option>
                ))}
              </select>
            </div>
            <textarea
              className={`${campo} min-h-24`}
              placeholder="Conte rapidamente o que você precisa (opcional)"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
            <button className="w-full rounded-full bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink hover:bg-gold-deep">
              Enviar pelo WhatsApp
            </button>
            <p className="text-center text-xs text-neutral-500">Sua mensagem abre no WhatsApp; nada fica gravado no site.</p>
          </form>
        </div>
      </div>
    </section>
  )
}

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-gold pl-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{rotulo}</p>
      <p className="mt-1 text-sm text-white">{children}</p>
    </div>
  )
}

export function Site() {
  return (
    <>
      <Cabecalho />
      <Hero />

      <section id="produtos" className="px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <Titulo sobre="O que fazemos" titulo="Como podemos" destaque="ajudar você hoje?" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {produtos.map((p) => (
              <a
                key={p.titulo}
                href={linkWhatsApp(`Olá! Quero saber mais sobre ${p.titulo}.`)}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-line bg-gradient-to-br from-coal to-ink p-7 transition hover:-translate-y-1 hover:border-gold/60"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold/40 text-gold">
                  <Icone nome={p.icone} className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold normal-case tracking-normal text-white">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.texto}</p>
                <span className="mt-5 inline-block text-sm font-semibold text-gold">Saiba mais →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="sobre" className="border-y border-line bg-coal px-4 py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Titulo sobre="Quem somos" titulo="A Dicoon Invest" destaque="Imóveis" />
            <p className="text-lg leading-relaxed text-muted">
              A Dicoon Invest Imóveis reúne em um só lugar crédito, seguros e imóveis. Nosso trabalho é entender o
              momento de cada cliente e encontrar a solução certa, com atendimento próximo e transparente.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {diferenciais.map((d) => (
                <div key={d.titulo} className="rounded-2xl border border-line bg-ink p-5">
                  <h3 className="text-sm font-bold text-gold">{d.titulo}</h3>
                  <p className="mt-2 text-sm text-muted">{d.texto}</p>
                </div>
              ))}
            </div>
          </div>
          <img
            src="/img/fachada.jpg"
            alt="Fachada da Dicoon Invest Imóveis em Canoas/RS"
            loading="lazy"
            className="w-full rounded-2xl border border-line object-cover"
          />
        </div>
      </section>

      <section id="parceiros" className="px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <Titulo sobre="Confiança que nos move" titulo="Parcerias que garantem as" destaque="melhores soluções." />
          <p className="max-w-2xl text-lg text-muted">
            Trabalhamos com diversas instituições financeiras e seguradoras parceiras. Assim comparamos as opções e
            buscamos as melhores condições disponíveis para o seu perfil.
          </p>
        </div>
      </section>

      <Contato />

      <footer className="border-t border-line bg-coal px-4 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <Logo />
          <div className="text-xs text-neutral-500">
            <p>
              {empresa.razaoSocial} · CNPJ {empresa.cnpj}
            </p>
            <p className="mt-1">
              {empresa.endereco}, {empresa.bairroCidade}
            </p>
            <p className="mt-1">© {new Date().getFullYear()} Dicoon Invest. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      <a
        href={linkWhatsApp()}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] shadow-lg shadow-black/50 hover:scale-105"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" aria-hidden="true">
          <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.42 9.44-9.42a9.4 9.4 0 0 1 9.42 9.43c0 5.2-4.23 9.43-9.43 9.43m8.02-17.45A11.27 11.27 0 0 0 12.05.75C5.8.75.72 5.83.72 12.08c0 2 .52 3.95 1.52 5.66L.62 23.62l6.02-1.58a11.3 11.3 0 0 0 5.4 1.38h.01c6.25 0 11.33-5.08 11.34-11.33 0-3.03-1.18-5.87-3.32-8.02" />
        </svg>
      </a>
    </>
  )
}
