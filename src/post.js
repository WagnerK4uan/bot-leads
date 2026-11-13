import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { DADOS, STATUS } from './config.js';

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
  tempo: 'Tempo de validação',
  tempoLegado: 'Tempo até aprovação', // nome antigo do campo, ainda presente em posts aprovados antes da troca
  finalizada: 'Finalizada em',
  pausas: 'Pausas',
  categoria: 'Categoria',
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

/** Campos do pedido no embed, no formato do formulário do /validacao (inverso de embedInicial). */
export function lerPedido(embed) {
  const campo = (nome) => embed.fields?.find((f) => f.name === nome)?.value ?? '';
  const labels = campo(CAMPO.dados)
    .split('\n')
    .map((l) => l.replace(/^✅\s*/, '').trim());
  return {
    cliente: campo(CAMPO.cliente),
    sistema: campo(CAMPO.sistema),
    acesso: campo(CAMPO.acesso),
    dadosValores: DADOS.filter((d) => labels.includes(d.label)).map((d) => d.value),
    obs: campo(CAMPO.obs),
  };
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

export const responsavelDe = (embed) =>
  embed.fields?.find((f) => f.name === CAMPO.responsavel)?.value.match(/<@!?(\d+)>/)?.[1] ?? null;

/** Lê um campo de data no formato <t:unix:f>. */
export function dataDoCampo(embed, nome) {
  const f = embed.fields?.find((x) => x.name === nome);
  const unix = f?.value.match(/<t:(\d+)/)?.[1];
  return unix ? new Date(Number(unix) * 1000) : null;
}

export const assumidaEm = (embed) => dataDoCampo(embed, CAMPO.assumida);

export const carimbo = (date) => `<t:${Math.floor(date.getTime() / 1000)}:f>`;

const EM_PAUSA = 'em pausa';

/** Intervalos do campo "Pausas": uma linha "⏸️ <t:inicio:f> → <t:fim:t>" ou "→ em pausa" se aberta. */
export function pausasDe(embed) {
  const f = embed.fields?.find((x) => x.name === CAMPO.pausas);
  if (!f) return [];
  return f.value
    .split('\n')
    .map((linha) => {
      const [inicio, fim] = [...linha.matchAll(/<t:(\d+)/g)].map((m) => new Date(Number(m[1]) * 1000));
      return inicio ? { inicio, fim: fim ?? null } : null;
    })
    .filter(Boolean);
}

export const emPausa = (embed) => pausasDe(embed).at(-1)?.fim === null;

/** Texto do campo "Pausas", ou null (remove o campo) se não houver pausas. */
export function textoPausas(pausas) {
  if (!pausas.length) return null;
  return pausas
    .map((p) => `⏸️ ${carimbo(p.inicio)} → ${p.fim ? `<t:${Math.floor(p.fim.getTime() / 1000)}:t>` : EM_PAUSA}`)
    .join('\n');
}

/** Fecha a pausa aberta (se houver) em `quando`. */
export const fecharPausa = (pausas, quando = new Date()) =>
  pausas.map((p) => (p.fim === null ? { ...p, fim: quando } : p));

export function botoes(status, pausado = false) {
  const finalizado = status === 'aprovado' || status === 'reprovado' || status === 'cancelado';
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
      pausado
        ? new ButtonBuilder().setCustomId('val:retomar').setLabel('Retomar').setEmoji('▶️').setStyle(ButtonStyle.Success)
        : new ButtonBuilder()
            .setCustomId('val:pausar')
            .setLabel('Pausar')
            .setEmoji('⏸️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(status === 'aguardando'),
      new ButtonBuilder().setCustomId('val:aprovar').setLabel('Aprovar').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('val:info').setLabel('Pedir info').setEmoji('❓').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('val:reprovar').setLabel('Reprovar').setEmoji('⛔').setStyle(ButtonStyle.Danger),
    ),
    // Ações do solicitante (a primeira linha já tem o máximo de 5 botões).
    new ActionRowBuilder().addComponents(
      // Em análise o pedido não muda por baixo de quem está validando.
      ...(status === 'analise'
        ? []
        : [new ButtonBuilder().setCustomId('val:editar').setLabel('Editar pedido').setEmoji('✏️').setStyle(ButtonStyle.Secondary)]),
      new ButtonBuilder().setCustomId('val:cancelar').setLabel('Cancelar pedido').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
    ),
  ];
}
