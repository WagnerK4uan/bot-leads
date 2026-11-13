import { createServer } from 'node:http';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { env } from './config.js';
import * as historico from './commands/historico.js';
import * as metricas from './commands/metricas.js';
import * as minhas from './commands/minhas.js';
import * as pendentes from './commands/pendentes.js';
import * as relatorio from './commands/relatorio.js';
import * as transferir from './commands/transferir.js';
import * as validacao from './commands/validacao.js';
import { carregarPosts } from './historico.js';
import * as botoesValidacao from './interactions/validacao.js';
import { agendarFechamento } from './jobs/fechamentoMensal.js';
import { agendarLembretes } from './jobs/lembretes.js';
import { agendarResumo } from './jobs/resumoSemanal.js';
import { efemero, findForum } from './util.js';
import { onMemberJoin, onSetorButton } from './welcome.js';

export const COMANDOS = [validacao, pendentes, minhas, relatorio, historico, metricas, transferir];

if (!env.token || !env.guildId) {
  console.error('Configure DISCORD_TOKEN e GUILD_ID no arquivo .env (veja .env.example).');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Online como ${c.user.tag}`);
  try {
    const guild = await c.guilds.fetch(env.guildId);
    await guild.commands.set(COMANDOS.map((m) => m.data.toJSON()));
    console.log(`Comandos registrados em ${guild.name}: ${COMANDOS.map((m) => '/' + m.data.name).join(', ')}`);
    // Deixa o histórico pronto para o autocomplete do /historico.
    carregarPosts(guild).catch((e) => console.error('Leitura do histórico falhou:', e.message));
  } catch (e) {
    console.error(`Falha ao registrar comandos no servidor ${env.guildId} (confira GUILD_ID e as permissões do bot):`, e);
  }
  // Os jobs varrem os servidores do cache a cada execução, então são agendados mesmo se o registro acima falhar.
  agendarLembretes(c);
  agendarResumo(c);
  agendarFechamento(c);
});

client.on(Events.Error, (e) => console.error('Erro do client:', e));
client.on(Events.Warn, (m) => console.warn('Aviso do client:', m));

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const cmd = COMANDOS.find((m) => m.data.name === interaction.commandName);
    return cmd?.autocomplete?.(interaction).catch((e) => console.error('Autocomplete falhou:', e.message));
  }
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = COMANDOS.find((m) => m.data.name === interaction.commandName);
      return await cmd?.execute(interaction);
    }
    const id = interaction.customId ?? '';
    if (interaction.isButton()) {
      if (id.startsWith('val:')) return await botoesValidacao.onButton(interaction);
      if (id.startsWith('setor:')) return await onSetorButton(interaction);
    }
    if (interaction.isModalSubmit()) {
      if (id === 'validacao:nova') return await validacao.onModal(interaction);
      if (id.startsWith('valm:')) return await botoesValidacao.onModal(interaction);
    }
  } catch (e) {
    console.error(`Erro em ${interaction.customId ?? interaction.commandName}:`, e);
    const resp = efemero(`Algo deu errado: ${e.message}`);
    if (interaction.deferred || interaction.replied) await interaction.followUp(resp).catch(() => {});
    else if (interaction.isRepliable()) await interaction.reply(resp).catch(() => {});
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild || !message.channel.isThread()) return;
  if (message.channel.parentId !== findForum(message.guild)?.id) return;
  await botoesValidacao.onThreadMessage(message).catch((e) => console.error('Erro ao reabrir pendência:', e.message));
});

client.on(Events.GuildMemberAdd, (member) => onMemberJoin(member).catch((e) => console.error('Boas-vindas falhou:', e.message)));

// Promessa rejeitada sem .catch: loga e segue (no Node ≥ 15 ela derrubaria o processo).
process.on('unhandledRejection', (e) => console.error('Promise rejeitada sem tratamento:', e));
// Exceção síncrona não capturada deixa o processo em estado incerto: loga e sai; a hospedagem reinicia o bot.
process.on('uncaughtException', (e) => {
  console.error('Exceção não capturada:', e);
  process.exit(1);
});
// Deploy/Ctrl+C: fecha a conexão com o Discord antes de sair.
for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, () => {
    console.log(`${sinal} recebido, encerrando.`);
    client.destroy().finally(() => process.exit(0));
  });
}

client.login(env.token);

// Hospedagens como o Render definem PORT e exigem uma porta aberta; o ping externo nela evita que o serviço durma.
if (process.env.PORT) {
  createServer((_req, res) => {
    res.writeHead(client.isReady() ? 200 : 503, { 'Content-Type': 'text/plain' });
    res.end(client.isReady() ? 'ok' : 'conectando');
  }).listen(process.env.PORT, () => console.log(`Health check na porta ${process.env.PORT}`));
}
