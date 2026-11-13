# 14 — Motivo de reprovação por categoria

**Tipo:** funcionalidade · **Tamanho:** M

## Problema
O motivo de reprovação é texto livre, então não dá para responder "por que mais reprovamos?". O `/relatorio` só mostra os sistemas mais reprovados.

## Comportamento esperado
- O modal de Reprovar ganha um select **Categoria** (obrigatório) acima do texto **Detalhes**.
- Categorias iniciais (revisar com o time antes de implementar):
  - Sem acesso ao computador/banco
  - Banco de dados protegido/criptografado
  - Sistema não permite exportar
  - Dados incompletos ou corrompidos
  - Sistema web/nuvem sem exportação
  - Outro
- "Detalhes" vira opcional, **exceto** com "Outro": se vier vazio, responder efêmero pedindo o detalhe (modal não tem obrigatoriedade condicional).
- O embed ganha o campo **Categoria** (inline), e o Motivo continua com o detalhe.
- Mensagem no post e log incluem a categoria.
- `/relatorio`, resumo semanal e `/metricas` ganham **Motivos de reprovação** (top 5 com contagem). Posts antigos sem categoria contam como "Sem categoria".

## Onde mexer
- `src/config.js`: `MOTIVOS_REPROVACAO = [{ value, label }]`.
- `src/post.js`: `CAMPO.categoria = 'Categoria'`.
- `src/interactions/validacao.js`:
  - `MODAIS.reprovar` com `LabelBuilder().setStringSelectMenuComponent(...)` (mesmo padrão do select "virada" do Aprovar) + `texto('motivo', 'Detalhes', { required: false })`;
  - `onModal` → `reprovar`: `f.getStringSelectValues('categoria')[0]`;
  - `reabrir`: limpar `[CAMPO.categoria, null]`.
- `src/historico.js`, `lerEmbed`: ler `categoria`.
- `src/commands/relatorio.js`, `calcularMetricas`: contar `categoria` dos reprovados (reaproveitar `top`); `montarEmbedRelatorio`: novo campo.
- `src/metricasMes.js`: mesma contagem, se fizer sentido no fechamento.

## Critérios de aceite
- [ ] Reprovar sem escolher categoria não é possível.
- [ ] "Outro" sem detalhe é recusado com mensagem clara.
- [ ] O `/relatorio` mostra a contagem por categoria, incluindo "Sem categoria" para posts antigos.
