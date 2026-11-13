# 16 — Comando /minhas

**Tipo:** funcionalidade · **Tamanho:** M

## Problema
O `/pendentes` mostra a fila inteira. Ninguém tem uma visão rápida de "o que está comigo": a Importação quer ver o que assumiu, e o Comercial quer acompanhar os próprios pedidos.

## Comportamento esperado
`/minhas` (resposta efêmera), com seções conforme o cargo de quem chama:
- **Importação**: "Com você": posts 🔵 e 🟠 onde `responsavelId === eu`, mais antigos primeiro, com tempo desde "Assumida em" e ⏸️ se pausado. No fim, uma linha "🟡 N aguardando alguém assumir → /pendentes".
- **Comercial**: "Seus pedidos": posts abertos onde `solicitanteId === eu`, e "Finalizados nos últimos 7 dias" (🟢/🔴/⚪ com o método ou motivo, via `linhaHistorico`).
- **Gestão** / admin: as duas seções.
- Lista vazia: `🎉 Nada com você agora.`

## Onde mexer
- Novo `src/commands/minhas.js` (`data` + `execute`), incluir no `COMANDOS` em `src/index.js`.
- Dados: `carregarPosts(guild)` em `src/historico.js`. Os registros já têm `status`, `responsavelId`, `solicitanteId`, `assumidaEm`, `pausas`, `finalizadaEm` e `thread`.
- Reaproveitar `idade` (`src/util.js`), `STATUS` e `linhaHistorico`.
- O corte de 3.900 caracteres do `/pendentes` (`src/commands/pendentes.js`): extrair para `src/util.js` como `limitarLinhas(linhas, max = 3900)` e usar nos dois.
- `README.md`: documentar.

## Atenção
- `carregarPosts` tem cache de 2 min, mas toda ação no post chama `invalidar`, então a lista fica atualizada logo depois de assumir ou aprovar.
- Use `deferReply` efêmero: a primeira carga lê todos os posts e pode passar de 3 s.

## Critérios de aceite
- [ ] Uma pessoa da Importação vê só os posts em que é responsável.
- [ ] Um comercial vê os pedidos abertos e os finalizados da última semana.
- [ ] Mais de ~40 itens não estoura o limite do embed.
