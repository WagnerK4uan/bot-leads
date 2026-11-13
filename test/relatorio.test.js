import { test } from 'node:test';
import assert from 'node:assert/strict';

const { calcularMetricas, SEM_CATEGORIA } = await import('../src/commands/relatorio.js');

const agora = new Date();
const post = (status, extra = {}) => ({ status, criadoEm: agora, ...extra });

test('motivos de reprovação: contagem por categoria, posts antigos como "Sem categoria"', () => {
  const m = calcularMetricas([
    post('reprovado', { categoria: 'Sistema não permite exportar' }),
    post('reprovado', { categoria: 'Sistema não permite exportar' }),
    post('reprovado'),
    post('aprovado'),
  ]);
  assert.deepEqual(m.motivos, [
    ['Sistema não permite exportar', 2],
    [SEM_CATEGORIA, 1],
  ]);
});

test('cancelados não mudam a taxa de aprovação', () => {
  const base = [post('aprovado'), post('reprovado')];
  assert.equal(calcularMetricas([...base, post('cancelado'), post('cancelado')]).taxaAprovacao, calcularMetricas(base).taxaAprovacao);
});
