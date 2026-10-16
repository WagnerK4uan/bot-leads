import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { STATUS } from '../config.js';
import { carregarPosts } from '../historico.js';
import { efemero, hasRole, horasUteis } from '../util.js';

const DIA = 24 * 3_600_000;

export const data = new SlashCommandBuilder()
  .setName('relatorio')
  .setDescription('Números das validações: volume, tempos e quem atendeu')
  .addIntegerOption((o) =>
    o
      .setName('periodo')
      .setDescription('Validações abertas nos últimos…')
      .addChoices(
        { name: '7 dias', value: 7 },
        { name: '30 dias', value: 30 },
        { name: '90 dias', value: 90 },
        { name: 'Desde o início', value: 0 },
      ),
  );

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function fmtHoras(h) {
  if (h === null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1).replace('.', ',')} h úteis`;
}

const top = (contagem, n) =>
  [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

/** Métricas dos registros de carregarPosts() abertos a partir de `desde` (null = todos). */
export function calcularMetricas(registros, desde = null) {
  const doPeriodo = registros.filter((r) => !desde || r.criadoEm >= desde);
  const porStatus = Object.fromEntries(Object.keys(STATUS).map((k) => [k, 0]));
  const ateAssumir = [];
  const analise = [];
  const responsaveis = new Map(); // id -> { aprovado, reprovado, horas: [] }
  const sistemas = new Map(); // chave -> { nome, total, reprovado }

  for (const r of doPeriodo) {
    if (r.status) porStatus[r.status]++;
    if (r.assumidaEm) ateAssumir.push(horasUteis(r.criadoEm, r.assumidaEm));

    const finalizado = r.status === 'aprovado' || r.status === 'reprovado';
    if (finalizado && r.responsavelId) {
      const p = responsaveis.get(r.responsavelId) ?? { aprovado: 0, reprovado: 0, horas: [] };
      p[r.status]++;
      if (r.assumidaEm && r.finalizadaEm) {
        const h = horasUteis(r.assumidaEm, r.finalizadaEm);
        p.horas.push(h);
        analise.push(h);
      }
      responsaveis.set(r.responsavelId, p);
    }

    if (r.sistemaChave) {
      const s = sistemas.get(r.sistemaChave) ?? { nome: r.sistema, total: 0, reprovado: 0 };
      s.total++;
      if (r.status === 'reprovado') s.reprovado++;
      sistemas.set(r.sistemaChave, s);
    }
  }

  const decididas = porStatus.aprovado + porStatus.reprovado;
  return {
    total: doPeriodo.length,
    porStatus,
    taxaAprovacao: decididas ? porStatus.aprovado / decididas : null,
    mediaAteAssumir: media(ateAssumir),
    mediaAnalise: media(analise),
    responsaveis: [...responsaveis.entries()]
      .map(([id, p]) => ({ id, ...p, media: media(p.horas) }))
      .sort((a, b) => b.aprovado + b.reprovado - (a.aprovado + a.reprovado)),
    sistemas: top(new Map([...sistemas].map(([k, s]) => [s.nome, s.total])), 5),
    reprovados: top(new Map([...sistemas].filter(([, s]) => s.reprovado).map(([, s]) => [s.nome, s.reprovado])), 3),
  };
}

export function montarEmbedRelatorio(m, titulo) {
  const embed = new EmbedBuilder().setTitle(titulo).setColor(0x3498db);
  if (!m.total) return embed.setDescription('Nenhuma validação aberta no período.');

  const status = Object.entries(m.porStatus)
    .map(([k, n]) => `${STATUS[k].emoji} ${STATUS[k].label}: **${n}**`)
    .join('\n');
  const taxa = m.taxaAprovacao === null ? '—' : `${Math.round(m.taxaAprovacao * 100)}%`;

  embed.addFields(
    { name: `Validações abertas: ${m.total}`, value: status },
    { name: 'Taxa de aprovação', value: taxa, inline: true },
    { name: 'Média até assumir', value: fmtHoras(m.mediaAteAssumir), inline: true },
    { name: 'Média de análise', value: fmtHoras(m.mediaAnalise), inline: true },
  );
  if (m.responsaveis.length) {
    embed.addFields({
      name: 'Por responsável (Importação)',
      value: m.responsaveis
        .slice(0, 10)
        .map((p) => `<@${p.id}> — 🟢 ${p.aprovado} · 🔴 ${p.reprovado} · ⏱️ ${fmtHoras(p.media)}`)
        .join('\n'),
    });
  }
  if (m.sistemas.length) {
    embed.addFields({ name: 'Sistemas mais pedidos', value: m.sistemas.map(([n, q]) => `${n} — ${q}`).join('\n'), inline: true });
  }
  if (m.reprovados.length) {
    embed.addFields({ name: 'Mais reprovados', value: m.reprovados.map(([n, q]) => `${n} — ${q}`).join('\n'), inline: true });
  }
  return embed.setFooter({ text: 'Tempos em horas úteis. Análise = de assumida até aprovar/reprovar.' });
}

export async function execute(interaction) {
  if (!hasRole(interaction.member, 'gestao', 'importacao')) {
    return interaction.reply(efemero('O relatório é para **Gestão** e **Importação**.'));
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const dias = interaction.options.getInteger('periodo') ?? 30;
  const registros = await carregarPosts(interaction.guild);
  const desde = dias ? new Date(Date.now() - dias * DIA) : null;
  const titulo = dias ? `📊 Validações — últimos ${dias} dias` : '📊 Validações — desde o início';
  await interaction.editReply({ embeds: [montarEmbedRelatorio(calcularMetricas(registros, desde), titulo)] });
}
