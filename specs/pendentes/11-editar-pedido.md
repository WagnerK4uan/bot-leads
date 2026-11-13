# 11 — Comercial edita o pedido

**Tipo:** funcionalidade · **Tamanho:** G

## Problema
Se o comercial digitar o AnyDesk errado, esquecer um tipo de dado ou errar o nome do sistema, não tem como corrigir: fica um comentário solto no post e o embed continua errado. O nome do sistema errado também atrapalha o `/historico`.

## Comportamento esperado
- Botão **✏️ Editar pedido** na segunda linha de botões (a mesma do Cancelar da spec 10, ou crie-a), visível em 🟡 e 🟠.
- Pode usar: o solicitante e a Gestão. Os outros recebem efêmero "Só quem abriu o pedido pode editar."
- Abre o mesmo formulário do `/validacao` **já preenchido** com os valores atuais.
- Ao enviar:
  - atualiza Cliente, Sistema, Acesso, Dados e Observações no embed, e o título `📋 <cliente>`;
  - renomeia a thread para `<cliente> — <sistema>` (máximo 100 caracteres);
  - recalcula as tags de dados, mantendo a tag de status;
  - posta `✏️ @X editou o pedido: Acesso, Dados` (só os campos que mudaram), sem menções;
  - se o post estava 🟠, conta como resposta e volta para 🔵/🟡 (mesma regra do `onThreadMessage`);
  - log `✏️ **Editada** <post> — por @X (Acesso, Dados)`.

## Onde mexer
- `src/commands/validacao.js`: extrair a montagem do modal para `export function modalValidacao({ customId, valores } = {})`. Ela preenche com `TextInputBuilder.setValue(...)` e marca `default: true` nas opções de Dados já escolhidas. O `/validacao` passa a chamar `modalValidacao({ customId: 'validacao:nova' })`.
- `src/post.js`: `lerPedido(embed)` → `{ cliente, sistema, acesso, dadosValores, obs }`. O campo Dados está como linhas `✅ <label>`; converta de volta via `DADOS` (label → value). Se o Acesso for `ACESSO_REMOVIDO` (spec 05), deixe vazio.
- `src/util.js`: `setTagsDeDados(thread, forum, valores)` reaproveitando `tagsDeDados` e mantendo a tag de status (o inverso do `setStatus`).
- `src/interactions/validacao.js`:
  - `editar` em `onButton`, antes da checagem de cargo (junto com o `cancelar` da spec 10). Sugestão: `const ACOES_SOLICITANTE = ['cancelar', 'editar']`;
  - `onModal` com customId `valm:editar` (registrado em `src/index.js` pelo prefixo `valm:`, nada a mudar lá);
  - extrair de `onThreadMessage` uma função `voltarDeInfo(thread, msg, autor)` e reusar aqui.
- O modal é aberto dentro do post, então `interaction.channel` é a thread (igual aos outros modais `valm:`).

## Atenção
- `Observações` pode não existir no embed: use `comCampo(..., obs || null)`. Para manter a ordem, `comCampo` insere no fim; aceitável, ou reconstrua com `embedInicial` + os campos de status/resultado.
- Chamar `invalidar(thread.id)`, porque o sistema pode ter mudado (afeta `/historico`).

## Critérios de aceite
- [ ] O solicitante corrige o AnyDesk; o embed mostra o novo valor e o post registra a edição.
- [ ] Trocar o sistema renomeia a thread e o `/historico` reflete a troca.
- [ ] Editar um 🟠 volta para 🔵 mencionando o responsável.
- [ ] O botão não aparece em 🔵, 🟢, 🔴 ou ⚪.
