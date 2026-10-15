import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { STATUS } from './config.js';

export const CAMPO = {
  cliente: 'Cliente',
  sistema: 'Sistema',
  acesso: 'Acesso',
  dados: 'Dados para importar',
  obs: 'Observações',
  solicitante: 'Solicitante (Comercial)',
  status: 'Status',
  responsavel: 'Responsável (Importação)',
  virada: 'Tem como trazer e fazer virada de chave?',
  metodo: 'Método de importação',
  motivo: 'Motivo',
  assumida: 'Assumida em',
  tempo: 'Tempo até aprovação',
};

export function embedInicial({ cliente, sistema, acesso, dados, obs, solicitanteId }) {
  return new EmbedBuilder()
    .setTitle(`📋 ${cliente}`)
    .setColor(STATUS.aguardando.color)
    .addFields(
      { name: CAMPO.cliente, value: cliente, inline: true },
      { name: CAMPO.sistema, value: sistema, inline: true },
      { name: CAMPO.acesso, value: acesso },
      { name: CAMPO.dados, value: dados.map((d) => `✅ ${d}`).join('\n') },
      ...(obs ? [{ name: CAMPO.obs, value: obs }] : []),
      { name: CAMPO.solicitante, value: `<@${solicitanteId}>`, inline: true },
      { name: CAMPO.status, value: statusTexto('aguardando'), inline: true },
    )
    .setFooter({ text: 'Só suba o ticket de importação com o status 🟢 Aprovado.' })
    .setTimestamp();
}

export const statusTexto = (key) => `${STATUS[key].emoji} ${STATUS[key].label}`;

/** Cria ou substitui um campo do embed, mantendo a ordem dos demais. */
export function comCampo(embed, name, value, inline = false) {
  const e = EmbedBuilder.from(embed);
  const fields = e.data.fields ?? [];
  const i = fields.findIndex((f) => f.name === name);
  if (value === null) {
    if (i >= 0) fields.splice(i, 1);
  } else if (i >= 0) {
    fields[i] = { name, value, inline };
  } else {
    fields.push({ name, value, inline });
  }
  e.setFields(fields);
  return e;
}

export function comStatus(embed, key) {
  return comCampo(embed, CAMPO.status, statusTexto(key), true).setColor(STATUS[key].color);
}

export function solicitanteDe(embed) {
  const f = embed.fields?.find((x) => x.name === CAMPO.solicitante);
  return f?.value.match(/<@!?(\d+)>/)?.[1] ?? null;
}

export function assumidaEm(embed) {
  const f = embed.fields?.find((x) => x.name === CAMPO.assumida);
  const unix = f?.value.match(/<t:(\d+)/)?.[1];
  return unix ? new Date(Number(unix) * 1000) : null;
}

export function botoes(status) {
  const finalizado = status === 'aprovado' || status === 'reprovado';
  if (finalizado) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('val:reabrir').setLabel('Reabrir').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('val:assumir').setLabel('Assumir').setEmoji('🙋').setStyle(ButtonStyle.Secondary).setDisabled(status === 'analise'),
      new ButtonBuilder().setCustomId('val:aprovar').setLabel('Aprovar').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('val:info').setLabel('Pedir info').setEmoji('❓').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('val:reprovar').setLabel('Reprovar').setEmoji('⛔').setStyle(ButtonStyle.Danger),
    ),
  ];
}
