# 06 — Proteção contra crash

**Tipo:** robustez · **Tamanho:** P

## Problema
[src/index.js](../../src/index.js) não tem `client.on('error')` nem handlers de processo. Alguns casos derrubam o bot ou deixam erro sem log:
- O handler `ClientReady` é `async`. Se `guild.commands.set` falhar, vira uma rejeição não tratada, e no Node ≥ 15 isso encerra o processo.
- Um evento `error` do client sem listener lança exceção.

## Comportamento esperado
- Erros inesperados são logados com contexto e o bot continua no ar.
- Uma exceção síncrona não capturada é logada e o processo sai com código 1. O `AUTORESTART=true` da Discloud (ou o restart do Render/Docker) sobe de novo; continuar depois de um `uncaughtException` é inseguro.
- `SIGTERM`/`SIGINT` (deploy) fazem `client.destroy()` antes de sair.

## Onde mexer
`src/index.js`:
```js
client.on(Events.Error, (e) => console.error('Erro do client:', e));
client.on(Events.Warn, (m) => console.warn('Aviso do client:', m));
process.on('unhandledRejection', (e) => console.error('Promise rejeitada sem tratamento:', e));
process.on('uncaughtException', (e) => { console.error('Exceção não capturada:', e); process.exit(1); });
for (const sinal of ['SIGTERM', 'SIGINT']) process.on(sinal, () => { client.destroy(); process.exit(0); });
```
Envolva também o corpo do `ClientReady` em `try/catch` com uma mensagem clara (ex.: "Falha ao registrar comandos").

## Critérios de aceite
- [ ] Um `Promise.reject` solto em um job não derruba o bot (teste temporário).
- [ ] Ctrl+C encerra limpo.
