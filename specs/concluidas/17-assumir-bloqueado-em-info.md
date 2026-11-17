# 17 — 🟠 Pendente de info não libera o Assumir

**Tipo:** correção · **Tamanho:** P

## Problema
Desde a spec 04 / ad40f2b, ❓ Pedir info mantém o responsável no embed. Mas `botoes()` ([src/post.js](../../src/post.js)) só desabilitava 🙋 Assumir em 🔵 Em análise: em 🟠 o botão voltava a ficar clicável, o post parecia sem dono, e a guarda em `executarBotao` ([src/interactions/validacao.js](../../src/interactions/validacao.js)) também só recusava em `analise`. Ou seja, outra pessoa da Importação podia "assumir" um post 🟠 e tomar a validação de quem pediu a informação.

## Comportamento esperado
- Em 🟠 o 🙋 Assumir fica desabilitado, como em 🔵.
- Clicar em Assumir num post 🔵 ou 🟠 com responsável (ex.: botão antigo de posts que já estavam em 🟠) responde "Já assumida por @X. Use `/transferir`…".
- Post 🟠 sem responsável (legado, de antes da spec 04) continua podendo ser assumido.

## Critérios de aceite
- [x] A assume, A pede info → Assumir desabilitado, Responsável = A.
- [x] B clica Assumir num 🟠 antigo de A → aviso, nada muda.
- [x] Teste de `botoes` cobrindo 🟡/🔵/🟠.
