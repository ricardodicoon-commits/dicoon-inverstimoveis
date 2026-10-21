export type Papel = 'admin' | 'corretor' | 'atendente' | 'cliente'

export interface Perfil {
  id: string
  nome: string | null
  email: string
  telefone: string | null
  role: Papel
  ativo: boolean
  aprovado: boolean
  created_at: string
}

export interface Cliente {
  id: string
  nome_completo: string
  cpf_cnpj: string | null
  data_nascimento: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  observacoes: string | null
  status: string | null
  responsavel_id: string
  usuario_id?: string | null
  created_at: string
  responsavel?: { nome: string | null; email: string } | null
}

export interface Negociacao {
  id: string
  cliente_id: string
  valor_estimado: number | null
  etapa: string
  observacoes: string | null
  responsavel_id: string
  created_at: string
  cliente?: { nome_completo: string } | null
}

export const etapas = ['Prospecção', 'Simulação', 'Documentação', 'Em análise', 'Aprovado', 'Contratado', 'Perdido']

export const statusCliente = ['Ativo', 'Em atendimento', 'Inativo']
