import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { CHANNELS } from '../config.js';
import { canalMetricas, embedDoMes, mesAntes, nomeMes, publicarMes } from '../metricasMes.js';
import { efemero, hasRole } from '../util.js';

export const data = new SlashCommandBuilder()
  .setName('metricas')
  .setDescription('Fechamento do mês: aprovadas, reprovadas, tempo médio de análise e pendentes')
  .addStringOption((o) =>
    o.setName('mes').setDescription('Mês do fechamento (padrão: mês anterior)').setAutocomplete(true).setMaxLength(7),
  );

const ultimosMeses = () => Array.from({ length: 12 }, (_, i) => mesAntes(i));

export async function autocomplete(interaction) {
  const busca = interaction.options.getFocused().toLowerCase();
  const opcoes = ultimosMeses()
    .map((chave) => ({ name: nomeMes(chave) + (chave === mesAntes(0) ? ' (parcial)' : ''), value: chave }))
    .filter((o) => o.name.toLowerCase().includes(busca) || o.value.includes(busca));
  await interaction.respond(opcoes.slice(0, 25));
}

export async function execute(interaction) {
  if (!hasRole(interaction.member, 'importacao', 'gestao')) {
    return interaction.reply(efemero('As métricas são para **Importação** e **Gestão**.'));
  }
  const chave = interaction.options.getString('mes') ?? mesAntes(1);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(chave)) {
    return interaction.reply(efemero('Escolha o mês na lista (ex.: `2026-10`).'));
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!canalMetricas(interaction.guild)) {
    const embed = await embedDoMes(interaction.guild, chave);
    return interaction.editReply({
      content: `Canal #${CHANNELS.metricas} não encontrado — rode \`npm run setup\` para criá-lo. Segue o fechamento só para você:`,
      embeds: [embed],
    });
  }
  const msg = await publicarMes(interaction.guild, chave, { repetir: true });
  await interaction.editReply(`Fechamento de **${nomeMes(chave)}** postado: ${msg.url}`);
}
