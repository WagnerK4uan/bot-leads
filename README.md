# Bot de Validação de Importação

Organiza o servidor onde o **Comercial** pede e a **Importação** valida se dá para importar os dados do sistema antigo de um lead.

- `/validacao` abre um formulário (Cliente, Sistema, Acesso, Dados, Observações) e cria um **post padronizado no fórum `#validacoes`** com status 🟡.
- Botões no post (só Importação/Gestão): **🙋 Assumir**, **✅ Aprovar** (virada de chave + método), **❓ Pedir info**, **⛔ Reprovar**, **↩️ Reabrir**.
- O solicitante é mencionado em cada resposta; quando ele responde um post 🟠, o post volta sozinho para 🟡.
- Lembrete automático para posts parados há mais de `SLA_HORAS` horas úteis (seg–sex, 8h–18h).
- `/pendentes` lista a fila em aberto.
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

### Hospedagem
- **Discloud**: compacte o projeto **sem** `node_modules` (com `.env`, `discloud.config`, `assets/`, `src/`, `package.json`) e envie pelo site ou `/upload` no bot da Discloud.
- **Railway / Fly.io / VPS**: há um `Dockerfile`. Configure as variáveis do `.env` no painel em vez de enviar o arquivo.

Use só **uma** instância rodando por vez (senão os lembretes saem em dobro).

## Imagens do tutorial
Ficam em `assets/` e são geradas de `tools/tutorial/index.html` com `npm run assets` (Edge headless). Para usar prints reais, substitua os PNGs mantendo os nomes e rode `npm run setup -- --republicar`.

## Ajustes comuns
| O que | Onde |
|---|---|
| Tempo até o lembrete | `SLA_HORAS` no `.env` |
| Horário de expediente | `EXPEDIENTE_INICIO` / `EXPEDIENTE_FIM` |
| Tipos de dados do formulário | `DADOS` em `src/config.js` |
| Nomes de canais/cargos | `CHANNELS` / `ROLES` em `src/config.js` (rode o setup de novo) |
| Textos do tutorial | `src/welcome.js` |

Observação: o Discord aceita no máximo 5 tags por post, então o post recebe a tag de status + até 4 tags de dados. A lista completa sempre aparece no embed.
