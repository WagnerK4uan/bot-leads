import { env } from '../config.js';
import { mesAntes, publicarMes } from '../metricasMes.js';
import { partes } from '../util.js';

const INTERVALO = 30 * 60_000;

/**
 * Em dia útil, a partir do início do expediente, posta o fechamento do mês anterior em
 * #metricas-importacao se ainda não foi postado (o rodapé "Mês AAAA-MM" evita repetir após reinício).
 * Na prática sai no 1º dia útil do mês.
 */
export function agendarFechamento(client) {
  if (!env.metricasMensal) return;
  const rodar = () => {
    const { weekday, hour } = partes(new Date());
    if (weekday === 'Sat' || weekday === 'Sun' || hour < env.expedienteInicio) return;
    const chave = mesAntes(1);
    for (const guild of client.guilds.cache.values()) {
      publicarMes(guild, chave).catch((e) => console.error('Fechamento mensal falhou:', e.message));
    }
  };
  setInterval(rodar, INTERVALO);
  rodar();
}
