import { ChannelType } from 'discord.js';
import { env } from '../config.js';
import { calcularMetricas, montarEmbedRelatorio } from '../commands/relatorio.js';
import { carregarPosts } from '../historico.js';
import { findChannel, partes } from '../util.js';

const INTERVALO = 30 * 60_000;
const SEMANA = 7 * 24 * 3_600_000;

/**
 * Toda segunda, a partir do início do expediente, posta em #gestao o resumo dos últimos 7 dias.
 * Não há banco: o rodapé carrega a data da segunda e serve para não repetir após reinício.
 */
export async function publicarResumo(guild, agora = new Date()) {
  const canal = findChannel(guild, 'gestao', ChannelType.GuildText);
  if (!canal) return;
  const marca = `Semana ${partes(agora).dia}`;

  const recentes = await canal.messages.fetch({ limit: 20 });
  const jaFoi = recentes.some((m) => m.author.id === guild.client.user.id && m.embeds[0]?.footer?.text?.includes(marca));
  if (jaFoi) return;

  const registros = await carregarPosts(guild, { forcar: true });
  const embed = montarEmbedRelatorio(calcularMetricas(registros, new Date(agora.getTime() - SEMANA)), '📊 Resumo semanal das validações');
  embed.setFooter({ text: `${embed.data.footer?.text ?? ''}\n${marca}`.trim() });
  await canal.send({ embeds: [embed], allowedMentions: { parse: [] } });
}

export function agendarResumo(client) {
  if (!env.resumoSemanal) return;
  const rodar = () => {
    const { weekday, hour } = partes(new Date());
    if (weekday !== 'Mon' || hour < env.expedienteInicio) return;
    for (const guild of client.guilds.cache.values()) {
      publicarResumo(guild).catch((e) => console.error('Resumo semanal falhou:', e.message));
    }
  };
  setInterval(rodar, INTERVALO);
  rodar();
}
