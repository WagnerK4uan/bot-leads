# 09 — Testes com node --test

**Tipo:** robustez · **Tamanho:** M

## Problema
O projeto não tem nenhum teste. A lógica mais sujeita a erro é de data e hora (expediente, fuso, pausas) e de parsing de embed, e hoje só dá para validar no Discord real.

## Comportamento esperado
`npm test` roda testes das funções puras, sem dependência nova (`node:test` + `node:assert`, Node ≥ 20).

## Onde mexer
- `package.json`: `"test": "node --test"`.
- `test/util.test.js`, `test/post.test.js`, `test/historico.test.js`.

## Cuidado com o `.env`
`src/config.js` importa `dotenv/config`, e o `.env` local pode mudar o expediente. No topo de cada teste, fixe os valores **antes** do import (o dotenv não sobrescreve variáveis já definidas):
```js
process.env.EXPEDIENTE_INICIO = '8';
process.env.EXPEDIENTE_FIM = '18';
process.env.TZ_EXPEDIENTE = 'America/Sao_Paulo';
const { horasUteis, horasUteisSemPausa } = await import('../src/util.js');
```
Monte as datas com offset explícito: `new Date('2026-11-13T17:00:00-03:00')`.

## Casos mínimos
**util.js**
- `horasUteis` dentro do mesmo dia (9h–11h = 2).
- Atravessando a noite (17h → 9h do dia seguinte = 2).
- Atravessando o fim de semana (sexta 17h → segunda 9h = 2).
- Tudo fora do expediente (sábado inteiro = 0).
- `horasUteisSemPausa` com pausa fechada e com pausa aberta.
- Feriado, se a spec 07 existir.

**post.js**
- `pausasDe` + `textoPausas`: ida e volta (pausa fechada, pausa aberta "em pausa", várias linhas).
- `emPausa`, `fecharPausa`.
- `solicitanteDe` / `responsavelDe` com `<@123>` e `<@!123>`.
- `comCampo`: substitui mantendo a posição, remove com `null`, adiciona no fim.

**historico.js**
- `chaveSistema('Clipp  Pró') === chaveSistema('clipp pro')`.

## Critérios de aceite
- [ ] `npm test` passa limpo, sem acessar a rede nem precisar de `DISCORD_TOKEN`.
- [ ] Linha "Rodar os testes: `npm test`" no `README.md`.
