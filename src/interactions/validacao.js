import {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { DADOS, MOTIVOS_REPROVACAO, STATUS } from '../config.js';
import { registrarLog } from '../log.js';
import { invalidar } from '../historico.js';
import { modalValidacao } from '../commands/validacao.js';
import {
  CAMPO,
  assumidaEm,
  botoes,
  carimbo,
  comCampo,
  comStatus,
  emPausa,
  fecharPausa,
  lerPedido,
  pausasDe,
  responsavelDe,
  solicitanteDe,
  statusTexto,
  textoPausas,
} from '../post.js';
import {
  efemero,
  findRole,
  fmtDuracaoUtil,
  hasRole,
  horasUteisSemPausa,
  setStatus,
  setTagsDeDados,
  temCargo,
  statusDoPost,
} from '../util.js';

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
      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Categoria')
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId('categoria')
              .setPlaceholder('Por que não é possível importar?')
              .addOptions(MOTIVOS_REPROVACAO.map((m) => ({ label: m.label, value: m.value }))),
          ),
        texto('motivo', 'Detalhes', { required: false, placeholder: 'Obrigatório se a categoria for "Outro"' }),
      ),
  info: () =>
    new ModalBuilder()
      .setCustomId('valm:info')
      .setTitle('Pedir informação ao comercial')
      .addLabelComponents(
        texto('motivo', 'O que está faltando?', { placeholder: 'Ex.: AnyDesk não conecta, preciso da senha do banco...' }),
      ),
  cancelar: () =>
    new ModalBuilder()
      .setCustomId('valm:cancelar')
      .setTitle('Cancelar pedido')
      .addLabelComponents(texto('motivo', 'Motivo (opcional)', { required: false, placeholder: 'Ex.: Cliente desistiu' })),
};

async function starterDe(thread) {
  // force: o cache pode ter o embed de antes da ação anterior da fila.
  const msg = await thread.fetchStarterMessage({ force: true }).catch(() => null);
  if (!msg?.embeds[0]) throw new Error('Mensagem inicial do post não encontrada.');
  return msg;
}

/**
 * Ações no mesmo post rodam uma de cada vez (o bot roda em uma instância só). Sem isso, dois
 * cliques quase juntos leem o mesmo embed e o segundo sobrescreve o primeiro.
 */
const travas = new Map(); // threadId -> Promise
export async function emFila(threadId, fn) {
  const anterior = travas.get(threadId) ?? Promise.resolve();
  const atual = anterior.catch(() => {}).then(fn);
  travas.set(threadId, atual);
  try {
    return await atual;
  } finally {
    if (travas.get(threadId) === atual) travas.delete(threadId);
  }
}

/** Estado atual do post direto da API: status pelas tags e a mensagem inicial com o embed. */
export async function estadoFresco(thread) {
  await thread.fetch(); // appliedTags do cache pode estar desatualizado
  const msg = await starterDe(thread);
  return { msg, embed: msg.embeds[0], status: statusDoPost(thread, thread.parent) };
}

const FINALIZADOS = ['aprovado', 'reprovado', 'cancelado'];
const msgFinalizado = (status) => `Este post já foi finalizado (${statusTexto(status)}). Use ↩️ Reabrir.`;

/**
 * Responde na hora (a interação tem 3 s e a fila pode demorar). Botões e modais vindos do post só
 * reconhecem o clique; o post é editado com msg.edit e os avisos vão por followUp.
 */
