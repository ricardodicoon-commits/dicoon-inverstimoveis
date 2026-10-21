import { createClient } from '@supabase/supabase-js'

// Chave pública (anon). A proteção dos dados vem das regras RLS do banco
// (supabase/01-seguranca.sql). Nunca colocar a service_role key aqui.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && chave)

export const supabase = createClient(url ?? 'http://localhost', chave ?? 'chave-ausente', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
