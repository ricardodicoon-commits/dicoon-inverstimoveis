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

// Perfis nas redes. Vazio = o ícone não aparece no rodapé.
export const redes = {
  instagram: '', // https://www.instagram.com/...
  facebook: '', // https://www.facebook.com/...
  messenger: '', // https://m.me/...
  tiktok: '', // https://www.tiktok.com/@...
}

// Medição. O Google Tag Manager carrega o Analytics (G-50TXLG4V23) e o Pixel da
// Meta (1403847860332992); a configuração fica em gtm/container-dicoon-invest.json.
// Vazio = nada é carregado e o aviso de cookies não aparece.
export const rastreamento = {
  tagManager: 'GTM-MGMRFZCG', // conta "Dicoon Invest", contêiner "www.dicooninvest.com.br"
}

export function linkWhatsApp(mensagem = 'Olá, quero conhecer as soluções da Dicoon Invest.') {
  return `https://wa.me/${empresa.whatsapp}?text=${encodeURIComponent(mensagem)}`
}
