import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { STATUS, STATUS_ABERTOS } from '../config.js';
import { efemero, findForum, hasRole, idade, statusDoPost } from '../util.js';

export const data = new SlashCommandBuilder()
  .setName('pendentes')
  .setDescription('Lista as validações que ainda aguardam resposta');

export async function postsAbertos(guild) {
  const forum = findForum(guild);
  if (!forum) return { forum: null, posts: [] };
  const { threads } = await guild.channels.fetchActiveThreads();
  const posts = threads
    .filter((t) => t.parentId === forum.id)
    .map((t) => ({ thread: t, status: statusDoPost(t, forum) }))
    .filter((p) => STATUS_ABERTOS.includes(p.status))
    .sort((a, b) => a.thread.createdTimestamp - b.thread.createdTimestamp);
  return { forum, posts };
}

export async function execute(interaction) {
  if (!hasRole(interaction.member, 'importacao', 'comercial', 'gestao')) {
    return interaction.reply(efemero('Escolha seu setor em #boas-vindas primeiro.'));
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { forum, posts } = await postsAbertos(interaction.guild);
  if (!forum) return interaction.editReply('Fórum #validacoes não encontrado.');
  if (!posts.length) return interaction.editReply('🎉 Nenhuma validação pendente.');

  const linhas = posts.map(({ thread, status }) => `${STATUS[status].emoji} ${thread} — aberto há ${idade(thread.createdAt)}`);
  let desc = '';
  for (const l of linhas) {
    if (desc.length + l.length > 3900) {
      desc += `\n… e mais ${linhas.length - desc.split('\n').length}`;
      break;
    }
    desc += (desc ? '\n' : '') + l;
  }
  const contagem = STATUS_ABERTOS.map((k) => `${STATUS[k].emoji} ${posts.filter((p) => p.status === k).length}`).join('  ');

  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle(`Validações pendentes (${posts.length})`).setDescription(desc).setFooter({ text: contagem }).setColor(0xf1c40f)],
  });
}
