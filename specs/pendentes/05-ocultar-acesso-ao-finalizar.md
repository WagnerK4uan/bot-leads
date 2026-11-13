# 05 — Ocultar acesso/senha ao finalizar

**Tipo:** segurança · **Tamanho:** P

## Problema
O campo "Acesso" do embed guarda o AnyDesk/TeamViewer **com a senha** (o próprio formulário pede). Ele fica visível no fórum para todos os cargos para sempre, inclusive em posts aprovados e arquivados há meses.

## Comportamento esperado
- Ao **aprovar** ou **reprovar** (e ao **cancelar**, se a spec 10 existir), o campo "Acesso" vira `🔒 Removido após a validação`.
- Ao **reabrir**, o bot pede o acesso de novo ao solicitante: `↩️ … @solicitante, envie o acesso ao PC do cliente novamente aqui no post` (ou "use ✏️ Editar", se a spec 11 existir).

## Onde mexer
- `src/post.js`: constante `ACESSO_REMOVIDO = '🔒 Removido após a validação'`.
- `src/interactions/validacao.js`: nos `campos` de aprovar e reprovar, adicionar `[CAMPO.acesso, ACESSO_REMOVIDO]`. `comCampo` substitui no mesmo lugar e o campo original não é inline, então a ordem não muda.
- Ramo `reabrir`: se o campo atual for `ACESSO_REMOVIDO`, mencionar o solicitante na mensagem (`solicitanteDe(embed)`).

## Fora do escopo
- Posts antigos já finalizados continuam com a senha. Se quiser limpar, um script único `node src/limparAcessos.js` que percorre `carregarPosts` e edita os finalizados. Faça só se o usuário pedir.
- Senha colada no chat do post pelo comercial: não dá para controlar.

## Critérios de aceite
- [ ] Depois de aprovar ou reprovar, o embed não mostra mais o AnyDesk/senha.
- [ ] Reabrir pede o acesso ao solicitante.
- [ ] `/historico` e as métricas não são afetados (não usam esse campo).
