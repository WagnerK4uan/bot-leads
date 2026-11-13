# 04 — Aprovar/Reprovar mantém o responsável

**Tipo:** correção · **Tamanho:** P

## Problema
Em `onModal` ([src/interactions/validacao.js](../../src/interactions/validacao.js)), aprovar e reprovar gravam `[CAMPO.responsavel, `${u}`]`, ou seja, quem clicou. Se a Gestão (ou um colega) finalizar um post que outra pessoa assumiu e analisou, o crédito e o tempo vão para quem clicou, em `/relatorio` e `/metricas`.

O "Pedir info" já faz o certo: mantém `responsavelDe(atual)` quando existe.

## Comportamento esperado
- Post com responsável: o responsável continua o mesmo.
- Post sem responsável (aprovado direto da fila 🟡): quem clicou vira o responsável, como hoje.
- A mensagem no post continua dizendo quem finalizou ("aprovada por @X").
- No log, quando quem finalizou for diferente do responsável: `— por @X (responsável: @Y)`.

## Onde mexer
- `tempoDesdeAssumida` já lê o embed. Faça-o devolver `embed` também, ou leia `responsavelDe(embed)` antes.
- Nos ramos `aprovar` e `reprovar`: `const respId = responsavelDe(embed) ?? u.id;` e `[CAMPO.responsavel, `<@${respId}>`, true]`.
- Ajustar as duas chamadas de `registrarLog`.

## Critérios de aceite
- [ ] A assume, B aprova → campo Responsável = A; `/metricas` credita A.
- [ ] Ninguém assumiu, B aprova → Responsável = B.
- [ ] O log mostra os dois nomes quando forem diferentes.
