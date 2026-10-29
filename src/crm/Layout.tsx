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
        { para: '/app/agenda', rotulo: 'Agenda' },
        { para: '/app/confirmacoes', rotulo: 'Confirmações' },
        { para: '/app/tarefas', rotulo: 'Tarefas' },
        { para: '/app/follow-up', rotulo: 'Follow-up' },
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
          {g.titulo && <p className="mt-4 px-4 text-[11px] font-bold uppercase tracking-widest text-muted">{g.titulo}</p>}
          {g.links.map((l) => (
            <NavLink
              key={l.para}
              to={l.para}
              end={l.fim}
              onClick={() => setAberto(false)}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2.5 text-sm font-semibold ${isActive ? 'bg-gold/15 text-gold' : 'text-white/80 hover:bg-white/5 hover:text-white'}`
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
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-line bg-coal p-4 lg:flex lg:sticky lg:top-0 lg:h-screen">
        <div>
          <div className="mb-6 flex items-center gap-2">
            <a href="/" className="text-lg text-muted hover:text-gold" aria-label="Voltar ao site">
              ←
            </a>
            <Logo />
            <span className="text-xs font-bold tracking-widest text-gold">APP</span>
          </div>
          {menu}
        </div>
        {rodape}
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
        <div className="space-y-4 border-b border-line bg-coal p-4 lg:hidden">
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
