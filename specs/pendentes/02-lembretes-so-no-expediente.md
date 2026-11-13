# 02 — Lembretes só no expediente

**Tipo:** correção · **Tamanho:** P

## Problema
`agendarLembretes` ([src/jobs/lembretes.js](../../src/jobs/lembretes.js)) roda 24/7. As horas são contadas só no expediente, mas o envio não: um post parado desde 14h já tem mais de 2 h úteis às 20h, e o "⏰" sai à noite ou no fim de semana.

## Comportamento esperado
A varredura só envia lembretes em dia útil, entre `EXPEDIENTE_INICIO` e `EXPEDIENTE_FIM`. O que acumulou fora do horário é cobrado na primeira varredura do expediente seguinte.

## Onde mexer
- `src/util.js`: exportar `emExpediente` (hoje é `function emExpediente` sem `export`).
- `src/jobs/lembretes.js`: em `agendarLembretes` → `rodar`, sair cedo com `if (!emExpediente(new Date())) return;`.

Coloque o filtro no agendador, e não dentro de `verificarPendentes`, para que uma chamada manual (testes) continue funcionando a qualquer hora.

## Critérios de aceite
- [ ] Nenhum lembrete às 20h, nem no sábado ou domingo.
- [ ] Às 8h do próximo dia útil, os posts vencidos são cobrados uma vez.
- [ ] Se a spec 07 (feriados) existir, `emExpediente` já cobre feriado e nada muda aqui.

## Como testar
`EXPEDIENTE_FIM` igual à hora atual (expediente acabou) → nenhum lembrete. Volte para 18 → lembrete sai.
