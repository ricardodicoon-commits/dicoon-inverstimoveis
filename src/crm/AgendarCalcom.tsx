import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Aviso, Botao, Campo, Carregando, Modal, estiloCampo } from './ui'

// Secretária no WhatsApp (modo assistido): busca horários livres no Cal.com, monta a mensagem com
// 3 opções, e agenda no Cal.com o horário que o cliente escolheu. O agendamento volta pelo webhook
// e entra sozinho na Agenda, com o lembrete de 1 h. E-mail do cliente é obrigatório (pedir na conversa).

const FUSO = 'America/Sao_Paulo'
const rotulo = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const linkWhats = (tel: string, texto: string) => `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${encodeURIComponent(texto)}`

interface Contato {
  tipo: 'lead' | 'cliente'
  id: string
  nome: string
  telefone: string | null
  email: string | null
}

// Chama a função do servidor e traz a mensagem de erro dela (em português) quando houver.
async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('calcom-agenda', { body: corpo })
  if (error) {
    const detalhe = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detalhe?.erro ?? 'Não foi possível falar com o Cal.com. Tente de novo.')
  }
  return data as T
}

export function AgendarCalcom({ contato, aoFechar }: { contato: Contato; aoFechar: () => void }) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<number | null>(null)
  const [escolhido, setEscolhido] = useState('')
  const [email, setEmail] = useState(contato.email ?? '')
  const [copiado, setCopiado] = useState(false)

  const tipos = useQuery({
    queryKey: ['calcom', 'tipos'],
    queryFn: () => chamar<{ tipos: { id: number; titulo: string; minutos: number }[] }>({ acao: 'tipos' }),
    staleTime: 5 * 60_000,
  })
  const tipoAtual = tipo ?? tipos.data?.tipos[0]?.id ?? null

  const horarios = useMutation({
    mutationFn: () => chamar<{ sugestoes: string[]; livres: string[]; mensagem: string }>({ acao: 'horarios', eventTypeId: tipoAtual, nome: contato.nome }),
    onSuccess: (r) => {
      setEscolhido('')
      setCopiado(false)
      if (!r.sugestoes.length) setEscolhido('')
    },
  })

  const agendar = useMutation({
    mutationFn: () =>
      chamar<{ ok: boolean }>({
        acao: 'agendar',
        eventTypeId: tipoAtual,
        inicio: escolhido,
        email,
        lead_id: contato.tipo === 'lead' ? contato.id : null,
        cliente_id: contato.tipo === 'cliente' ? contato.id : null,
      }),
    onSuccess: () => {
      // O compromisso chega pelo webhook em alguns segundos.
      setTimeout(() => qc.invalidateQueries({ queryKey: ['compromissos'] }), 4000)
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  const r = horarios.data
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

  return (
    <Modal titulo={`Agendar pelo Cal.com · ${contato.nome}`} aoFechar={aoFechar}>
      {agendar.isSuccess ? (
        <div className="space-y-4">
          <Aviso tipo="ok">
            Agendado no Cal.com para {rotulo(escolhido)}. Em instantes aparece na Agenda, com o lembrete de 1 hora em Confirmações. O Cal.com envia a confirmação para {email}.
          </Aviso>
          <div className="flex justify-end">
            <Botao onClick={aoFechar}>Fechar</Botao>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {(tipos.error || horarios.error || agendar.error) && <Aviso>{((tipos.error || horarios.error || agendar.error) as Error).message}</Aviso>}

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">1. Sugerir horários</p>
            {tipos.isPending ? (
              <Carregando />
            ) : (
              <div className="flex flex-wrap gap-2">
                <select className={`${estiloCampo} w-auto`} value={tipoAtual ?? ''} onChange={(e) => setTipo(Number(e.target.value))} aria-label="Tipo de reunião">
                  {tipos.data?.tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.titulo}
                    </option>
                  ))}
                </select>
                <Botao variante="secundario" onClick={() => horarios.mutate()} disabled={!tipoAtual || horarios.isPending}>
                  {horarios.isPending ? 'Buscando…' : 'Buscar horários livres'}
                </Botao>
              </div>
            )}
            {r && !r.sugestoes.length && <p className="text-sm text-muted">Nenhum horário livre nos próximos 10 dias.</p>}
            {r && !!r.sugestoes.length && (
              <>
                <p className="whitespace-pre-line rounded-lg bg-ink p-3 text-sm text-white/90">{r.mensagem}</p>
                <div className="flex flex-wrap gap-2">
                  <Botao
                    variante="secundario"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(r.mensagem)
                        setCopiado(true)
                      } catch {
                        setCopiado(false)
                      }
                    }}
                  >
                    {copiado ? 'Copiado' : 'Copiar'}
                  </Botao>
                  {contato.telefone && (
                    <a href={linkWhats(contato.telefone, r.mensagem)} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-white hover:border-gold hover:text-gold">
                      Abrir no WhatsApp
                    </a>
                  )}
                </div>
              </>
            )}
          </section>

          {r && !!r.sugestoes.length && (
            <section className="space-y-3 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">2. Quando o cliente responder</p>
              <Campo rotulo="Horário escolhido *">
                <select className={estiloCampo} value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
                  <option value="">Selecione</option>
                  <optgroup label="Sugeridos">
                    {r.sugestoes.map((s, i) => (
                      <option key={s} value={s}>
                        {i + 1} - {rotulo(s)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Outros horários livres">
                    {r.livres
                      .filter((s) => !r.sugestoes.includes(s))
                      .map((s) => (
                        <option key={s} value={s}>
                          {rotulo(s)}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </Campo>
              <Campo rotulo="E-mail do cliente * (pedir na conversa)">
                <input className={estiloCampo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@exemplo.com" />
              </Campo>
              {email && !emailOk && <p className="text-xs text-amber-300">E-mail inválido.</p>}
              <p className="text-xs text-muted">O telefone usado é o do cadastro deste contato. O Cal.com envia a confirmação e o link da reunião ao cliente.</p>
              <div className="flex justify-end gap-3">
                <Botao variante="secundario" onClick={aoFechar}>
                  Cancelar
                </Botao>
                <Botao onClick={() => agendar.mutate()} disabled={!escolhido || !emailOk || agendar.isPending}>
                  {agendar.isPending ? 'Agendando…' : 'Agendar no Cal.com'}
                </Botao>
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
