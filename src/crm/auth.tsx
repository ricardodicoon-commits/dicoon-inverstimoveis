import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAoVivo } from './dados'
import type { Perfil } from './tipos'

interface Auth {
  sessao: Session | null | undefined
  perfil: Perfil | null | undefined
  ehAdmin: boolean
  sair: () => Promise<void>
}

const Contexto = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const idUsuario = sessao?.user.id
  const consulta = useQuery({
    queryKey: ['perfil', idUsuario],
    enabled: Boolean(idUsuario),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', idUsuario!).maybeSingle()
      if (error) throw error
      return data as Perfil | null
    },
  })
  // Quando o admin aprova, a tela de espera libera sozinha.
  useAoVivo('profiles', ['perfil'])

  const perfil = !sessao ? null : consulta.isPending ? undefined : (consulta.data ?? null)

  const valor: Auth = {
    sessao,
    perfil,
    ehAdmin: Boolean(perfil?.role === 'admin' && perfil.ativo),
    sair: async () => {
      await supabase.auth.signOut()
    },
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAuth() {
  const c = useContext(Contexto)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}
