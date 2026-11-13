# Specs de melhorias do bot

Cada arquivo é uma melhoria independente, pronta para ser executada sozinha (ex.: "implemente specs/pendentes/03-tempo-em-horas-uteis.md").
A numeração segue a ordem recomendada.

As specs ficam em `pendentes/` até serem implementadas; ao finalizar uma, ela é movida para `concluidas/` (com `git mv`) e o link na tabela abaixo é atualizado.

| # | Spec | Tipo | Tamanho | Depende de / conversa com |
|---|---|---|---|---|
| 01 | [Pausa esquecida também gera lembrete](concluidas/01-lembrete-pausa-esquecida.md) | Correção | P | 02 |
| 02 | [Lembretes só no expediente](concluidas/02-lembretes-so-no-expediente.md) | Correção | P | 07 |
| 03 | [Tempo do post em horas úteis](concluidas/03-tempo-em-horas-uteis.md) | Correção | M | 09 (testes), 04 |
| 04 | [Aprovar/Reprovar mantém o responsável](concluidas/04-manter-responsavel-ao-finalizar.md) | Correção | P | 03 |
| 05 | [Ocultar acesso/senha ao finalizar](pendentes/05-ocultar-acesso-ao-finalizar.md) | Segurança | P | 10, 11 |
| 06 | [Proteção contra crash](concluidas/06-protecao-contra-crash.md) | Robustez | P | — |
| 07 | [Feriados no cálculo de horas úteis](concluidas/07-feriados.md) | Robustez | P | 02, 09 |
| 08 | [Trava contra clique duplo](concluidas/08-trava-clique-duplo.md) | Robustez | M | 12 |
| 09 | [Testes com node --test](concluidas/09-testes.md) | Robustez | M | — |
| 10 | [Comercial cancela o pedido](concluidas/10-cancelar-pedido.md) | Funcionalidade | M | 05, 11 |
| 11 | [Comercial edita o pedido](concluidas/11-editar-pedido.md) | Funcionalidade | G | 05, 10, 15 |
| 12 | [Transferir responsável](concluidas/12-transferir-responsavel.md) | Funcionalidade | M | 08 |
| 13 | [Aviso de cliente duplicado](concluidas/13-aviso-duplicidade.md) | Funcionalidade | P | — |
| 14 | [Motivo de reprovação por categoria](concluidas/14-motivo-reprovacao-categorizado.md) | Funcionalidade | M | — |
| 15 | [Qualquer pessoa do Comercial responde o 🟠](concluidas/15-resposta-de-qualquer-comercial.md) | Funcionalidade | P | 11 |
| 16 | [Comando /minhas](pendentes/16-comando-minhas.md) | Funcionalidade | M | — |

Tamanho: P = até ~30 linhas, M = ~30–100, G = mais de 100.

## Regras para todas as specs
- Nada de banco de dados: o estado continua nas tags do post e nos campos do embed (`src/post.js`, `CAMPO`).
- Posts antigos precisam continuar sendo lidos por `lerEmbed` em `src/historico.js`.
- Toda ação que altera um post chama `invalidar(thread.id)` (via `atualizarPost` em `src/interactions/validacao.js`).
- Variável nova no `.env`: adicionar em `src/config.js`, `.env.example` e na tabela "Ajustes comuns" do `README.md`.
- Mudou um comportamento visível? Atualize o `README.md` da raiz.
- Ao terminar a spec: mover o arquivo de `pendentes/` para `concluidas/` e atualizar o link na tabela deste README.
- Não commitar: no fim, sugerir uma mensagem de commit.
