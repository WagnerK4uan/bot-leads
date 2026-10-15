/**
 * Monta a estrutura do servidor: cargos, categorias, canais, fórum, permissões e mensagens fixas.
 * Idempotente: só cria o que falta e só *acrescenta* permissões nos cargos do bot; nada é apagado.
 *
 *   npm run setup:dry        mostra o que seria feito
 *   npm run setup            aplica
 *   npm run setup -- --republicar   apaga e republica as mensagens do bot em #boas-vindas e #regras-e-fluxo
 */
import {
  ChannelType,
  Client,
  Events,
  ForumLayoutType,
  GatewayIntentBits,
  PermissionFlagsBits as P,
  SortOrderType,
} from 'discord.js';
import { CATEGORIES, CHANNELS, DADOS, FORUM_GUIDELINES, ROLES, STATUS, env } from './config.js';
import { regras, tutorial } from './welcome.js';

const DRY = process.argv.includes('--dry-run');
const REPUBLICAR = process.argv.includes('--republicar');
const log = (msg) => console.log(`${DRY ? '[dry-run] ' : ''}${msg}`);

const LER = { ViewChannel: true, ReadMessageHistory: true };
const SO_LER = { ...LER, SendMessages: false, CreatePublicThreads: false, CreatePrivateThreads: false };
const ESCREVER = { ...LER, SendMessages: true, AttachFiles: true, EmbedLinks: true, AddReactions: true };
const OCULTO = { ViewChannel: false };

// Gestão tem Administrator e enxerga tudo; não precisa de overwrite.
const ESTRUTURA = [
  {
    categoria: CATEGORIES.inicio,
    perms: { everyone: SO_LER },
    canais: [
      { key: 'boasVindas', topic: 'Comece aqui: escolha seu setor e veja o passo a passo.', perms: { everyone: SO_LER } },
      { key: 'regras', topic: 'Como funciona a validação de importação.', perms: { everyone: SO_LER } },
      { key: 'avisos', topic: 'Comunicados da gestão.', perms: { everyone: SO_LER } },
    ],
  },
  {
    categoria: CATEGORIES.validacao,
    perms: { everyone: OCULTO, comercial: LER, importacao: LER },
    canais: [
      {
        key: 'forum',
        type: ChannelType.GuildForum,
        perms: {
          everyone: OCULTO,
          // Sem SendMessages ninguém cria post na mão: o único caminho é o /validacao.
          comercial: { ...ESCREVER, SendMessages: false, SendMessagesInThreads: true, UseApplicationCommands: true },
          importacao: { ...ESCREVER, SendMessages: false, SendMessagesInThreads: true, UseApplicationCommands: true },
        },
      },
      {
        key: 'log',
        topic: 'Histórico automático de validações abertas, aprovadas e reprovadas.',
        perms: { everyone: OCULTO, comercial: SO_LER, importacao: SO_LER },
      },
    ],
  },
  {
    categoria: CATEGORIES.times,
    perms: { everyone: OCULTO, comercial: ESCREVER, importacao: ESCREVER },
    canais: [
      { key: 'comercial', topic: 'Conversa interna do time Comercial.', perms: { everyone: OCULTO, comercial: ESCREVER, importacao: OCULTO } },
      { key: 'importacao', topic: 'Conversa interna do time de Importação.', perms: { everyone: OCULTO, importacao: ESCREVER, comercial: OCULTO } },
      { key: 'geral', topic: 'Conversa entre os times. Pedido de validação vai no /validacao.', perms: { everyone: OCULTO, comercial: ESCREVER, importacao: ESCREVER } },
    ],
  },
  {
    categoria: CATEGORIES.gestao,
    perms: { everyone: OCULTO },
    canais: [{ key: 'gestao', topic: 'Somente gestão.', perms: { everyone: OCULTO } }],
  },
];

const TAGS = [
  ...Object.values(STATUS).map((s) => ({ name: s.tag, emoji: { id: null, name: s.emoji }, moderated: true })),
  ...DADOS.map((d) => ({ name: d.tag, moderated: false })),
];

async function garantirCargos(guild) {
  const roles = { everyone: guild.roles.everyone };
  for (const [key, def] of Object.entries(ROLES)) {
    let role = guild.roles.cache.find((r) => r.name === def.name);
    if (!role) {
      log(`+ cargo ${def.name}`);
      if (!DRY) {
        role = await guild.roles.create({
          name: def.name,
          color: def.color,
          hoist: true,
          mentionable: true,
          permissions: key === 'gestao' ? [P.Administrator] : [],
        });
      }
    }
    roles[key] = role;
  }

  const owner = await guild.fetchOwner();
  if (roles.gestao && !owner.roles.cache.has(roles.gestao.id)) {
    log(`+ cargo Gestão para o dono do servidor (${owner.user.tag})`);
    if (!DRY) await owner.roles.add(roles.gestao);
  } else if (!roles.gestao) {
    log(`+ cargo Gestão para o dono do servidor (${owner.user.tag})`);
  }
  return roles;
}

