// Conteúdo das páginas de serviço. RASCUNHO: validar com o Ricardo o que é
// efetivamente oferecido. Regras do briefing: sem taxas, prazos, aprovações,
// depoimentos ou regras regulatórias afirmadas de memória.

export interface Passo {
  titulo: string
  texto: string
}

export interface Pergunta {
  p: string
  r: string
}

export interface Servico {
  slug: string
  url: string
  icone: string
  nome: string // usado no menu, cartões e no formulário
  resumo: string // texto curto dos cartões
  seoTitulo: string
  seoDescricao: string
  h1: string
  intro: string
  paraQuem: string[]
  passos: Passo[]
  saiba: string[]
  perguntas: Pergunta[]
  publico: ('voce' | 'empresa')[]
}

export const servicos: Servico[] = [
  {
    slug: 'financiamento-imobiliario',
    url: '/credito/financiamento-imobiliario',
    icone: 'casa',
    nome: 'Financiamento imobiliário',
    resumo: 'Crédito bancário para comprar seu imóvel, com simulação e acompanhamento da proposta até a assinatura.',
    seoTitulo: 'Financiamento imobiliário em Canoas/RS | Dicoon Invest',
    seoDescricao:
      'Financiamento imobiliário com atendimento de correspondente bancário em Canoas/RS: simulação, análise de crédito e acompanhamento até a assinatura do contrato.',
    h1: 'Financiamento imobiliário',
    intro:
      'Crédito bancário para comprar sua casa ou apartamento, com orientação em cada etapa: da simulação de financiamento imobiliário à assinatura do contrato.',
    paraQuem: [
      'Quem vai comprar o primeiro imóvel',
      'Quem quer trocar de casa ou apartamento',
      'Quem precisa comparar condições entre instituições antes de decidir',
    ],
    passos: [
      { titulo: 'Conversa inicial', texto: 'Entendemos o imóvel que você quer, sua renda e o seu objetivo.' },
      { titulo: 'Simulação', texto: 'Comparamos cenários de entrada, prazo e parcela nas instituições parceiras.' },
      { titulo: 'Documentação e análise', texto: 'Organizamos os documentos e encaminhamos a proposta para a análise de crédito.' },
      { titulo: 'Avaliação e contrato', texto: 'Acompanhamos a avaliação do imóvel e a assinatura do contrato com o banco.' },
    ],
    saiba: [
      'No financiamento imobiliário, o próprio imóvel costuma ficar como garantia do contrato até a quitação.',
      'Entrada, prazo e valor das parcelas dependem do seu perfil e da análise de cada instituição. Você vê os números da simulação antes de qualquer decisão.',
      'Em alguns casos é possível usar o saldo do FGTS na compra. As regras são verificadas para o seu caso durante o atendimento.',
    ],
    perguntas: [
      {
        p: 'Posso financiar um imóvel usado?',
        r: 'Em geral, sim, desde que o imóvel e a documentação sejam aprovados na avaliação da instituição financeira.',
      },
      {
        p: 'O que influencia a aprovação do crédito?',
        r: 'A instituição analisa renda, histórico de crédito, compromissos financeiros e a documentação do comprador e do imóvel.',
      },
      {
        p: 'A Dicoon Invest aprova o financiamento?',
        r: 'Não. A análise e a aprovação são feitas pela instituição financeira. Nós orientamos, organizamos o processo e acompanhamos você até o fim.',
      },
    ],
    publico: ['voce'],
  },
  {
    slug: 'veicular',
    url: '/credito/veicular',
    icone: 'carro',
    nome: 'Financiamento veicular',
    resumo: 'Crédito para comprar seu carro, novo ou usado, comparando opções nas instituições parceiras.',
    seoTitulo: 'Financiamento de veículos em Canoas/RS | Dicoon Invest',
    seoDescricao:
      'Financiamento de veículos novos e usados com simulação e comparação de condições nas instituições parceiras. Atendimento personalizado em Canoas/RS.',
    h1: 'Financiamento de veículos',
    intro: 'Crédito para comprar seu carro novo ou usado, com simulação de financiamento e comparação de condições nas instituições parceiras.',
    paraQuem: [
      'Quem vai comprar o primeiro carro',
      'Quem quer trocar de veículo',
      'Profissionais que usam o carro para trabalhar',
    ],
    passos: [
      { titulo: 'Conversa inicial', texto: 'Entendemos o veículo que você procura e quanto quer investir por mês.' },
      { titulo: 'Simulação', texto: 'Comparamos entrada, prazo e parcela em diferentes instituições.' },
      { titulo: 'Análise de crédito', texto: 'Encaminhamos a proposta e acompanhamos a resposta da instituição.' },
      { titulo: 'Contrato', texto: 'Orientamos você na assinatura e nos próximos passos até a liberação.' },
    ],
    saiba: [
      'No financiamento de veículos, o carro normalmente fica como garantia do contrato até a quitação.',
      'A entrada, o prazo e a parcela variam conforme o veículo, o seu perfil e a instituição escolhida.',
      'Antes de assinar, você recebe as condições da proposta para comparar com calma.',
    ],
    perguntas: [
      { p: 'Dá para financiar carro usado?', r: 'Em geral, sim. Cada instituição tem critérios próprios, como o ano e a avaliação do veículo.' },
      { p: 'Preciso dar entrada?', r: 'Depende da instituição e do seu perfil. Na simulação mostramos as opções disponíveis para o seu caso.' },
    ],
    publico: ['voce', 'empresa'],
  },
  {
    slug: 'consignado',
    url: '/credito/consignado',
    icone: 'carteira',
    nome: 'Crédito consignado',
    resumo: 'Empréstimo com desconto das parcelas direto na folha ou no benefício, para quem tem acesso à modalidade.',
    seoTitulo: 'Crédito consignado em Canoas/RS | Dicoon Invest',
    seoDescricao:
      'Empréstimo consignado para aposentados e pensionistas, servidores públicos e trabalhadores com convênio. Simulação e atendimento personalizado em Canoas/RS.',
    h1: 'Crédito consignado',
    intro: 'Empréstimo consignado com as parcelas descontadas direto na folha de pagamento ou no benefício, para quem tem acesso à modalidade.',
    paraQuem: [
      'Aposentados e pensionistas',
      'Servidores públicos',
      'Trabalhadores de empresas com convênio de consignado',
    ],
    passos: [
      { titulo: 'Conversa inicial', texto: 'Verificamos se você tem acesso à modalidade e qual é o seu objetivo.' },
      { titulo: 'Simulação de consignado', texto: 'Mostramos valor, prazo e parcela possíveis dentro da sua margem disponível.' },
      { titulo: 'Contratação', texto: 'Orientamos a contratação com a instituição escolhida.' },
      { titulo: 'Acompanhamento', texto: 'Seguimos com você até a liberação do valor.' },
    ],
    saiba: [
      'Como as parcelas são descontadas direto da folha ou do benefício, o consignado costuma ter condições diferentes das outras linhas de crédito pessoal.',
      'Existe um limite de quanto da renda pode ir para as parcelas, a chamada margem consignável. Ele é definido pelas regras de cada convênio.',
      'Atenção a golpes: desconfie de quem pede depósito antecipado para liberar empréstimo.',
    ],
    perguntas: [
      {
        p: 'Quem pode contratar crédito consignado?',
        r: 'Aposentados e pensionistas, servidores públicos e trabalhadores de empresas conveniadas, conforme as regras de cada convênio.',
      },
      { p: 'O que é margem consignável?', r: 'É a parte da renda que pode ser comprometida com as parcelas do consignado, segundo as regras do seu convênio.' },
    ],
    publico: ['voce'],
  },
  {
    slug: 'home-equity',
    url: '/credito/home-equity',
    icone: 'chave',
    nome: 'Home Equity',
    resumo: 'Empréstimo com garantia de imóvel: valores mais altos e prazos mais longos usando o seu imóvel como garantia.',
    seoTitulo: 'Home Equity: empréstimo com garantia de imóvel | Dicoon Invest',
    seoDescricao:
      'Home Equity em Canoas/RS: simule o empréstimo com garantia de imóvel, entenda custos, prazos e alienação fiduciária e compare opções nas instituições parceiras.',
    h1: 'Home Equity: empréstimo com garantia de imóvel',
    intro:
      'Use o seu imóvel como garantia para conseguir um crédito de valor mais alto, com prazos mais longos e parcelas que cabem no orçamento. Você continua morando ou usando o imóvel normalmente.',
    paraQuem: [
      'Quem tem imóvel próprio e precisa de um valor mais alto',
      'Quem quer trocar dívidas caras por parcelas mais longas',
      'Quem vai construir, reformar ou investir no próprio negócio',
      'Quem já tem um empréstimo com garantia e quer comparar condições',
    ],
    passos: [
      { titulo: 'Simulação e conversa', texto: 'Simulamos valor, prazo e parcela e entendemos para que você vai usar o dinheiro.' },
      { titulo: 'Análise de crédito', texto: 'Organizamos seus documentos e os do imóvel e acompanhamos a análise da instituição.' },
      { titulo: 'Avaliação do imóvel', texto: 'A instituição agenda a vistoria para definir o valor de avaliação do imóvel.' },
      { titulo: 'Contrato e liberação', texto: 'Após a assinatura e o registro da garantia em cartório, o valor é liberado na sua conta.' },
    ],
    saiba: [
      'No Home Equity o imóvel fica em alienação fiduciária: a garantia é registrada na matrícula, mas o imóvel continua sendo seu e você segue morando ou usando normalmente. Com a quitação, a garantia é retirada.',
      'O valor liberado é uma parte do valor de avaliação do imóvel. O limite exato, o prazo e a taxa dependem da instituição e da análise do seu perfil.',
      'As taxas podem ser pré-fixadas (iguais durante todo o contrato) ou pós-fixadas (com uma parte corrigida por um índice de inflação). Mostramos as duas opções quando disponíveis.',
      'Além dos juros, podem incidir IOF, seguros obrigatórios, tarifa de avaliação e custos de registro em cartório. Tudo aparece no custo efetivo total antes da assinatura.',
      'Atenção: por ser uma garantia, o atraso prolongado das parcelas pode levar à perda do imóvel. Por isso ajudamos você a escolher uma parcela segura para o seu orçamento.',
    ],
    perguntas: [
      {
        p: 'Quanto posso pegar no Home Equity?',
        r: 'Uma parte do valor de avaliação do imóvel. Muitas instituições trabalham com até cerca de 60% desse valor, mas o limite exato depende da instituição, do tipo de imóvel e da sua capacidade de pagamento.',
      },
      {
        p: 'Posso continuar morando no imóvel?',
        r: 'Sim. O imóvel continua sendo seu durante todo o contrato. A garantia fica registrada na matrícula e é retirada quando o empréstimo é quitado.',
      },
      {
        p: 'O imóvel precisa estar quitado?',
        r: 'Depende da instituição. Algumas aceitam imóvel com saldo de financiamento baixo, outras exigem o imóvel quitado. Verificamos isso no seu caso.',
      },
      {
        p: 'Posso vender o imóvel que está em garantia?',
        r: 'Em geral é preciso quitar o empréstimo antes ou na própria venda, com o acordo da instituição. Orientamos você se esse momento chegar.',
      },
      {
        p: 'Qual a diferença entre taxa pré-fixada e pós-fixada?',
        r: 'Na pré-fixada a taxa é definida na assinatura e não muda. Na pós-fixada, uma parte é corrigida por um índice de inflação, então a parcela pode variar ao longo do tempo.',
      },
      {
        p: 'Existe renda mínima?',
        r: 'Cada instituição tem os próprios critérios. Na análise avaliamos se a parcela cabe na sua renda com segurança.',
      },
      {
        p: 'Já tenho um empréstimo com garantia. Posso levar para outra instituição?',
        r: 'A portabilidade pode ser possível. Comparamos as condições atuais com as de outras instituições para ver se vale a pena.',
      },
    ],
    publico: ['voce'],
  },
  {
    slug: 'empresarial',
    url: '/credito/empresarial',
    icone: 'predio',
    nome: 'Crédito empresarial',
    resumo: 'Soluções de crédito para o seu negócio investir, se organizar e crescer.',
    seoTitulo: 'Crédito para empresas em Canoas/RS | Dicoon Invest',
    seoDescricao:
      'Crédito empresarial e financiamento para empresas investirem, organizarem o caixa e crescerem. Diagnóstico e acompanhamento da proposta em Canoas/RS.',
    h1: 'Crédito empresarial',
    intro: 'Soluções financeiras para empresas que querem investir, organizar o caixa e crescer com planejamento.',
    paraQuem: [
      'Empresas que precisam reforçar o capital de giro',
      'Negócios que vão investir em equipamentos, reforma ou expansão',
      'Empresas que querem reorganizar compromissos financeiros',
    ],
    passos: [
      { titulo: 'Diagnóstico', texto: 'Entendemos o momento da empresa e para que o crédito será usado.' },
      { titulo: 'Simulação', texto: 'Comparamos linhas e condições nas instituições parceiras.' },
      { titulo: 'Documentação e análise', texto: 'Organizamos os documentos da empresa e acompanhamos a análise.' },
      { titulo: 'Contratação', texto: 'Orientamos a contratação e seguimos disponíveis depois dela.' },
    ],
    saiba: [
      'Cada linha de crédito para empresas tem garantias, prazos e exigências próprias, definidas pela instituição financeira.',
      'A análise costuma considerar faturamento, tempo de atividade, histórico de crédito e documentação da empresa.',
    ],
    perguntas: [
      { p: 'Empresa nova consegue crédito?', r: 'Depende da instituição e da linha. No diagnóstico avaliamos as alternativas possíveis para o momento da sua empresa.' },
      { p: 'Quais documentos a empresa precisa?', r: 'A lista varia conforme a linha e a instituição. Passamos tudo o que for necessário logo no primeiro atendimento.' },
    ],
    publico: ['empresa'],
  },
  {
    slug: 'consorcios',
    url: '/consorcios',
    icone: 'calendario',
    nome: 'Consórcios',
    resumo: 'Planejamento para conquistar imóvel ou veículo com carta de crédito e parcelas que cabem no seu orçamento.',
    seoTitulo: 'Consórcio de imóveis e veículos em Canoas/RS | Dicoon Invest',
    seoDescricao:
      'Consórcio de imóveis e de veículos: entenda como funciona, como é a contemplação por sorteio ou lance e simule a carta de crédito ideal para você.',
    h1: 'Consórcios',
    intro: 'Consórcio de imóveis e de veículos para planejar a sua conquista com carta de crédito e parcelas programadas.',
    paraQuem: [
      'Quem quer planejar a compra sem pressa',
      'Quem busca uma alternativa ao financiamento',
      'Empresas que querem renovar veículos ou equipamentos com planejamento',
    ],
    passos: [
      { titulo: 'Escolha da carta de crédito', texto: 'Definimos juntos o valor da carta e o tipo de bem: imóvel ou veículo.' },
      { titulo: 'Adesão ao grupo', texto: 'Você entra em um grupo e passa a pagar as parcelas mensais.' },
      { titulo: 'Contemplação', texto: 'Todo mês há contemplações por sorteio ou por lance.' },
      { titulo: 'Uso da carta', texto: 'Contemplado, você usa a carta de crédito para comprar o bem.' },
    ],
    saiba: [
      'No consórcio não há juros como no financiamento. O custo vem da taxa de administração e dos demais encargos previstos no contrato.',
      'Não há data garantida para a contemplação: ela acontece por sorteio ou lance, conforme as regras do grupo.',
      'Antes de aderir, você recebe as condições do grupo para avaliar com calma.',
    ],
    perguntas: [
      {
        p: 'Como funciona um consórcio?',
        r: 'Um grupo de pessoas paga parcelas mensais e, todo mês, participantes são contemplados por sorteio ou lance para usar a carta de crédito na compra do bem.',
      },
      { p: 'Posso dar lance?', r: 'Sim, a maioria dos grupos aceita lances. As regras de cada grupo são apresentadas antes da adesão.' },
      { p: 'Quando recebo a carta de crédito?', r: 'Quando for contemplado, por sorteio ou lance. Por isso o consórcio é indicado para quem pode planejar a compra.' },
    ],
    publico: ['voce', 'empresa'],
  },
  {
    slug: 'seguros',
    url: '/seguros',
    icone: 'escudo',
    nome: 'Seguros',
    resumo: 'Proteção para você, sua família, seu veículo e o seu patrimônio.',
    seoTitulo: 'Cotação de seguros em Canoas/RS | Dicoon Invest',
    seoDescricao:
      'Cotação de seguro auto, seguro residencial, seguro de vida e seguro empresarial com orientação para escolher a cobertura certa. Atendimento em Canoas/RS.',
    h1: 'Seguros',
    intro: 'Cotação de seguros para você, sua família, seu veículo e a sua empresa, com orientação para escolher a cobertura certa.',
    paraQuem: [
      'Seguro auto: proteção para o seu veículo',
      'Seguro residencial: proteção para a sua casa',
      'Seguro de vida: tranquilidade para a sua família',
      'Seguro empresarial: proteção para o seu negócio',
    ],
    passos: [
      { titulo: 'Conversa inicial', texto: 'Entendemos o que você quer proteger e o que é mais importante para você.' },
      { titulo: 'Cotação', texto: 'Buscamos opções nas seguradoras parceiras.' },
      { titulo: 'Comparação', texto: 'Explicamos coberturas, franquias e valores para você decidir com clareza.' },
      { titulo: 'Contratação e suporte', texto: 'Acompanhamos a contratação e seguimos disponíveis depois dela.' },
    ],
    saiba: [
      'O preço do seguro não é o único ponto a comparar: coberturas, franquias e assistências fazem diferença na hora de usar.',
      'Leia com atenção as condições gerais da apólice. Nós explicamos os pontos principais antes da contratação.',
    ],
    perguntas: [
      { p: 'Como escolher a cobertura certa?', r: 'Depende do que você quer proteger e do seu orçamento. Na conversa inicial ajudamos a definir as coberturas mais importantes.' },
      { p: 'Vocês fazem seguro para empresas?', r: 'Sim, buscamos opções de seguro empresarial nas seguradoras parceiras.' },
    ],
    publico: ['voce', 'empresa'],
  },
]

export const servicosCredito = servicos.filter((s) => s.url.startsWith('/credito/'))
export const porSlug = (slug: string) => servicos.find((s) => s.slug === slug)!
