# 12 — Transferir responsável

**Tipo:** funcionalidade · **Tamanho:** M

## Problema
Quando quem assumiu sai de férias, adoece ou está sobrecarregado, não dá para passar o post para outra pessoa: "Assumir" fica desabilitado em 🔵. A Gestão também não consegue distribuir a fila.

## Comportamento esperado
- Comando `/transferir pessoa:@usuario`, usado **dentro de um post** do fórum.
- Pode usar: Importação e Gestão.
- `pessoa` precisa ter o cargo Importação; senão, efêmero de erro.
- Funciona em 🟡, 🔵 e 🟠:
  - 🟡: vira 🔵 com a pessoa como responsável e `Assumida em` = agora (atribuição);
  - 🔵 / 🟠: troca só o Responsável. `Assumida em` e Pausas **não mudam**, e o tempo continua contando.
- Mensagem no post: `🔁 @A transferiu esta validação para @B.`, mencionando só B. Log `🔁 **Transferida** <post> — @A → @B`.
- Fora de um post, ou em post finalizado: efêmero explicando.

## Onde mexer
- Novo `src/commands/transferir.js` com `data` (SlashCommandBuilder + `addUserOption('pessoa', required)`) e `execute`.
- `src/index.js`: incluir no `COMANDOS`.
- `src/interactions/validacao.js`: **exportar** `atualizarPost`. Ele já trata `interaction.message` indefinido: busca a starter e faz `msg.edit`. No slash command, responda depois com `interaction.reply(efemero('Transferido.'))`.
- Se a spec 08 existir, rodar dentro de `emFila(thread.id, …)`.
- `README.md`: documentar o comando.

## Atenção
- Métricas: o tempo inteiro, desde `Assumida em`, fica creditado ao responsável final. Documente isso no README; não vale a pena dividir o tempo.
- Para checar o cargo da pessoa, use `interaction.options.getMember('pessoa')` + `hasRole`.

## Critérios de aceite
- [ ] A transfere um post 🔵 para B: o embed mostra B, "Assumida em" não muda e B é mencionado.
- [ ] Transferir para alguém do Comercial é recusado.
- [ ] A Gestão atribui um 🟡 a B → vira 🔵 com B.
