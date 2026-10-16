import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { carregarPosts, chaveSistema, contagemPorStatus, doSistema, emCache, linhaHistorico } from '../historico.js';
import { efemero, hasRole } from '../util.js';

export const data = new SlashCommandBuilder()
  .setName('historico')
  .setDescription('Validações anteriores de um sistema e o método usado')
  .addStringOption((o) =>
    o.setName('sistema').setDescription('Sistema antigo do cliente').setRequired(true).setAutocomplete(true).setMaxLength(60),
  );

export async function autocomplete(interaction) {
  const busca = chaveSistema(interaction.options.getFocused());
  const nomes = new Map(); // chave -> nome mais recente, para "Clipp Pro" aparecer uma vez só
  for (const r of emCache(interaction.guild)) {
    if (r.sistemaChave && !nomes.has(r.sistemaChave)) nomes.set(r.sistemaChave, r.sistema);
  }
  const opcoes = [...nomes]
    .filter(([chave]) => chave.includes(busca))
    .slice(0, 25)
    .map(([, nome]) => ({ name: nome.slice(0, 100), value: nome.slice(0, 100) }));
  await interaction.respond(opcoes);
}

export async function execute(interaction) {
  if (!hasRole(interaction.member, 'importacao', 'comercial', 'gestao')) {
    return interaction.reply(efemero('Escolha seu setor em #boas-vindas primeiro.'));
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const nome = interaction.options.getString('sistema', true);
  const lista = doSistema(await carregarPosts(interaction.guild), nome);
  if (!lista.length) return interaction.editReply(`Nenhuma validação encontrada para **${nome}**.`);

  let desc = '';
  for (const [i, r] of lista.entries()) {
    const l = `${linhaHistorico(r)}${r.responsavelId ? ` · <@${r.responsavelId}>` : ''}`;
    if (desc.length + l.length > 3900) {
      desc += `\n… e mais ${lista.length - i}`;
      break;
    }
    desc += (desc ? '\n' : '') + l;
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`📚 ${lista[0].sistema} — ${lista.length} validação(ões)`)
        .setDescription(desc)
        .setFooter({ text: contagemPorStatus(lista) })
        .setColor(0x9b59b6),
    ],
  });
}
