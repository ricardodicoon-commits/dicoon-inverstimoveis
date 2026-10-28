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
  cliente_id: string | null
  valor_estimado: number | null
  etapa: string
  observacoes: string | null
  responsavel_id: string
  created_at: string
  lead_id?: string | null
  cliente?: { nome_completo: string } | null
  lead?: { nome: string } | null
}

// Valores aceitos pelo banco (enum negotiation_stage_type) e o nome mostrado na tela.
export const etapas = [
  { valor: 'novo_contato', rotulo: 'Novo contato' },
  { valor: 'analise', rotulo: 'Em análise' },
  { valor: 'proposta', rotulo: 'Proposta' },
  { valor: 'aprovacao', rotulo: 'Aprovação' },
  { valor: 'concluido', rotulo: 'Concluído' },
]

export const etapaFinal = 'concluido'

export function rotuloEtapa(valor: string) {
  return etapas.find((e) => e.valor === valor)?.rotulo ?? valor
}

export const statusCliente = ['Ativo', 'Em atendimento', 'Inativo']

// Secretária / atendimento (tabelas do supabase/05-secretaria-estrutura.sql).

export const interesses = [
  { valor: 'financiamento', rotulo: 'Crédito e financiamento' },
  { valor: 'seguro', rotulo: 'Seguros' },
  { valor: 'imovel', rotulo: 'Imóveis' },
  { valor: 'consorcio', rotulo: 'Consórcio' },
  { valor: 'investimento', rotulo: 'Investimento' },
]

export const statusLead = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'em_atendimento', rotulo: 'Em atendimento' },
  { valor: 'proposta_enviada', rotulo: 'Proposta enviada' },
  { valor: 'convertido', rotulo: 'Convertido' },
  { valor: 'perdido', rotulo: 'Perdido' },
]

export function rotulo(lista: { valor: string; rotulo: string }[], valor: string) {
  return lista.find((i) => i.valor === valor)?.rotulo ?? valor
}

export interface Lead {
  id: string
  nome: string
  telefone: string
  tipo_interesse: string
  origem_lead: string
  status: string
  observacoes: string | null
  responsavel_id: string | null
  created_at: string
}

export interface Tarefa {
  id: string
  titulo: string
  descricao: string | null
  data_tarefa: string
  prioridade: string
  status: string
  origem: string
  lead_id: string | null
  responsavel_id: string | null
}

export interface Canal {
  id: string
  nome: string
  numero: string | null
  provedor: string | null
  conexao: 'nao_conectado' | 'configuracao_pendente' | 'conectado' | 'erro'
  modo: 'standby' | 'ativo'
}

export const rotuloConexao: Record<Canal['conexao'], string> = {
  nao_conectado: 'Não conectado',
  configuracao_pendente: 'Configuração pendente',
  conectado: 'Conectado',
  erro: 'Com erro',
}

export interface RespostaAprovada {
  id: string
  atalho: string
  titulo: string
  texto: string
  area: string
  ordem: number
  ativa: boolean
}
