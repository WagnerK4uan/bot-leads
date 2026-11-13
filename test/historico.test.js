import { test } from 'node:test';
import assert from 'node:assert/strict';

const { chaveSistema, doSistema } = await import('../src/historico.js');

test('chaveSistema ignora acento, caixa e espaços repetidos', () => {
  assert.equal(chaveSistema('Clipp  Pró'), chaveSistema('clipp pro'));
  assert.equal(chaveSistema('  Clipp Pró '), 'clipp pro');
  assert.equal(chaveSistema(null), '');
});

test('doSistema filtra pela chave e ignora nome vazio', () => {
  const registros = [{ sistemaChave: 'clipp pro' }, { sistemaChave: 'outro' }];
  assert.equal(doSistema(registros, 'CLIPP PRÓ').length, 1);
  assert.deepEqual(doSistema(registros, ''), []);
});
