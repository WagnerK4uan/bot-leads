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
import { CAMPO, assumidaEm, botoes, carimbo, comCampo, comStatus, solicitanteDe, statusTexto } from '../post.js';
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

/** Aplica status + campos no post e devolve o embed atualizado. */
async function atualizarPost(interaction, status, campos) {
  const thread = interaction.channel;
  // O Discord recusa troca de tags em post arquivado.
  if (thread.archived) await thread.setArchived(false);
  const msg = interaction.message ?? (await starterDe(thread));
  let embed = comStatus(msg.embeds[0], status);
  for (const [nome, valor, inline] of campos) embed = comCampo(embed, nome, valor, inline);

  await setStatus(thread, thread.parent, status);
  const payload = { embeds: [embed], components: botoes(status) };
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
  } else if (acao === 'reabrir') {
    const atual = statusDoPost(thread, thread.parent);
    await atualizarPost(interaction, 'aguardando', [
      [CAMPO.responsavel, null],
      [CAMPO.assumida, null],
      [CAMPO.tempo, null],
      [CAMPO.finalizada, null],
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
    const inicio = assumidaEm((interaction.message ?? (await starterDe(thread))).embeds[0]) ?? new Date();
    const tempo = `${Math.round((Date.now() - inicio.getTime()) / 60000)} min`;
    const embed = await atualizarPost(interaction, 'aprovado', [
      [CAMPO.responsavel, `${u}`, true],
      [CAMPO.assumida, carimbo(inicio), true],
      [CAMPO.virada, virada, true],
      [CAMPO.metodo, metodo],
      [CAMPO.motivo, obs ? `Ressalvas: ${obs}` : null],
      [CAMPO.tempo, tempo, true],
      [CAMPO.finalizada, carimbo(new Date()), true],
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
    const embed = await atualizarPost(interaction, 'reprovado', [
      [CAMPO.responsavel, `${u}`, true],
      [CAMPO.motivo, motivo],
      [CAMPO.finalizada, carimbo(new Date()), true],
    ]);
    await avisarSolicitante(thread, embed, `⛔ **Validação reprovada** por ${u}.\n**Motivo:** ${motivo}\n\nNão suba ticket de importação para este cliente.`);
    await thread.setAutoArchiveDuration(1440);
    await registrarLog(interaction.guild, `🔴 **Reprovada** ${thread} — por ${u}: ${motivo}`);
  } else if (acao === 'info') {
    const motivo = f.getTextInputValue('motivo').trim();
    const embed = await atualizarPost(interaction, 'info', [[CAMPO.motivo, `Pendente: ${motivo}`]]);
    await avisarSolicitante(
      thread,
      embed,
      `❓ ${u} precisa de mais informação:\n> ${motivo}\n\nResponda aqui no post — o status volta para ${statusTexto('aguardando')} automaticamente.`,
    );
    await registrarLog(interaction.guild, `🟠 **Pendente de info** ${thread} — ${u}: ${motivo}`);
  }
}

/** Quando o solicitante responde um post 🟠, devolve para a fila da Importação. */
export async function onThreadMessage(message) {
  const thread = message.channel;
  if (statusDoPost(thread, thread.parent) !== 'info') return;
  const msg = await starterDe(thread).catch(() => null);
  if (!msg || solicitanteDe(msg.embeds[0]) !== message.author.id) return;

  const embed = comCampo(comStatus(msg.embeds[0], 'aguardando'), CAMPO.motivo, null);
  await setStatus(thread, thread.parent, 'aguardando');
  await msg.edit({ embeds: [embed], components: botoes('aguardando') });
  invalidar(thread.id);
  const importacao = findRole(message.guild, 'importacao');
  await thread.send({
    content: `🔄 ${message.author} respondeu. Voltou para ${statusTexto('aguardando')} ${importacao ?? ''}`,
    allowedMentions: { roles: importacao ? [importacao.id] : [] },
  });
}
