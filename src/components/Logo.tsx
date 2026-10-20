// Marca recriada em vetor para fundo escuro.
// Substituir pelo arquivo oficial com fundo transparente quando disponível.
export function Logo({ grande = false }: { grande?: boolean }) {
  const tamanho = grande ? 'h-28 w-28' : 'h-10 w-10'
  return (
    <div className={`flex items-center ${grande ? 'flex-col gap-4' : 'gap-3'}`}>
      <svg viewBox="0 0 64 64" className={tamanho} aria-hidden="true">
        <path d="M6 30 L32 9 L58 30" fill="none" stroke="#d4af37" strokeWidth="3" strokeLinejoin="round" />
        <path d="M46 19 V12 H51 V23" fill="none" stroke="#d4af37" strokeWidth="3" strokeLinejoin="round" />
        <path
          d="M19 25 V54 H30 C43 54 50 47 50 39.5 C50 31 43 25 30 25 Z"
          fill="none"
          stroke="#d4af37"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M24 29 V50" stroke="#d4af37" strokeWidth="1.5" />
      </svg>
      <div className={grande ? 'text-center' : ''}>
        <div className={`font-bold tracking-[0.3em] text-white ${grande ? 'text-4xl' : 'text-lg leading-none'}`}>
          DICOON
        </div>
        <div className={`font-semibold tracking-[0.25em] text-gold ${grande ? 'mt-1 text-sm' : 'text-[0.6rem]'}`}>
          INVEST IMÓVEIS
        </div>
      </div>
    </div>
  )
}
