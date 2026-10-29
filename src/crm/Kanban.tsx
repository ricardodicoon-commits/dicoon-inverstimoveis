import { useEffect, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { estiloCampo, tons, type Tom } from './ui'

// Kanban genérico no estilo de processos por fases: colunas com faixa de cor, contador, "+" por
// coluna e arrastar e soltar (mouse e toque). No celular, uma fase por vez com "Mover para…".

export interface ColunaKanban {
  valor: string
  rotulo: string
  tom: Tom
  extra?: ReactNode // ex.: soma dos valores
}

function useTelaLarga() {
  const consulta = '(min-width: 768px)'
  const [larga, setLarga] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia(consulta).matches))
  useEffect(() => {
    const m = window.matchMedia(consulta)
    const mudou = () => setLarga(m.matches)
    m.addEventListener('change', mudou)
    return () => m.removeEventListener('change', mudou)
  }, [])
  return larga
}

export function Kanban<T extends { id: string }>({
  colunas,
  itens,
  colunaDe,
  card,
  podeMover,
  aoMover,
  aoCriar,
  podeCriar = () => true,
  vazioColuna = 'Nada aqui.',
}: {
  colunas: ColunaKanban[]
  itens: T[]
  colunaDe: (item: T) => string
  card: (item: T) => ReactNode
  podeMover: (item: T) => boolean
  aoMover: (item: T, destino: string) => void
  aoCriar?: (coluna: string) => void
  podeCriar?: (coluna: string) => boolean // "+" só nas colunas em que faz sentido criar
  vazioColuna?: string
}) {
  const larga = useTelaLarga()
  const [arrastando, setArrastando] = useState<T | null>(null)
  const [faseCelular, setFaseCelular] = useState(colunas[0]?.valor ?? '')
  // Mouse: começa a arrastar depois de 6 px (o clique continua abrindo o card).
  // Toque: segurar 250 ms (assim a rolagem da tela continua funcionando).
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  )
  const porColuna = (c: string) => itens.filter((i) => colunaDe(i) === c)

  function inicio(e: DragStartEvent) {
    setArrastando(itens.find((i) => i.id === e.active.id) ?? null)
  }
  function fim(e: DragEndEvent) {
    const item = itens.find((i) => i.id === e.active.id)
    setArrastando(null)
    const destino = e.over?.id ? String(e.over.id) : null
    if (item && destino && destino !== colunaDe(item) && podeMover(item)) aoMover(item, destino)
  }

  if (!larga) {
    const atual = colunas.find((c) => c.valor === faseCelular) ?? colunas[0]
    const lista = porColuna(atual.valor)
    return (
      <div>
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist">
          {colunas.map((c) => (
            <button
              key={c.valor}
              role="tab"
              aria-selected={c.valor === atual.valor}
              onClick={() => setFaseCelular(c.valor)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                c.valor === atual.valor ? `border-transparent ${tons[c.tom].fundo} ${tons[c.tom].texto}` : 'border-line text-white/70'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${tons[c.tom].faixa}`} />
              {c.rotulo}
              <span className="text-white/50">{porColuna(c.valor).length}</span>
            </button>
          ))}
        </div>
        {atual.extra && <p className="mb-2 text-xs text-gold">{atual.extra}</p>}
        <div className="space-y-2">
          {lista.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-coal">
              {card(i)}
              <div className="border-t border-line px-3 py-2">
                <select
                  className={`${estiloCampo} py-1.5 text-xs`}
                  value={colunaDe(i)}
                  disabled={!podeMover(i)}
                  onChange={(e) => aoMover(i, e.target.value)}
                  aria-label="Mover para"
                  title={podeMover(i) ? undefined : 'Você não pode mover este card'}
                >
                  {colunas.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      Mover para: {c.rotulo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {!lista.length && <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{vazioColuna}</p>}
          {aoCriar && podeCriar(atual.valor) && (
            <button onClick={() => aoCriar(atual.valor)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-3 text-sm font-semibold text-white/70 hover:border-gold hover:text-gold">
              <Plus className="h-4 w-4" /> Criar em {atual.rotulo}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <DndContext sensors={sensores} onDragStart={inicio} onDragEnd={fim} onDragCancel={() => setArrastando(null)}>
      <div className="-mx-4 flex select-none gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [scrollbar-color:rgba(200,164,93,0.45)_transparent] [scrollbar-width:thin]">
        {colunas.map((c) => (
          <Coluna key={c.valor} coluna={c} total={porColuna(c.valor).length} aoCriar={aoCriar && podeCriar(c.valor) ? aoCriar : undefined}>
            {porColuna(c.valor).map((i) => (
              <CartaoArrastavel key={i.id} id={i.id} desativado={!podeMover(i)}>
                {card(i)}
              </CartaoArrastavel>
            ))}
            {!porColuna(c.valor).length && <p className="px-2 py-6 text-center text-xs text-muted/70">{vazioColuna}</p>}
          </Coluna>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{arrastando ? <div className="w-72 rotate-2 rounded-xl border border-gold/60 bg-coal shadow-2xl">{card(arrastando)}</div> : null}</DragOverlay>
    </DndContext>
  )
}

function Coluna({ coluna, total, aoCriar, children }: { coluna: ColunaKanban; total: number; aoCriar?: (c: string) => void; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.valor })
  return (
    <section ref={setNodeRef} className={`flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border bg-ink/60 transition ${isOver ? 'border-gold/70 bg-gold/5' : 'border-line'}`}>
      <div className={`h-1 ${tons[coluna.tom].faixa}`} />
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            {coluna.rotulo}
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${tons[coluna.tom].fundo} ${tons[coluna.tom].texto}`}>{total}</span>
          </p>
          {coluna.extra && <p className="mt-0.5 text-xs text-gold">{coluna.extra}</p>}
        </div>
        {aoCriar && (
          <button onClick={() => aoCriar(coluna.valor)} className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-gold" title={`Criar em ${coluna.rotulo}`} aria-label={`Criar em ${coluna.rotulo}`}>
            <Plus className="h-4 w-4" />
          </button>
        )}
      </header>
      <div className="flex max-h-[calc(100vh-15rem)] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">{children}</div>
    </section>
  )
}

function CartaoArrastavel({ id, desativado, children }: { id: string; desativado: boolean; children: ReactNode }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id, disabled: desativado })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-xl border border-line bg-coal transition hover:border-gold/40 ${isDragging ? 'opacity-30' : ''} ${desativado ? '' : 'cursor-grab active:cursor-grabbing'}`}
    >
      {children}
    </div>
  )
}
