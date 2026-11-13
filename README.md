# Bot de Validação de Importação

Organiza o servidor onde o **Comercial** pede e a **Importação** valida se dá para importar os dados do sistema antigo de um lead.

- `/validacao` abre um formulário (Cliente, Sistema, Acesso, Dados, Observações) e cria um **post padronizado no fórum `#validacoes`** com status 🟡.
- Se já existe um post aberto (🟡 🔵 🟠) para o mesmo cliente (sem diferenciar acento, maiúsculas ou espaços), o post novo é criado mesmo assim, mas quem abriu recebe um aviso com o link do outro e o post novo ganha a mensagem "⚠️ Possível duplicata de …" para a Importação ver antes de assumir.
- Botões no post (só Importação/Gestão): **🙋 Assumir**, **⏸️ Pausar / ▶️ Retomar** (só Importação; o tempo pausado não conta), **✅ Aprovar** (virada de chave + método), **❓ Pedir info**, **⛔ Reprovar** (categoria obrigatória + detalhes; "Outro" exige o detalhe), **↩️ Reabrir**. Ao aprovar/reprovar, o "Tempo de validação" do post é contado em horas úteis desde que foi assumida, descontando as pausas — o mesmo número de `/relatorio` e `/metricas`. Quem assumiu continua como responsável mesmo que outra pessoa (ex.: a Gestão) aprove ou reprove; se ninguém assumiu, quem clicou vira o responsável. Ações no mesmo post rodam uma de cada vez: se duas pessoas clicam juntas, só a primeira vale e a outra recebe um aviso ("Já assumida por…", "Este post já foi finalizado…").
- **✏️ Editar pedido** (solicitante ou Gestão, só em 🟡 e 🟠): abre o formulário do `/validacao` já preenchido. Atualiza o post, renomeia a thread se o cliente ou o sistema mudar, troca as tags de dados e registra no post quais campos mudaram. Num post 🟠, editar conta como resposta e ele volta para 🔵.
- **🚫 Cancelar pedido** (solicitante ou Gestão): fecha um post aberto como ⚪ Cancelado, com motivo opcional. Cancelado não conta como aberto, aprovado nem reprovado (a taxa de aprovação não muda), sai do `/pendentes` e dos lembretes, e pode ser reaberto com ↩️ Reabrir. Depois de atualizar o bot, rode `npm run setup` para criar a tag "Cancelado" no fórum.
- O solicitante é mencionado em cada resposta. Quando um post 🟠 recebe resposta do solicitante ou de qualquer pessoa do Comercial/Gestão que não seja da Importação (ex.: um colega cobrindo férias), ele volta sozinho para 🔵 com o mesmo responsável (ou 🟡, se ninguém tinha assumido). Comentários da Importação não tiram o post do 🟠.
- Lembrete automático para posts parados há mais de `SLA_HORAS` horas úteis (seg–sex, 8h–18h, fora os `FERIADOS`), enviado só dentro do expediente — o que vence à noite ou no fim de semana é cobrado na primeira varredura do próximo dia útil. Post com o tempo pausado há mais de `SLA_PAUSA_HORAS` horas úteis recebe um lembrete de pausa para o responsável.
- `/pendentes` lista a fila em aberto.
- `/minhas` mostra só o que é seu (resposta visível só para você). Importação: "Com você", os posts 🔵/🟠 em que você é o responsável, dos mais antigos para os mais novos, com o tempo desde "Assumida em" e ⏸️ se pausado, mais quantos 🟡 aguardam alguém assumir. Comercial: "Seus pedidos" em aberto e os finalizados (🟢 🔴 ⚪) nos últimos 7 dias. Gestão e administradores veem as duas visões.
- `/transferir pessoa:@usuario` (Importação/Gestão, dentro de um post aberto): passa a validação para outra pessoa com o cargo Importação, que é mencionada no post. Em 🟡 o post vira 🔵 com a pessoa como responsável e o tempo começa agora; em 🔵/🟠 só o responsável muda — "Assumida em" e as pausas ficam, e o tempo continua contando. Nas métricas, todo o tempo desde "Assumida em" fica com o responsável final (o tempo não é dividido entre quem passou e quem recebeu).
- `/relatorio [periodo]` (Gestão/Importação): volume por status, taxa de aprovação, tempo médio até assumir e de análise (horas úteis), números por responsável, sistemas mais pedidos/reprovados e os motivos de reprovação por categoria (top 5; posts antigos contam como "Sem categoria").
- Resumo semanal: toda segunda, no início do expediente, o mesmo relatório dos últimos 7 dias sai em `#gestao`.
- `/metricas [mes]` (Importação/Gestão): fechamento do mês em `#metricas-importacao` — aprovadas, reprovadas, tempo médio de análise (de assumida até aprovar/reprovar, horas úteis), números por responsável, motivos de reprovação por categoria e aviso das validações ainda pendentes. Sem `mes`, usa o mês anterior.
- Fechamento mensal: no 1º dia útil de cada mês, no início do expediente, o `/metricas` do mês anterior sai sozinho em `#metricas-importacao`.
- `/historico sistema:<nome>` (com autocomplete) lista as validações anteriores daquele sistema e o método usado. Ao abrir uma validação de um sistema já analisado, o bot posta esse histórico no próprio post.
- `#log-validacoes` guarda o histórico (aberta / aprovada / reprovada).
- Boas-vindas: tutorial com imagens em `#boas-vindas`, botões para escolher setor e DM para quem entra.

