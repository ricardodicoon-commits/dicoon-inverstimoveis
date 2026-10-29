import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from './auth'
import { rotuloPapel } from './tipos'
import { TrocarSenha } from './TrocarSenha'

export function Layout() {
  const { perfil, ehAdmin, sair } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  const grupos: { titulo?: string; links: { para: string; rotulo: string; fim?: boolean }[] }[] = [
    {
      links: [
        { para: '/app', rotulo: 'Painel', fim: true },
        { para: '/app/atendimento', rotulo: 'Atendimento' },
        { para: '/app/clientes', rotulo: 'Clientes' },
        { para: '/app/negociacoes', rotulo: 'Negociações' },
      ],
    },
    {
      titulo: 'Secretária',
      links: [
        { para: '/app/secretaria', rotulo: 'Resumo do dia' },
        { para: '/app/agenda', rotulo: 'Agenda' },
        { para: '/app/confirmacoes', rotulo: 'Confirmações' },
        { para: '/app/tarefas', rotulo: 'Tarefas' },
        { para: '/app/follow-up', rotulo: 'Follow-up' },
        { para: '/app/mensagens', rotulo: 'Mensagens' },
      ],
    },
    ...(ehAdmin
      ? [
          {
            titulo: 'Administração',
            links: [
              { para: '/app/equipe', rotulo: 'Equipe' },
              { para: '/app/integracoes', rotulo: 'Integrações' },
            ],
          },
        ]
      : []),
  ]

  const menu = (
    <nav className="flex flex-col gap-1">
      {grupos.map((g, i) => (
        <div key={i} className="flex flex-col gap-1">
          {g.titulo && <p className="mt-4 mb-1 px-3 text-left text-[11px] font-bold uppercase tracking-widest text-muted">{g.titulo}</p>}
          {g.links.map((l) => (
            <NavLink
              key={l.para}
              to={l.para}
              end={l.fim}
              onClick={() => setAberto(false)}
              className={({ isActive }) =>
                `block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${isActive ? 'bg-gold/15 text-gold' : 'text-white/80 hover:bg-white/5 hover:text-white'}`
              }
            >
              {l.rotulo}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )

  const rodape = (
    <div className="border-t border-line pt-4 text-xs">
      <p className="truncate font-semibold text-white">{perfil?.nome || perfil?.email}</p>
      <p className="truncate text-muted">{perfil ? rotuloPapel[perfil.role] ?? perfil.role : ''}</p>
      <div className="mt-3 flex gap-4">
        <button onClick={() => setTrocandoSenha(true)} className="font-semibold text-gold hover:underline">
          Trocar senha
        </button>
        <button onClick={sair} className="font-semibold text-gold hover:underline">
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:flex">
      {/* Logo fixo em cima, "Trocar senha / Sair" fixo embaixo; só o menu rola quando não cabe. */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-coal p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="mb-4 flex shrink-0 items-center gap-2">
          <a href="/" className="text-lg text-muted hover:text-gold" aria-label="Voltar ao site">
            ←
          </a>
          <Logo />
          <span className="text-xs font-bold tracking-widest text-gold">APP</span>
        </div>
        <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-color:rgba(200,164,93,0.45)_transparent] [scrollbar-width:thin]">
          {menu}
        </div>
        <div className="mt-4 shrink-0">{rodape}</div>
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-coal px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <a href="/" className="text-lg text-muted" aria-label="Voltar ao site">
            ←
          </a>
          <Logo />
        </div>
        <button className="rounded border border-line p-2 text-gold" onClick={() => setAberto(!aberto)} aria-label="Abrir menu">
          ☰
        </button>
      </header>
      {aberto && (
        <div className="sticky top-16 z-20 max-h-[calc(100dvh-4rem)] space-y-4 overflow-y-auto border-b border-line bg-coal p-4 [scrollbar-width:thin] lg:hidden">
          {menu}
          {rodape}
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <Outlet />
      </main>
      {trocandoSenha && <TrocarSenha aoFechar={() => setTrocandoSenha(false)} />}
    </div>
  )
}
