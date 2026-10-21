import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { erroAmigavel } from './dados'
import { Aviso, Botao, Campo, Modal, estiloCampo } from './ui'

// Cada usuário troca a senha inicial que o admin definiu.
// Também usada no link de recuperação de senha (/app?nova-senha).
export function TrocarSenha({ aoFechar, titulo = 'Trocar senha' }: { aoFechar: () => void; titulo?: string }) {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.')
    if (senha !== confirmacao) return setErro('As senhas não conferem.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) return setErro(erroAmigavel(error))
    setOk(true)
  }

  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      {ok ? (
        <div className="space-y-4">
          <Aviso tipo="ok">Senha alterada. Use a nova senha no próximo acesso.</Aviso>
          <Botao onClick={aoFechar}>Fechar</Botao>
        </div>
      ) : (
        <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Nova senha">
            <input
              type="password"
              required
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={estiloCampo}
            />
          </Campo>
          <Campo rotulo="Repita a nova senha">
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className={estiloCampo}
            />
          </Campo>
          {erro && <Aviso>{erro}</Aviso>}
          <Botao type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar nova senha'}
          </Botao>
        </form>
      )}
    </Modal>
  )
}
