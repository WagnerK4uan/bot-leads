# 08 — Trava contra clique duplo

**Tipo:** robustez · **Tamanho:** M

## Problema
Os botões usam `interaction.message.embeds[0]`, que é o embed **no momento do clique**. Se duas pessoas clicarem "Assumir" quase juntas, as duas interações passam (o botão só fica desabilitado depois da primeira resposta) e a segunda sobrescreve o responsável da primeira. O mesmo vale para Aprovar e Reprovar quase simultâneos, ou Pausar e Aprovar.

## Comportamento esperado
- Ações no mesmo post rodam uma de cada vez.
- "Assumir" num post que já tem responsável e está 🔵 responde, só para quem clicou: `Já assumida por @X.`
- Aprovar, reprovar ou pedir info num post já finalizado responde `Este post já foi finalizado (🟢 Aprovado). Use ↩️ Reabrir.`

## Onde mexer
`src/interactions/validacao.js`:
1. Trava em memória por thread (o bot roda em uma instância só, como diz o README):
   ```js
   const travas = new Map(); // threadId -> Promise
   async function emFila(threadId, fn) {
     const anterior = travas.get(threadId) ?? Promise.resolve();
     const atual = anterior.catch(() => {}).then(fn);
     travas.set(threadId, atual);
     try { return await atual; } finally { if (travas.get(threadId) === atual) travas.delete(threadId); }
   }
   ```
2. Em `onButton` (exceto `showModal`, que precisa responder na hora) e em `onModal`, executar o corpo dentro de `emFila(thread.id, …)`.
3. Dentro da fila, sempre ler o estado **fresco**: `const msg = await starterDe(thread)` e `statusDoPost(thread, thread.parent)`. Pare de confiar em `interaction.message.embeds[0]`. `atualizarPost` deve usar o embed fresco como base, mas continuar respondendo com `interaction.update` quando houver `interaction.message`.
4. Validações de estado (já assumida / já finalizado) dentro da fila, com resposta via `efemero`.

## Atenção
- Interações têm 3 s para responder. Se a fila puder demorar, faça `interaction.deferUpdate()` antes de entrar na fila e use `msg.edit` + `followUp` no lugar de `interaction.update`.
- `thread.appliedTags` pode estar desatualizado no cache. Para o status, use `await thread.fetch()` antes de `statusDoPost`.

## Critérios de aceite
- [x] Duas contas clicando "Assumir" ao mesmo tempo: a primeira assume, a segunda recebe "Já assumida por…".
- [x] Aprovar duas vezes seguidas não duplica a mensagem de aprovação.
