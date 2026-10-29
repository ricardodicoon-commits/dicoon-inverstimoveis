import type { Workbook, Worksheet } from 'exceljs'

// Planilha completa do Financeiro em Excel (.xlsx), com fórmulas de verdade: os totais, saldos,
// DRE e fluxo de caixa são calculados pelo Excel a partir da aba "Lançamentos". Se alguém mudar
// um valor ou a data-base do Resumo, tudo recalcula. A biblioteca só carrega quando se clica.

export interface LinhaLancamento {
  tipo: 'receber' | 'pagar'
  descricao: string
  categoria: string
  linhaDre: string
  grupoDfc: string
  competencia: string
  vencimento: string
  status: 'pendente' | 'pago' | 'cancelado'
  pagoEm: string | null
  valor: number
  valorPago: number | null
  conta: string
  forma: string
  parceiro: string
  repete: boolean
  observacoes: string
}
export interface LinhaConta {
  nome: string
  tipo: string
  saldoInicial: number
  dataSaldoInicial: string
  ativa: boolean
}
export interface LinhaCategoria {
  nome: string
  tipo: 'receita' | 'despesa'
  linhaDre: string
  grupoDfc: string
  ativa: boolean
}

const NAVY = 'FF10243A'
const OURO = 'FFC8A45D'
const CINZA = 'FFF3F5F8'
const VERDE = 'FF0F7B4D'
const VERMELHO = 'FFB4232F'
const MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
const DATA = 'dd/mm/yyyy'
const MES = 'mmm/yy'
const PORCENTO = '0.0%'

const data = (dia: string | null) => {
  if (!dia) return null
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

function titulo(ws: Worksheet, texto: string, subtitulo: string, colunas: number) {
  ws.mergeCells(1, 1, 1, colunas)
  const t = ws.getCell(1, 1)
  t.value = texto
  t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: OURO } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  t.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 28
  ws.mergeCells(2, 1, 2, colunas)
  const s = ws.getCell(2, 1)
  s.value = subtitulo
  s.font = { italic: true, size: 10, color: { argb: 'FF5B6B7F' } }
}

function cabecalho(ws: Worksheet, linha: number, nomes: string[]) {
  const r = ws.getRow(linha)
  nomes.forEach((n, i) => {
    const c = r.getCell(i + 1)
    c.value = n
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    c.alignment = { vertical: 'middle', wrapText: true }
    c.border = { bottom: { style: 'thin', color: { argb: OURO } } }
  })
  r.height = 22
}

