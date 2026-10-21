import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const estiloCampo =
  'w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-gold focus:outline-none'

export function Botao({
  children,
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' }) {
  const cores = {
    primario: 'bg-gold text-ink hover:bg-gold-deep',
    secundario: 'border border-line text-white hover:border-gold hover:text-gold',
    perigo: 'border border-red-500/40 text-red-400 hover:bg-red-500/10',
  }
  return (
    <button
      {...props}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${cores[variante]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{rotulo}</span>
      {children}
    </label>
  )
}

export function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-coal p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={titulo}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold normal-case tracking-normal text-white">{titulo}</h2>
          <button onClick={aoFechar} className="text-2xl leading-none text-muted hover:text-white" aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'ok'; children: ReactNode }) {
  const cor = tipo === 'erro' ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-green-500/40 bg-green-500/10 text-green-300'
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cor}`}>{children}</div>
}

export function Carregando() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-muted">{children}</div>
}

export function Cabecalho({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold normal-case tracking-normal text-white">{titulo}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
