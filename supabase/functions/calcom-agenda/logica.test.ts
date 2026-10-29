// node --test supabase/functions/calcom-agenda/logica.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailValido, escolherSugestoes, listarHorarios, localParaCalcom, mensagemSugestao, rotuloHorario, telefoneInternacional, tituloEmPortugues } from './logica.ts'

test('local: escritório com o endereço da Dicoon, local do cliente e videochamada', () => {
  assert.deepEqual(localParaCalcom({ tipo: 'escritorio' }).calcom, { type: 'address' })
  assert.match(localParaCalcom({ tipo: 'escritorio' }).texto, /Capistrano de Abreu, 163/)
  assert.deepEqual(localParaCalcom({ tipo: 'cliente', endereco: ' Rua A, 10 ' }), { calcom: { type: 'attendeeAddress', address: 'Rua A, 10' }, texto: 'Rua A, 10' })
  assert.deepEqual(localParaCalcom({ tipo: 'video' }).calcom, { type: 'integration', integration: 'cal-video' })
})

test('título em português', () => {
  assert.equal(tituloEmPortugues('Reunião de 30 min between Ricardo and Joana', 'Joana Souza'), 'Reunião de 30 min com Joana Souza')
})

const porDia = {
  '2026-11-03': [{ start: '2026-11-03T09:00:00.000-03:00' }, { start: '2026-11-03T09:15:00.000-03:00' }, { start: '2026-11-03T14:00:00.000-03:00' }],
  '2026-10-30': [{ start: '2026-10-30T08:00:00.000-03:00' }, { start: '2026-10-30T16:30:00.000-03:00' }],
}

test('lista em ordem e corta o que é antes do limite', () => {
  const l = listarHorarios(porDia, new Date('2026-10-30T10:00:00-03:00'))
  assert.deepEqual(l, ['2026-10-30T16:30:00.000-03:00', '2026-11-03T09:00:00.000-03:00', '2026-11-03T09:15:00.000-03:00', '2026-11-03T14:00:00.000-03:00'])
})

test('sugere um por dia e completa com horários a 2 h de distância', () => {
  const l = listarHorarios(porDia, new Date('2026-10-30T10:00:00-03:00'))
  assert.deepEqual(escolherSugestoes(l, 3), ['2026-10-30T16:30:00.000-03:00', '2026-11-03T09:00:00.000-03:00', '2026-11-03T14:00:00.000-03:00'])
  assert.deepEqual(escolherSugestoes([], 3), [])
})

test('rótulo e mensagem em português, com pedido de e-mail', () => {
  assert.equal(rotuloHorario('2026-11-03T14:00:00.000-03:00'), 'ter, 03/11 às 14:00')
  const m = mensagemSugestao('Joana Souza', ['2026-11-03T14:00:00.000-03:00'], 15)
  assert.match(m, /^Olá, Joana!/)
  assert.match(m, /1 - ter, 03\/11 às 14:00/)
  assert.match(m, /e-mail/)
})

test('e-mail obrigatório e válido; telefone no formato internacional', () => {
  assert.equal(emailValido('joana@exemplo.com'), true)
  assert.equal(emailValido('joana@exemplo'), false)
  assert.equal(emailValido(''), false)
  assert.equal(telefoneInternacional('51987654321'), '+5551987654321')
  assert.equal(telefoneInternacional('5551987654321'), '+5551987654321')
  assert.equal(telefoneInternacional('1234'), null)
})
