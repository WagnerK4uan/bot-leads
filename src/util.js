import { ChannelType, MessageFlags } from 'discord.js';
import { CHANNELS, DADOS, MAX_TAGS_DADOS, ROLES, STATUS, env } from './config.js';

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

/** Troca as tags de dados preservando a tag de status (o inverso de setStatus). */
export async function setTagsDeDados(thread, forum, valores) {
  const statusIds = new Set(Object.values(STATUS).map((s) => tagId(forum, s.tag)));
  const status = thread.appliedTags.filter((id) => statusIds.has(id));
  await thread.setAppliedTags([...status, ...tagsDeDados(forum, valores, MAX_TAGS_DADOS)].slice(0, 5));
}

export const efemero = (content) => ({ content, flags: MessageFlags.Ephemeral });

// Partes de data no fuso do expediente (o servidor de hospedagem costuma estar em UTC).
// Criar o formatter é caro e horasUteis() chama partes() a cada 5 min do intervalo.
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: env.timezone,
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function partes(date) {
  const fmt = formatter.formatToParts(date);
  const get = (t) => fmt.find((p) => p.type === t).value;
  return { weekday: get('weekday'), hour: Number(get('hour')), dia: `${get('year')}-${get('month')}-${get('day')}` };
}

// Recebe as partes já calculadas: horasUteis() passa por aqui a cada 5 min do intervalo.
const diaUtil = ({ weekday, dia }) =>
  weekday !== 'Sat' && weekday !== 'Sun' && !env.feriados.has(dia) && !env.feriados.has(dia.slice(5));

/** Seg–sex e fora dos feriados de FERIADOS ("MM-DD" ou "AAAA-MM-DD"). */
export const ehDiaUtil = (date) => diaUtil(partes(date));

export function emExpediente(date) {
  const p = partes(date);
  return diaUtil(p) && p.hour >= env.expedienteInicio && p.hour < env.expedienteFim;
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

/** Horas úteis entre as datas descontando as pausas (pausa aberta conta até `fim`). */
export function horasUteisSemPausa(inicio, fim, pausas = []) {
  const pausado = pausas.reduce((s, p) => s + horasUteis(p.inicio, p.fim ?? fim), 0);
  return Math.max(0, horasUteis(inicio, fim) - pausado);
}

/** "35 min úteis", "2 h úteis", "2 h 10 min úteis" ou "menos de 5 min úteis". */
export function fmtDuracaoUtil(horas) {
  if (horas < 5 / 60) return 'menos de 5 min úteis';
  const total = Math.round(horas * 60);
  const h = Math.floor(total / 60);
  const min = total % 60;
  if (!h) return `${min} min úteis`;
  return min ? `${h} h ${min} min úteis` : `${h} h úteis`;
}

export function idade(date) {
  const min = Math.floor((Date.now() - date.getTime()) / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
