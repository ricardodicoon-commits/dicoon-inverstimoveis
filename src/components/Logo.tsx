// Logo oficial (fundo transparente), em public/img/logo-dicoon.png.
export function Logo({ grande = false }: { grande?: boolean }) {
  return (
    <img
      src="/img/logo-dicoon.png"
      alt="Dicoon Invest Imóveis"
      width={520}
      height={352}
      className={grande ? 'h-40 w-auto' : 'h-12 w-auto'}
    />
  )
}
