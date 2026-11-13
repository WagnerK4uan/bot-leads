import { test } from 'node:test';
import assert from 'node:assert/strict';

const { montarMinhas } = await import('../src/commands/minhas.js');
const { limitarLinhas } = await import('../src/util.js');

const agora = new Date();
const horasAtras = (h) => new Date(agora.getTime() - h * 3_600_000);
let n = 0;
const post = (status, extra = {}) => ({
  thread: `<#${++n}>`,
  status,
  criadoEm: horasAtras(48),
  pausas: [],
  solicitanteId: 'com',
  responsavelId: null,
  assumidaEm: null,
  finalizadaEm: null,
  ...extra,
});

const registros = [
  post('analise', { responsavelId: 'imp', assumidaEm: horasAtras(2) }),
  post('info', { responsavelId: 'imp', assumidaEm: horasAtras(5), pausas: [{ inicio: horasAtras(1), fim: null }] }),
  post('analise', { responsavelId: 'outro', assumidaEm: horasAtras(3) }),
  post('aguardando'),
  post('aguardando', { solicitanteId: 'outro-com' }),
  post('aprovado', { finalizadaEm: horasAtras(24), metodo: 'Backup' }),
  post('reprovado', { finalizadaEm: horasAtras(24 * 10), motivo: 'Antigo' }),
];

test('Importação vê só os posts em que é responsável, mais antigos primeiro, e a contagem de 🟡', () => {
  const linhas = montarMinhas(registros, 'imp', { importacao: true, comercial: false }, agora);
  assert.equal(linhas[0], '**Com você (2)**');
  assert.match(linhas[1], /^🟠 .*⏸️ pausada$/); // assumida há 5 h vem antes da de 2 h
  assert.match(linhas[2], /^🔵 /);
  assert.equal(linhas.at(-1), '🟡 2 aguardando alguém assumir → `/pendentes`');
  assert.ok(!linhas.some((l) => l.includes('Seus pedidos')));
});

test('Comercial vê os pedidos abertos e os finalizados da última semana', () => {
  const linhas = montarMinhas(registros, 'com', { importacao: false, comercial: true }, agora);
  assert.ok(linhas.includes('**Seus pedidos (4)**'));
  assert.ok(linhas.includes('**Finalizados nos últimos 7 dias (1)**'));
  assert.ok(linhas.some((l) => l.includes('Backup')));
  assert.ok(!linhas.some((l) => l.includes('Antigo')));
});

test('lista vazia', () => {
  assert.deepEqual(montarMinhas([], 'x', { importacao: false, comercial: true }, agora), ['🎉 Nada com você agora.']);
});

test('limitarLinhas corta antes do limite e conta o que sobrou', () => {
  const linhas = Array.from({ length: 100 }, (_, i) => `linha ${String(i).padStart(3, '0')} ${'x'.repeat(90)}`);
  const desc = limitarLinhas(linhas);
  assert.ok(desc.length <= 4096);
  const mostradas = desc.split('\n').length - 1;
  assert.equal(desc.split('\n').at(-1), `… e mais ${100 - mostradas}`);
  assert.equal(limitarLinhas(['a', 'b']), 'a\nb');
});
