import { useEffect, useRef } from 'react'

// Envia um evento ao Analytics e ao Pixel (só funciona se a pessoa aceitou os cookies;
// ver components/site/Rastreamento.astro). Nunca passar dados pessoais nem valores digitados.
export function registrarEvento(nome: string, dados: Record<string, string> = {}) {
  ;(window as unknown as { dicoonEvento?: (n: string, d: Record<string, string>) => void }).dicoonEvento?.(nome, dados)
}

// Conta uma simulação por produto na primeira vez que a pessoa mexe no simulador.
export function useEventoSimulacao(produto: string, dependencias: unknown[]) {
  const primeira = useRef(true)
  const contados = useRef(new Set<string>())
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    if (contados.current.has(produto)) return
    contados.current.add(produto)
    registrarEvento('simulacao', { produto })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias)
}
