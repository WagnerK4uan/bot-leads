import 'dotenv/config';

const num = (v, def) => (v === undefined || v === '' ? def : Number(v));

export const env = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  // Horas úteis sem resposta antes de cobrar o time de importação.
  slaHoras: num(process.env.SLA_HORAS, 2),
  // Intervalo da varredura de pendentes, em minutos.
  lembreteIntervaloMin: num(process.env.LEMBRETE_INTERVALO_MIN, 30),
  expedienteInicio: num(process.env.EXPEDIENTE_INICIO, 8),
  expedienteFim: num(process.env.EXPEDIENTE_FIM, 18),
  timezone: process.env.TZ_EXPEDIENTE || 'America/Sao_Paulo',
  // Resumo da semana anterior em #gestao toda segunda no início do expediente.
  resumoSemanal: process.env.RESUMO_SEMANAL !== 'false',
};

// Tudo é resolvido por nome em tempo de execução, então não há IDs para configurar.
export const ROLES = {
  gestao: { name: 'Gestão', color: 0xe67e22 },
  importacao: { name: 'Importação', color: 0x3498db },
  comercial: { name: 'Comercial', color: 0x2ecc71 },
};

export const CHANNELS = {
  boasVindas: 'boas-vindas',
  regras: 'regras-e-fluxo',
  avisos: 'avisos',
  forum: 'validacoes',
  log: 'log-validacoes',
  comercial: 'comercial',
  importacao: 'importacao',
  geral: 'geral',
  gestao: 'gestao',
};

export const CATEGORIES = {
  inicio: '📌 INÍCIO',
  validacao: '✅ VALIDAÇÃO',
  times: '💬 TIMES',
  gestao: '🔧 GESTÃO',
};

// Nome da tag no Discord tem limite de 20 caracteres; o emoji vai no campo próprio.
export const STATUS = {
  aguardando: { tag: 'Aguardando validação', emoji: '🟡', color: 0xf1c40f, label: 'Aguardando validação' },
  analise: { tag: 'Em análise', emoji: '🔵', color: 0x3498db, label: 'Em análise' },
  aprovado: { tag: 'Aprovado', emoji: '🟢', color: 0x2ecc71, label: 'Aprovado' },
  reprovado: { tag: 'Reprovado', emoji: '🔴', color: 0xe74c3c, label: 'Reprovado' },
  info: { tag: 'Pendente de info', emoji: '🟠', color: 0xe67e22, label: 'Pendente de informação' },
};

// Status que ainda dependem do time de importação (entram no lembrete e no /pendentes).
export const STATUS_ABERTOS = ['aguardando', 'analise', 'info'];

export const DADOS = [
  { value: 'clientes', label: 'Clientes', tag: 'Clientes' },
  { value: 'fornecedores', label: 'Fornecedores', tag: 'Fornecedores' },
  { value: 'produtos', label: 'Produtos', tag: 'Produtos' },
  { value: 'historico', label: 'Histórico de Venda', tag: 'Histórico de Venda' },
  { value: 'os', label: 'Ordem de Serviço', tag: 'Ordem de Serviço' },
  { value: 'pagar', label: 'Contas a Pagar', tag: 'Contas a Pagar' },
  { value: 'receber', label: 'Contas a Receber', tag: 'Contas a Receber' },
];

// O Discord aceita no máximo 5 tags por post: 1 de status + até 4 de dados.
export const MAX_TAGS_DADOS = 4;

export const FORUM_GUIDELINES = [
  'Este fórum é onde o Comercial pede a validação de importação de um lead e o time de Importação responde.',
  '',
  '➡️ Para abrir uma validação use o comando /validacao (não dá para criar post direto).',
  '➡️ Cada cliente = 1 post. Toda conversa sobre ele acontece DENTRO do post.',
  '➡️ Só suba ticket de importação depois que o post estiver 🟢 Aprovado.',
  '',
  'Status: 🟡 Aguardando • 🔵 Em análise • 🟠 Pendente de info • 🟢 Aprovado • 🔴 Reprovado',
].join('\n');