async function aplicarPerms(canal, perms, roles) {
  for (const [key, valores] of Object.entries(perms)) {
    const role = roles[key];
    if (!role) continue; // dry-run: cargo ainda não existe
    const atual = canal.permissionOverwrites?.cache.get(role.id);
    const mudou = Object.entries(valores).some(([perm, v]) => {
      const bit = P[perm];
      const estado = atual?.allow.has(bit) ? true : atual?.deny.has(bit) ? false : null;
      return estado !== v;
    });
    if (!mudou) continue;
    log(`  ~ permissões de ${role.name} em ${canal.name}`);
    if (!DRY) await canal.permissionOverwrites.edit(role, valores);
  }
}

async function garantirCanal(guild, { key, type = ChannelType.GuildText, topic }, categoria) {
  const nome = CHANNELS[key];
  let canal = guild.channels.cache.find((c) => c.name === nome && c.type === type);
  if (!canal) {
    log(`+ canal ${type === ChannelType.GuildForum ? 'fórum ' : '#'}${nome}`);
    if (DRY) return null;
    const base = { name: nome, type, parent: categoria?.id };
    canal =
      type === ChannelType.GuildForum
        ? await guild.channels.create({
            ...base,
            topic: FORUM_GUIDELINES,
            availableTags: TAGS,
            defaultReactionEmoji: { id: null, name: '✅' },
            defaultForumLayout: ForumLayoutType.ListView,
            defaultSortOrder: SortOrderType.LatestActivity,
            defaultAutoArchiveDuration: 10080,
          })
        : await guild.channels.create({ ...base, topic });
    return canal;
  }

  if (categoria && canal.parentId !== categoria.id) {
    log(`~ movendo #${nome} para ${categoria.name}`);
    if (!DRY) await canal.setParent(categoria.id, { lockPermissions: false });
  }
  if (type === ChannelType.GuildForum) {
    const faltando = TAGS.filter((t) => !canal.availableTags.some((a) => a.name === t.name));
    if (faltando.length) {
      log(`  + tags no fórum: ${faltando.map((t) => t.name).join(', ')}`);
      if (!DRY) await canal.setAvailableTags([...canal.availableTags, ...faltando]);
    }
    if (canal.topic !== FORUM_GUIDELINES) {
      log('  ~ diretrizes do fórum');
      if (!DRY) await canal.setTopic(FORUM_GUIDELINES);
    }
  } else if (topic && !canal.topic) {
    log(`  ~ tópico de #${nome}`);
    if (!DRY) await canal.setTopic(topic);
  }
  return canal;
}

async function publicar(canal, mensagens, client) {
  if (!canal) return;
  const doBot = (await canal.messages.fetch({ limit: 50 })).filter((m) => m.author.id === client.user.id);
  if (doBot.size && !REPUBLICAR) return log(`= #${canal.name} já tem mensagens do bot (use --republicar para refazer)`);
  log(`+ publicando ${mensagens.length} mensagem(ns) em #${canal.name}`);
  if (DRY) return;
  for (const m of doBot.values()) await m.delete().catch(() => {});
  const enviadas = [];
  for (const m of mensagens) enviadas.push(await canal.send(m));
  await enviadas[0].pin().catch(() => {});
}

async function main() {
  if (!env.token || !env.guildId) throw new Error('Configure DISCORD_TOKEN e GUILD_ID no .env');
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  const pronto = new Promise((r) => client.once(Events.ClientReady, r));
  await client.login(env.token);
  await pronto;

  const guild = await client.guilds.fetch(env.guildId);
  await guild.roles.fetch();
  await guild.channels.fetch();
  console.log(`Servidor: ${guild.name}`);

  if (!guild.features.includes('COMMUNITY')) {
    throw new Error(
      'O servidor precisa ser "Comunidade" para ter canal fórum.\n' +
        'Configurações do servidor › Ativar Comunidade (pode escolher #regras-e-fluxo e #avisos depois).',
    );
  }

  const roles = await garantirCargos(guild);

  for (const grupo of ESTRUTURA) {
    let cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === grupo.categoria);
    if (!cat) {
      log(`+ categoria ${grupo.categoria}`);
      if (!DRY) cat = await guild.channels.create({ name: grupo.categoria, type: ChannelType.GuildCategory });
    }
    if (cat) await aplicarPerms(cat, grupo.perms, roles);
    for (const def of grupo.canais) {
      const canal = await garantirCanal(guild, def, cat);
      if (canal) await aplicarPerms(canal, def.perms, roles);
    }
  }

  await guild.channels.fetch();
  const porKey = (key) => guild.channels.cache.find((c) => c.name === CHANNELS[key] && c.type === ChannelType.GuildText);
  await publicar(porKey('boasVindas'), tutorial(guild), client);
  await publicar(porKey('regras'), [regras(guild)], client);

  const membros = await guild.members.fetch();
  const semSetor = membros.filter((m) => !m.user.bot && !Object.keys(ROLES).some((k) => roles[k] && m.roles.cache.has(roles[k].id)));
  if (semSetor.size) {
    console.log(`\n⚠️  ${semSetor.size} membro(s) sem setor — só verão #boas-vindas até escolher: ${semSetor.map((m) => m.displayName).join(', ')}`);
  }

  console.log(DRY ? '\nNada foi alterado. Rode "npm run setup" para aplicar.' : '\nPronto.');
  await client.destroy();
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
