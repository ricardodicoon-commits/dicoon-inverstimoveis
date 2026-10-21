// Instituições parceiras exibidas na página inicial.
// Lista informada pelo Ricardo em 2026-10-21. Logos recortadas da arte enviada por ele
// (public/img/parceiros); para trocar por arquivos oficiais, basta manter o nome do arquivo
// e atualizar largura/altura.

export type Parceiro = {
  nome: string
  arquivo: string
  alt: string
  largura: number
  altura: number
  tipo: 'banco' | 'seguradora'
}

export const parceiros: Parceiro[] = [
  { nome: 'Banrisul', arquivo: 'banrisul', alt: 'Logo do Banrisul', largura: 303, altura: 59, tipo: 'banco' },
  { nome: 'Bradesco', arquivo: 'bradesco', alt: 'Logo do Banco Bradesco', largura: 377, altura: 286, tipo: 'banco' },
  { nome: 'Itaú', arquivo: 'itau', alt: 'Logo do Banco Itaú', largura: 370, altura: 370, tipo: 'banco' },
  { nome: 'Banco Inter', arquivo: 'inter', alt: 'Logo do Banco Inter', largura: 360, altura: 180, tipo: 'banco' },
  { nome: 'Zurich Seguros', arquivo: 'zurich', alt: 'Logo da Zurich Seguros', largura: 88, altura: 74, tipo: 'seguradora' },
  { nome: 'Yelum Seguros', arquivo: 'yelum', alt: 'Logo da Yelum Seguros', largura: 103, altura: 38, tipo: 'seguradora' },
  { nome: 'MSIG', arquivo: 'msig', alt: 'Logo da MSIG Seguradora', largura: 81, altura: 84, tipo: 'seguradora' },
  { nome: 'SulAmérica Seguros', arquivo: 'sulamerica', alt: 'Logo da SulAmérica Seguros', largura: 83, altura: 41, tipo: 'seguradora' },
  { nome: 'Justos Seguros', arquivo: 'justos', alt: 'Logo da Justos Seguros', largura: 97, altura: 43, tipo: 'seguradora' },
  { nome: 'Aliro Seguro', arquivo: 'aliro', alt: 'Logo da Aliro Seguro', largura: 93, altura: 64, tipo: 'seguradora' },
  { nome: 'Itaú Seguros', arquivo: 'itau-seguros', alt: 'Logo da Itaú Seguros', largura: 69, altura: 75, tipo: 'seguradora' },
  { nome: 'HDI Seguros', arquivo: 'hdi', alt: 'Logo da HDI Seguros', largura: 96, altura: 59, tipo: 'seguradora' },
  { nome: 'MAPFRE', arquivo: 'mapfre', alt: 'Logo da MAPFRE Seguros', largura: 97, altura: 55, tipo: 'seguradora' },
  { nome: 'Sompo Seguros', arquivo: 'sompo', alt: 'Logo da Sompo Seguros', largura: 83, altura: 59, tipo: 'seguradora' },
  { nome: 'Porto Seguro', arquivo: 'porto-seguro', alt: 'Logo da Porto Seguro', largura: 72, altura: 73, tipo: 'seguradora' },
  { nome: 'Suhai Seguradora', arquivo: 'suhai', alt: 'Logo da Suhai Seguradora', largura: 99, altura: 20, tipo: 'seguradora' },
  { nome: 'Tokio Marine', arquivo: 'tokio-marine', alt: 'Logo da Tokio Marine Seguradora', largura: 90, altura: 56, tipo: 'seguradora' },
  { nome: 'Azul Seguros', arquivo: 'azul', alt: 'Logo da Azul Seguros', largura: 89, altura: 65, tipo: 'seguradora' },
  { nome: 'Ezze Seguros', arquivo: 'ezze', alt: 'Logo da Ezze Seguros', largura: 77, altura: 45, tipo: 'seguradora' },
  { nome: 'Bradesco Seguros', arquivo: 'bradesco-seguros', alt: 'Logo da Bradesco Seguros', largura: 91, altura: 65, tipo: 'seguradora' },
]
