import { useEffect, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react'

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

// Tons para fases do kanban e etiquetas, suaves sobre o fundo escuro (faixa, fundo e texto).
export const tons = {
  azul: { faixa: 'bg-sky-400', fundo: 'bg-sky-400/15', texto: 'text-sky-300', hex: '#38bdf8' },
  ambar: { faixa: 'bg-amber-400', fundo: 'bg-amber-400/15', texto: 'text-amber-300', hex: '#fbbf24' },
  roxo: { faixa: 'bg-violet-400', fundo: 'bg-violet-400/15', texto: 'text-violet-300', hex: '#a78bfa' },
  ciano: { faixa: 'bg-teal-400', fundo: 'bg-teal-400/15', texto: 'text-teal-300', hex: '#2dd4bf' },
  verde: { faixa: 'bg-emerald-400', fundo: 'bg-emerald-400/15', texto: 'text-emerald-300', hex: '#34d399' },
  vermelho: { faixa: 'bg-rose-400', fundo: 'bg-rose-400/15', texto: 'text-rose-300', hex: '#fb7185' },
  dourado: { faixa: 'bg-gold', fundo: 'bg-gold/15', texto: 'text-gold', hex: '#c8a45d' },
  cinza: { faixa: 'bg-white/30', fundo: 'bg-white/10', texto: 'text-white/70', hex: '#94a3b8' },
} as const
export type Tom = keyof typeof tons

export function Etiqueta({ tom = 'cinza', children }: { tom?: Tom; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tons[tom].fundo} ${tons[tom].texto}`}>{children}</span>
}

// Abas no topo da tela (ex.: Kanban | Lista), no estilo das visões de um processo.
export function Abas<T extends string>({
  abas,
  ativa,
  aoMudar,
}: {
  abas: { valor: T; rotulo: string; icone?: ComponentType<{ className?: string }> }[]
  ativa: T
  aoMudar: (v: T) => void
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]" role="tablist">
      {abas.map((a) => (
        <button
          key={a.valor}
          role="tab"
          aria-selected={a.valor === ativa}
          onClick={() => aoMudar(a.valor)}
          className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${
            a.valor === ativa ? 'border-gold text-gold' : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          {a.icone && <a.icone className="h-4 w-4" />}
          {a.rotulo}
        </button>
      ))}
    </div>
  )
}

// Indicador em número grande, com ícone e tom; vira link quando recebe "para".
export function CartaoIndicador({
  rotulo,
  valor,
  icone: Icone,
  tom = 'dourado',
  detalhe,
}: {
  rotulo: string
  valor: ReactNode
  icone?: ComponentType<{ className?: string }>
  tom?: Tom
  detalhe?: ReactNode
}) {
  return (
    <div className="flex h-full items-start gap-3 rounded-2xl border border-line bg-coal p-4 transition hover:border-gold/50">
      {Icone && (
        <span className={`rounded-xl p-2.5 ${tons[tom].fundo} ${tons[tom].texto}`}>
          <Icone className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight text-white sm:text-3xl">{valor}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{rotulo}</p>
        {detalhe && <p className="mt-1 text-[11px] text-white/60">{detalhe}</p>}
      </div>
    </div>
  )
}

export function Cabecalho({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold normal-case tracking-normal text-white">{titulo}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
