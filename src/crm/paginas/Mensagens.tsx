import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth'
import { erroAmigavel, useAoVivo } from '../dados'
import { FileText, MessageSquareText } from 'lucide-react'
import { Abas, Aviso, Botao, Cabecalho, Campo, Carregando, Etiqueta, Modal, Vazio, estiloCampo, type Tom } from '../ui'

// Rascunhos de mensagem: a Secretária prepara, uma pessoa revisa, aprova e envia pelo próprio
// WhatsApp. O sistema não envia nada e só registra "enviada" quando alguém informa.

const FUSO = 'America/Sao_Paulo'
const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
const linkWhats = (tel: string, texto: string) => `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${encodeURIComponent(texto)}`
const digitos = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '')

// Os 10 tipos de uso geral (os modelos de lembrete e follow-up ficam em Confirmações).
const TIPOS = [
  'confirmacao_de_reuniao', 'lembrete_de_compromisso', 'solicitacao_de_confirmacao', 'reagendamento', 'agradecimento_por_reuniao',
  'acompanhamento_de_simulacao', 'retorno_comercial', 'solicitacao_de_documentos', 'contato_com_parceiros', 'pos_visita_imobiliaria',
]
const statusRascunho: Record<string, string> = {
  rascunho: 'Rascunho',
  aprovado: 'Aprovado',
  enviado_manual: 'Enviado (registrado)',
  descartado: 'Descartado',
}
const tomRascunho: Record<string, Tom> = { rascunho: 'ambar', aprovado: 'azul', enviado_manual: 'verde', descartado: 'cinza' }

interface Modelo {
  id: string
  tipo: string
  titulo: string
  texto: string
  ativo: boolean
}
interface Rascunho {
  id: string
  tipo: string
  destinatario_nome: string | null
  destinatario_telefone: string | null
  conteudo: string
  status: string
  enviado_em: string | null
  autor_id: string
  created_at: string
  updated_at: string
}
interface Contato {
  valor: string
  nome: string
  telefone: string | null
}

function useModelos() {
  return useQuery({
    queryKey: ['modelos', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modelos_mensagens').select('*').order('titulo')
      if (error) throw error
      return data as Modelo[]
    },
  })
}

