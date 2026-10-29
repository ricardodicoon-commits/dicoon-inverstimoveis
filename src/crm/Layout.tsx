import { useEffect, useState, type ComponentType } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Handshake,
  Headset,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquareText,
  PlugZap,
  Repeat,
  Sun,
  UserCog,
  Users,
  KeyRound,
  Wallet,
  X,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAuth } from './auth'
import { rotuloPapel } from './tipos'
import { TrocarSenha } from './TrocarSenha'

type Icone = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
interface Link {
  para: string
  rotulo: string
  icone: Icone
  fim?: boolean
}

// Barra lateral recolhível (preferência guardada só neste navegador).
function useRecolhido() {
  const [recolhido, setRecolhido] = useState(() => {
    try {
      return localStorage.getItem('crm-menu-recolhido') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('crm-menu-recolhido', recolhido ? '1' : '0')
    } catch {
      /* sem armazenamento: só não lembra a preferência */
    }
  }, [recolhido])
  return [recolhido, setRecolhido] as const
}

export function Layout() {
  const { perfil, ehAdmin, sair } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [recolhido, setRecolhido] = useRecolhido()

  const grupos: { titulo?: string; links: Link[] }[] = [
    {
      links: [
        { para: '/app', rotulo: 'Painel', icone: LayoutDashboard, fim: true },
        { para: '/app/atendimento', rotulo: 'Atendimento', icone: Headset },
        { para: '/app/clientes', rotulo: 'Clientes', icone: Users },
        { para: '/app/negociacoes', rotulo: 'Negociações', icone: Handshake },
      ],
    },
    {
      titulo: 'Secretária',
      links: [
        { para: '/app/secretaria', rotulo: 'Resumo do dia', icone: Sun },
        { para: '/app/agenda', rotulo: 'Agenda', icone: CalendarDays },
        { para: '/app/confirmacoes', rotulo: 'Confirmações', icone: CalendarCheck },
        { para: '/app/tarefas', rotulo: 'Tarefas', icone: ListTodo },
        { para: '/app/follow-up', rotulo: 'Follow-up', icone: Repeat },
        { para: '/app/mensagens', rotulo: 'Mensagens', icone: MessageSquareText },
      ],
    },
    ...(ehAdmin
      ? [
          {
            titulo: 'Administração',
            links: [
              { para: '/app/financeiro', rotulo: 'Financeiro', icone: Wallet },
              { para: '/app/equipe', rotulo: 'Equipe', icone: UserCog },
              { para: '/app/integracoes', rotulo: 'Integrações', icone: PlugZap },
            ],
          },
        ]
      : []),
  ]

  // Celular: as áreas mais usadas ficam na barra de baixo; o resto em "Mais".
  const principais: Link[] = [
    { para: '/app', rotulo: 'Painel', icone: LayoutDashboard, fim: true },
    { para: '/app/atendimento', rotulo: 'Atendimento', icone: Headset },
    { para: '/app/agenda', rotulo: 'Agenda', icone: CalendarDays },
    { para: '/app/tarefas', rotulo: 'Tarefas', icone: ListTodo },
  ]

  const estiloLink = (ativo: boolean, compacto: boolean) =>
    `group flex w-full items-center gap-3 rounded-lg text-left text-sm font-semibold transition ${compacto ? 'justify-center px-0 py-2.5' : 'px-3 py-2'} ${
      ativo ? 'bg-gold/15 text-gold' : 'text-white/75 hover:bg-white/5 hover:text-white'
    }`

  const menu = (compacto: boolean) => (
    <nav className="flex flex-col gap-1" aria-label="Menu do CRM">
      {grupos.map((g, i) => (
        <div key={i} className="flex flex-col gap-1">
          {g.titulo &&
            (compacto ? (
              <div className="mx-auto my-3 h-px w-6 bg-line" aria-hidden />
            ) : (
              <p className="mb-1 mt-4 px-3 text-left text-[11px] font-bold uppercase tracking-widest text-muted">{g.titulo}</p>
            ))}
          {g.links.map((l) => (
            <NavLink key={l.para} to={l.para} end={l.fim} onClick={() => setAberto(false)} title={compacto ? l.rotulo : undefined} className={({ isActive }) => estiloLink(isActive, compacto)}>
              <l.icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!compacto && <span className="truncate">{l.rotulo}</span>}
              {compacto && <span className="sr-only">{l.rotulo}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )

  const rodape = (compacto: boolean) =>
    compacto ? (
      <div className="flex flex-col items-center gap-2 border-t border-line pt-3">
        <button onClick={() => setTrocandoSenha(true)} className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-gold" title="Trocar senha" aria-label="Trocar senha">
          <KeyRound className="h-[18px] w-[18px]" />
        </button>
        <button onClick={sair} className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-gold" title="Sair" aria-label="Sair">
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    ) : (
      <div className="border-t border-line pt-4 text-xs">
        <p className="truncate font-semibold text-white">{perfil?.nome || perfil?.email}</p>
        <p className="truncate text-muted">{perfil ? rotuloPapel[perfil.role] ?? perfil.role : ''}</p>
        <div className="mt-3 flex gap-4">
          <button onClick={() => setTrocandoSenha(true)} className="inline-flex items-center gap-1.5 font-semibold text-gold hover:underline">
            <KeyRound className="h-3.5 w-3.5" /> Trocar senha
          </button>
          <button onClick={sair} className="inline-flex items-center gap-1.5 font-semibold text-gold hover:underline">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
    )

  // Tablet (md): barra sempre compacta, só ícones. Computador (lg): larga, recolhível.
  const lateral = (compacto: boolean, classes: string) => (
    <aside className={`${classes} shrink-0 flex-col border-r border-line bg-coal p-3 md:sticky md:top-0 md:h-screen ${compacto ? 'w-[68px]' : 'w-60'}`}>
      <div className={`mb-4 flex shrink-0 items-center gap-2 ${compacto ? 'flex-col' : ''}`}>
        <a href="/" className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-gold" aria-label="Voltar ao site" title="Voltar ao site">
          <ArrowLeft className="h-4 w-4" />
        </a>
        {!compacto && (
          <>
            <Logo />
            <span className="text-xs font-bold tracking-widest text-gold">APP</span>
          </>
        )}
      </div>
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-color:rgba(200,164,93,0.45)_transparent] [scrollbar-width:thin]">{menu(compacto)}</div>
      <div className="mt-3 shrink-0">{rodape(compacto)}</div>
    </aside>
  )

  return (
    <div className="min-h-screen md:flex">
      {/* Tablet: compacta. Computador: conforme a escolha de recolher. */}
      {lateral(true, 'hidden md:flex lg:hidden')}
      <div className="relative hidden lg:flex">
        {lateral(recolhido, 'flex')}
        <button
          onClick={() => setRecolhido(!recolhido)}
          className="absolute -right-3 top-6 z-10 rounded-full border border-line bg-coal p-1 text-muted shadow hover:text-gold"
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          title={recolhido ? 'Expandir menu' : 'Recolher menu'}
        >
          {recolhido ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Celular: cabeçalho em cima e barra de navegação embaixo. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-coal px-4 md:hidden">
        <div className="flex items-center gap-2">
          <a href="/" className="text-muted" aria-label="Voltar ao site">
            <ArrowLeft className="h-4 w-4" />
          </a>
          <Logo />
        </div>
      </header>

      <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 md:pb-8 lg:p-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-coal pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navegação principal">
        {principais.map((l) => (
          <NavLink
            key={l.para}
            to={l.para}
            end={l.fim}
            onClick={() => setAberto(false)}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? 'text-gold' : 'text-white/70'}`}
          >
            <l.icone className="h-5 w-5" aria-hidden />
            {l.rotulo}
          </NavLink>
        ))}
        <button onClick={() => setAberto(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-white/70" aria-label="Mais opções">
          <Menu className="h-5 w-5" aria-hidden />
          Mais
        </button>
      </nav>

      {aberto && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAberto(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-line bg-coal p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Menu</p>
              <button onClick={() => setAberto(false)} className="rounded-lg p-1.5 text-muted hover:text-white" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {menu(false)}
            {rodape(false)}
          </div>
        </div>
      )}
      {trocandoSenha && <TrocarSenha aoFechar={() => setTrocandoSenha(false)} />}
    </div>
  )
}
