import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } from 'discord.js';
import { STATUS } from './config.js';
import { efemero, findChannel, findRole } from './util.js';

const ASSETS = fileURLToPath(new URL('../assets/', import.meta.url));
const COR = 0x5865f2;

const ch = (guild, key) => {
  const c = findChannel(guild, key);
  return c ? `${c}` : `#${key}`;
};

function comImagem(embed, arquivo) {
  const caminho = ASSETS + arquivo;
  if (!existsSync(caminho)) return { embeds: [embed] };
  embed.setImage(`attachment://${arquivo}`);
  return { embeds: [embed], files: [new AttachmentBuilder(caminho, { name: arquivo })] };
}

export const botoesSetor = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setor:comercial').setLabel('Sou do Comercial').setEmoji('💼').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setor:importacao').setLabel('Sou da Importação').setEmoji('🗄️').setStyle(ButtonStyle.Primary),
  );

/** Mensagens fixas do #boas-vindas, na ordem em que são publicadas. */
export function tutorial(guild) {
  const forum = ch(guild, 'forum');
  return [
    {
      embeds: [
        new EmbedBuilder()
          .setColor(COR)
          .setTitle('👋 Bem-vindo ao servidor de Validação de Importação')
          .setDescription(
            [
              'Aqui o **Comercial** confirma com o time de **Importação** se dá para trazer os dados do sistema antigo do lead **antes** de vender e subir o ticket.',
              '',
              '**Por que isso importa?** Ticket sem validação = cliente com expectativa errada = churn. Cada lead ganha um *artigo* próprio no fórum, com status, responsável e histórico em um só lugar.',
              '',
              '**1º passo:** escolha seu setor no botão abaixo para liberar os canais.',
              '*(Gestão é liberada manualmente por um administrador.)*',
            ].join('\n'),
          ),
      ],
      components: [botoesSetor()],
    },
    comImagem(
      new EmbedBuilder()
        .setColor(COR)
        .setTitle('Passo 1 — Abra o formulário com /validacao')
        .setDescription(
          'Em qualquer canal, digite **`/validacao`** e aperte **Enter**. Não precisa criar post manualmente no fórum — ele é criado para você, sempre no mesmo padrão.',
        ),
      '01-comando.png',
    ),
    comImagem(
      new EmbedBuilder()
        .setColor(COR)
        .setTitle('Passo 2 — Preencha os dados do lead')
        .setDescription(
          [
            '• **Cliente** — nome do cliente/empresa',
            '• **Sistema antigo** — ex.: Clipp Pro, Digisat, Bling',
            '• **Acesso** — número do AnyDesk ou TeamViewer *(TeamViewer: coloque a senha)*',
            '• **Dados para importar** — marque tudo que o cliente quer trazer',
            '• **Observações** — cliente em ligação, horário combinado, etc.',
            '',
            'Clique em **Enviar**.',
          ].join('\n'),
        ),
      '02-formulario.png',
    ),
    comImagem(
      new EmbedBuilder()
        .setColor(COR)
        .setTitle(`Passo 3 — O artigo é criado em ${forum}`)
        .setDescription(
          'O bot cria o post com o título **Cliente — Sistema**, as tags dos dados e o status 🟡 **Aguardando validação**, e já avisa o time de Importação. **Toda conversa sobre esse cliente acontece dentro do post** — prints, dúvidas, horários.',
        ),
      '03-post.png',
    ),
    comImagem(
      new EmbedBuilder()
        .setColor(COR)
        .setTitle('Passo 4 — A Importação valida')
        .setDescription(
          [
            'Alguém da Importação clica em **🙋 Assumir**, acessa o PC do cliente e responde com:',
            '✅ **Aprovar** — informa se dá para fazer a virada de chave e o método de importação',
            '❓ **Pedir info** — falta algo; o comercial responde no post e ele volta para a fila',
            '⛔ **Reprovar** — com o motivo',
            '',
            'Quem abriu o pedido é mencionado em cada resposta. **Só suba o ticket de importação com 🟢 Aprovado.**',
          ].join('\n'),
        ),
      '04-validacao.png',
    ),
    comImagem(
      new EmbedBuilder()
        .setColor(COR)
        .setTitle('Legenda dos status')
        .setDescription(
          [
            ...Object.values(STATUS).map((s) => `${s.emoji} **${s.label}**`),
            '',
            `Use **\`/pendentes\`** para ver tudo que está em aberto. Posts parados recebem lembrete automático. Dúvidas? Leia ${ch(guild, 'regras')}.`,
          ].join('\n'),
        ),
      '05-status.png',
    ),
  ];
}

