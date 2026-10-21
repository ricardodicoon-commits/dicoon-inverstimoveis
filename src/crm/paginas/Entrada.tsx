import { useState, type FormEvent } from 'react'
import { Logo } from '../../components/Logo'
import { empresa } from '../../config'
import { supabase } from '../../lib/supabase'
import { erroAmigavel } from '../dados'
import { Aviso, Botao, Campo, estiloCampo } from '../ui'

type Modo = 'entrar' | 'criar' | 'recuperar'

const linkSolicitarAcesso = `mailto:${empresa.email}?subject=${encodeURIComponent(
  'Solicitação de acesso à Área do Cliente',
)}&body=${encodeURIComponent('Olá! Quero solicitar acesso à Área do Cliente da Dicoon Invest.\n\nNome:\nE-mail para acesso:\nTelefone:\n')}`

const textoLink: Record<Exclude<Modo, 'entrar'>, string> = {
  criar: 'Informe o e-mail cadastrado pela Dicoon e enviaremos um link para você criar sua senha.',
  recuperar: 'Informe seu e-mail e enviaremos um link para criar uma nova senha.',
}

// Cadastro fechado: só entra quem o admin criou no Supabase (Authentication > Users).
// "Primeiro acesso" e "Esqueci minha senha" usam o mesmo link por e-mail.
export function Entrada() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [indo, setIndo] = useState(false)
  const [linkEnviado, setLinkEnviado] = useState(false)

  async function enviarLink(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setIndo(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/app?nova-senha`,
    })
    setIndo(false)
    if (error) return setErro(erroAmigavel(error))
    // Mesma resposta exista ou não o e-mail, para não revelar quem tem acesso.
    setLinkEnviado(true)
  }

  function irPara(novo: Modo) {
    setModo(novo)
    setLinkEnviado(false)
    setErro('')
  }

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setIndo(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    if (error) {
      setErro(erroAmigavel(error))
      setIndo(false)
    }
  }

  const campoEmail = (
    <Campo rotulo="E-mail">
      <input
        type="email"
        required
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={estiloCampo}
      />
    </Campo>
  )

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-coal p-8">
        <div className="flex justify-center">
          <Logo grande />
        </div>
        <h1 className="mt-6 text-center text-xl font-bold normal-case tracking-normal text-white">
          {modo === 'criar' ? 'Primeiro acesso' : 'Área do Cliente'}
        </h1>
        <p className="mt-2 text-center text-sm text-muted">Acesso restrito a usuários autorizados pela Dicoon Invest.</p>

        {modo === 'entrar' ? (
          <form onSubmit={entrar} className="mt-8 space-y-4">
            {campoEmail}
            <Campo rotulo="Senha">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={estiloCampo}
              />
            </Campo>
            <Botao type="submit" disabled={indo} className="w-full">
              {indo ? 'Entrando…' : 'Entrar'}
            </Botao>
          </form>
        ) : linkEnviado ? (
          <div className="mt-8">
            <Aviso tipo="ok">
              Se este e-mail tiver acesso, você vai receber um link para criar sua senha. Confira também a caixa de spam.
            </Aviso>
          </div>
        ) : (
          <form onSubmit={enviarLink} className="mt-8 space-y-4">
            <p className="text-sm text-muted">{textoLink[modo]}</p>
            {campoEmail}
            <Botao type="submit" disabled={indo} className="w-full">
              {indo ? 'Enviando…' : 'Enviar link'}
            </Botao>
          </form>
        )}

        {erro && (
          <div className="mt-4">
            <Aviso>{erro}</Aviso>
          </div>
        )}

        <div className="mt-4 flex flex-col items-center gap-2 text-sm font-semibold">
          {modo === 'entrar' ? (
            <>
              <button onClick={() => irPara('criar')} className="text-gold hover:underline">
                Primeiro acesso? Criar senha
              </button>
              <button onClick={() => irPara('recuperar')} className="text-gold hover:underline">
                Esqueci minha senha
              </button>
            </>
          ) : (
            <button onClick={() => irPara('entrar')} className="text-gold hover:underline">
              ← Voltar para o login
            </button>
          )}
        </div>
        <div className="mt-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-center text-xs text-muted">
          <p>
            O acesso à ferramenta é liberado <strong className="text-white">somente após autorização</strong> da Dicoon
            Invest. Sem autorização, não é possível entrar.
          </p>
          <a href={linkSolicitarAcesso} className="mt-2 inline-block font-semibold text-gold hover:underline">
            Solicitar acesso por e-mail
          </a>
        </div>
        <div className="text-center">
          <a href="/" className="mt-4 inline-block text-xs font-semibold text-gold hover:underline">
            ← Voltar ao site
          </a>
        </div>
      </div>
    </main>
  )
}
