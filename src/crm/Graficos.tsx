import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Gráficos do CRM (carregados sob demanda para não pesar a abertura do app). Cores do tema escuro.
const GRADE = '#24405e'
const TEXTO = '#a9b6c6'
const dicaEstilo = { background: '#0b1a2b', border: '1px solid #24405e', borderRadius: 12, color: '#f5f5f5', fontSize: 12 }

export interface Serie {
  chave: string
  rotulo: string
  cor: string
}

export function GraficoLinhas({ dados, series }: { dados: Record<string, number | string>[]; series: Serie[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.chave} id={`g-${s.chave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.cor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.cor} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRADE} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="semana" tick={{ fill: TEXTO, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: TEXTO, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={dicaEstilo} labelStyle={{ color: TEXTO }} />
        <Legend wrapperStyle={{ fontSize: 12, color: TEXTO }} iconType="circle" iconSize={8} />
        {series.map((s) => (
          <Area key={s.chave} type="monotone" dataKey={s.chave} name={s.rotulo} stroke={s.cor} strokeWidth={2} fill={`url(#g-${s.chave})`} dot={false} activeDot={{ r: 4 }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function GraficoRosca({ dados, total, legendaTotal }: { dados: { rotulo: string; valor: number; cor: string }[]; total: number; legendaTotal: string }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados.filter((d) => d.valor > 0)} dataKey="valor" nameKey="rotulo" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none">
              {dados
                .filter((d) => d.valor > 0)
                .map((d) => (
                  <Cell key={d.rotulo} fill={d.cor} />
                ))}
            </Pie>
            <Tooltip contentStyle={dicaEstilo} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{total}</span>
          <span className="text-[11px] text-muted">{legendaTotal}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {dados.map((d) => (
          <li key={d.rotulo} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-white/85">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.cor }} />
              {d.rotulo}
            </span>
            <span className="text-muted">{d.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