export function regras(guild) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COR)
        .setTitle('📜 Regras e fluxo')
        .addFields(
          {
            name: 'Fluxo',
            value: [
              `1. Comercial usa \`/validacao\` → artigo criado em ${ch(guild, 'forum')} (🟡)`,
              '2. Importação assume (🔵), acessa o cliente e responde',
              '3. 🟢 Aprovado → comercial sobe o ticket de importação',
              '   🟠 Pendente de info → comercial responde no post',
              '   🔴 Reprovado → não sobe ticket; alinhar com o cliente',
            ].join('\n'),
          },
          {
            name: 'Regras',
            value: [
              '• **Nunca** suba ticket de importação sem o post 🟢 Aprovado.',
              '• Um post por cliente. Se o cliente voltar, use **Reabrir** no post antigo.',
              '• Conversa sobre o cliente fica **dentro do post**, não no chat geral.',
              '• Senha de acesso remoto só no post (o fórum é restrito aos times).',
              '• Pedido urgente (cliente em ligação)? Escreva isso em Observações.',
            ].join('\n'),
          },
          {
            name: 'Canais',
            value: [
              `${ch(guild, 'forum')} — artigos de validação`,
              `${ch(guild, 'log')} — histórico de aprovações e reprovações`,
              `${ch(guild, 'comercial')} / ${ch(guild, 'importacao')} — conversa interna de cada time`,
              `${ch(guild, 'geral')} — conversa entre todos`,
            ].join('\n'),
          },
        ),
    ],
  };
}

export async function onMemberJoin(member) {
  const canal = findChannel(member.guild, 'boasVindas', ChannelType.GuildText);
  if (canal) {
    await canal
      .send({
        content: `👋 Bem-vindo(a), ${member}! Comece escolhendo seu setor nos botões fixados aqui no topo do canal.`,
        allowedMentions: { users: [member.id] },
      })
      .catch(() => {});
  }
  await member
    .send(
      `Olá! Você entrou no servidor **${member.guild.name}**.\n` +
        `1. Vá em ${canal ?? '#boas-vindas'} e escolha seu setor (Comercial ou Importação).\n` +
        '2. Leia o passo a passo com imagens — leva 2 minutos.\n' +
        '3. Para pedir uma validação, digite `/validacao` em qualquer canal.',
    )
    .catch(() => {}); // DMs fechadas
}

export async function onSetorButton(interaction) {
  const key = interaction.customId.split(':')[1];
  const role = findRole(interaction.guild, key);
  if (!role) return interaction.reply(efemero('Cargo não encontrado. Avise a Gestão.'));

  const member = interaction.member;
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    return interaction.reply(efemero(`Cargo **${role.name}** removido.`));
  }
  await member.roles.add(role);
  const proximo =
    key === 'comercial'
      ? `Agora é só usar \`/validacao\` sempre que um lead precisar de validação. Os pedidos ficam em ${ch(interaction.guild, 'forum')}.`
      : `Fique de olho em ${ch(interaction.guild, 'forum')}: você será mencionado a cada pedido novo. Use \`/pendentes\` para ver a fila.`;
  await interaction.reply(efemero(`✅ Você agora é **${role.name}**. ${proximo}`));
}
