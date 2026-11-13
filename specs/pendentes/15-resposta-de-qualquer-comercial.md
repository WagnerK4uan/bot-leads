# 15 — Qualquer pessoa do Comercial responde o 🟠

**Tipo:** funcionalidade · **Tamanho:** P

## Problema
Em `onThreadMessage` ([src/interactions/validacao.js](../src/interactions/validacao.js)), um post 🟠 só volta para 🔵 se quem responder for o **solicitante**:

```js
if (!msg || solicitanteDe(msg.embeds[0]) !== message.author.id) return;
```

Se um colega do Comercial (ou a Gestão, cobrindo férias) responder com a informação, o post continua 🟠 e o lembrete continua cobrando o solicitante.

## Comportamento esperado
O post volta de 🟠 quando responde:
- o solicitante; **ou**
- alguém com o cargo **Comercial** ou **Gestão** que **não** tenha o cargo Importação.

Mensagens da Importação (ex.: "consegue mandar também a senha?") **não** tiram o post do 🟠.

## Onde mexer
- `src/interactions/validacao.js`, `onThreadMessage`: trocar a condição por uma função
  ```js
  const podeResponder = (member, solicitanteId) =>
    member.id === solicitanteId ||
    (memberTemCargo(member, 'comercial', 'gestao') && !memberTemCargo(member, 'importacao'));
  ```
- **Não** use `hasRole` aqui: ele devolve `true` para Administrador, e um admin da Importação tiraria o post do 🟠 sem querer. Crie em `src/util.js` um `temCargo(member, ...keys)` que só olha os cargos.
- `message.member` existe em mensagens de servidor (intents `Guilds` + `GuildMembers` + `GuildMessages` já ligados). Se vier `null`, use `await message.guild.members.fetch(message.author.id)`.
- Se a spec 11 existir, mover essa regra para dentro de `voltarDeInfo`.

## Critérios de aceite
- [ ] Um colega do Comercial responde o 🟠 → volta para 🔵 mencionando o responsável.
- [ ] O responsável da Importação comenta no 🟠 → continua 🟠.
- [ ] O solicitante continua funcionando como hoje.
