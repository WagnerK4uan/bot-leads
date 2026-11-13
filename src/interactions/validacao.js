import {
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { STATUS } from '../config.js';
import { registrarLog } from '../log.js';
import { invalidar } from '../historico.js';
import {
  CAMPO,
  assumidaEm,
  botoes,
  carimbo,
  comCampo,
  comStatus,
  emPausa,
  fecharPausa,
  minutosPausados,
  pausasDe,
  responsavelDe,
  solicitanteDe,
  statusTexto,
  textoPausas,
} from '../post.js';
import { efemero, findRole, hasRole, setStatus, statusDoPost } from '../util.js';

const texto = (id, label, { required = true, placeholder, short = false, description } = {}) => {
  const l = new LabelBuilder().setLabel(label).setTextInputComponent(
    new TextInputBuilder()
      .setCustomId(id)
      .setStyle(short ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(required)
      .setMaxLength(1000)
      .setPlaceholder(placeholder ?? ''),
  );
  if (description) l.setDescription(description);
  return l;
};

const MODAIS = {
  aprovar: () =>
    new ModalBuilder()
      .setCustomId('valm:aprovar')
      .setTitle('Aprovar validação')
      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Tem como trazer e fazer virada de chave?')
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId('virada')
              .addOptions(
                { label: 'Sim', value: 'Sim', emoji: '✅' },
                { label: 'Sim, com ressalvas', value: 'Sim, com ressalvas', emoji: '⚠️' },
              ),
          ),
        texto('metodo', 'Método de importação', {
          placeholder: 'Ex.: Backup gerado no sistema do cliente (Firebird .FDB)',
        }),
        texto('obs', 'Ressalvas / observações', { required: false, placeholder: 'O que o comercial precisa avisar ao cliente' }),
      ),
  reprovar: () =>
    new ModalBuilder()
      .setCustomId('valm:reprovar')
      .setTitle('Reprovar validação')
      .addLabelComponents(texto('motivo', 'Motivo', { placeholder: 'Por que não é possível importar?' })),
  info: () =>
    new ModalBuilder()
      .setCustomId('valm:info')
      .setTitle('Pedir informação ao comercial')
      .addLabelComponents(
        texto('motivo', 'O que está faltando?', { placeholder: 'Ex.: AnyDesk não conecta, preciso da senha do banco...' }),
      ),
};

async function starterDe(thread) {
  const msg = await thread.fetchStarterMessage().catch(() => null);
  if (!msg?.embeds[0]) throw new Error('Mensagem inicial do post não encontrada.');
  return msg;
}

/**
 * Início ("Assumida em", ou agora se ninguém assumiu), pausas (a aberta é fechada agora) e minutos
 * até agora descontando as pausas, para aprovar/reprovar.
 */
async function tempoDesdeAssumida(interaction, thread) {
  const embed = (interaction.message ?? (await starterDe(thread))).embeds[0];
  const agora = new Date();
  const inicio = assumidaEm(embed) ?? agora;
  const pausas = fecharPausa(pausasDe(embed), agora);
  const min = Math.max(0, (agora.getTime() - inicio.getTime()) / 60000 - minutosPausados(pausas, agora));
  return { inicio, pausas, tempo: `${Math.round(min)} min` };
}

/** Aplica status + campos no post e devolve o embed atualizado. */
async function atualizarPost(interaction, status, campos) {
  const thread = interaction.channel;
  // O Discord recusa troca de tags em post arquivado.
  if (thread.archived) await thread.setArchived(false);
  const msg = interaction.message ?? (await starterDe(thread));
  let embed = comStatus(msg.embeds[0], status);
  for (const [nome, valor, inline] of campos) embed = comCampo(embed, nome, valor, inline);

  await setStatus(thread, thread.parent, status);
  const payload = { embeds: [embed], components: botoes(status, emPausa(embed.data)) };
  if (interaction.message) await interaction.update(payload);
  else await msg.edit(payload);
  invalidar(thread.id);
  return embed;
}

function avisarSolicitante(thread, embed, texto) {
  const id = solicitanteDe(embed);
  return thread.send({
    content: `${id ? `<@${id}> ` : ''}${texto}`,
    allowedMentions: { users: id ? [id] : [] },
  });
}

