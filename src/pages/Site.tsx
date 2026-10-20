import { useState, type FormEvent, type ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { empresa, linkWhatsApp } from '../config'

const menu = [
  { href: '#inicio', rotulo: 'Home' },
  { href: '#sobre', rotulo: 'A Dicoon Invest' },
  { href: '#produtos', rotulo: 'Produtos' },
  { href: '#parceiros', rotulo: 'Parceiros' },
  { href: '#contato', rotulo: 'Contatos' },
]

const produtos = [
  {
    titulo: 'Correspondente Bancário',
    texto: 'Atendimento para crédito junto a instituições financeiras parceiras, com orientação do início ao fim.',
  },
  {
    titulo: 'Financiamentos',
    texto: 'Financiamento imobiliário e de veículos, com simulação e acompanhamento da proposta.',
  },
  {
    titulo: 'Consórcios',
    texto: 'Planejamento para conquistar imóvel ou veículo sem juros de financiamento.',
  },
  {
    titulo: 'Seguros',
    texto: 'Proteção para você, sua família, seu patrimônio e seu negócio.',
  },
  {
    titulo: 'Investimentos',
    texto: 'Orientação para fazer seu dinheiro trabalhar a seu favor.',
  },
  {
    titulo: 'Imóveis',
    texto: 'Compra, venda e locação de imóveis em Canoas e região.',
  },
]

const diferenciais = [
  { titulo: 'Atendimento próximo', texto: 'Você fala direto com quem cuida do seu caso, sem filas e sem robôs.' },
  { titulo: 'Tudo em um lugar', texto: 'Crédito, seguros e imóveis com a mesma equipe, sem precisar ir a vários lugares.' },
  { titulo: 'Transparência', texto: 'Condições explicadas com clareza antes de qualquer assinatura.' },
  { titulo: 'Acompanhamento', texto: 'Seguimos com você até a conclusão do processo.' },
]

function Titulo({ sobre, titulo }: { sobre: string; titulo: string }) {
  return (
    <div className="mb-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{sobre}</p>
      <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{titulo}</h2>
      <div className="mx-auto mt-4 h-0.5 w-16 bg-gold" />
    </div>
  )
}

function Cabecalho() {
  const [aberto, setAberto] = useState(false)
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#inicio" aria-label="Dicoon Invest - início">
          <Logo />
        </a>
        <nav className="hidden items-center gap-6 lg:flex">
          {menu.map((m) => (
            <a key={m.href} href={m.href} className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-gold">
              {m.rotulo}
            </a>
          ))}
          <a href="/app" className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-gold">
            Área do Cliente
          </a>
          <a
            href={linkWhatsApp('Olá! Quero contratar on-line pelo site da Dicoon Invest.')}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-gold-deep"
          >
            Contrate On-Line
          </a>
        </nav>
        <button
          className="rounded border border-line p-2 text-gold lg:hidden"
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
        <nav className="border-t border-line bg-ink px-4 py-4 lg:hidden">
          {[...menu, { href: '/app', rotulo: 'Área do Cliente' }].map((m) => (
            <a
              key={m.href}
              href={m.href}
              onClick={() => setAberto(false)}
              className="block py-3 text-sm font-semibold uppercase tracking-wider text-muted hover:text-gold"
            >
              {m.rotulo}
            </a>
          ))}
          <a
            href={linkWhatsApp('Olá! Quero contratar on-line pelo site da Dicoon Invest.')}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block rounded-full bg-gold px-4 py-3 text-center text-sm font-bold uppercase tracking-wider text-ink"
          >
            Contrate On-Line
          </a>
        </nav>
      )}
    </header>
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
    'w-full rounded-lg border border-line bg-coal px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-gold focus:outline-none'

  return (
    <section id="contato" className="px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <Titulo sobre="Fale com a gente" titulo="Contatos" />
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-6">
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
              {empresa.endereco}
              <br />
              {empresa.bairroCidade}
            </Info>
          </div>
          <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-line bg-coal/60 p-6">
            <input className={campo} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <select className={campo} value={interesse} onChange={(e) => setInteresse(e.target.value)}>
              {produtos.map((p) => (
                <option key={p.titulo}>{p.titulo}</option>
              ))}
            </select>
            <textarea
              className={`${campo} min-h-28`}
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
      <p className="mt-1 text-white">{children}</p>
    </div>
  )
}

export function Site() {
  return (
    <>
      <Cabecalho />

      <section
        id="inicio"
        className="relative flex min-h-screen items-center overflow-hidden px-4 pt-16"
        style={{ background: 'radial-gradient(ellipse at top, rgba(212,175,55,0.15), transparent 60%)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 text-center">
          <Logo grande />
          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-5xl">
            Proteção, Crédito e <span className="text-gold">Soluções Financeiras</span>
          </h1>
          <p className="max-w-xl text-muted">
            Correspondente bancário, financiamentos, consórcios, seguros, investimentos e imóveis em Canoas/RS.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={linkWhatsApp()}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-gold px-7 py-3 text-sm font-bold uppercase tracking-wider text-ink hover:bg-gold-deep"
            >
              Fale com um especialista
            </a>
            <a
              href="#produtos"
              className="rounded-full border border-gold/50 px-7 py-3 text-sm font-bold uppercase tracking-wider text-gold hover:bg-gold/10"
            >
              Conheça os produtos
            </a>
          </div>
        </div>
      </section>

      <section id="produtos" className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <Titulo sobre="O que fazemos" titulo="Produtos e Serviços" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {produtos.map((p) => (
              <div key={p.titulo} className="rounded-2xl border border-line bg-coal p-6 transition hover:border-gold/60">
                <div className="mb-4 h-1 w-10 bg-gold" />
                <h3 className="text-base font-bold text-white">{p.titulo}</h3>
                <p className="mt-2 text-sm text-muted">{p.texto}</p>
                <a
                  href={linkWhatsApp(`Olá! Quero saber mais sobre ${p.titulo}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-xs font-bold uppercase tracking-wider text-gold hover:underline"
                >
                  Quero saber mais →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="sobre" className="border-y border-line bg-coal px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Titulo sobre="Quem somos" titulo="A Dicoon Invest" />
          <p className="text-muted">
            A Dicoon Invest Imóveis reúne em um só lugar crédito, seguros e imóveis. Nosso trabalho é entender o
            momento de cada cliente e encontrar a solução certa, com atendimento próximo e transparente.
          </p>
          <div className="mt-12 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
            {diferenciais.map((d) => (
              <div key={d.titulo} className="rounded-2xl border border-line bg-ink p-5">
                <h3 className="text-sm font-bold text-gold">{d.titulo}</h3>
                <p className="mt-2 text-sm text-muted">{d.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="parceiros" className="px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Titulo sobre="Rede de parceiros" titulo="Parceiros Financeiros" />
          <p className="text-muted">
            Trabalhamos com instituições financeiras e seguradoras parceiras para oferecer mais opções e as melhores
            condições disponíveis para o seu perfil.
          </p>
        </div>
      </section>

      <Contato />

      <footer className="border-t border-line px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
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
