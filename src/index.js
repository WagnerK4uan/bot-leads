import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { env } from './config.js';
import * as pendentes from './commands/pendentes.js';
import * as validacao from './commands/validacao.js';
import * as botoesValidacao from './interactions/validacao.js';
import { agendarLembretes } from './jobs/lembretes.js';
import { efemero, findForum } from './util.js';
import { onMemberJoin, onSetorButton } from './welcome.js';

export const COMANDOS = [validacao, pendentes];

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
  const guild = await c.guilds.fetch(env.guildId);
  await guild.commands.set(COMANDOS.map((m) => m.data.toJSON()));
  console.log(`Comandos registrados em ${guild.name}: ${COMANDOS.map((m) => '/' + m.data.name).join(', ')}`);
  agendarLembretes(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
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

client.login(env.token);
