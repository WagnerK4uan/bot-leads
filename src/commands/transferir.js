import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { STATUS_ABERTOS } from '../config.js';
import { atualizarPost, emFila, estadoFresco } from '../interactions/validacao.js';
import { registrarLog } from '../log.js';
import { CAMPO, carimbo, responsavelDe, statusTexto } from '../post.js';
import { efemero, findForum, hasRole, temCargo } from '../util.js';

export const data = new SlashCommandBuilder()
  .setName('transferir')
  .setDescription('Passa esta validação para outra pessoa da Importação (use dentro do post)')
  .addUserOption((o) => o.setName('pessoa').setDescription('Quem passa a ser o responsável').setRequired(true));

export async function execute(interaction) {
  if (!hasRole(interaction.member, 'importacao', 'gestao')) {
    return interaction.reply(efemero('Só **Importação** e **Gestão** podem transferir validações.'));
  }
  const thread = interaction.channel;
  if (!thread?.isThread() || thread.parentId !== findForum(interaction.guild)?.id) {
    return interaction.reply(efemero('Use `/transferir` dentro do post da validação, no fórum #validacoes.'));
  }
  const alvo = interaction.options.getMember('pessoa');
  if (!alvo || alvo.user.bot || !temCargo(alvo, 'importacao')) {
    return interaction.reply(efemero('Só dá para transferir para alguém com o cargo **Importação**.'));
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const aviso = await emFila(thread.id, () => transferir(interaction, thread, alvo));
  await interaction.editReply(aviso ?? 'Transferido.');
}

/** Devolve um aviso (string) quando não transfere. */
async function transferir(interaction, thread, alvo) {
  const u = interaction.user;
  const { msg, embed, status } = await estadoFresco(thread);
  if (!STATUS_ABERTOS.includes(status)) {
    return `Este post não está aberto (${status ? statusTexto(status) : 'sem status'}). Use ↩️ Reabrir antes.`;
  }
  if (responsavelDe(embed) === alvo.id) return `${alvo} já é o responsável por este post.`;

  // 🟡 vira 🔵 com o tempo começando agora; em 🔵/🟠 só troca o responsável (Assumida em e pausas ficam).
  const campos = [[CAMPO.responsavel, `${alvo}`, true]];
  if (status === 'aguardando') campos.push([CAMPO.assumida, carimbo(new Date()), true]);
  await atualizarPost(thread, msg, status === 'aguardando' ? 'analise' : status, campos);

  await thread.send({
    content: `🔁 ${u} transferiu esta validação para ${alvo}.`,
    allowedMentions: { users: [alvo.id] },
  });
  await registrarLog(interaction.guild, `🔁 **Transferida** ${thread} — ${u} → ${alvo}`);
  return null;
}
