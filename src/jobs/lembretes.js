import { env } from '../config.js';
import { postsAbertos } from '../commands/pendentes.js';
import { CAMPO, solicitanteDe } from '../post.js';
import { findRole, horasUteis } from '../util.js';

const responsavelDe = (embed) =>
  embed.fields?.find((f) => f.name === CAMPO.responsavel)?.value.match(/<@!?(\d+)>/)?.[1] ?? null;

/**
 * Cobra posts parados há mais de SLA_HORAS úteis. A própria mensagem de lembrete vira a
 * "última mensagem" do post, então a próxima cobrança só sai depois de outro SLA inteiro.
 */
export async function verificarPendentes(guild) {
  const { posts } = await postsAbertos(guild);
  const importacao = findRole(guild, 'importacao');

  for (const { thread, status } of posts) {
    try {
      const [ultima] = (await thread.messages.fetch({ limit: 1 })).values();
      const desde = ultima?.createdAt ?? thread.createdAt;
      const horas = horasUteis(desde);
      if (horas < env.slaHoras) continue;

      const starter = await thread.fetchStarterMessage().catch(() => null);
      const embed = starter?.embeds[0];
      const h = `${Math.floor(horas)} h úteis`;

      if (status === 'info') {
        const id = embed && solicitanteDe(embed);
        await thread.send({
          content: `⏰ ${id ? `<@${id}>` : 'Comercial'}, a Importação está esperando sua resposta há ${h}.`,
          allowedMentions: { users: id ? [id] : [] },
        });
      } else if (status === 'analise') {
        const id = embed && responsavelDe(embed);
        await thread.send({
          content: `⏰ ${id ? `<@${id}>` : (importacao ?? 'Importação')}, esta validação está em análise sem atualização há ${h}.`,
          allowedMentions: id ? { users: [id] } : { roles: importacao ? [importacao.id] : [] },
        });
      } else {
        await thread.send({
          content: `⏰ ${importacao ?? 'Importação'}, esta validação está aguardando há ${h}. Alguém pode assumir?`,
          allowedMentions: { roles: importacao ? [importacao.id] : [] },
        });
      }
    } catch (e) {
      console.error(`Lembrete falhou em ${thread.name}:`, e.message);
    }
  }
}

export function agendarLembretes(client) {
  const rodar = () => {
    for (const guild of client.guilds.cache.values()) {
      verificarPendentes(guild).catch((e) => console.error('Varredura de pendentes falhou:', e.message));
    }
  };
  setInterval(rodar, env.lembreteIntervaloMin * 60_000);
  rodar();
}
