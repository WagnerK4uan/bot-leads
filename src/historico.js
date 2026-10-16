import { STATUS } from './config.js';
import { CAMPO, assumidaEm, dataDoCampo, responsavelDe, solicitanteDe } from './post.js';
import { findForum, statusDoPost } from './util.js';

/**
 * Leitura de todos os posts do fórum (ativos + arquivados) para relatórios e histórico.
 * O embed só muda por ação do bot, então cada post é lido uma vez e guardado; as ações chamam
 * invalidar(threadId) para forçar nova leitura. O status vem sempre fresco das tags da thread.
 */
const LISTA_TTL = 2 * 60_000;
const LOTE = 5;

const embeds = new Map(); // threadId -> dados do embed já interpretados
const cache = new Map(); // guildId -> { em, registros }
const emAndamento = new Map(); // guildId -> Promise

export function invalidar(threadId) {
  if (threadId) embeds.delete(threadId);
  // Mantém a lista antiga para o autocomplete, só marca como vencida.
  for (const c of cache.values()) c.em = 0;
}

/** "Clipp  Pró" e "clipp pro" viram a mesma chave. */
export const chaveSistema = (nome) =>
  (nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const campo = (embed, nome) => embed.fields?.find((f) => f.name === nome)?.value ?? null;

function lerEmbed(embed) {
  const sistema = campo(embed, CAMPO.sistema);
  const assumida = assumidaEm(embed);
  const tempoMin = Number(campo(embed, CAMPO.tempo)?.match(/(\d+)\s*min/)?.[1]);
  // Posts aprovados antes do campo "Finalizada em" só têm o "Tempo até aprovação".
  const finalizada =
    dataDoCampo(embed, CAMPO.finalizada) ??
    (assumida && Number.isFinite(tempoMin) ? new Date(assumida.getTime() + tempoMin * 60_000) : null);
  return {
    cliente: campo(embed, CAMPO.cliente),
    sistema,
    sistemaChave: chaveSistema(sistema),
    solicitanteId: solicitanteDe(embed),
    responsavelId: responsavelDe(embed),
    assumidaEm: assumida,
    finalizadaEm: finalizada,
    metodo: campo(embed, CAMPO.metodo),
    virada: campo(embed, CAMPO.virada),
    motivo: campo(embed, CAMPO.motivo),
  };
}

async function listarThreads(forum) {
  const threads = new Map();
  const { threads: ativas } = await forum.guild.channels.fetchActiveThreads();
  for (const t of ativas.values()) if (t.parentId === forum.id) threads.set(t.id, t);

  let before;
  for (;;) {
    const { threads: pagina, hasMore } = await forum.threads.fetchArchived({ type: 'public', limit: 100, before });
    for (const t of pagina.values()) threads.set(t.id, t);
    if (!hasMore || !pagina.size) break;
    before = new Date(Math.min(...pagina.map((t) => t.archivedAt?.getTime() ?? Date.now())));
  }
  return [...threads.values()];
}

async function carregar(guild) {
  const forum = findForum(guild);
  if (!forum) return [];
  const threads = await listarThreads(forum);

  const faltando = threads.filter((t) => !embeds.has(t.id));
  for (let i = 0; i < faltando.length; i += LOTE) {
    await Promise.all(
      faltando.slice(i, i + LOTE).map(async (t) => {
        const msg = await t.fetchStarterMessage().catch(() => null);
        // Post sem embed (ex.: criado à mão) fica de fora, mas não é buscado de novo.
        embeds.set(t.id, msg?.embeds[0] ? lerEmbed(msg.embeds[0]) : null);
      }),
    );
  }

  return threads
    .filter((t) => embeds.get(t.id))
    .map((t) => ({ thread: t, status: statusDoPost(t, forum), criadoEm: t.createdAt, ...embeds.get(t.id) }))
    .sort((a, b) => b.criadoEm - a.criadoEm);
}

/** Registros de todos os posts do fórum, do mais novo para o mais antigo. */
export async function carregarPosts(guild, { forcar = false } = {}) {
  const atual = cache.get(guild.id);
  if (!forcar && atual && Date.now() - atual.em < LISTA_TTL) return atual.registros;
  if (!emAndamento.has(guild.id)) {
    const p = carregar(guild)
      .then((registros) => {
        cache.set(guild.id, { em: Date.now(), registros });
        return registros;
      })
      .finally(() => emAndamento.delete(guild.id));
    emAndamento.set(guild.id, p);
  }
  return emAndamento.get(guild.id);
}

/** Validações do mesmo sistema, mais novas primeiro. */
export const doSistema = (registros, nome) => {
  const chave = chaveSistema(nome);
  return chave ? registros.filter((r) => r.sistemaChave === chave) : [];
};

export const contagemPorStatus = (registros) =>
  Object.entries(STATUS)
    .map(([k, s]) => [s.emoji, registros.filter((r) => r.status === k).length])
    .filter(([, n]) => n)
    .map(([emoji, n]) => `${emoji} ${n}`)
    .join(' · ');

/** "🟢 #post — Backup Firebird (12/09)" */
export function linhaHistorico(r) {
  const detalhe = r.status === 'aprovado' ? r.metodo : r.motivo;
  const quando = `<t:${Math.floor((r.finalizadaEm ?? r.criadoEm).getTime() / 1000)}:d>`;
  return `${STATUS[r.status]?.emoji ?? '⚪'} ${r.thread}${detalhe ? ` — ${detalhe.slice(0, 120)}` : ''} (${quando})`;
}

/** Último resultado carregado, sem chamar a API (para autocomplete, que tem 3 s para responder). */
export function emCache(guild) {
  const atual = cache.get(guild.id);
  if (!atual || Date.now() - atual.em >= LISTA_TTL) carregarPosts(guild).catch(() => {});
  return atual?.registros ?? [];
}