async function adiar(interaction) {
  if (interaction.message) await interaction.deferUpdate();
  else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

const avisar = (interaction, content) =>
  interaction.message ? interaction.followUp(efemero(content)) : interaction.editReply(content);

/**
 * Início ("Assumida em", ou agora se ninguém assumiu), pausas (a aberta é fechada agora) e horas
 * úteis até agora descontando as pausas — o mesmo cálculo de /relatorio e /metricas.
 */
function tempoDesdeAssumida(embed) {
  const agora = new Date();
  const inicio = assumidaEm(embed) ?? agora;
  const pausas = fecharPausa(pausasDe(embed), agora);
  const horas = horasUteisSemPausa(inicio, agora, pausas);
  return { inicio, pausas, tempo: fmtDuracaoUtil(horas) };
}

/** "por @X" no log, e "(responsável: @Y)" quando quem finalizou não é o responsável. */
const porQuem = (u, respId) => `por ${u}${respId !== u.id ? ` (responsável: <@${respId}>)` : ''}`;

/** Aplica status + campos no post a partir do embed fresco e devolve o embed atualizado. */
export async function atualizarPost(thread, msg, status, campos) {
  // O Discord recusa troca de tags em post arquivado.
  if (thread.archived) await thread.setArchived(false);
  let embed = comStatus(msg.embeds[0], status);
  for (const [nome, valor, inline] of campos) embed = comCampo(embed, nome, valor, inline);

  await setStatus(thread, thread.parent, status);
  await msg.edit({ embeds: [embed], components: botoes(status, emPausa(embed.data)) });
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

/** Solicitante do post ou Gestão (a Importação fecha pelo Reprovar). */
const ehSolicitanteOuGestao = (interaction) =>
  solicitanteDe(interaction.message.embeds[0] ?? {}) === interaction.user.id || hasRole(interaction.member, 'gestao');

// Ações de quem abriu o pedido: tratadas antes da checagem de cargo da Importação.
const ACOES_SOLICITANTE = {
  cancelar: { recusa: 'Só quem abriu o pedido pode cancelar.', modal: () => MODAIS.cancelar() },
  editar: {
    recusa: 'Só quem abriu o pedido pode editar.',
    modal: (embed) => modalValidacao({ customId: 'valm:editar', valores: lerPedido(embed) }),
  },
};

export async function onButton(interaction) {
  const acao = interaction.customId.split(':')[1];
  if (ACOES_SOLICITANTE[acao]) {
    const { recusa, modal } = ACOES_SOLICITANTE[acao];
    if (!ehSolicitanteOuGestao(interaction)) return interaction.reply(efemero(recusa));
    return interaction.showModal(modal(interaction.message.embeds[0]));
  }
  if ((acao === 'pausar' || acao === 'retomar') && !hasRole(interaction.member, 'importacao')) {
    return interaction.reply(efemero('Só o time de **Importação** pode pausar ou retomar o tempo.'));
  }
  if (!hasRole(interaction.member, 'importacao', 'gestao')) {
    return interaction.reply(efemero('Só o time de **Importação** pode validar. Se tiver algo a acrescentar, escreva aqui no post.'));
  }
  // O modal precisa abrir na hora; o estado é conferido de novo quando ele for enviado.
  if (MODAIS[acao]) return interaction.showModal(MODAIS[acao]());

  const thread = interaction.channel;
  await adiar(interaction);
  return emFila(thread.id, () => executarBotao(interaction, acao, thread));
}

async function executarBotao(interaction, acao, thread) {
  const u = interaction.user;
  const { msg, embed: atual, status } = await estadoFresco(thread);
  const finalizado = FINALIZADOS.includes(status);

  if (acao === 'reabrir') {
    if (!finalizado) return avisar(interaction, `Este post já está aberto (${statusTexto(status ?? 'aguardando')}).`);
  } else if (finalizado) {
    return avisar(interaction, msgFinalizado(status));
  }

  if (acao === 'assumir') {
    const respId = responsavelDe(atual);
    // 🟠 também tem dono: só o /transferir troca. Posts 🟠 antigos ainda têm o botão habilitado.
    if (respId && (status === 'analise' || status === 'info')) {
      return avisar(interaction, `Já assumida por <@${respId}>. Use \`/transferir\` para passar para outra pessoa.`);
    }
    const desde = assumidaEm(atual) ?? new Date();
    await atualizarPost(thread, msg, 'analise', [
      [CAMPO.responsavel, `${u}`, true],
      [CAMPO.assumida, carimbo(desde), true],
    ]);
    await thread.send({ content: `🙋 ${u} assumiu esta validação.`, allowedMentions: { parse: [] } });
  } else if (acao === 'pausar' || acao === 'retomar') {
    const pausas = pausasDe(atual);
    const pausado = pausas.at(-1)?.fim === null;
    if ((acao === 'pausar') === pausado) {
      return avisar(interaction, pausado ? 'O tempo já está pausado.' : 'O tempo não está pausado.');
    }
    const agora = new Date();
    const novas = acao === 'pausar' ? [...pausas, { inicio: agora, fim: null }] : fecharPausa(pausas, agora);
    await atualizarPost(thread, msg, status, [[CAMPO.pausas, textoPausas(novas)]]);
    if (acao === 'pausar') {
      await thread.send({ content: `⏸️ ${u} pausou o tempo desta validação.`, allowedMentions: { parse: [] } });
      await registrarLog(interaction.guild, `⏸️ **Pausada** ${thread} — por ${u}`);
    } else {
      const min = Math.round((agora.getTime() - pausas.at(-1).inicio.getTime()) / 60000);
      await thread.send({ content: `▶️ ${u} retomou o tempo (ficou pausado ${min} min).`, allowedMentions: { parse: [] } });
      await registrarLog(interaction.guild, `▶️ **Retomada** ${thread} — por ${u} (pausada ${min} min)`);
    }
  } else if (acao === 'reabrir') {
    await atualizarPost(thread, msg, 'aguardando', [
      [CAMPO.responsavel, null],
      [CAMPO.assumida, null],
      [CAMPO.tempo, null],
      [CAMPO.tempoLegado, null],
      [CAMPO.finalizada, null],
      [CAMPO.pausas, null],
      [CAMPO.motivo, null],
      [CAMPO.categoria, null],
    ]);
    await thread.setAutoArchiveDuration(10080);
    const importacao = findRole(interaction.guild, 'importacao');
    await thread.send({
      content: `↩️ ${u} reabriu a validação (estava ${STATUS[status]?.emoji ?? ''} ${STATUS[status]?.label ?? '—'}). ${importacao ?? ''}`,
      allowedMentions: { roles: importacao ? [importacao.id] : [] },
    });
    await registrarLog(interaction.guild, `↩️ **Reaberta** ${thread} — por ${u}`);
  }
}

export async function onModal(interaction) {
  const acao = interaction.customId.split(':')[1];
  const thread = interaction.channel;
  await adiar(interaction);
  const aviso = await emFila(thread.id, () => executarModal(interaction, acao, thread));
  // Modal sem mensagem de origem respondeu com deferReply: fecha o "pensando…".
  if (!interaction.message && !aviso) await interaction.editReply('Post atualizado.');
}

async function executarModal(interaction, acao, thread) {
  const u = interaction.user;
  const f = interaction.fields;
  const { msg, embed: atual, status } = await estadoFresco(thread);
  // Dois modais enviados quase juntos: o segundo encontra o post já finalizado.
  if (FINALIZADOS.includes(status)) return avisar(interaction, msgFinalizado(status));

  if (acao === 'aprovar') {
    const virada = f.getStringSelectValues('virada')[0];
    const metodo = f.getTextInputValue('metodo').trim();
    const obs = f.getTextInputValue('obs')?.trim();
    const { inicio, pausas, tempo } = tempoDesdeAssumida(atual);
    // Quem assumiu continua responsável (crédito e tempo nas métricas); sem responsável, quem clicou assume.
    const respId = responsavelDe(atual) ?? u.id;
    const embed = await atualizarPost(thread, msg, 'aprovado', [
      [CAMPO.responsavel, `<@${respId}>`, true],
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
      `✅ **Validação aprovada** por ${u}.\n**Virada de chave:** ${virada}\n**Método:** ${metodo}${obs ? `\n**Ressalvas:** ${obs}` : ''}\n**Tempo desde que foi assumida (horas úteis):** ${tempo}\n\nPode subir o ticket de importação. Este post será arquivado após 24 h sem atividade.`,
    );
    await thread.setAutoArchiveDuration(1440);
    await registrarLog(interaction.guild, `🟢 **Aprovada** ${thread} — ${porQuem(u, respId)} (${tempo} desde assumida)`);
  } else if (acao === 'reprovar') {
    const valorCategoria = f.getStringSelectValues('categoria')[0];
    const categoria = MOTIVOS_REPROVACAO.find((m) => m.value === valorCategoria)?.label ?? valorCategoria;
    const detalhe = f.getTextInputValue('motivo')?.trim();
    // Modal não tem obrigatoriedade condicional: "Outro" exige o detalhe.
    if (valorCategoria === 'outro' && !detalhe) {
      return avisar(interaction, 'Com a categoria **Outro**, descreva o motivo em **Detalhes**. Clique em ⛔ Reprovar de novo.');
    }
    const motivo = detalhe ? `${categoria} — ${detalhe}` : categoria;
    const { inicio, pausas, tempo } = tempoDesdeAssumida(atual);
    const respId = responsavelDe(atual) ?? u.id;
    const embed = await atualizarPost(thread, msg, 'reprovado', [
      [CAMPO.responsavel, `<@${respId}>`, true],
      [CAMPO.assumida, carimbo(inicio), true],
      [CAMPO.categoria, categoria, true],
      [CAMPO.motivo, detalhe || null],
      [CAMPO.tempo, tempo, true],
      [CAMPO.tempoLegado, null],
      [CAMPO.finalizada, carimbo(new Date()), true],
      [CAMPO.pausas, textoPausas(pausas)],
    ]);
    await avisarSolicitante(
      thread,
      embed,
      `⛔ **Validação reprovada** por ${u}.\n**Motivo:** ${motivo}\n**Tempo desde que foi assumida (horas úteis):** ${tempo}\n\nNão suba ticket de importação para este cliente.`,
    );
    await thread.setAutoArchiveDuration(1440);
    await registrarLog(interaction.guild, `🔴 **Reprovada** ${thread} — ${porQuem(u, respId)} (${tempo} desde assumida): ${motivo}`);
  } else if (acao === 'info') {
    const motivo = f.getTextInputValue('motivo').trim();
    // Pedir info conta como assumir: mantém o responsável e o início do tempo, ou assume agora.
    const responsavelId = responsavelDe(atual);
    const embed = await atualizarPost(thread, msg, 'info', [
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
  } else if (acao === 'cancelar') {
    const motivo = f.getTextInputValue('motivo')?.trim();
    // Sem "Tempo de validação": cancelamento não entra nas métricas de análise.
    const respId = responsavelDe(atual);
    await atualizarPost(thread, msg, 'cancelado', [
      [CAMPO.motivo, motivo ? `Cancelado: ${motivo}` : 'Cancelado'],
      [CAMPO.finalizada, carimbo(new Date()), true],
      [CAMPO.pausas, textoPausas(fecharPausa(pausasDe(atual)))],
    ]);
    await thread.send({
      content: `⚪ ${u} cancelou o pedido.${motivo ? ` Motivo: ${motivo}` : ''}${respId ? ` <@${respId}>` : ''}

Este post será arquivado após 24 h sem atividade.`,
      allowedMentions: { users: respId ? [respId] : [] },
    });
    await thread.setAutoArchiveDuration(1440);
    await registrarLog(interaction.guild, `⚪ **Cancelada** ${thread} — por ${u}${motivo ? `: ${motivo}` : ''}`);
  } else if (acao === 'editar') {
    return editarPedido(interaction, thread, msg, atual, status);
  }
}

const ROTULOS_PEDIDO = { cliente: 'Cliente', sistema: 'Sistema', acesso: 'Acesso', dadosValores: 'Dados', obs: 'Observações' };

/** Substitui os campos do pedido; Observações nova entra logo depois de Dados, para manter a ordem do post. */
function comPedido(embed, { cliente, sistema, acesso, dadosValores, obs }) {
  const dados = DADOS.filter((d) => dadosValores.includes(d.value))
    .map((d) => `✅ ${d.label}`)
    .join('\n');
  let e = comCampo(embed, CAMPO.cliente, cliente, true);
  e = comCampo(e, CAMPO.sistema, sistema, true);
  e = comCampo(e, CAMPO.acesso, acesso);
  e = comCampo(e, CAMPO.dados, dados);
  const fields = e.data.fields.filter((f) => f.name !== CAMPO.obs);
  if (obs) fields.splice(fields.findIndex((f) => f.name === CAMPO.dados) + 1, 0, { name: CAMPO.obs, value: obs, inline: false });
  return e.setFields(fields).setTitle(`📋 ${cliente}`);
}

async function editarPedido(interaction, thread, msg, atual, status) {
  const u = interaction.user;
  if (status === 'analise') {
    return avisar(interaction, 'O post está em análise e não pode mais ser editado. Escreva aqui no post o que mudou.');
  }
  const f = interaction.fields;
  const novo = {
    cliente: f.getTextInputValue('cliente').trim(),
    sistema: f.getTextInputValue('sistema').trim(),
    acesso: f.getTextInputValue('acesso').trim(),
    dadosValores: f.getStringSelectValues('dados'),
    obs: f.getTextInputValue('obs')?.trim() ?? '',
  };
  const antigo = lerPedido(atual);
  const igual = (k) => (k === 'dadosValores' ? [...novo[k]].sort().join() === [...antigo[k]].sort().join() : novo[k] === antigo[k]);
  const mudou = Object.keys(ROTULOS_PEDIDO).filter((k) => !igual(k));
  if (!mudou.length) return avisar(interaction, 'Nada mudou no pedido.');

  if (thread.archived) await thread.setArchived(false);
  const embed = comPedido(atual, novo);
  if (mudou.includes('cliente') || mudou.includes('sistema')) await thread.setName(`${novo.cliente} — ${novo.sistema}`.slice(0, 100));
  if (mudou.includes('dadosValores')) await setTagsDeDados(thread, thread.parent, novo.dadosValores);

  const lista = mudou.map((k) => ROTULOS_PEDIDO[k]).join(', ');
  // 🟠: a edição conta como resposta ao pedido de informação.
  if (status === 'info') {
    await thread.send({ content: `✏️ ${u} editou o pedido: ${lista}`, allowedMentions: { parse: [] } });
    await voltarDeInfo(thread, msg, embed, u, 'editou o pedido');
  } else {
    await msg.edit({ embeds: [embed], components: botoes(status, emPausa(embed.data)) });
    invalidar(thread.id);
    await thread.send({ content: `✏️ ${u} editou o pedido: ${lista}`, allowedMentions: { parse: [] } });
  }
  await registrarLog(interaction.guild, `✏️ **Editada** ${thread} — por ${u} (${lista})`);
}

/**
 * Quem pode tirar um post do 🟠 respondendo: o solicitante, ou alguém do Comercial/Gestão que não seja da
 * Importação (colega cobrindo férias). temCargo, não hasRole: um admin da Importação não pode contar como resposta.
 */
export const podeResponder = (member, solicitanteId) =>
  member.id === solicitanteId || (temCargo(member, 'comercial', 'gestao') && !temCargo(member, 'importacao'));

/**
 * Quando o Comercial responde um post 🟠, devolve para 🔵 Em análise com o mesmo responsável.
 * Posts sem responsável (de antes dessa regra) voltam para a fila da Importação.
 */
export async function onThreadMessage(message) {
  const thread = message.channel;
  // Filtro barato pelo cache; o estado é conferido de novo dentro da fila.
  if (statusDoPost(thread, thread.parent) !== 'info') return;
  await emFila(thread.id, () => voltarParaAnalise(message, thread));
}

async function voltarParaAnalise(message, thread) {
  const { msg, embed: atual, status: statusAtual } = await estadoFresco(thread).catch(() => ({}));
  if (statusAtual !== 'info') return;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member || !podeResponder(member, solicitanteDe(atual))) return;
  await voltarDeInfo(thread, msg, atual, message.author);
}

/**
 * Tira o post do 🟠: volta para 🔵 com o mesmo responsável (ou 🟡 se não houver) e avisa quem vai continuar.
 * `embed` é o embed a gravar (o atual, ou já editado pelo ✏️ Editar).
 */
async function voltarDeInfo(thread, msg, base, autor, verbo = 'respondeu') {
  const responsavelId = responsavelDe(base.data ?? base);
  const status = responsavelId ? 'analise' : 'aguardando';
  const embed = comCampo(comStatus(base, status), CAMPO.motivo, null);
  await setStatus(thread, thread.parent, status);
  await msg.edit({ embeds: [embed], components: botoes(status, emPausa(embed.data)) });
  invalidar(thread.id);

  if (responsavelId) {
    await thread.send({
      content: `🔄 ${autor} ${verbo}. Voltou para ${statusTexto(status)} <@${responsavelId}>`,
      allowedMentions: { users: [responsavelId] },
    });
    return;
  }
  const importacao = findRole(thread.guild, 'importacao');
  await thread.send({
    content: `🔄 ${autor} ${verbo}. Voltou para ${statusTexto(status)} ${importacao ?? ''}`,
    allowedMentions: { roles: importacao ? [importacao.id] : [] },
  });
}
