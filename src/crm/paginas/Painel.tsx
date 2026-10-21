import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { useAoVivo } from '../dados'
import { Cabecalho } from '../ui'

async function contar(tabela: string, filtro?: (q: any) => any) {
  let q = supabase.from(tabela).select('id', { count: 'exact', head: true })
  if (filtro) q = filtro(q)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

export function Painel() {
  const { perfil, ehAdmin } = useAuth()
  const { data } = useQuery({
    queryKey: ['painel', ehAdmin],
    queryFn: async () => ({
      clientes: await contar('clientes'),
      negociacoes: await contar('negociacoes'),
      abertas: await contar('negociacoes', (q) => q.not('etapa', 'in', '("Contratado","Perdido")')),
      pendentes: ehAdmin ? await contar('profiles', (q) => q.eq('aprovado', false)) : 0,
    }),
  })
  useAoVivo('clientes', ['painel'])
  useAoVivo('negociacoes', ['painel'])

  const cartoes = [
    { rotulo: 'Clientes', valor: data?.clientes, link: '/app/clientes' },
    { rotulo: 'Negociações em aberto', valor: data?.abertas, link: '/app/negociacoes' },
    { rotulo: 'Negociações no total', valor: data?.negociacoes, link: '/app/negociacoes' },
    ...(ehAdmin ? [{ rotulo: 'Acessos aguardando aprovação', valor: data?.pendentes, link: '/app/equipe' }] : []),
  ]

  return (
    <>
      <Cabecalho titulo={`Olá, ${perfil?.nome?.split(' ')[0] || 'bem-vindo'}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c) => (
          <Link key={c.rotulo} to={c.link} className="rounded-2xl border border-line bg-coal p-6 hover:border-gold/60">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{c.rotulo}</p>
            <p className="mt-3 text-4xl font-bold text-white">{c.valor ?? '–'}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
