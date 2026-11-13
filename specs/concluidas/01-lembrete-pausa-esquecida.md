# 01 — Pausa esquecida também gera lembrete

**Tipo:** correção · **Tamanho:** P

## Problema
Em [src/jobs/lembretes.js](../src/jobs/lembretes.js), um post 🔵 Em análise com o tempo pausado nunca é cobrado:

```js
if (status === 'analise' && embed && emPausa(embed)) continue;
```

Se alguém pausa e esquece, o post fica parado para sempre sem lembrete, e o tempo pausado não entra nas métricas.

## Comportamento esperado
- Pausado há menos de `SLA_PAUSA_HORAS` horas úteis: não cobra (como hoje).
- Passou disso: cobra o responsável com uma mensagem própria de pausa.
- A mensagem de lembrete vira a "última mensagem" do post, então a próxima cobrança só sai depois de outro `SLA_PAUSA_HORAS`. É o mesmo mecanismo do lembrete atual.

## Onde mexer
- `src/config.js`: `slaPausaHoras: num(process.env.SLA_PAUSA_HORAS, 8)`.
- `.env.example` e a tabela "Ajustes comuns" do `README.md`.
- `src/jobs/lembretes.js`, função `verificarPendentes`.

## Passo a passo
1. Depois de ler o `embed`, se `status === 'analise' && emPausa(embed)`:
   - se `horas < env.slaPausaHoras`, faz `continue`;
   - senão, envia: `⏸️ <@responsavel>, esta validação está pausada há X h úteis. Ainda está bloqueada? Retome o tempo ou atualize o post.`, com `allowedMentions: { users: [id] }`. Sem responsável, menciona o cargo Importação.
   - `continue` (não cai no lembrete normal de análise).
2. `horas` continua sendo `horasUteis(desde)` a partir da última mensagem. Assim, se a pessoa comentou no post durante a pausa, o relógio recomeça.

## Critérios de aceite
- [ ] Post pausado há 1 h útil não recebe nada.
- [ ] Post pausado há mais de `SLA_PAUSA_HORAS` recebe o lembrete de pausa, mencionando o responsável.
- [ ] Lembretes de 🟡 e 🟠 e de 🔵 não pausado continuam iguais.

## Como testar
`.env` local com `SLA_HORAS=0.05`, `SLA_PAUSA_HORAS=0.1` e `LEMBRETE_INTERVALO_MIN=1`, dentro do expediente. Assumir → Pausar → esperar cerca de 6 min.
