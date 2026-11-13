import { test } from 'node:test';
import assert from 'node:assert/strict';

const { CAMPO, comCampo, emPausa, fecharPausa, pausasDe, responsavelDe, solicitanteDe, textoPausas } = await import(
  '../src/post.js'
);

const t = (s) => new Date(`${s}-03:00`);
const comPausas = (pausas) => ({ fields: [{ name: CAMPO.pausas, value: textoPausas(pausas) }] });

test('pausasDe + textoPausas: pausa fechada vai e volta', () => {
  const pausas = [{ inicio: t('2026-11-12T10:00:00'), fim: t('2026-11-12T11:30:00') }];
  assert.deepEqual(pausasDe(comPausas(pausas)), pausas);
});

test('pausasDe + textoPausas: pausa aberta vira "em pausa"', () => {
  const pausas = [{ inicio: t('2026-11-12T10:00:00'), fim: null }];
  const texto = textoPausas(pausas);
  assert.match(texto, /em pausa$/);
  assert.deepEqual(pausasDe(comPausas(pausas)), pausas);
});

test('pausasDe + textoPausas: várias linhas', () => {
  const pausas = [
    { inicio: t('2026-11-12T10:00:00'), fim: t('2026-11-12T10:30:00') },
    { inicio: t('2026-11-12T14:00:00'), fim: t('2026-11-12T15:00:00') },
    { inicio: t('2026-11-13T09:00:00'), fim: null },
  ];
  assert.equal(textoPausas(pausas).split('\n').length, 3);
  assert.deepEqual(pausasDe(comPausas(pausas)), pausas);
});

test('textoPausas sem pausas devolve null e pausasDe sem campo devolve []', () => {
  assert.equal(textoPausas([]), null);
  assert.deepEqual(pausasDe({ fields: [] }), []);
  assert.deepEqual(pausasDe({}), []);
});

test('emPausa', () => {
  assert.equal(emPausa({ fields: [] }), false);
  assert.equal(emPausa(comPausas([{ inicio: t('2026-11-12T10:00:00'), fim: null }])), true);
  assert.equal(emPausa(comPausas([{ inicio: t('2026-11-12T10:00:00'), fim: t('2026-11-12T11:00:00') }])), false);
});

test('fecharPausa fecha só a aberta', () => {
  const fechada = { inicio: t('2026-11-12T10:00:00'), fim: t('2026-11-12T11:00:00') };
  const aberta = { inicio: t('2026-11-12T14:00:00'), fim: null };
  const quando = t('2026-11-12T15:00:00');
  assert.deepEqual(fecharPausa([fechada, aberta], quando), [fechada, { ...aberta, fim: quando }]);
  assert.deepEqual(fecharPausa([fechada], quando), [fechada]);
});

test('solicitanteDe / responsavelDe com <@123> e <@!123>', () => {
  const embed = (sol, resp) => ({
    fields: [
      { name: CAMPO.solicitante, value: sol },
      { name: CAMPO.responsavel, value: resp },
    ],
  });
  assert.equal(solicitanteDe(embed('<@123>', '<@!456>')), '123');
  assert.equal(responsavelDe(embed('<@123>', '<@!456>')), '456');
  assert.equal(solicitanteDe(embed('<@!789>', '<@1>')), '789');
  assert.equal(solicitanteDe({ fields: [] }), null);
  assert.equal(responsavelDe({}), null);
});

test('comCampo substitui mantendo a posição', () => {
  const base = { fields: [{ name: 'A', value: '1' }, { name: 'B', value: '2' }, { name: 'C', value: '3' }] };
  const e = comCampo(base, 'B', 'novo', true);
  assert.deepEqual(
    e.data.fields.map((f) => [f.name, f.value]),
    [['A', '1'], ['B', 'novo'], ['C', '3']],
  );
  assert.equal(e.data.fields[1].inline, true);
});

test('comCampo remove com null e adiciona no fim', () => {
  const base = { fields: [{ name: 'A', value: '1' }, { name: 'B', value: '2' }] };
  assert.deepEqual(comCampo(base, 'A', null).data.fields.map((f) => f.name), ['B']);
  assert.deepEqual(comCampo(base, 'X', null).data.fields.map((f) => f.name), ['A', 'B']);
  assert.deepEqual(comCampo(base, 'Z', '9').data.fields.map((f) => f.name), ['A', 'B', 'Z']);
});

test('botoes: aberto tem a linha do solicitante com Cancelar; finalizado só Reabrir', async () => {
  const { botoes } = await import('../src/post.js');
  const ids = (rows) => rows.map((r) => r.components.map((c) => c.data.custom_id));
  assert.ok(ids(botoes('aguardando'))[1].includes('val:cancelar'));
  for (const s of ['aprovado', 'reprovado', 'cancelado']) assert.deepEqual(ids(botoes(s)), [['val:reabrir']]);
});

test('lerPedido devolve os valores do formulário a partir do embed inicial', async () => {
  const { embedInicial, lerPedido } = await import('../src/post.js');
  const embed = embedInicial({
    cliente: 'Juliana Modas',
    sistema: 'Clipp Pro',
    acesso: 'AnyDesk 123',
    dados: ['Clientes', 'Histórico de Venda'],
    obs: '',
    solicitanteId: '1',
  }).toJSON();
  assert.deepEqual(lerPedido(embed), {
    cliente: 'Juliana Modas',
    sistema: 'Clipp Pro',
    acesso: 'AnyDesk 123',
    dadosValores: ['clientes', 'historico'],
    obs: '',
  });
});

test('botoes: Editar aparece em 🟡 e 🟠, não em 🔵', async () => {
  const { botoes } = await import('../src/post.js');
  const linha2 = (s) => botoes(s)[1].components.map((c) => c.data.custom_id);
  assert.deepEqual(linha2('aguardando'), ['val:editar', 'val:cancelar']);
  assert.deepEqual(linha2('info'), ['val:editar', 'val:cancelar']);
  assert.deepEqual(linha2('analise'), ['val:cancelar']);
});
