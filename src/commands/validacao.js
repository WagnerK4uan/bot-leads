import {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { DADOS, MAX_TAGS_DADOS, STATUS } from '../config.js';
import { botoes, embedInicial } from '../post.js';
import { efemero, findForum, findRole, hasRole, tagId, tagsDeDados } from '../util.js';
import { carregarPosts, contagemPorStatus, doSistema, invalidar, linhaHistorico } from '../historico.js';
import { registrarLog } from '../log.js';

export const data = new SlashCommandBuilder()
  .setName('validacao')
  .setDescription('Abre um pedido de validação de importação para um lead');

export async function execute(interaction) {
  if (!hasRole(interaction.member, 'comercial', 'gestao')) {
    return interaction.reply(efemero('Só o time **Comercial** abre validações. Escolha seu setor em #boas-vindas.'));
  }

  const modal = new ModalBuilder()
    .setCustomId('validacao:nova')
    .setTitle('Nova validação de importação')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Cliente')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('cliente').setStyle(TextInputStyle.Short).setMaxLength(80).setPlaceholder('Ex.: Juliana Modas'),
        ),
      new LabelBuilder()
        .setLabel('Sistema antigo do cliente')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId('sistema').setStyle(TextInputStyle.Short).setMaxLength(60).setPlaceholder('Ex.: Clipp Pro'),
        ),
      new LabelBuilder()
        .setLabel('Acesso ao PC do cliente')
        .setDescription('Número do AnyDesk ou TeamViewer. Se for TeamViewer, coloque a senha também.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('acesso')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(200)
            .setPlaceholder('AnyDesk 1 760 828 359  |  TeamViewer 123 456 789 senha abc123'),
        ),
      new LabelBuilder()
        .setLabel('Dados para importar')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('dados')
            .setPlaceholder('Marque tudo que o cliente quer trazer')
            .setMinValues(1)
            .setMaxValues(DADOS.length)
            .addOptions(DADOS.map((d) => ({ label: d.label, value: d.value }))),
        ),
      new LabelBuilder()
        .setLabel('Observações (opcional)')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('obs')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000)
            .setPlaceholder('Cliente em ligação, horário combinado, versão do sistema, banco de dados...'),
        ),
    );

  await interaction.showModal(modal);
}

export async function onModal(interaction) {
  const guild = interaction.guild;
  const forum = findForum(guild);
  if (!forum) return interaction.reply(efemero('Fórum #validacoes não encontrado. Peça para a Gestão rodar o setup.'));

  const f = interaction.fields;
  const cliente = f.getTextInputValue('cliente').trim();
  const sistema = f.getTextInputValue('sistema').trim();
  const acesso = f.getTextInputValue('acesso').trim();
  const obs = f.getTextInputValue('obs')?.trim();
  const valores = f.getStringSelectValues('dados');
  const dados = DADOS.filter((d) => valores.includes(d.value)).map((d) => d.label);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const importacao = findRole(guild, 'importacao');
  const thread = await forum.threads.create({
    name: `${cliente} — ${sistema}`.slice(0, 100),
    appliedTags: [tagId(forum, STATUS.aguardando.tag), ...tagsDeDados(forum, valores, MAX_TAGS_DADOS)].filter(Boolean),
    message: {
      content: `${importacao ?? '@Importação'} nova validação aberta por ${interaction.user}.`,
      embeds: [embedInicial({ cliente, sistema, acesso, dados, obs, solicitanteId: interaction.user.id })],
      components: botoes('aguardando'),
      allowedMentions: { roles: importacao ? [importacao.id] : [] },
    },
  });

  await registrarLog(guild, `🟡 **Nova validação** ${thread} — aberta por ${interaction.user}`);
  await interaction.editReply(`Validação criada: ${thread}\nAcompanhe por lá — você será mencionado quando a Importação responder.`);
  invalidar();
  await avisarHistorico(guild, thread, sistema).catch((e) => console.error('Histórico do sistema falhou:', e.message));
}

/** Mostra no post novo como foram as validações anteriores do mesmo sistema. */
async function avisarHistorico(guild, thread, sistema) {
  const anteriores = doSistema(await carregarPosts(guild), sistema).filter(
    (r) => r.thread.id !== thread.id && (r.status === 'aprovado' || r.status === 'reprovado'),
  );
  if (!anteriores.length) return;
  const vezes = anteriores.length === 1 ? '1 vez' : `${anteriores.length} vezes`;
  await thread.send({
    content: [
      `📚 **${sistema}** já foi validado ${vezes}: ${contagemPorStatus(anteriores)}`,
      ...anteriores.slice(0, 3).map((r) => `• ${linhaHistorico(r)}`),
      anteriores.length > 3 ? `Lista completa: \`/historico sistema:${sistema}\`` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    allowedMentions: { parse: [] },
  });
}