export function Mensagens() {
  const { perfil, ehAdmin } = useAuth()
  const [aba, setAba] = useState<'rascunhos' | 'modelos'>('rascunhos')
  const [filtro, setFiltro] = useState('ativos')
  const [novo, setNovo] = useState(false)
  const [abrindo, setAbrindo] = useState<Rascunho | null>(null)
  const modelos = useModelos()
  const titulos = Object.fromEntries((modelos.data ?? []).map((m) => [m.tipo, m.titulo]))

  const rascunhos = useQuery({
    queryKey: ['rascunhos', filtro],
    queryFn: async () => {
      let q = supabase.from('rascunhos_mensagens').select('*').order('updated_at', { ascending: false }).limit(200)
      if (filtro === 'ativos') q = q.in('status', ['rascunho', 'aprovado'])
      else if (filtro !== 'todos') q = q.eq('status', filtro)
      const { data, error } = await q
      if (error) throw error
      return data as Rascunho[]
    },
  })
  useAoVivo('rascunhos_mensagens', ['rascunhos'])

  return (
    <>
      <Cabecalho titulo="Mensagens">{aba === 'rascunhos' && <Botao onClick={() => setNovo(true)}>+ Nova mensagem</Botao>}</Cabecalho>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Prepare, revise e aprove. O envio é feito por você, no seu WhatsApp; o sistema só registra quando você informa que enviou.
      </p>

      {ehAdmin && (
        <Abas
          abas={[
            { valor: 'rascunhos', rotulo: 'Rascunhos', icone: MessageSquareText },
            { valor: 'modelos', rotulo: 'Modelos', icone: FileText },
          ]}
          ativa={aba}
          aoMudar={setAba}
        />
      )}

      {aba === 'modelos' && ehAdmin ? (
        <EditorModelos modelos={modelos.data ?? []} carregando={modelos.isPending} />
      ) : (
        <>
          <select className={`${estiloCampo} mb-4 w-auto`} value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Situação">
            <option value="ativos">Rascunhos e aprovadas</option>
            <option value="enviado_manual">Enviadas (registradas)</option>
            <option value="descartado">Descartadas</option>
            <option value="todos">Todas</option>
          </select>
          {rascunhos.error && (
            <div className="mb-4">
              <Aviso>{erroAmigavel(rascunhos.error)}</Aviso>
            </div>
          )}
          {rascunhos.isPending ? (
            <Carregando />
          ) : !rascunhos.data?.length ? (
            <Vazio>Nenhuma mensagem aqui.</Vazio>
          ) : (
            <ul className="space-y-2">
              {rascunhos.data.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setAbrindo(r)} className="w-full rounded-xl border border-line bg-coal p-4 text-left hover:bg-white/5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-white">{r.destinatario_nome || 'Sem destinatário'}</p>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Etiqueta tom={tomRascunho[r.status] ?? 'cinza'}>{statusRascunho[r.status] ?? r.status}</Etiqueta>
                        {quando(r.updated_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gold">{titulos[r.tipo] ?? r.tipo}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-white/80">{r.conteudo}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {novo && <NovaMensagem modelos={(modelos.data ?? []).filter((m) => m.ativo && TIPOS.includes(m.tipo))} aoFechar={() => setNovo(false)} />}
      {abrindo && (
        <Detalhe r={abrindo} titulo={titulos[abrindo.tipo] ?? abrindo.tipo} podeEditar={ehAdmin || abrindo.autor_id === perfil?.id} aoFechar={() => setAbrindo(null)} />
      )}
    </>
  )
}

function NovaMensagem({ modelos, aoFechar }: { modelos: Modelo[]; aoFechar: () => void }) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState(modelos[0]?.tipo ?? '')
  const [contato, setContato] = useState('')
  const [compromisso, setCompromisso] = useState('')
  const [nomeManual, setNomeManual] = useState('')
  const [telManual, setTelManual] = useState('')
  const [texto, setTexto] = useState('')

  // Contatos do CRM (o telefone vem do próprio cadastro) e compromissos futuros para datas.
  const dados = useQuery({
    queryKey: ['mensagens', 'opcoes'],
    queryFn: async () => {
      const [cl, ld, cp] = await Promise.all([
        supabase.from('clientes').select('id, nome_completo, telefone').order('nome_completo').limit(300),
        supabase.from('leads').select('id, nome, telefone').order('created_at', { ascending: false }).limit(300),
        supabase.from('compromissos').select('id, titulo, inicio, local, cliente_id, lead_id').gte('inicio', new Date(Date.now() - 7 * 86_400_000).toISOString()).order('inicio').limit(200),
      ])
      for (const r of [cl, ld, cp]) if (r.error) throw r.error
      const contatos: Contato[] = [
        ...(cl.data as { id: string; nome_completo: string; telefone: string | null }[]).map((x) => ({ valor: `cliente:${x.id}`, nome: x.nome_completo, telefone: digitos(x.telefone) || null })),
        ...(ld.data as { id: string; nome: string; telefone: string | null }[]).map((x) => ({ valor: `lead:${x.id}`, nome: x.nome, telefone: digitos(x.telefone) || null })),
      ]
      return { contatos, compromissos: cp.data as { id: string; titulo: string; inicio: string; local: string | null; cliente_id: string | null; lead_id: string | null }[] }
    },
  })

  const c = dados.data?.contatos.find((x) => x.valor === contato)
  const comp = dados.data?.compromissos.find((x) => x.id === compromisso)
  const nome = c?.nome ?? nomeManual
  const telefone = c?.telefone ?? (digitos(telManual) || null)

  function preparar() {
    const base = modelos.find((m) => m.tipo === tipo)?.texto ?? ''
    let t = base.replaceAll('{nome}', nome.trim().split(' ')[0] || '{nome}')
    if (comp) {
      t = t
        .replaceAll('{data}', new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short' }).format(new Date(comp.inicio)))
        .replaceAll('{hora}', new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(comp.inicio)))
        .replaceAll('{local}', comp.local || 'local a combinar')
    }
    setTexto(t)
  }

  const salvar = useMutation({
    mutationFn: async (status: 'rascunho' | 'aprovado') => {
      const { error } = await supabase.from('rascunhos_mensagens').insert({
        tipo,
        status,
        destinatario_nome: nome || null,
        destinatario_telefone: telefone,
        conteudo: texto.trim(),
        cliente_id: contato.startsWith('cliente:') ? contato.slice(8) : null,
        lead_id: contato.startsWith('lead:') ? contato.slice(5) : null,
        compromisso_id: compromisso || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rascunhos'] })
      aoFechar()
    },
  })

  const faltaPreencher = /\{[a-z_]+\}/.test(texto)
  function enviar(e: FormEvent) {
    e.preventDefault()
    salvar.mutate('rascunho')
  }

  return (
    <Modal titulo="Nova mensagem" aoFechar={aoFechar}>
      <form onSubmit={enviar} className="grid gap-4">
        {salvar.error && <Aviso>{/destinatário|clientes diferentes/.test((salvar.error as Error).message) ? (salvar.error as Error).message : erroAmigavel(salvar.error)}</Aviso>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Tipo">
            <select className={estiloCampo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {modelos.map((m) => (
                <option key={m.tipo} value={m.tipo}>
                  {m.titulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Para (cliente ou lead do CRM)">
            <select className={estiloCampo} value={contato} onChange={(e) => setContato(e.target.value)}>
              <option value="">Outro contato (ex.: parceiro)</option>
              {dados.data?.contatos.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.nome} ({x.valor.startsWith('cliente') ? 'cliente' : 'lead'})
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {!contato && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome do contato">
              <input className={estiloCampo} value={nomeManual} onChange={(e) => setNomeManual(e.target.value)} />
            </Campo>
            <Campo rotulo="WhatsApp do contato">
              <input className={estiloCampo} value={telManual} onChange={(e) => setTelManual(e.target.value)} inputMode="tel" placeholder="(51) 99999-9999" />
            </Campo>
          </div>
        )}
        <Campo rotulo="Compromisso (preenche data, hora e local)">
          <select className={estiloCampo} value={compromisso} onChange={(e) => setCompromisso(e.target.value)}>
            <option value="">Nenhum</option>
            {dados.data?.compromissos
              .filter((x) => !contato || x.cliente_id === contato.slice(8) || x.lead_id === contato.slice(5) || (!x.cliente_id && !x.lead_id))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.titulo} · {quando(x.inicio)}
                </option>
              ))}
          </select>
        </Campo>
        <div>
          <Botao type="button" variante="secundario" onClick={preparar} disabled={!tipo}>
            Preparar texto
          </Botao>
        </div>
        <Campo rotulo="Mensagem">
          <textarea className={`${estiloCampo} min-h-32`} value={texto} onChange={(e) => setTexto(e.target.value)} required />
        </Campo>
        {faltaPreencher && <p className="text-xs text-amber-300">Ainda há campos entre chaves para completar, como {'{assunto}'} ou {'{documentos}'}.</p>}
        <p className="text-xs text-muted">Use só dados deste contato. Nunca peça nem envie senhas ou dados bancários.</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="secundario" disabled={salvar.isPending || !texto.trim()}>
            Salvar rascunho
          </Botao>
          <Botao type="button" disabled={salvar.isPending || !texto.trim() || faltaPreencher} onClick={() => salvar.mutate('aprovado')}>
            Aprovar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

function Detalhe({ r, titulo, podeEditar, aoFechar }: { r: Rascunho; titulo: string; podeEditar: boolean; aoFechar: () => void }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState(r.conteudo)
  const [copiado, setCopiado] = useState(false)
  const editavel = podeEditar && (r.status === 'rascunho' || r.status === 'aprovado')

  const atualizar = useMutation({
    mutationFn: async (campos: Partial<Rascunho>) => {
      const { error } = await supabase.from('rascunhos_mensagens').update(campos).eq('id', r.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rascunhos'] })
      aoFechar()
    },
  })

  const mudou = texto !== r.conteudo
  const faltaPreencher = /\{[a-z_]+\}/.test(texto)
  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      {atualizar.error && (
        <div className="mb-4">
          <Aviso>{erroAmigavel(atualizar.error)}</Aviso>
        </div>
      )}
      <p className="mb-3 text-sm text-muted">
        Para <span className="font-semibold text-white">{r.destinatario_nome || '—'}</span>
        {r.destinatario_telefone ? ` · ${r.destinatario_telefone}` : ''} · {statusRascunho[r.status] ?? r.status}
        {r.enviado_em ? ` em ${quando(r.enviado_em)}` : ''}
      </p>
      <textarea className={`${estiloCampo} min-h-36`} value={texto} onChange={(e) => setTexto(e.target.value)} readOnly={!editavel} />
      {faltaPreencher && editavel && <p className="mt-1 text-xs text-amber-300">Complete os campos entre chaves antes de aprovar.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {editavel && mudou && (
          <Botao variante="secundario" onClick={() => atualizar.mutate({ conteudo: texto, status: 'rascunho' })} disabled={!texto.trim()}>
            Salvar alterações
          </Botao>
        )}
        {editavel && r.status === 'rascunho' && !mudou && (
          <Botao onClick={() => atualizar.mutate({ status: 'aprovado' })} disabled={faltaPreencher}>
            Aprovar
          </Botao>
        )}
        {r.status === 'aprovado' && !mudou && (
          <>
            <Botao
              variante="secundario"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(r.conteudo)
                  setCopiado(true)
                } catch {
                  setCopiado(false)
                }
              }}
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </Botao>
            {r.destinatario_telefone && (
              <a href={linkWhats(r.destinatario_telefone, r.conteudo)} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-white hover:border-gold hover:text-gold">
                Abrir no WhatsApp
              </a>
            )}
            {podeEditar && (
              <Botao onClick={() => atualizar.mutate({ status: 'enviado_manual', enviado_em: new Date().toISOString() })}>Já enviei</Botao>
            )}
          </>
        )}
        {editavel && (
          <Botao variante="perigo" onClick={() => confirm('Descartar esta mensagem? Ela fica no histórico como descartada.') && atualizar.mutate({ status: 'descartado' })}>
            Descartar
          </Botao>
        )}
      </div>
      {!podeEditar && <p className="mt-4 text-xs text-muted">Só quem escreveu ou o administrador altera esta mensagem.</p>}
    </Modal>
  )
}

// Admin: textos-base. Placeholders: {nome}, {data}, {hora}, {local}, {assunto}, {documentos}, {tipo}.
function EditorModelos({ modelos, carregando }: { modelos: Modelo[]; carregando: boolean }) {
  if (carregando) return <Carregando />
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Campos automáticos: {'{nome}'}, {'{data}'}, {'{hora}'}, {'{local}'}, {'{tipo}'}. Para completar à mão: {'{assunto}'}, {'{documentos}'}. Não prometa aprovação,
        taxas ou contemplação; consórcio é "sem juros, com taxa de administração".
      </p>
      {modelos.map((m) => (
        <ModeloItem key={m.id} m={m} />
      ))}
    </div>
  )
}

function ModeloItem({ m }: { m: Modelo }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState(m.texto)
  const [ativo, setAtivo] = useState(m.ativo)
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('modelos_mensagens').update({ texto, ativo, updated_at: new Date().toISOString() }).eq('id', m.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modelos'] }),
  })
  const mudou = texto !== m.texto || ativo !== m.ativo
  return (
    <article className="rounded-xl border border-line bg-coal p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold text-white">{m.titulo}</p>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      </div>
      {salvar.error && <Aviso>{erroAmigavel(salvar.error)}</Aviso>}
      <textarea className={`${estiloCampo} min-h-24`} value={texto} onChange={(e) => setTexto(e.target.value)} />
      {mudou && (
        <div className="mt-2 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => { setTexto(m.texto); setAtivo(m.ativo) }}>
            Desfazer
          </Botao>
          <Botao onClick={() => salvar.mutate()} disabled={salvar.isPending || !texto.trim()}>
            Salvar
          </Botao>
        </div>
      )}
    </article>
  )
}
