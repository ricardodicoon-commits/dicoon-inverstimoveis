// Dados de contato da empresa (fonte: backup do site, 13/08/2026).
export const empresa = {
  nome: 'Dicoon Invest Imóveis',
  razaoSocial: 'DICOON INVEST IMOVEIS LTDA',
  cnpj: '43.363.198/0001-80',
  whatsapp: '5551982367904',
  telefone: '(51) 98236-7904',
  email: 'contato@dicooninvest.com.br',
  endereco: 'Rua Capistrano de Abreu, 163 - Sala 2',
  bairroCidade: 'Niterói, Canoas/RS',
}

export function linkWhatsApp(mensagem = 'Olá! Vim pelo site da Dicoon Invest e gostaria de atendimento.') {
  return `https://wa.me/${empresa.whatsapp}?text=${encodeURIComponent(mensagem)}`
}
