import { test } from 'node:test';
import assert from 'node:assert/strict';

const { normalizar, doSistema } = await import('../src/historico.js');

test('normalizar ignora acento, caixa e espaços repetidos', () => {
  assert.equal(normalizar('Clipp  Pró'), normalizar('clipp pro'));
  assert.equal(normalizar('  Clipp Pró '), 'clipp pro');
  assert.equal(normalizar(null), '');
});

test('doSistema filtra pela chave e ignora nome vazio', () => {
  const registros = [{ sistemaChave: 'clipp pro' }, { sistemaChave: 'outro' }];
  assert.equal(doSistema(registros, 'CLIPP PRÓ').length, 1);
  assert.deepEqual(doSistema(registros, ''), []);
});

test('normalizar trata nomes de cliente iguais com caixa/espaços diferentes', () => {
  assert.equal(normalizar('Juliana Modas'), normalizar('juliana  modas'));
  assert.notEqual(normalizar('Juliana Modas'), normalizar('Juliana Modas 2'));
});
