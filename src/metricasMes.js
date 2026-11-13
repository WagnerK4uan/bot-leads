import { ChannelType, EmbedBuilder } from 'discord.js';
import { STATUS_ABERTOS, STATUS } from './config.js';
import { fmtHoras, media } from './commands/relatorio.js';
import { carregarPosts } from './historico.js';
import { findChannel, horasUteisSemPausa, idade, partes } from './util.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MAX_PENDENTES = 10;

/** "2026-10" no fuso do expediente. Strings nesse formato comparam na ordem certa. */
export const chaveMes = (date) => partes(date).dia.slice(0, 7);

export function nomeMes(chave) {
  const [ano, mes] = chave.split('-').map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

/** Chave do mês `n` meses antes do mês de `agora` (n = 1 é o mês anterior). */
export function mesAntes(n, agora = new Date()) {
  const [ano, mes] = chaveMes(agora).split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const marcaMes = (chave) => `Mês ${chave}`;

/**
 * Validações finalizadas (aprovadas/reprovadas) no mês e o que ficou pendente até o fim dele.
 * A validação conta no mês em que foi finalizada; o tempo é de assumida até aprovar/reprovar.
 */
export function calcularMes(registros, chave) {
  const finalizadas = registros.filter(
    (r) => (r.status === 'aprovado' || r.status === 'reprovado') && r.finalizadaEm && chaveMes(r.finalizadaEm) === chave,
  );
  const tempos = [];
  const responsaveis = new Map(); // id -> { aprovado, reprovado, horas: [] }
  let semTempo = 0;

  for (const r of finalizadas) {
    const h = r.assumidaEm ? horasUteisSemPausa(r.assumidaEm, r.finalizadaEm, r.pausas) : null;
    if (h === null) semTempo++;
    else tempos.push(h);
    if (r.responsavelId) {
      const p = responsaveis.get(r.responsavelId) ?? { aprovado: 0, reprovado: 0, horas: [] };
      p[r.status]++;
      if (h !== null) p.horas.push(h);
      responsaveis.set(r.responsavelId, p);
    }
  }

  const pendentes = registros
    .filter((r) => STATUS_ABERTOS.includes(r.status) && chaveMes(r.criadoEm) <= chave)
    .sort((a, b) => a.criadoEm - b.criadoEm);

  return {
    aprovadas: finalizadas.filter((r) => r.status === 'aprovado').length,
    reprovadas: finalizadas.filter((r) => r.status === 'reprovado').length,
    mediaAnalise: media(tempos),
    semTempo,
    responsaveis: [...responsaveis.entries()]
      .map(([id, p]) => ({ id, ...p, media: media(p.horas) }))
      .sort((a, b) => b.aprovado + b.reprovado - (a.aprovado + a.reprovado)),
    pendentes,
  };
}

export function montarEmbedMes(m, chave) {
  const total = m.aprovadas + m.reprovadas;
  const embed = new EmbedBuilder().setTitle(`⏱️ Fechamento — ${nomeMes(chave)}`).setColor(0x3498db);

  embed.addFields(
    { name: 'Aprovadas', value: `🟢 **${m.aprovadas}**`, inline: true },
    { name: 'Reprovadas', value: `🔴 **${m.reprovadas}**`, inline: true },
    { name: 'Total finalizadas', value: `**${total}**`, inline: true },
    {
      name: 'Tempo médio de análise',
      value: `**${fmtHoras(m.mediaAnalise)}**${m.semTempo ? `\n_${m.semTempo} sem horário de assumida, fora da média_` : ''}`,
    },
  );

  if (m.responsaveis.length) {
    embed.addFields({
      name: 'Por responsável',
      value: m.responsaveis
        .slice(0, 15)
        .map((p) => `<@${p.id}> — 🟢 ${p.aprovado} · 🔴 ${p.reprovado} · ⏱️ ${fmtHoras(p.media)}`)
        .join('\n'),
    });
  }

  if (m.pendentes.length) {
    const linhas = m.pendentes
      .slice(0, MAX_PENDENTES)
      .map((r) => `${STATUS[r.status].emoji} ${r.thread} — aberta há ${idade(r.criadoEm)}`);
    if (m.pendentes.length > MAX_PENDENTES) linhas.push(`… e mais ${m.pendentes.length - MAX_PENDENTES}`);
    embed.addFields({ name: `⚠️ ${m.pendentes.length} pendente(s)`, value: linhas.join('\n') });
  } else if (!total) {
    embed.setDescription('Nenhuma validação finalizada no mês.');
  }

  return embed.setFooter({ text: `Horas úteis, de assumida até aprovar/reprovar.\n${marcaMes(chave)}` });
}

export const canalMetricas = (guild) => findChannel(guild, 'metricas', ChannelType.GuildText);

/** Já existe fechamento desse mês postado pelo bot? */
export async function jaPublicado(canal, chave) {
  const recentes = await canal.messages.fetch({ limit: 20 });
  return recentes.some((m) => m.author.id === canal.client.user.id && m.embeds[0]?.footer?.text?.includes(marcaMes(chave)));
}

export async function embedDoMes(guild, chave) {
  const registros = await carregarPosts(guild, { forcar: true });
  return montarEmbedMes(calcularMes(registros, chave), chave);
}

/** Posta o fechamento em #metricas-importacao. Retorna a mensagem, ou null se não postou. */
export async function publicarMes(guild, chave, { repetir = false } = {}) {
  const canal = canalMetricas(guild);
  if (!canal) return null;
  if (!repetir && (await jaPublicado(canal, chave))) return null;
  const embed = await embedDoMes(guild, chave);
  return canal.send({ embeds: [embed], allowedMentions: { parse: [] } });
}
