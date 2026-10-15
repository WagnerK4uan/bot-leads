import { ChannelType, MessageFlags } from 'discord.js';
import { CHANNELS, DADOS, ROLES, STATUS, env } from './config.js';

export const findRole = (guild, key) => guild.roles.cache.find((r) => r.name === ROLES[key].name);

export const findChannel = (guild, key, type) =>
  guild.channels.cache.find((c) => c.name === CHANNELS[key] && (type === undefined || c.type === type));

export const findForum = (guild) => findChannel(guild, 'forum', ChannelType.GuildForum);

export function hasRole(member, ...keys) {
  if (member.permissions.has('Administrator')) return true;
  return keys.some((k) => member.roles.cache.some((r) => r.name === ROLES[k].name));
}

export function tagId(forum, name) {
  return forum.availableTags.find((t) => t.name === name)?.id;
}

/** Chave de STATUS aplicada ao post, ou null. */
export function statusDoPost(thread, forum) {
  for (const [key, s] of Object.entries(STATUS)) {
    const id = tagId(forum, s.tag);
    if (id && thread.appliedTags.includes(id)) return key;
  }
  return null;
}

/** Troca a tag de status preservando as tags de dados. */
export async function setStatus(thread, forum, key) {
  const statusIds = new Set(Object.values(STATUS).map((s) => tagId(forum, s.tag)));
  const outras = thread.appliedTags.filter((id) => !statusIds.has(id));
  const novo = tagId(forum, STATUS[key].tag);
  await thread.setAppliedTags([novo, ...outras].filter(Boolean).slice(0, 5));
}

export function tagsDeDados(forum, valores, limite) {
  return DADOS.filter((d) => valores.includes(d.value))
    .map((d) => tagId(forum, d.tag))
    .filter(Boolean)
    .slice(0, limite);
}

export const efemero = (content) => ({ content, flags: MessageFlags.Ephemeral });

// Partes de data no fuso do expediente (o servidor de hospedagem costuma estar em UTC).
function partes(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: env.timezone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => fmt.find((p) => p.type === t).value;
  return { weekday: get('weekday'), hour: Number(get('hour')) };
}

function emExpediente(date) {
  const { weekday, hour } = partes(date);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return hour >= env.expedienteInicio && hour < env.expedienteFim;
}

/** Horas úteis (seg–sex, dentro do expediente) entre duas datas, com resolução de 5 min. */
export function horasUteis(inicio, fim = new Date()) {
  const passo = 5 * 60 * 1000;
  let total = 0;
  for (let t = inicio.getTime(); t < fim.getTime(); t += passo) {
    if (emExpediente(new Date(t))) total += Math.min(passo, fim.getTime() - t);
  }
  return total / 3_600_000;
}

export function idade(date) {
  const min = Math.floor((Date.now() - date.getTime()) / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
