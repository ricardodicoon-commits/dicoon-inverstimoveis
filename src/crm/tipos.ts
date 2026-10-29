export type Papel = 'admin' | 'corretor' | 'atendente' | 'secretaria' | 'cliente'

export const rotuloPapel: Record<Papel, string> = {
  admin: 'Administrador',
  corretor: 'Corretor',
  atendente: 'Atendente',
  secretaria: 'Secretária',
  cliente: 'Cliente',
}

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
  aceita_mensagens?: boolean
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
  aceita_mensagens?: boolean
  created_at: string
}

export interface Tarefa {
  id: string
  titulo: string
  descricao: string | null
  tipo: string
  categoria: string
  data_tarefa: string
  hora_inicio: string | null
  prioridade: string
  status: string
  origem: string
  recorrencia: string | null
  resultado: string | null
  motivo: string | null
  proxima_acao: string | null
  concluida_em: string | null
  tarefa_pai_id: string | null
  compromisso_id: string | null
  negociacao_id: string | null
  lead_id: string | null
  responsavel_id: string | null
  criado_por: string | null
  responsavel?: { nome: string | null; email: string } | null
}

export const categoriasTarefa = [
  { valor: 'comercial', rotulo: 'Comercial' },
  { valor: 'credito', rotulo: 'Crédito' },
  { valor: 'consorcios', rotulo: 'Consórcios' },
  { valor: 'consignados', rotulo: 'Consignados' },
  { valor: 'seguros', rotulo: 'Seguros' },
  { valor: 'imobiliaria', rotulo: 'Imobiliária' },
  { valor: 'documentacao', rotulo: 'Documentação' },
  { valor: 'parcerias', rotulo: 'Parcerias' },
  { valor: 'agenda', rotulo: 'Agenda' },
  { valor: 'administrativo', rotulo: 'Administrativo' },
  { valor: 'pessoal', rotulo: 'Pessoal' },
  { valor: 'outros', rotulo: 'Outros' },
]

export const statusTarefa = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'aguardando_terceiro', rotulo: 'Aguardando terceiro' },
  { valor: 'concluida', rotulo: 'Concluída' },
  { valor: 'cancelada', rotulo: 'Cancelada' },
]

export const recorrencias = [
  { valor: '', rotulo: 'Não repete' },
  { valor: 'diaria', rotulo: 'Todo dia' },
  { valor: 'semanal', rotulo: 'Toda semana' },
  { valor: 'mensal', rotulo: 'Todo mês' },
]

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

// Agenda (supabase/06-secretaria-agenda.sql).

export const categoriasCompromisso = [
  { valor: 'reuniao_comercial', rotulo: 'Reunião comercial' },
  { valor: 'visita_imobiliaria', rotulo: 'Visita a imobiliária' },
  { valor: 'reuniao_com_construtora', rotulo: 'Reunião com construtora' },
  { valor: 'reuniao_com_parceiro', rotulo: 'Reunião com parceiro' },
  { valor: 'atendimento_agendado', rotulo: 'Atendimento agendado' },
  { valor: 'compromisso_pessoal', rotulo: 'Pessoal' },
  { valor: 'tarefa_externa', rotulo: 'Tarefa externa' },
  { valor: 'outros', rotulo: 'Outros' },
]

export const statusCompromisso = [
  { valor: 'a_confirmar', rotulo: 'Agendado' },
  { valor: 'aguardando_confirmacao', rotulo: 'Aguardando confirmação' },
  { valor: 'confirmado', rotulo: 'Confirmado' },
  { valor: 'solicitou_remarcacao', rotulo: 'Solicitou remarcação' },
  { valor: 'cancelamento_solicitado', rotulo: 'Cancelamento solicitado' },
  { valor: 'reagendado', rotulo: 'Remarcado' },
  { valor: 'realizado', rotulo: 'Concluído' },
  { valor: 'nao_compareceu', rotulo: 'Não compareceu' },
  { valor: 'follow_up_pendente', rotulo: 'Follow-up pendente' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
]

// Compromissos ainda no caminho (para conflitos e validação de comparecimento).
export const statusAtivosCompromisso = ['a_confirmar', 'aguardando_confirmacao', 'confirmado', 'solicitou_remarcacao', 'reagendado']

export interface LembreteEnvio {
  id: string
  compromisso_id: string
  etapa: 'confirmacao' | 'follow_up_falta'
  enviar_em: string
  status: string
  destinatario_telefone: string | null
  mensagem: string | null
  resposta_opcao: string | null
  respostas: Record<string, string>
  compromisso?: { titulo: string; inicio: string; fim: string; status: string } | null
}

export const prioridades = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'urgente', rotulo: 'Urgente' },
]

export interface Compromisso {
  id: string
  titulo: string
  categoria: string
  inicio: string
  fim: string
  local: string | null
  endereco: string | null
  participantes: string | null
  objetivo: string | null
  observacoes: string | null
  resultado: string | null
  status: string
  prioridade: string
  lembrete_minutos: number | null
  negociacao_id: string | null
  cliente_id: string | null
  lead_id: string | null
  responsavel_id: string
  criado_por: string | null
  responsavel?: { nome: string | null; email: string } | null
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
