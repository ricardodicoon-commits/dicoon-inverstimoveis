import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Atualiza as telas sozinho quando a tabela muda no banco.
// O Supabase só envia as mudanças que o usuário tem permissão de ver.
export function useAoVivo(tabela: string, chave: QueryKey) {
  const qc = useQueryClient()
  const chaveTexto = JSON.stringify(chave)
  useEffect(() => {
    const canal = supabase
      .channel(`aovivo-${tabela}-${chaveTexto}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tabela }, () => {
        qc.invalidateQueries({ queryKey: JSON.parse(chaveTexto) as QueryKey })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [tabela, chaveTexto, qc])
}

// Tira caracteres que quebram o filtro "or" do Supabase.
export function limparBusca(texto: string) {
  return texto.replace(/[,()%*]/g, ' ').trim()
}

export function erroAmigavel(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  if (/row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para esta ação.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão com o servidor. Tente de novo.'
  return msg
}

export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
