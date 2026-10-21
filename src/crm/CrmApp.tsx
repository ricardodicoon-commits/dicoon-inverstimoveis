import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { linkWhatsApp } from '../config'
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

// Enquanto o Supabase não estiver configurado na Vercel.
function EmManutencao() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <Logo grande />
      <div className="max-w-md">
        <h1 className="text-xl font-bold text-white">Área do Cliente</h1>
        <p className="mt-3 text-muted">Estamos atualizando nosso sistema. Enquanto isso, fale com a gente pelo WhatsApp.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={linkWhatsApp()}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink hover:bg-gold-deep"
        >
          Falar no WhatsApp
        </a>
        <a
          href="/"
          className="rounded-full border border-gold/50 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gold hover:bg-gold/10"
        >
          Voltar ao site
        </a>
      </div>
    </main>
  )
}

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
  if (!supabaseConfigurado) return <EmManutencao />
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
