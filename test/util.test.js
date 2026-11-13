import { test } from 'node:test';
import assert from 'node:assert/strict';

// Fixa o expediente antes do import: o dotenv não sobrescreve variáveis já definidas.
process.env.EXPEDIENTE_INICIO = '8';
process.env.EXPEDIENTE_FIM = '18';
process.env.TZ_EXPEDIENTE = 'America/Sao_Paulo';
process.env.FERIADOS = '12-25,2026-11-20';
const { horasUteis, horasUteisSemPausa, ehDiaUtil, emExpediente, fmtDuracaoUtil } = await import('../src/util.js');

const d = (s) => new Date(`${s}-03:00`);

test('horasUteis dentro do mesmo dia', () => {
  assert.equal(horasUteis(d('2026-11-12T09:00:00'), d('2026-11-12T11:00:00')), 2);
});

test('horasUteis atravessando a noite', () => {
  assert.equal(horasUteis(d('2026-11-12T17:00:00'), d('2026-11-13T09:00:00')), 2);
});

test('horasUteis atravessando o fim de semana', () => {
  // Sexta 13/11 17h → segunda 16/11 9h.
  assert.equal(horasUteis(d('2026-11-13T17:00:00'), d('2026-11-16T09:00:00')), 2);
});

test('horasUteis com tudo fora do expediente', () => {
  assert.equal(horasUteis(d('2026-11-14T00:00:00'), d('2026-11-15T00:00:00')), 0);
  assert.equal(horasUteis(d('2026-11-12T18:00:00'), d('2026-11-13T08:00:00')), 0);
});

test('horasUteis com fim antes do início dá 0', () => {
  assert.equal(horasUteis(d('2026-11-12T11:00:00'), d('2026-11-12T09:00:00')), 0);
});

test('horasUteisSemPausa com pausa fechada', () => {
  const pausas = [{ inicio: d('2026-11-12T10:00:00'), fim: d('2026-11-12T11:00:00') }];
  assert.equal(horasUteisSemPausa(d('2026-11-12T09:00:00'), d('2026-11-12T13:00:00'), pausas), 3);
});

test('horasUteisSemPausa com pausa aberta conta até o fim', () => {
  const pausas = [{ inicio: d('2026-11-12T12:00:00'), fim: null }];
  assert.equal(horasUteisSemPausa(d('2026-11-12T09:00:00'), d('2026-11-12T13:00:00'), pausas), 3);
});

test('horasUteisSemPausa nunca fica negativo', () => {
  const pausas = [{ inicio: d('2026-11-12T08:00:00'), fim: d('2026-11-12T12:00:00') }];
  assert.equal(horasUteisSemPausa(d('2026-11-12T09:00:00'), d('2026-11-12T10:00:00'), pausas), 0);
});

test('feriado fixo (MM-DD) e feriado de data única (AAAA-MM-DD) não contam', () => {
  assert.equal(ehDiaUtil(d('2026-12-25T10:00:00')), false);
  assert.equal(ehDiaUtil(d('2027-12-24T10:00:00')), true);
  assert.equal(ehDiaUtil(d('2026-11-20T10:00:00')), false);
  assert.equal(ehDiaUtil(d('2027-11-19T10:00:00')), true);
  // Quinta 19/11 17h → segunda 23/11 9h, pulando o feriado da sexta e o fim de semana.
  assert.equal(horasUteis(d('2026-11-19T17:00:00'), d('2026-11-23T09:00:00')), 2);
});

test('emExpediente respeita início inclusivo e fim exclusivo', () => {
  assert.equal(emExpediente(d('2026-11-12T08:00:00')), true);
  assert.equal(emExpediente(d('2026-11-12T07:59:00')), false);
  assert.equal(emExpediente(d('2026-11-12T17:59:00')), true);
  assert.equal(emExpediente(d('2026-11-12T18:00:00')), false);
});

test('fmtDuracaoUtil', () => {
  assert.equal(fmtDuracaoUtil(0), 'menos de 5 min úteis');
  assert.equal(fmtDuracaoUtil(35 / 60), '35 min úteis');
  assert.equal(fmtDuracaoUtil(2), '2 h úteis');
  assert.equal(fmtDuracaoUtil(2 + 10 / 60), '2 h 10 min úteis');
});
