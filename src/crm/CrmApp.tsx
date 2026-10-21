import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabaseConfigurado } from '../lib/supabase'
import { AuthProvider, useAuth } from './auth'
import { Layout } from './Layout'
import { Aguardando } from './paginas/Aguardando'
import { Clientes } from './paginas/Clientes'
import { Entrada } from './paginas/Entrada'
import { Equipe } from './paginas/Equipe'
import { Negociacoes } from './paginas/Negociacoes'
import { Painel } from './paginas/Painel'
import { Carregando } from './ui'

const clienteDados = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
})

function Portao() {
  const { sessao, perfil, ehAdmin } = useAuth()
  if (sessao === undefined || (sessao && perfil === undefined)) return <Carregando />
  if (!sessao) return <Entrada />
  if (!perfil || !perfil.aprovado) return <Aguardando desativado={perfil ? !perfil.ativo : false} />
  if (!perfil.ativo) return <Aguardando desativado />

  return (
    <Routes>
      <Route path="/app" element={<Layout />}>
        <Route index element={<Painel />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="negociacoes" element={<Negociacoes />} />
        {ehAdmin && <Route path="equipe" element={<Equipe />} />}
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  )
}

export default function CrmApp() {
  if (!supabaseConfigurado) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-bold normal-case tracking-normal text-white">Área do Cliente</h1>
          <p className="mt-2 text-muted">Configuração do sistema pendente.</p>
        </div>
      </main>
    )
  }
  return (
    <QueryClientProvider client={clienteDados}>
      <AuthProvider>
        <BrowserRouter>
          <Portao />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
