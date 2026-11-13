# 13 — Aviso de cliente duplicado

**Tipo:** funcionalidade · **Tamanho:** P

## Problema
Dois comerciais (ou o mesmo, sem lembrar) podem abrir validação para o mesmo cliente, e a Importação analisa duas vezes.

## Comportamento esperado
Ao enviar o `/validacao`, se já existir um post **aberto** (🟡 🔵 🟠) com o mesmo cliente (comparação normalizada: sem acento, caixa ou espaços extras):
- o post novo **é criado mesmo assim** (pode ser legítimo, ex.: outra loja do mesmo dono);
- a resposta efêmera ganha: `⚠️ Já existe uma validação em aberto para esse cliente: <post>. Se for o mesmo pedido, cancele um deles.`;
- o post novo recebe a mensagem `⚠️ Possível duplicata de <post> (aberto por @X).`, sem menções, para a Importação ver antes de assumir.

## Onde mexer
- `src/historico.js`: `chaveSistema` já é um normalizador genérico. Exporte um alias `normalizar = chaveSistema` (ou renomeie e ajuste os usos) e use-o para o cliente.
- `src/commands/validacao.js`, `onModal`: depois do `deferReply` e **antes** de `forum.threads.create`, buscar `carregarPosts(guild)` e filtrar `STATUS_ABERTOS.includes(r.status) && normalizar(r.cliente) === normalizar(cliente)`. Depois de criar, montar a resposta e a mensagem.
- `carregarPosts` tem cache de 2 min, mas `invalidar()` (chamado ao criar) zera a validade, então um post criado há segundos já aparece na próxima consulta.

## Critérios de aceite
- [ ] Abrir "Juliana Modas" e depois "juliana  modas" avisa nos dois lugares.
- [ ] Cliente igual mas com o post anterior finalizado: sem aviso.
- [ ] Falha ao consultar o histórico não impede a criação (use `catch` e siga sem aviso).
