import { Logo } from '../../components/Logo'
import { useAuth } from '../auth'
import { Botao } from '../ui'

export function Aguardando({ desativado = false }: { desativado?: boolean }) {
  const { sessao, sair } = useAuth()
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-coal p-8 text-center">
        <div className="flex justify-center">
          <Logo grande />
        </div>
        <h1 className="mt-6 text-xl font-bold normal-case tracking-normal text-white">
          {desativado ? 'Acesso desativado' : 'Aguardando aprovação'}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {desativado
            ? 'Seu acesso foi desativado pelo administrador. Fale com a Dicoon Invest se precisar.'
            : 'Seu cadastro foi recebido. Assim que o administrador aprovar, esta tela libera sozinha.'}
        </p>
        <p className="mt-4 rounded-lg border border-line bg-ink px-4 py-2 text-sm text-white">{sessao?.user.email}</p>
        <Botao variante="secundario" className="mt-6" onClick={sair}>
          Sair
        </Botao>
      </div>
    </main>
  )
}