function linhaTotal(ws: Worksheet, linha: number, colunas: number) {
  const r = ws.getRow(linha)
  for (let i = 1; i <= colunas; i++) {
    const c = r.getCell(i)
    c.font = { ...(c.font ?? {}), bold: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8DCC0' } }
    c.border = { top: { style: 'thin', color: { argb: NAVY } } }
  }
}

export async function gerarExcelFinanceiro(dados: { lancamentos: LinhaLancamento[]; contas: LinhaConta[]; categorias: LinhaCategoria[]; hoje: string; meses: string[] }) {
  const ExcelJS = (await import('exceljs')).default
  const wb: Workbook = new ExcelJS.Workbook()
  wb.creator = 'CRM Dicoon Invest'
  wb.created = new Date()
  wb.calcProperties.fullCalcOnLoad = true // o Excel recalcula tudo ao abrir

  const geradoEm = `Gerado em ${dados.hoje.split('-').reverse().join('/')} pelo CRM da Dicoon Invest. Valores calculados por fórmulas a partir da aba Lançamentos.`
  const resumo = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] })
  const dre = wb.addWorksheet('DRE', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }] })
  const dfc = wb.addWorksheet('Fluxo de caixa', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }] })
  const lanc = wb.addWorksheet('Lançamentos', { views: [{ state: 'frozen', ySplit: 4 }] })
  const aReceber = wb.addWorksheet('A receber', { views: [{ state: 'frozen', ySplit: 4 }] })
  const aPagar = wb.addWorksheet('A pagar', { views: [{ state: 'frozen', ySplit: 4 }] })
  const contas = wb.addWorksheet('Contas', { views: [{ state: 'frozen', ySplit: 4 }] })
  const cats = wb.addWorksheet('Categorias', { views: [{ state: 'frozen', ySplit: 4 }] })

  // ------------------------------------------------------------ Lançamentos (a base de tudo)
  const colL = ['Tipo', 'Descrição', 'Categoria', 'Linha da DRE', 'Grupo do caixa', 'Competência', 'Vencimento', 'Situação', 'Pago em', 'Valor', 'Valor pago', 'Valor efetivo', 'Efeito no caixa', 'Conta', 'Forma', 'Quem paga ou recebe', 'Repete', 'Observações']
  titulo(lanc, 'Lançamentos', geradoEm, colL.length)
  cabecalho(lanc, 4, colL)
  const L1 = 5
  const ordenados = [...dados.lancamentos].sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  ordenados.forEach((l, i) => {
    const n = L1 + i
    const r = lanc.getRow(n)
    r.values = [
      l.tipo === 'receber' ? 'A receber' : 'A pagar',
      l.descricao,
      l.categoria,
      l.linhaDre,
      l.grupoDfc,
      data(l.competencia),
      data(l.vencimento),
      l.status === 'pago' ? 'Pago' : l.status === 'cancelado' ? 'Cancelado' : 'Pendente',
      data(l.pagoEm),
      l.valor,
      l.valorPago,
      { formula: `IF(H${n}="Pago",IF(K${n}="",J${n},K${n}),IF(H${n}="Cancelado",0,J${n}))` },
      { formula: `IF(H${n}="Pago",IF(A${n}="A receber",1,-1)*L${n},0)` },
      l.conta,
      l.forma,
      l.parceiro,
      l.repete ? 'Todo mês' : '',
      l.observacoes,
    ]
    const cor = l.tipo === 'receber' ? VERDE : VERMELHO
    for (const c of [10, 11, 12]) r.getCell(c).font = { color: { argb: cor } }
    if (l.status === 'pendente' && l.vencimento < dados.hoje) {
      for (let c = 1; c <= colL.length; c++) r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8EA' } }
      r.getCell(8).value = 'Pendente'
      r.getCell(8).font = { bold: true, color: { argb: VERMELHO } }
    } else if (i % 2) {
      for (let c = 1; c <= colL.length; c++) r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA } }
    }
  })
  const LN = Math.max(L1, L1 + ordenados.length - 1) // última linha de dados
  const totL = LN + 1
  lanc.getCell(totL, 1).value = 'Total (respeita os filtros)'
  for (const c of ['J', 'K', 'L', 'M']) lanc.getCell(`${c}${totL}`).value = { formula: `SUBTOTAL(109,${c}${L1}:${c}${LN})` }
  linhaTotal(lanc, totL, colL.length)
  lanc.autoFilter = { from: { row: 4, column: 1 }, to: { row: LN, column: colL.length } }
  ;[12, 38, 32, 20, 15, 12, 12, 11, 12, 14, 14, 14, 15, 18, 15, 26, 10, 36].forEach((w, i) => (lanc.getColumn(i + 1).width = w))
  for (const c of [6, 7, 9]) lanc.getColumn(c).numFmt = DATA
  for (const c of [10, 11, 12, 13]) lanc.getColumn(c).numFmt = MOEDA

  // Intervalos usados nas fórmulas das outras abas.
  const R = (col: string) => `'Lançamentos'!$${col}$${L1}:$${col}$${LN}`
  const TIPO = R('A'), CAT = R('C'), DRE_ = R('D'), DFC_ = R('E'), COMP = R('F'), VENC = R('G'), SIT = R('H'), PAGO = R('I'), VALOR = R('J'), VPAGO = R('K'), EFET = R('L'), CAIXA = R('M'), CONTA = R('N')

  // ------------------------------------------------------------ Contas
  const colC = ['Conta', 'Tipo', 'Ativa', 'Saldo inicial', 'Data do saldo inicial', 'Entradas pagas', 'Saídas pagas', 'Saldo atual']
  titulo(contas, 'Contas e saldos', geradoEm, colC.length)
  cabecalho(contas, 4, colC)
  const C1 = 5
  dados.contas.forEach((c, i) => {
    const n = C1 + i
    contas.getRow(n).values = [
      c.nome,
      c.tipo,
      c.ativa ? 'Sim' : 'Não',
      c.saldoInicial,
      data(c.dataSaldoInicial),
      { formula: `SUMIFS(${VPAGO},${CONTA},A${n},${SIT},"Pago",${TIPO},"A receber",${PAGO},">="&E${n})` },
      { formula: `SUMIFS(${VPAGO},${CONTA},A${n},${SIT},"Pago",${TIPO},"A pagar",${PAGO},">="&E${n})` },
      { formula: `D${n}+F${n}-G${n}` },
    ]
  })
  const CN = Math.max(C1, C1 + dados.contas.length - 1)
  const totC = CN + 1
  contas.getCell(totC, 1).value = 'Total das contas ativas'
  for (const c of ['D', 'F', 'G', 'H']) contas.getCell(`${c}${totC}`).value = { formula: `SUMIFS(${c}${C1}:${c}${CN},$C$${C1}:$C$${CN},"Sim")` }
  linhaTotal(contas, totC, colC.length)
  ;[28, 16, 8, 16, 14, 16, 16, 16].forEach((w, i) => (contas.getColumn(i + 1).width = w))
  contas.getColumn(5).numFmt = DATA
  for (const c of [4, 6, 7, 8]) contas.getColumn(c).numFmt = MOEDA

  // ------------------------------------------------------------ Resumo
  titulo(resumo, 'Financeiro · Dicoon Invest', geradoEm, 6)
  resumo.getCell('A4').value = 'Data-base'
  resumo.getCell('B4').value = data(dados.hoje)
  resumo.getCell('B4').numFmt = DATA
  resumo.getCell('B4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6DD' } }
  resumo.getCell('C4').value = 'Mude esta data para recalcular os prazos abaixo.'
  resumo.getCell('C4').font = { italic: true, size: 9, color: { argb: 'FF5B6B7F' } }
  resumo.getCell('A4').font = { bold: true }
  cabecalho(resumo, 6, ['Indicador', 'Valor', 'Lançamentos'])
  const B = '$B$4'
  const indicadores: [string, string, string | null][] = [
    ['Saldo nas contas ativas', `Contas!H${totC}`, null],
    ['A receber nos próximos 30 dias', `SUMIFS(${VALOR},${TIPO},"A receber",${SIT},"Pendente",${VENC},">="&${B},${VENC},"<="&${B}+30)`, `COUNTIFS(${TIPO},"A receber",${SIT},"Pendente",${VENC},">="&${B},${VENC},"<="&${B}+30)`],
    ['A pagar nos próximos 30 dias', `SUMIFS(${VALOR},${TIPO},"A pagar",${SIT},"Pendente",${VENC},">="&${B},${VENC},"<="&${B}+30)`, `COUNTIFS(${TIPO},"A pagar",${SIT},"Pendente",${VENC},">="&${B},${VENC},"<="&${B}+30)`],
    ['Recebimentos atrasados', `SUMIFS(${VALOR},${TIPO},"A receber",${SIT},"Pendente",${VENC},"<"&${B})`, `COUNTIFS(${TIPO},"A receber",${SIT},"Pendente",${VENC},"<"&${B})`],
    ['Pagamentos atrasados', `SUMIFS(${VALOR},${TIPO},"A pagar",${SIT},"Pendente",${VENC},"<"&${B})`, `COUNTIFS(${TIPO},"A pagar",${SIT},"Pendente",${VENC},"<"&${B})`],
    ['Caixa do mês da data-base (entrou − saiu)', `SUMIFS(${CAIXA},${PAGO},">="&DATE(YEAR(${B}),MONTH(${B}),1),${PAGO},"<"&EDATE(DATE(YEAR(${B}),MONTH(${B}),1),1))`, null],
    ['Saldo previsto em 30 dias', `B7+B8-B9+B10-B11`, null],
  ]
  indicadores.forEach(([rotulo, f, cont], i) => {
    const n = 7 + i
    resumo.getCell(`A${n}`).value = rotulo
    resumo.getCell(`B${n}`).value = { formula: f }
    resumo.getCell(`B${n}`).numFmt = MOEDA
    resumo.getCell(`B${n}`).font = { bold: true }
    if (cont) resumo.getCell(`C${n}`).value = { formula: cont }
    if (i % 2) for (const c of ['A', 'B', 'C']) resumo.getCell(`${c}${n}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA } }
  })
  resumo.getCell('A13').note = 'Saldo atual + a receber em 30 dias − a pagar em 30 dias + atrasados a receber − atrasados a pagar.'

  // Caixa mês a mês (data do pagamento).
  const M0 = 16
  resumo.getCell(`A${M0 - 1}`).value = 'Caixa mês a mês (pela data do pagamento)'
  resumo.getCell(`A${M0 - 1}`).font = { bold: true, size: 12, color: { argb: NAVY } }
  cabecalho(resumo, M0, ['Mês', 'Entradas', 'Saídas', 'Resultado', 'Acumulado'])
  dados.meses.forEach((mes, i) => {
    const n = M0 + 1 + i
    resumo.getCell(`A${n}`).value = data(`${mes}-01`)
    resumo.getCell(`A${n}`).numFmt = MES
    resumo.getCell(`B${n}`).value = { formula: `SUMIFS(${EFET},${TIPO},"A receber",${SIT},"Pago",${PAGO},">="&A${n},${PAGO},"<"&EDATE(A${n},1))` }
    resumo.getCell(`C${n}`).value = { formula: `SUMIFS(${EFET},${TIPO},"A pagar",${SIT},"Pago",${PAGO},">="&A${n},${PAGO},"<"&EDATE(A${n},1))` }
    resumo.getCell(`D${n}`).value = { formula: `B${n}-C${n}` }
    resumo.getCell(`E${n}`).value = { formula: i === 0 ? `D${n}` : `E${n - 1}+D${n}` }
    for (const c of ['B', 'C', 'D', 'E']) resumo.getCell(`${c}${n}`).numFmt = MOEDA
    resumo.getCell(`B${n}`).font = { color: { argb: VERDE } }
    resumo.getCell(`C${n}`).font = { color: { argb: VERMELHO } }
  })
  const MN = M0 + dados.meses.length
  resumo.getCell(`A${MN + 1}`).value = 'Total 12 meses'
  for (const c of ['B', 'C', 'D']) {
    resumo.getCell(`${c}${MN + 1}`).value = { formula: `SUM(${c}${M0 + 1}:${c}${MN})` }
    resumo.getCell(`${c}${MN + 1}`).numFmt = MOEDA
  }
  linhaTotal(resumo, MN + 1, 5)

  // Receita por categoria (competência, últimos 12 meses).
  const P0 = MN + 4
  resumo.getCell(`A${P0 - 1}`).value = 'Receita por categoria nos 12 meses (pela competência)'
  resumo.getCell(`A${P0 - 1}`).font = { bold: true, size: 12, color: { argb: NAVY } }
  cabecalho(resumo, P0, ['Categoria', 'Receita', '% do total'])
  const receitas = dados.categorias.filter((c) => c.tipo === 'receita')
  const inicio = `$A$${M0 + 1}`
  receitas.forEach((c, i) => {
    const n = P0 + 1 + i
    resumo.getCell(`A${n}`).value = c.nome
    resumo.getCell(`B${n}`).value = { formula: `SUMIFS(${EFET},${TIPO},"A receber",${CAT},A${n},${COMP},">="&${inicio})` }
    resumo.getCell(`B${n}`).numFmt = MOEDA
    resumo.getCell(`C${n}`).value = { formula: `IFERROR(B${n}/$B$${P0 + receitas.length + 1},0)` }
    resumo.getCell(`C${n}`).numFmt = PORCENTO
  })
  const PN = P0 + receitas.length + 1
  resumo.getCell(`A${PN}`).value = 'Total'
  resumo.getCell(`B${PN}`).value = { formula: `SUM(B${P0 + 1}:B${PN - 1})` }
  resumo.getCell(`B${PN}`).numFmt = MOEDA
  linhaTotal(resumo, PN, 3)
  ;[44, 18, 16, 16, 16, 10].forEach((w, i) => (resumo.getColumn(i + 1).width = w))

  // ------------------------------------------------------------ DRE (competência)
  const nm = dados.meses.length
  titulo(dre, 'DRE · Demonstração do Resultado (pela competência)', geradoEm + ' Despesas aparecem negativas.', nm + 2)
  cabecalho(dre, 4, ['Linha', ...dados.meses.map(() => ''), 'Total'])
  dados.meses.forEach((mes, i) => {
    const c = dre.getCell(4, i + 2)
    c.value = data(`${mes}-01`)
    c.numFmt = MES
    c.alignment = { horizontal: 'center' }
  })
  const col = (i: number) => dre.getColumn(i + 2).letter
  const net = (linha: string, i: number) => {
    const m = `${col(i)}$4`
    return `SUMIFS(${EFET},${DRE_},"${linha}",${TIPO},"A receber",${COMP},">="&${m},${COMP},"<"&EDATE(${m},1))-SUMIFS(${EFET},${DRE_},"${linha}",${TIPO},"A pagar",${COMP},">="&${m},${COMP},"<"&EDATE(${m},1))`
  }
  const estrutura: { rotulo: string; tipo: 'linha' | 'soma'; linha?: string; soma?: number[]; destaque?: boolean }[] = [
    { rotulo: 'Receita bruta', tipo: 'linha', linha: 'Receita bruta' }, // 5
    { rotulo: '(−) Deduções (impostos)', tipo: 'linha', linha: 'Deduções (impostos)' }, // 6
    { rotulo: '= Receita líquida', tipo: 'soma', soma: [5, 6], destaque: true }, // 7
    { rotulo: '(−) Custo do serviço', tipo: 'linha', linha: 'Custo do serviço' }, // 8
    { rotulo: '= Lucro bruto', tipo: 'soma', soma: [7, 8], destaque: true }, // 9
    { rotulo: '(−) Despesas operacionais', tipo: 'linha', linha: 'Despesa operacional' }, // 10
    { rotulo: '= Resultado operacional (EBITDA)', tipo: 'soma', soma: [9, 10], destaque: true }, // 11
    { rotulo: '(−) Depreciação', tipo: 'linha', linha: 'Depreciação' }, // 12
    { rotulo: '(+/−) Resultado financeiro', tipo: 'linha', linha: 'Resultado financeiro' }, // 13
    { rotulo: '= Lucro líquido', tipo: 'soma', soma: [11, 12, 13], destaque: true }, // 14
  ]
  estrutura.forEach((e, k) => {
    const n = 5 + k
    dre.getCell(n, 1).value = e.rotulo
    for (let i = 0; i < nm; i++) {
      const cel = dre.getCell(n, i + 2)
      cel.value = { formula: e.tipo === 'linha' ? net(e.linha!, i) : e.soma!.map((s) => `${col(i)}${s}`).join('+') }
      cel.numFmt = MOEDA
    }
    const t = dre.getCell(n, nm + 2)
    t.value = { formula: `SUM(B${n}:${col(nm - 1)}${n})` }
    t.numFmt = MOEDA
    t.font = { bold: true }
    if (e.destaque) linhaTotal(dre, n, nm + 2)
  })
  const indicadoresDre: [string, number][] = [
    ['Margem bruta', 9],
    ['Margem operacional (EBITDA)', 11],
    ['Margem líquida', 14],
  ]
  indicadoresDre.forEach(([rotulo, linha], k) => {
    const n = 16 + k
    dre.getCell(n, 1).value = rotulo
    dre.getCell(n, 1).font = { italic: true }
    for (let i = 0; i <= nm; i++) {
      const c = i < nm ? col(i) : dre.getColumn(nm + 2).letter
      const cel = dre.getCell(n, i + 2)
      cel.value = { formula: `IFERROR(${c}${linha}/${c}7,0)` }
      cel.numFmt = PORCENTO
    }
  })
  dre.getCell(20, 1).value = 'Fora da DRE (aportes, empréstimos, investimentos, distribuição de lucros) não entra no resultado; veja o Fluxo de caixa.'
  dre.getCell(20, 1).font = { italic: true, size: 9, color: { argb: 'FF5B6B7F' } }
  dre.getColumn(1).width = 36
  for (let i = 2; i <= nm + 2; i++) dre.getColumn(i).width = 14

  // ------------------------------------------------------------ Fluxo de caixa (data do pagamento)
  titulo(dfc, 'Fluxo de caixa (pela data do pagamento)', geradoEm, nm + 2)
  cabecalho(dfc, 4, ['Grupo', ...dados.meses.map(() => ''), 'Total'])
  dados.meses.forEach((mes, i) => {
    const c = dfc.getCell(4, i + 2)
    c.value = data(`${mes}-01`)
    c.numFmt = MES
    c.alignment = { horizontal: 'center' }
  })
  const grupos = ['Operacional', 'Investimento', 'Financiamento']
  grupos.forEach((g, k) => {
    const n = 5 + k
    dfc.getCell(n, 1).value = `Fluxo ${g.toLowerCase()}`
    for (let i = 0; i < nm; i++) {
      const m = `${col(i)}$4`
      const cel = dfc.getCell(n, i + 2)
      cel.value = { formula: `SUMIFS(${CAIXA},${DFC_},"${g}",${PAGO},">="&${m},${PAGO},"<"&EDATE(${m},1))` }
      cel.numFmt = MOEDA
    }
    const t = dfc.getCell(n, nm + 2)
    t.value = { formula: `SUM(B${n}:${col(nm - 1)}${n})` }
    t.numFmt = MOEDA
    t.font = { bold: true }
  })
  dfc.getCell(8, 1).value = '= Geração líquida de caixa'
  for (let i = 0; i <= nm; i++) {
    const c = i < nm ? col(i) : dfc.getColumn(nm + 2).letter
    const cel = dfc.getCell(8, i + 2)
    cel.value = { formula: `SUM(${c}5:${c}7)` }
    cel.numFmt = MOEDA
  }
  linhaTotal(dfc, 8, nm + 2)
  dfc.getCell(9, 1).value = 'Acumulado no período'
  for (let i = 0; i < nm; i++) {
    const cel = dfc.getCell(9, i + 2)
    cel.value = { formula: i === 0 ? `${col(i)}8` : `${col(i - 1)}9+${col(i)}8` }
    cel.numFmt = MOEDA
    cel.font = { italic: true }
  }
  dfc.getColumn(1).width = 30
  for (let i = 2; i <= nm + 2; i++) dfc.getColumn(i).width = 14

  // ------------------------------------------------------------ A receber / A pagar (pendentes)
  for (const [ws, tipo, nome] of [
    [aReceber, 'receber', 'Contas a receber em aberto'],
    [aPagar, 'pagar', 'Contas a pagar em aberto'],
  ] as const) {
    const cols = ['Vencimento', 'Descrição', 'Categoria', tipo === 'receber' ? 'Quem paga' : 'Favorecido', 'Valor', 'Dias de atraso', 'Repete']
    titulo(ws, nome, geradoEm + ' Dias de atraso contados a partir da data-base do Resumo.', cols.length)
    cabecalho(ws, 4, cols)
    const itens = ordenados.filter((l) => l.tipo === tipo && l.status === 'pendente')
    itens.forEach((l, i) => {
      const n = 5 + i
      ws.getRow(n).values = [data(l.vencimento), l.descricao, l.categoria, l.parceiro, l.valor, { formula: `MAX(0,Resumo!$B$4-A${n})` }, l.repete ? 'Todo mês' : '']
      if (l.vencimento < dados.hoje) for (let c = 1; c <= cols.length; c++) ws.getCell(n, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8EA' } }
    })
    const fim = 5 + Math.max(itens.length, 1)
    ws.getCell(fim, 1).value = 'Total'
    ws.getCell(fim, 5).value = { formula: `SUM(E5:E${fim - 1})` }
    linhaTotal(ws, fim, cols.length)
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(5, fim - 1), column: cols.length } }
    ;[12, 38, 34, 26, 15, 12, 10].forEach((w, i) => (ws.getColumn(i + 1).width = w))
    ws.getColumn(1).numFmt = DATA
    ws.getColumn(5).numFmt = MOEDA
  }

  // ------------------------------------------------------------ Categorias
  const colK = ['Categoria', 'Tipo', 'Linha da DRE', 'Grupo do caixa', 'Ativa', 'Total lançado (12 meses)']
  titulo(cats, 'Categorias', geradoEm, colK.length)
  cabecalho(cats, 4, colK)
  dados.categorias.forEach((c, i) => {
    const n = 5 + i
    cats.getRow(n).values = [c.nome, c.tipo === 'receita' ? 'Receita' : 'Despesa', c.linhaDre, c.grupoDfc, c.ativa ? 'Sim' : 'Não', { formula: `SUMIFS(${EFET},${CAT},A${n},${COMP},">="&Resumo!${inicio})` }]
    cats.getCell(n, 6).numFmt = MOEDA
    cats.getCell(n, 2).font = { color: { argb: c.tipo === 'receita' ? VERDE : VERMELHO } }
  })
  cats.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + Math.max(1, dados.categorias.length), column: colK.length } }
  ;[44, 10, 22, 16, 8, 20].forEach((w, i) => (cats.getColumn(i + 1).width = w))

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
