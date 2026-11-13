import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { STATUS, STATUS_ABERTOS } from '../config.js';
import { carregarPosts, linhaHistorico } from '../historico.js';
import { efemero, hasRole, idade, limitarLinhas, temCargo } from '../util.js';

const SEMANA = 7 * 24 * 3_600_000;
const FINALIZADOS = ['aprovado', 'reprovado', 'cancelado'];

export const data = new SlashCommandBuilder()
  .setName('minhas')
  .setDescription('O que está com você: posts que você assumiu e os pedidos que você abriu');

const emPausa = (r) => r.pausas.at(-1)?.fim === null;

/**
 * Seções do /minhas para `userId`. Importação vê "Com você"; Comercial vê "Seus pedidos" e os finalizados
 * da semana; Gestão/admin vê tudo. Devolve as linhas da descrição.
 */
export function montarMinhas(registros, userId, { importacao, comercial }, agora = new Date()) {
  const secoes = [];

  if (importacao) {
    const comigo = registros
      .filter((r) => (r.status === 'analise' || r.status === 'info') && r.responsavelId === userId)
      .sort((a, b) => (a.assumidaEm ?? a.criadoEm) - (b.assumidaEm ?? b.criadoEm));
    if (comigo.length) {
      secoes.push([
        `**Com você (${comigo.length})**`,
        ...comigo.map(
          (r) =>
            `${STATUS[r.status].emoji} ${r.thread} — assumida há ${idade(r.assumidaEm ?? r.criadoEm)}${emPausa(r) ? ' ⏸️ pausada' : ''}`,
        ),
      ]);
    }
  }

  if (comercial) {
    const abertos = registros
      .filter((r) => STATUS_ABERTOS.includes(r.status) && r.solicitanteId === userId)
      .sort((a, b) => a.criadoEm - b.criadoEm);
    if (abertos.length) {
      secoes.push([
        `**Seus pedidos (${abertos.length})**`,
        ...abertos.map(
          (r) =>
            `${STATUS[r.status].emoji} ${r.thread} — aberto há ${idade(r.criadoEm)}${r.responsavelId ? ` · com <@${r.responsavelId}>` : ''}`,
        ),
      ]);
    }
    const desde = agora.getTime() - SEMANA;
    const finalizados = registros.filter(
      (r) => FINALIZADOS.includes(r.status) && r.solicitanteId === userId && r.finalizadaEm?.getTime() >= desde,
    );
    if (finalizados.length) {
      secoes.push([`**Finalizados nos últimos 7 dias (${finalizados.length})**`, ...finalizados.map(linhaHistorico)]);
    }
  }

  const linhas = secoes.length ? secoes.flatMap((s, i) => (i ? ['', ...s] : s)) : ['🎉 Nada com você agora.'];
  if (importacao) {
    const aguardando = registros.filter((r) => r.status === 'aguardando').length;
    if (aguardando) linhas.push('', `🟡 ${aguardando} aguardando alguém assumir → \`/pendentes\``);
  }
  return linhas;
}

export async function execute(interaction) {
  const m = interaction.member;
  const gestao = hasRole(m, 'gestao'); // inclui Administrador
  const papeis = { importacao: gestao || temCargo(m, 'importacao'), comercial: gestao || temCargo(m, 'comercial') };
  if (!papeis.importacao && !papeis.comercial) {
    return interaction.reply(efemero('Escolha seu setor em #boas-vindas primeiro.'));
  }
  // A primeira carga lê todos os posts e pode passar dos 3 s da interação.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const registros = await carregarPosts(interaction.guild);
  const linhas = montarMinhas(registros, interaction.user.id, papeis);
  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle('📌 Minhas validações').setDescription(limitarLinhas(linhas)).setColor(0x3498db)],
  });
}