export async function onButton(interaction) {
  const acao = interaction.customId.split(':')[1];
  if ((acao === 'pausar' || acao === 'retomar') && !hasRole(interaction.member, 'importacao')) {
    return interaction.reply(efemero('Só o time de **Importação** pode pausar ou retomar o tempo.'));
  }
  if (!hasRole(interaction.member, 'importacao', 'gestao')) {
    return interaction.reply(efemero('Só o time de **Importação** pode validar. Se tiver algo a acrescentar, escreva aqui no post.'));
  }
  if (MODAIS[acao]) return interaction.showModal(MODAIS[acao]());

  const thread = interaction.channel;
  const u = interaction.user;
  if (acao === 'assumir') {
    const desde = assumidaEm(interaction.message.embeds[0]) ?? new Date();
    await atualizarPost(interaction, 'analise', [
      [CAMPO.responsavel, `${u}`, true],
      [CAMPO.assumida, carimbo(desde), true],
    ]);
    await thread.send({ content: `🙋 ${u} assumiu esta validação.`, allowedMentions: { parse: [] } });
  } else if (acao === 'pausar' || acao === 'retomar') {
    const pausas = pausasDe(interaction.message.embeds[0]);
    const pausado = pausas.at(-1)?.fim === null;
    if ((acao === 'pausar') === pausado) {
      return interaction.reply(efemero(pausado ? 'O tempo já está pausado.' : 'O tempo não está pausado.'));
    }
    const agora = new Date();
    const novas = acao === 'pausar' ? [...pausas, { inicio: agora, fim: null }] : fecharPausa(pausas, agora);
    await atualizarPost(interaction, statusDoPost(thread, thread.parent), [[CAMPO.pausas, textoPausas(novas)]]);
    if (acao === 'pausar') {
      await thread.send({ content: `⏸️ ${u} pausou o tempo desta validação.`, allowedMentions: { parse: [] } });
      await registrarLog(interaction.guild, `⏸️ **Pausada** ${thread} — por ${u}`);
    } else {
      const min = Math.round((agora.getTime() - pausas.at(-1).inicio.getTime()) / 60000);
      await thread.send({ content: `▶️ ${u} retomou o tempo (ficou pausado ${min} min).`, allowedMentions: { parse: [] } });
      await registrarLog(interaction.guild, `▶️ **Retomada** ${thread} — por ${u} (pausada ${min} min)`);
    }
  } else if (acao === 'reabrir') {
    const atual = statusDoPost(thread, thread.parent);
    await atualizarPost(interaction, 'aguardando', [
      [CAMPO.responsavel, null],
      [CAMPO.assumida, null],
      [CAMPO.tempo, null],
      [CAMPO.tempoLegado, null],
      [CAMPO.finalizada, null],
      [CAMPO.pausas, null],
    ]);
    await thread.setAutoArchiveDuration(10080);
    const importacao = findRole(interaction.guild, 'importacao');
    await thread.send({
      content: `↩️ ${u} reabriu a validação (estava ${STATUS[atual]?.emoji ?? ''} ${STATUS[atual]?.label ?? '—'}). ${importacao ?? ''}`,
      allowedMentions: { roles: importacao ? [importacao.id] : [] },
    });
    await registrarLog(interaction.guild, `↩️ **Reaberta** ${thread} — por ${u}`);
  }
}

