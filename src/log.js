import { ChannelType } from 'discord.js';
import { findChannel } from './util.js';

export async function registrarLog(guild, content) {
  const canal = findChannel(guild, 'log', ChannelType.GuildText);
  if (!canal) return;
  await canal.send({ content, allowedMentions: { parse: [] } }).catch((e) => console.error('Falha ao registrar log:', e.message));
}
