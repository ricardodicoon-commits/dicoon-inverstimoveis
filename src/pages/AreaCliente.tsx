import { Logo } from '../components/Logo'
import { linkWhatsApp } from '../config'

export function AreaCliente() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <Logo grande />
      <div className="max-w-md">
        <h1 className="text-xl font-bold text-white">Área do Cliente</h1>
        <p className="mt-3 text-muted">
          Estamos atualizando nosso sistema. Enquanto isso, fale com a gente pelo WhatsApp.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={linkWhatsApp()}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink hover:bg-gold-deep"
        >
          Falar no WhatsApp
        </a>
        <a
          href="/"
          className="rounded-full border border-gold/50 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gold hover:bg-gold/10"
        >
          Voltar ao site
        </a>
      </div>
    </main>
  )
}
