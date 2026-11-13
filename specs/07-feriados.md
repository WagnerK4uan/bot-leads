# 07 — Feriados no cálculo de horas úteis

**Tipo:** robustez · **Tamanho:** P

## Problema
`emExpediente` em [src/util.js](../src/util.js) só conhece sábado e domingo. Em feriado:
- o SLA conta horas, e os lembretes cobram o time;
- o tempo de análise (métricas e, depois da spec 03, o post) fica inflado;
- o fechamento mensal pode sair num feriado (ex.: 1º de janeiro).

## Comportamento esperado
`FERIADOS` no `.env` aceita datas separadas por vírgula, em dois formatos:
- `MM-DD`: feriado fixo, repete todo ano (ex.: `01-01,04-21,05-01,09-07,10-12,11-02,11-15,11-20,12-25`);
- `AAAA-MM-DD`: data única (Carnaval, Sexta-feira Santa, Corpus Christi, emendas).

Feriado conta como fim de semana em tudo que usa expediente.

## Onde mexer
- `src/config.js`: `feriados: new Set((process.env.FERIADOS ?? '').split(',').map((s) => s.trim()).filter(Boolean))`.
- `src/util.js`:
  - `export function ehDiaUtil(date)`: não é Sat/Sun e nem `partes(date).dia` (`AAAA-MM-DD`) nem os últimos 5 caracteres (`MM-DD`) estão em `env.feriados`.
  - `emExpediente` passa a usar `ehDiaUtil`.
- `src/jobs/fechamentoMensal.js`: trocar o teste de `weekday` por `!ehDiaUtil(agora)`, para sair no 1º dia útil de verdade.
- `src/jobs/resumoSemanal.js`: **deixe como está**. O resumo só roda na segunda, e se a segunda for feriado ele não sairia na semana. Publicar no `#gestao` num feriado não causa problema.
- `.env.example` com a lista de feriados nacionais fixos já preenchida, e a linha no `README.md`.

## Atenção
`horasUteis` chama `emExpediente` a cada 5 min do intervalo. O lookup no `Set` é barato; não crie objetos dentro do laço.

## Critérios de aceite
- [ ] `horasUteis(24/12 17h, 26/12 9h)` com `12-25` configurado = 2 h (1 h no dia 24 e 1 h no dia 26).
- [ ] Nenhum lembrete em feriado (junto com a spec 02).
- [ ] Sem `FERIADOS`, nada muda.
