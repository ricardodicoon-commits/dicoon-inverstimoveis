// Dados de contato da empresa (fonte: backup do site, 13/08/2026).
export const empresa = {
  nome: 'Dicoon Invest',
  razaoSocial: 'DICOON INVEST IMOVEIS LTDA',
  cnpj: '43.363.198/0001-80',
  whatsapp: '5551982367904',
  telefone: '(51) 98236-7904',
  email: 'contato@dicooninvest.com.br',
  endereco: 'Rua Capistrano de Abreu, 163 - Sala 2',
  bairroCidade: 'Niterói, Canoas/RS',
  bairro: 'Niterói',
  cidade: 'Canoas',
  uf: 'RS',
  site: 'https://www.dicooninvest.com.br',
}

// Códigos públicos de medição (aparecem no site; não são senhas).
// Vazios = nada é carregado e o aviso de cookies não aparece.
export const rastreamento = {
  googleAnalytics: 'G-50TXLG4V23', // propriedade "Dicoon Invest - Site", fluxo "Site Dicoon Invest"
  pixelMeta: '1403847860332992', // "Pixel de Paulo Ricardo Schimumeck", conta de anúncios 2368456383335072
}

export function linkWhatsApp(mensagem = 'Olá, quero conhecer as soluções da Dicoon Invest.') {
  return `https://wa.me/${empresa.whatsapp}?text=${encodeURIComponent(mensagem)}`
}
