import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Logo } from '../../components/Logo'
import { empresa } from '../../config'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, moeda, useAoVivo } from '../dados'
import { etapas, rotuloEtapa, type Cliente, type Negociacao } from '../tipos'
import { TrocarSenha } from '../TrocarSenha'
import { Aviso, Carregando, Vazio } from '../ui'

interface Responsavel {
  nome: string | null
  telefone: string | null
  email: string | null
}


function linkWhats(telefone: string | null, nome: string) {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  const numero = digitos.length >= 10 ? (digitos.startsWith('55') ? digitos : `55${digitos}`) : empresa.whatsapp
  return `https://wa.me/${numero}?text=${encodeURIComponent(`Olá, sou ${nome} e quero falar sobre meu atendimento na Dicoon Invest.`)}`
}

// Portal do cliente: só consulta. As regras do banco garantem que ele vê apenas o que é dele.
export function PortalCliente() {
  const { perfil, sair } = useAuth()
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  const dados = useQuery({
    queryKey: ['portal'],
    queryFn: async () => {
      const [cliente, negociacoes, responsavel] = await Promise.all([
        supabase.from('clientes').select('*').limit(1).maybeSingle(),
        supabase.from('negociacoes').select('*').order('updated_at', { ascending: false }),
        supabase.rpc('fn_meu_responsavel'),
      ])
      if (cliente.error) throw cliente.error
      if (negociacoes.error) throw negociacoes.error
      return {
        cliente: cliente.data as Cliente | null,
        negociacoes: (negociacoes.data ?? []) as Negociacao[],
        responsavel: ((responsavel.data ?? []) as Responsavel[])[0] ?? null,
      }
    },
  })
  useAoVivo('negociacoes', ['portal'])

  const c = dados.data?.cliente
  const nome = c?.nome_completo || perfil?.nome || 'cliente'
  const r = dados.data?.responsavel
  const negociacoes = dados.data?.negociacoes ?? []

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-coal px-4 sm:px-8">
        <a href="/" aria-label="Voltar ao site">
          <Logo />
        </a>
        <div className="flex gap-4 text-xs font-semibold">
          <button onClick={() => setTrocandoSenha(true)} className="text-gold hover:underline">
            Trocar senha
          </button>
          <button onClick={sair} className="text-gold hover:underline">
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
        <h1 className="text-2xl font-bold normal-case tracking-normal text-white">Olá, {nome.split(' ')[0]}</h1>
        {dados.error && <Aviso>{erroAmigavel(dados.error)}</Aviso>}

        {dados.isPending ? (
          <Carregando />
        ) : !c ? (
          <Vazio>Seu cadastro ainda não está disponível. Fale com a Dicoon Invest.</Vazio>
        ) : (
          <>
            <section className="rounded-2xl border border-line bg-coal p-6">
              <h2 className="mb-4 text-sm font-bold text-gold">Andamento</h2>
              {!negociacoes.length ? (
                <p className="text-sm text-muted">Ainda não há atendimento em andamento. Assim que começar, você acompanha aqui.</p>
              ) : (
                <div className="space-y-6">
                  {negociacoes.map((n) => {
                    const atual = etapas.findIndex((e) => e.valor === n.etapa)
                    return (
                      <article key={n.id}>
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-semibold text-white">{rotuloEtapa(n.etapa)}</p>
                          {n.valor_estimado != null && <p className="text-sm text-gold">{moeda.format(n.valor_estimado)}</p>}
                        </div>
                        <ol className="grid grid-cols-5 gap-1" aria-label="Etapas">
                          {etapas.map((etapa, i) => (
                            <li key={etapa.valor} title={etapa.rotulo}>
                              <div className={`h-1.5 rounded-full ${i <= atual ? 'bg-gold' : 'bg-white/10'}`} />
                              <p className={`mt-1 hidden text-[10px] sm:block ${i === atual ? 'text-white' : 'text-muted'}`}>{etapa.rotulo}</p>
                            </li>
                          ))}
                        </ol>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-coal p-6">
              <h2 className="mb-4 text-sm font-bold text-gold">Seu atendimento</h2>
              <p className="text-white">{r?.nome || 'Equipe Dicoon Invest'}</p>
              {r?.email && <p className="text-sm text-muted">{r.email}</p>}
              <a
                href={linkWhats(r?.telefone ?? null, nome)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink hover:bg-gold-deep"
              >
                Falar no WhatsApp
              </a>
            </section>

            <section className="rounded-2xl border border-line bg-coal p-6">
              <h2 className="mb-4 text-sm font-bold text-gold">Seus dados</h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Nome', c.nome_completo],
                  ['Telefone', c.telefone],
                  ['E-mail', c.email],
                  ['Endereço', [c.endereco, c.bairro].filter(Boolean).join(', ')],
                  ['Cidade', [c.cidade, c.estado].filter(Boolean).join('/')],
                  ['CEP', c.cep],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="text-xs uppercase tracking-wider text-muted">{rotulo}</dt>
                    <dd className="text-white">{valor || '—'}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted">Algum dado errado? Fale com seu atendimento para corrigir.</p>
            </section>
          </>
        )}
      </main>
      {trocandoSenha && <TrocarSenha aoFechar={() => setTrocandoSenha(false)} />}
    </div>
  )
}
