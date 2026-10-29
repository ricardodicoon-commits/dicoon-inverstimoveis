// Testes da lógica do webhook: node --test supabase/functions/calcom-webhook/logica.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { assinaturaValida, extrair } from './logica.ts'

const segredo = 'segredo-de-teste'
const assinar = (corpo: string) => createHmac('sha256', segredo).update(corpo).digest('hex')

test('assinatura: aceita a correta e recusa errada, vazia ou de outro corpo', async () => {
  const corpo = JSON.stringify({ triggerEvent: 'BOOKING_CREATED' })
  assert.equal(await assinaturaValida(corpo, assinar(corpo), segredo), true)
  assert.equal(await assinaturaValida(corpo, assinar(corpo).toUpperCase(), segredo), true)
  assert.equal(await assinaturaValida(corpo, 'a'.repeat(64), segredo), false)
  assert.equal(await assinaturaValida(corpo, null, segredo), false)
  assert.equal(await assinaturaValida(corpo, assinar(corpo), ''), false)
  assert.equal(await assinaturaValida(corpo + ' ', assinar(corpo), segredo), false)
})

const criado = {
  triggerEvent: 'BOOKING_CREATED',
  payload: {
    uid: 'abc123',
    title: 'Reunião de 30 min entre Ricardo e Joana',
    startTime: '2026-11-03T13:00:00Z',
    endTime: '2026-11-03T13:30:00Z',
    location: 'integrations:daily',
    attendees: [{ name: 'Joana Souza', email: 'joana@exemplo.com', timeZone: 'America/Sao_Paulo' }],
    responses: { name: { value: 'Joana Souza' }, email: { value: 'joana@exemplo.com' }, attendeePhoneNumber: { value: '+5551987654321' }, notes: { value: 'Quero financiar' } },
  },
}

test('extrai um agendamento criado com telefone das respostas', () => {
  const d = extrair(criado)!
  assert.equal(d.p_evento, 'BOOKING_CREATED')
  assert.equal(d.p_uid, 'abc123')
  assert.equal(d.p_telefone, '+5551987654321')
  assert.equal(d.p_nome, 'Joana Souza')
  assert.equal(d.p_local, 'Videochamada (Cal.com)')
  assert.equal(d.p_observacoes, 'Quero financiar')
  assert.equal(d.p_uid_anterior, null)
})

test('remarcado traz o uid anterior; telefone pode vir do participante', () => {
  const d = extrair({
    triggerEvent: 'BOOKING_RESCHEDULED',
    payload: { ...criado.payload, uid: 'novo', rescheduleUid: 'abc123', responses: {}, attendees: [{ name: 'J', phoneNumber: '+5551911112222' }] },
  })!
  assert.equal(d.p_uid, 'novo')
  assert.equal(d.p_uid_anterior, 'abc123')
  assert.equal(d.p_telefone, '+5551911112222')
})

test('ignora PING e avisos incompletos', () => {
  assert.equal(extrair({ triggerEvent: 'PING', payload: {} }), null)
  assert.equal(extrair({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'x' } }), null)
  assert.equal(extrair({}), null)
})
