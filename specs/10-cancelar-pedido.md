# 10 — Comercial cancela o pedido

**Tipo:** funcionalidade · **Tamanho:** M

## Problema
Quando o lead desiste, o post fica 🟡 ou 🟠 para sempre. Ele recebe lembretes e polui o `/pendentes`. Hoje o único jeito de fechar é a Importação **reprovar**, o que distorce a taxa de aprovação e o "Mais reprovados".

## Comportamento esperado
- Novo status **⚪ Cancelado** (tag "Cancelado"), que não conta como aberto, aprovado nem reprovado.
- Botão **🚫 Cancelar pedido** em posts abertos (🟡 🔵 🟠). Pode usar: o **solicitante** do post e a **Gestão**. A Importação não, porque ela tem Reprovar.
- Abre um modal com "Motivo (opcional)" (ex.: "Cliente desistiu").
- Embed: status ⚪, `Motivo: Cancelado: <motivo>`, `Finalizada em`, a pausa aberta é fechada e o acesso é ocultado (spec 05, se existir). Não grava "Tempo de validação".
- Mensagem no post `⚪ @X cancelou o pedido. Motivo: …`, mencionando o responsável se houver; log `⚪ **Cancelada**`; arquivamento em 24 h.
- Botões depois de cancelar: só **↩️ Reabrir** (mesma regra dos finalizados).

## Onde mexer
- `src/config.js`: `STATUS.cancelado = { tag: 'Cancelado', emoji: '⚪', color: 0x95a5a6, label: 'Cancelado' }`. Fica fora de `STATUS_ABERTOS`. Atualize `FORUM_GUIDELINES`.
- **Rodar `npm run setup`** depois do deploy: ele cria as tags que faltam (`src/setup.js`, linha ~156). Limite do Discord: 20 tags por fórum; hoje são 12.
- `src/post.js`, `botoes()`:
  - `finalizado` passa a incluir `cancelado`;
  - a primeira linha já tem 5 botões (o máximo), então crie uma **segunda `ActionRowBuilder`** com `val:cancelar` (estilo Secondary). Se a spec 11 existir, o "✏️ Editar" vai na mesma linha.
- `src/interactions/validacao.js`:
  - em `onButton`, **antes** da checagem de cargo Importação/Gestão, trate `cancelar`: permitido se `solicitanteDe(embed) === interaction.user.id` ou `hasRole(member, 'gestao')`; senão, efêmero "Só quem abriu o pedido pode cancelar.";
  - `MODAIS.cancelar` (customId `valm:cancelar`, campo `motivo` opcional);
  - ramo `cancelar` em `onModal` usando `atualizarPost`;
  - `reabrir`: adicionar `[CAMPO.motivo, null]` (hoje o motivo de reprovação fica no embed ao reabrir; aproveite para corrigir).
- Métricas: `calcularMetricas` em `src/commands/relatorio.js` já itera `STATUS`, então "⚪ Cancelado: N" aparece sozinho. A taxa de aprovação só usa aprovado/reprovado; confira que continua assim. Em `src/metricasMes.js`, opcionalmente uma linha "Canceladas no mês: N".

## Critérios de aceite
- [ ] O solicitante cancela o próprio pedido 🟡; outro comercial recebe a recusa.
- [ ] O post cancelado some do `/pendentes` e dos lembretes.
- [ ] A taxa de aprovação não muda com cancelamentos.
- [ ] Reabrir um cancelado volta para 🟡.
