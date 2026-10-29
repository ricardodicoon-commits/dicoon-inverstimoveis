# Secretária da Dicoon Invest (CRM `/app`)

Módulo de atendimento, agenda, tarefas, follow-up e mensagens dentro do CRM, sobre o mesmo Supabase. Não cria funil novo nem duplica o cadastro de clientes: tudo se liga a `clientes`, `leads` e `negociacoes` pelos identificadores que já existem.

Situação em 28/10/2026: no ar em **modo assistido**. O canal de WhatsApp está "Não conectado" e em standby. **O sistema não envia mensagens.** Ele prepara o texto, avisa quando é hora e registra o que uma pessoa informar.

## Telas

| Menu | Tela | O que faz |
|---|---|---|
| — | Atendimento | Cadastro rápido de lead do WhatsApp (cria lead, negociação, tarefa de retorno e conversa, sem duplicar telefone); tarefas pendentes; leads recentes; "aceita mensagens". |
| Secretária | Resumo do dia | Indicadores do dia (clicáveis), agenda de hoje, as 3 prioridades sugeridas, próximas reuniões, "precisa de atenção", tarefas por área, resumo de 7 ou 30 dias, anotações e ideias. |
| Secretária | Agenda | Semana e lista; conflito de horário; confirmar, concluir, reagendar (com histórico), cancelar; liga o compromisso a cliente ou lead e a uma negociação. |
| Secretária | Confirmações | Lembretes a enviar (pelo menos 1 h antes), respostas 1/2/3, validação de comparecimento depois do horário, follow-up de quem faltou (uma pergunta por vez). |
| Secretária | Tarefas | Central de tarefas: atrasadas, hoje, próximos 7 dias; filtros; subtarefas; recorrência; resultado. |
| Secretária | Follow-up | Retornos comerciais ligados às negociações; negociações paradas há 7+ dias sem retorno; mensagem para revisão. |
| Secretária | Mensagens | Rascunhos dos 10 modelos: preparar, aprovar, copiar, abrir no WhatsApp, "já enviei", descartar. Admin edita os modelos. |
| Administração | Integrações | Canal de WhatsApp (não conectado, standby) e respostas aprovadas. |

## Papéis e permissões (garantidos pelo banco, não só pela tela)

- **Admin**: vê e edita tudo, inclusive itens pessoais.
- **Secretária** (papel `secretaria`): vê tudo, inclusive leads, clientes, negociações e conversas (no CRM comercial é **só leitura**). Cria compromissos e tarefas para qualquer pessoa e **edita só o que ela criou**. Registra lembretes, respostas e follow-ups de qualquer compromisso.
- **Corretor/atendente**: vê e edita o que é dele ou o que ele criou.
- **Sem login**: não vê nada.

Para trocar o papel de alguém, use a tela **Equipe**, logado como admin. Pelo SQL Editor a troca é desfeita em silêncio pelo gatilho `trigger_prevent_role_escalation`, porque ali não há usuário logado.

## Regras de negócio e de privacidade

- **Sigilo entre clientes**: a mensagem ligada a um cliente, lead ou negociação só aceita o telefone **do próprio cadastro**. O banco recusa outro número e recusa misturar pessoas diferentes.
- **Nada consta como enviado** sem uma pessoa registrar (`enviado_em` obrigatório).
- **Nunca marcar como concluído só porque o horário passou**: depois do horário, o responsável diz se aconteceu.
- Follow-up **não muda a etapa** da negociação.
- Quem desmarcar **"aceita mensagens"** fica fora dos lembretes, e o caso vira tarefa para o responsável.
- Textos: não prometer aprovação, taxas ou contemplação; consórcio é "sem juros, com taxa de administração"; nunca pedir senha ou dados bancários.

## Lembretes e follow-up de falta (modo assistido)

1. Um compromisso com cliente ou lead (direto ou pela negociação) **gera um lembrete** para `inicio − max(60 min, lembrete escolhido)`. Se faltar menos de 1 hora, o lembrete é para agora.
2. Mudou o horário: o lembrete pendente é cancelado e outro é criado. Cancelou ou confirmou: o pendente é cancelado. **No máximo um por etapa e horário.**
3. Sem telefone válido ou sem permissão: não há lembrete, e vira tarefa "Confirmar compromisso".
4. "Já enviei": o compromisso passa a "Aguardando confirmação". Respostas possíveis:
   - Confirmou → confirmado.
   - Remarcar → solicitou remarcação, mais uma tarefa.
   - Não poderá → cancelamento solicitado, mais uma tarefa.
   - Sem resposta → tarefa de acompanhamento. Nada é presumido.
   - Resposta confusa → o texto de esclarecimento fica pronto.
5. Depois do horário, a pessoa marca **Aconteceu** ou **Não compareceu**. Se não compareceu, o sistema prepara a mensagem de follow-up e as 3 perguntas, mais uma tarefa. O desfecho pode ser remarcar, encerrar, precisa de atendente ou sem resposta.

## Limitações conhecidas

- **Os avisos só aparecem com o CRM aberto.** Não há notificação com o navegador fechado.
- O envio é manual: Copiar ou Abrir no WhatsApp, e depois "Já enviei".
- A agenda é interna, sem sincronização com Google Agenda.
- A tabela `tarefas` não tem chave estrangeira em `responsavel_id`. As telas buscam o nome do responsável à parte.
- Toda tarefa tem prazo (o padrão é o dia da criação), então não existe "tarefa sem prazo".

## Fase B: start (envio automático 24 horas por dia)

Só com o ok do Ricardo e a avaliação de custo.

- **WhatsApp oficial** (API da Meta) com o **número novo de atendimento**. Lembretes são mensagens iniciadas pela empresa: exigem modelos aprovados pela Meta e **são cobrados por mensagem**. Verificar a regra de "coexistência" se o número for continuar no app do celular.
- **Agendador e webhook no servidor** (Supabase Edge Functions e pg_cron, ou a VPS). O webhook grava em `mensagens` com `id_externo` único, o que evita processar a mesma mensagem duas vezes. As respostas 1/2/3 são lidas por regra, sem IA. Tokens ficam nos segredos do servidor, nunca no banco nem no front.
- O plano gratuito do Supabase pode **pausar projetos sem uso**. Confirmar a regra atual antes de depender dele 24 horas por dia.
- O que muda no código: um "enviador" que pega `lembretes_envios` pendentes com `enviar_em <= now()`, envia com `canal = 'whatsapp'` e `modo = 'automatico'` e registra `enviado`/`falhou`. As telas e as regras continuam as mesmas.

## Banco: scripts e testes

Rodar à mão no SQL Editor, nesta ordem: `05-secretaria-estrutura.sql` → `06-secretaria-agenda.sql` → `07-lembretes-e-follow-up.sql`. Os três já estão aplicados em produção. Cada um pode ser rodado de novo e tem um `-desfazer.sql`, que se roda na ordem inversa: 07, depois 06, depois 05. O Supabase pede confirmação de "operação destrutiva" por causa da troca de regras e restrições; nenhum dado é apagado.

Testes num banco **descartável** (Postgres do JARVIS no Docker do Ubuntu), nunca no Supabase:

```bash
bash supabase/testes/rodar.sh
```

Os "ERROR" esperados na saída são as recusas testadas, como outro destinatário, falta de permissão ou resposta antes do envio. Ao mudar um script, rode de novo e compare.