Não há banco de dados: o status mora nas tags do post e nos campos do embed.

## 1. Criar o bot (feito por você, uma vez)

1. Acesse <https://discord.com/developers/applications> › **New Application** › nome "Bot Validação".
2. **General Information**: copie o **Application ID** → `CLIENT_ID`. (Opcional: coloque um ícone.)
3. **Bot**:
   - **Reset Token** → copie → `DISCORD_TOKEN`. *Não compartilhe esse token com ninguém.*
   - Em **Privileged Gateway Intents**, ligue **Server Members Intent**.
4. No Discord, **Configurações › Avançado › Modo desenvolvedor** ligado. Botão direito no ícone do servidor › **Copiar ID do servidor** → `GUILD_ID`.
5. Copie `.env.example` para `.env` e preencha os três valores.
6. Convide o bot (troque `CLIENT_ID`):

   ```
   https://discord.com/oauth2/authorize?client_id=1551637009901031525&scope=bot+applications.commands&permissions=8
   ```

7. **Configurações do servidor › Ativar Comunidade** (obrigatório para canal fórum). Pode apontar regras/atualizações para qualquer canal; depois do setup troque para `#regras-e-fluxo` e `#avisos`.
8. **Configurações do servidor › Cargos**: arraste o cargo do bot para o **topo** da lista (ele precisa estar acima de Comercial/Importação/Gestão para atribuí-los).

## 2. Montar o servidor

```bash
npm install
npm run setup:dry     # mostra o que vai ser criado/alterado, sem mexer em nada
npm run setup         # aplica
```

O setup cria cargos (Gestão, Importação, Comercial), categorias, canais, o fórum com tags e diretrizes, ajusta permissões e publica o tutorial em `#boas-vindas` e as regras em `#regras-e-fluxo`. Pode rodar de novo quando quiser: só cria o que falta. Nada é apagado; canais existentes (ex.: `#geral`) são movidos para a categoria certa.

> Depois do setup, quem ainda não tem cargo só enxerga a área **📌 INÍCIO** até escolher o setor. Avise o time para clicar no botão em `#boas-vindas`.

Para refazer as mensagens fixas (ex.: depois de trocar imagens): `npm run setup -- --republicar`.

## 3. Rodar

```bash
npm start
```

Rodar os testes: `npm test` (funções de data/hora e leitura do embed; não precisa de `.env` nem de rede).

### Hospedagem
- **Discloud**: compacte o projeto **sem** `node_modules` (com `.env`, `discloud.config`, `assets/`, `src/`, `package.json`) e envie pelo site ou `/upload` no bot da Discloud.
- **Railway / Fly.io / VPS**: há um `Dockerfile`. Configure as variáveis do `.env` no painel em vez de enviar o arquivo.

Use só **uma** instância rodando por vez (senão os lembretes saem em dobro).

Erros inesperados vão para o log e o bot continua no ar. Uma exceção não capturada encerra o processo com código 1 para a hospedagem reiniciar (na Discloud, `AUTORESTART=true` no `discloud.config`). Ctrl+C e deploy (`SIGTERM`) desconectam do Discord antes de sair.

## Imagens do tutorial
Ficam em `assets/` e são geradas de `tools/tutorial/index.html` com `npm run assets` (Edge headless). Para usar prints reais, substitua os PNGs mantendo os nomes e rode `npm run setup -- --republicar`.

## Ajustes comuns
| O que | Onde |
|---|---|
| Tempo até o lembrete | `SLA_HORAS` no `.env` |
| Tempo pausado até o lembrete de pausa | `SLA_PAUSA_HORAS` no `.env` (padrão 8 h úteis) |
| Horário de expediente | `EXPEDIENTE_INICIO` / `EXPEDIENTE_FIM` |
| Feriados (não contam horas úteis, sem lembretes nem fechamento mensal) | `FERIADOS` no `.env`: `MM-DD` para fixos (ex.: `12-25`), `AAAA-MM-DD` para datas únicas (Carnaval, Corpus Christi), separados por vírgula |
| Desligar o resumo semanal | `RESUMO_SEMANAL=false` no `.env` |
| Desligar o fechamento mensal | `METRICAS_MENSAL=false` no `.env` |
| Tipos de dados do formulário | `DADOS` em `src/config.js` |
| Categorias de reprovação | `MOTIVOS_REPROVACAO` em `src/config.js` |
| Nomes de canais/cargos | `CHANNELS` / `ROLES` em `src/config.js` (rode o setup de novo) |
| Textos do tutorial | `src/welcome.js` |

Observação: o Discord aceita no máximo 5 tags por post, então o post recebe a tag de status + até 4 tags de dados. A lista completa sempre aparece no embed.
