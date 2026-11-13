# 03 — Tempo do post em horas úteis

**Tipo:** correção · **Tamanho:** M

## Problema
O campo "Tempo de validação" do post usa minutos de relógio. Já `/relatorio` e `/metricas` usam horas úteis descontando as pausas.

- Post: `tempoDesdeAssumida` em [src/interactions/validacao.js](../src/interactions/validacao.js) faz `(agora - inicio)/60000 - minutosPausados(...)`.
- Métricas: `horasUteisSemPausa(r.assumidaEm, r.finalizadaEm, r.pausas)` em `src/commands/relatorio.js` e `src/metricasMes.js`.

Exemplo: assumida na sexta às 17h e aprovada na segunda às 9h aparece como ~3.840 min no post e ~2 h nas métricas. O Comercial e a Gestão veem números diferentes para a mesma validação.

## Comportamento esperado
O post, a mensagem no post e o `#log-validacoes` mostram o mesmo número das métricas, por exemplo `2 h 10 min úteis` ou `35 min úteis`.

## Onde mexer
- `src/util.js`: novo `fmtDuracaoUtil(horas)` → `"35 min úteis"`, `"2 h úteis"`, `"2 h 10 min úteis"`.
- `src/interactions/validacao.js`, `tempoDesdeAssumida`: trocar o cálculo por `horasUteisSemPausa(inicio, agora, pausas)` e devolver `tempo: fmtDuracaoUtil(h)`.
- Textos que dizem "Tempo desde que foi assumida" ou "desde assumida": acrescentar "(horas úteis)".
- `src/historico.js`, `lerEmbed`: hoje o fallback de `finalizada` lê `(\d+)\s*min` de `CAMPO.tempo ?? CAMPO.tempoLegado`. O formato novo "2 h 10 min" quebraria essa leitura. Restrinja o fallback a `CAMPO.tempoLegado` e a posts sem `CAMPO.finalizada`. Posts novos sempre têm "Finalizada em", então o fallback só serve aos antigos.

## Atenção
- `minutosPausados` deixa de ser usado ali. Se não sobrar nenhum uso, remova-o de `src/post.js`.
- Posts já finalizados continuam com "N min" no campo. Não precisa migrar, porque as métricas recalculam a partir das datas.
- Assumir e aprovar fora do expediente dá `0 min úteis`. Isso está correto, mas mostre `menos de 5 min úteis` quando `h < 5/60`.

## Critérios de aceite
- [ ] Aprovar um post assumido na sexta às 17h e aprovado na segunda às 9h mostra cerca de `2 h úteis`.
- [ ] O tempo do post bate com a linha do responsável em `/metricas` daquele mês.
- [ ] `/historico` e `/relatorio` continuam lendo posts antigos (campo "Tempo até aprovação").

## Como testar
Se a spec 09 já existir, adicione um teste para `fmtDuracaoUtil`. No servidor: Assumir → Pausar 10 min → Retomar → Aprovar e conferir o desconto da pausa.