export async function onModal(interaction) {
  const acao = interaction.customId.split(':')[1];
  const thread = interaction.channel;
  const u = interaction.user;
  const f = interaction.fields;

  if (acao === 'aprovar') {
    const virada = f.getStringSelectValues('virada')[0];
    const metodo = f.getTextInputValue('metodo').trim();
    const obs = f.getTextInputValue('obs')?.trim();
    const { inicio, pausas, tempo } = await tempoDesdeAssumida(interaction, thread);
    const embed = await atualizarPost(interaction, 'aprovado', [
      [CAMPO.responsavel, `${u}`, true],
      [CAMPO.assumida, carimbo(inicio), true],
      [CAMPO.virada, virada, true],
      [CAMPO.metodo, metodo],
      [CAMPO.motivo, obs ? `Ressalvas: ${obs}` : null],
      [CAMPO.tempo, tempo, true],
      [CAMPO.tempoLegado, null],
      [CAMPO.finalizada, carimbo(new Date()), true],
      [CAMPO.pausas, textoPausas(pausas)],
    ]);
    await avisarSolicitante(
      thread,
      embed,
      `✅ **Validação aprovada** por ${u}.\n**Virada de chave:** ${virada}\n**Método:** ${metodo}${obs ? `\n**Ressalvas:** ${obs}` : ''}\n**Tempo desde que foi assumida:** ${tempo}\n\nPode subir o ticket de importação. Este post será arquivado após 24 h sem atividade.`,
    );
    await thread.setAutoArchiveDuration(1440);
    await registrarLog(interaction.guild, `🟢 **Aprovada** ${thread} — por ${u} (${tempo} desde assumida)`);
  } else if (acao === 'reprovar') {
    const motivo = f.getTextInputValue('motivo').trim();
    const { inicio, pausas, tempo } = await tempoDesdeAssumida(interaction, thread);
    const embed = await atualizarPost(interaction, 'reprovado', [
      [CAMPO.responsavel, `${u}`, true],
      [CAMPO.assumida, carimbo(inicio), true],
      [CAMPO.motivo, motivo],
      [CAMPO.tempo, tempo, true],
      [CAMPO.tempoLegado, null],
      [CAMPO.finalizada, carimbo(new Date()), true],
      [CAMPO.pausas, textoPausas(pausas)],
    ]);
    await avisarSolicitante(
      thread,
      embed,
      `⛔ **Validação reprovada** por ${u}.\n**Motivo:** ${motivo}\n**Tempo desde que foi assumida:** ${tempo}\n\nNão suba ticket de importação para este cliente.`,
    );
    await thread.setAutoArchiveDuration(1440);
    await registrarLog(interaction.guild, `🔴 **Reprovada** ${thread} — por ${u} (${tempo} desde assumida): ${motivo}`);
  } else if (acao === 'info') {
    const motivo = f.getTextInputValue('motivo').trim();
    // Pedir info conta como assumir: mantém o responsável e o início do tempo, ou assume agora.
    const atual = (interaction.message ?? (await starterDe(thread))).embeds[0];
    const responsavelId = responsavelDe(atual);
    const embed = await atualizarPost(interaction, 'info', [
      [CAMPO.responsavel, responsavelId ? `<@${responsavelId}>` : `${u}`, true],
      [CAMPO.assumida, carimbo(assumidaEm(atual) ?? new Date()), true],
      [CAMPO.motivo, `Pendente: ${motivo}`],
    ]);
    await avisarSolicitante(
      thread,
      embed,
      `❓ ${u} precisa de mais informação:\n> ${motivo}\n\nResponda aqui no post — o status volta para ${statusTexto('analise')} automaticamente.`,
    );
    await registrarLog(interaction.guild, `🟠 **Pendente de info** ${thread} — ${u}: ${motivo}`);
  }
}

/**
 * Quando o solicitante responde um post 🟠, devolve para 🔵 Em análise com o mesmo responsável.
 * Posts sem responsável (de antes dessa regra) voltam para a fila da Importação.
 */
export async function onThreadMessage(message) {
  const thread = message.channel;
  if (statusDoPost(thread, thread.parent) !== 'info') return;
  const msg = await starterDe(thread).catch(() => null);
  if (!msg || solicitanteDe(msg.embeds[0]) !== message.author.id) return;

  const responsavelId = responsavelDe(msg.embeds[0]);
  const status = responsavelId ? 'analise' : 'aguardando';
  const embed = comCampo(comStatus(msg.embeds[0], status), CAMPO.motivo, null);
  await setStatus(thread, thread.parent, status);
  await msg.edit({ embeds: [embed], components: botoes(status, emPausa(embed.data)) });
  invalidar(thread.id);

  if (responsavelId) {
    await thread.send({
      content: `🔄 ${message.author} respondeu. Voltou para ${statusTexto(status)} <@${responsavelId}>`,
      allowedMentions: { users: [responsavelId] },
    });
    return;
  }
  const importacao = findRole(message.guild, 'importacao');
  await thread.send({
    content: `🔄 ${message.author} respondeu. Voltou para ${statusTexto(status)} ${importacao ?? ''}`,
    allowedMentions: { roles: importacao ? [importacao.id] : [] },
  });
}
