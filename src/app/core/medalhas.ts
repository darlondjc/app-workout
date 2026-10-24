import { Exercise, Sessao } from './models';
import { dataISO, deIso, dias, inicioSemana, volumeSessao } from './stats';

/** Do mais simples ao mais raro. Cada nível substitui o anterior: a pessoa tem sempre uma só medalha por meta. */
export type Nivel = 'bronze' | 'prata' | 'ouro' | 'diamante';

export const NIVEIS: readonly Nivel[] = ['bronze', 'prata', 'ouro', 'diamante'];

export const NOMES_NIVEL: Record<Nivel, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  diamante: 'Diamante',
};

/** As metas que têm medalha. */
export type TipoConquista = 'treinos' | 'ano' | 'constancia' | 'sequencia' | 'volume' | 'recordes' | 'superiores' | 'inferiores' | 'cardio';

/** Onde um exercício conta nas medalhas por região do corpo. Abdômen fica de fora (nem superior, nem inferior). */
export type RegiaoDoExercicio = 'superior' | 'inferior' | 'cardio';

const MUSCULOS_INFERIORES = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'];
const MUSCULOS_SUPERIORES = ['chest', 'lats', 'middle back', 'lower back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'neck'];

/** Região do exercício pelo músculo principal (ou cardio pela categoria); `null` quando não conta em nenhuma. */
export function regiaoDoExercicio(e: Exercise | undefined): RegiaoDoExercicio | null {
  if (!e) return null;
  if (e.category === 'cardio') return 'cardio';
  const musculo = e.primaryMuscles[0];
  if (MUSCULOS_INFERIORES.includes(musculo)) return 'inferior';
  if (MUSCULOS_SUPERIORES.includes(musculo)) return 'superior';
  return null;
}

/** Informações de fora do histórico que algumas medalhas pedem. */
export interface ContextoMedalhas {
  /** Dia de hoje: define o ano da medalha anual. Padrão: agora. */
  hoje?: Date;
  /** Região de um exercício pelo id; sem isto as medalhas por região ficam zeradas. */
  regiaoDe?: (exerciseId: string) => RegiaoDoExercicio | null;
}

/** Um degrau da trilha: o valor a alcançar para ganhar aquele nível. */
export interface Degrau {
  nivel: Nivel;
  alvo: number;
  conquistado: boolean;
  /** Dia em que foi alcançado (yyyy-mm-dd). Só existe quando `conquistado`. */
  data: string | null;
}

/** Uma meta com a sua trilha de quatro níveis e o ponto em que a pessoa está. */
export interface Conquista {
  id: TipoConquista;
  titulo: string;
  descricao: string;
  /** Quanto a pessoa já alcançou (treinos, semanas, kg ou recordes, conforme a meta). */
  atual: number;
  degraus: Degrau[];
  /** Maior nível já conquistado; `null` se ainda não chegou ao bronze. */
  nivel: Nivel | null;
  /** Dia em que ganhou o nível atual. */
  dataDoNivel: string | null;
  /** Próximo degrau a alcançar; `null` quando já está no nível máximo. */
  proximo: Degrau | null;
}

/** Uma vez em que a carga de um exercício passou o melhor que a pessoa tinha até então. */
export interface RecordeEvento {
  exerciseId: string;
  carga: number;
  antes: number;
  data: string;
}

interface Definicao {
  id: TipoConquista;
  titulo: string;
  descricao: string;
  /** Alvo de cada nível, na ordem bronze, prata, ouro, diamante. */
  alvos: [number, number, number, number];
}

const definicoes = (ano: number): Definicao[] => [
  { id: 'treinos', titulo: 'Treinos', descricao: 'Treinos concluídos', alvos: [5, 25, 100, 250] },
  { id: 'ano', titulo: `Treinos em ${ano}`, descricao: `Treinos concluídos em ${ano}. A contagem recomeça a cada ano.`, alvos: [20, 60, 120, 200] },
  { id: 'constancia', titulo: 'Constância', descricao: 'Semanas seguidas cumprindo a meta', alvos: [2, 4, 12, 24] },
  { id: 'sequencia', titulo: 'Dias seguidos', descricao: 'Maior sequência de dias treinando sem parar', alvos: [3, 7, 14, 30] },
  { id: 'volume', titulo: 'Carga levantada', descricao: 'Carga total somada (kg × repetições)', alvos: [1000, 10000, 50000, 200000] },
  { id: 'recordes', titulo: 'Recordes', descricao: 'Vezes em que você superou a sua melhor carga', alvos: [1, 10, 30, 100] },
  { id: 'superiores', titulo: 'Superiores', descricao: 'Exercícios de peito, costas, ombros e braços', alvos: [30, 150, 500, 1500] },
  { id: 'inferiores', titulo: 'Inferiores', descricao: 'Exercícios de pernas e glúteos', alvos: [20, 100, 300, 750] },
  { id: 'cardio', titulo: 'Cardio', descricao: 'Exercícios de cardio feitos', alvos: [5, 25, 75, 150] },
];

function ordem(a: Sessao, b: Sessao): number {
  return a.data.localeCompare(b.data) || (a.concluidaEm ?? 0) - (b.concluidaEm ?? 0);
}

/**
 * Todos os recordes de carga, do mais antigo ao mais recente. A primeira vez que um exercício
 * aparece só estabelece a marca; recorde é passar uma marca que já existia (mesmo critério de `recordesDaSessao`).
 */
export function historicoDeRecordes(h: Sessao[]): RecordeEvento[] {
  const melhor = new Map<string, number>();
  const out: RecordeEvento[] = [];
  for (const s of [...h].sort(ordem)) {
    for (const r of s.registros ?? []) {
      if (r.unidade === 'min' || r.series.length === 0) continue;
      const carga = Math.max(0, ...r.series.map((x) => x.carga));
      const antes = melhor.get(r.exerciseId);
      if (antes !== undefined && carga > antes) out.push({ exerciseId: r.exerciseId, carga, antes, data: s.data });
      melhor.set(r.exerciseId, Math.max(antes ?? 0, carga));
    }
  }
  return out;
}

/**
 * Semanas seguidas em que a meta foi cumprida: a maior sequência já feita e o dia em que cada
 * tamanho de sequência foi alcançado pela primeira vez (o dia do treino que fechou a meta da semana).
 */
function constancia(ordenadas: Sessao[], meta: number): { melhor: number; datas: Map<number, string> } {
  const semanas = new Map<string, Sessao[]>();
  for (const s of ordenadas) {
    const k = dataISO(inicioSemana(deIso(s.data)));
    const lista = semanas.get(k);
    if (lista) lista.push(s);
    else semanas.set(k, [s]);
  }
  const datas = new Map<number, string>();
  let melhor = 0;
  let seguidas = 0;
  let anterior: Date | null = null;
  for (const k of [...semanas.keys()].sort()) {
    const treinos = semanas.get(k) ?? [];
    if (treinos.length < meta) continue;
    const inicio = deIso(k);
    seguidas = anterior && dias(anterior, inicio) === 7 ? seguidas + 1 : 1;
    anterior = inicio;
    melhor = Math.max(melhor, seguidas);
    if (!datas.has(seguidas)) datas.set(seguidas, treinos[meta - 1].data);
  }
  return { melhor, datas };
}

/** Maior sequência de dias seguidos com treino e o dia em que cada tamanho de sequência foi alcançado. */
function sequenciaDeDias(ordenadas: Sessao[]): { melhor: number; datas: Map<number, string> } {
  const unicos = [...new Set(ordenadas.map((s) => s.data))].sort();
  const datas = new Map<number, string>();
  let melhor = 0;
  let seguidos = 0;
  let anterior: Date | null = null;
  for (const d of unicos) {
    const dia = deIso(d);
    seguidos = anterior && dias(anterior, dia) === 1 ? seguidos + 1 : 1;
    anterior = dia;
    melhor = Math.max(melhor, seguidos);
    if (!datas.has(seguidos)) datas.set(seguidos, d);
  }
  return { melhor, datas };
}

/** Quanto a pessoa tem em cada meta e o dia em que passou cada alvo. */
function medir(def: Definicao, ordenadas: Sessao[], recordes: RecordeEvento[], meta: number, ctx: { ano: number; regiaoDe: (id: string) => RegiaoDoExercicio | null }): { atual: number; dataDe: (alvo: number) => string | null } {
  switch (def.id) {
    case 'treinos':
      return { atual: ordenadas.length, dataDe: (alvo) => ordenadas[alvo - 1]?.data ?? null };
    case 'ano': {
      const doAno = ordenadas.filter((s) => s.data.startsWith(`${ctx.ano}-`));
      return { atual: doAno.length, dataDe: (alvo) => doAno[alvo - 1]?.data ?? null };
    }
    case 'sequencia': {
      const { melhor, datas } = sequenciaDeDias(ordenadas);
      return { atual: melhor, dataDe: (alvo) => datas.get(alvo) ?? null };
    }
    case 'superiores':
    case 'inferiores':
    case 'cardio': {
      const regiao: RegiaoDoExercicio = def.id === 'superiores' ? 'superior' : def.id === 'inferiores' ? 'inferior' : 'cardio';
      const datas: string[] = [];
      for (const s of ordenadas) {
        for (const r of s.registros ?? []) {
          if (r.series.length === 0) continue;
          const doExercicio = r.unidade === 'min' ? 'cardio' : ctx.regiaoDe(r.exerciseId);
          if (doExercicio === regiao) datas.push(s.data);
        }
      }
      return { atual: datas.length, dataDe: (alvo) => datas[alvo - 1] ?? null };
    }
    case 'constancia': {
      const { melhor, datas } = constancia(ordenadas, meta);
      return { atual: melhor, dataDe: (alvo) => datas.get(alvo) ?? null };
    }
    case 'volume': {
      let acumulado = 0;
      const datas = new Map<number, string>();
      for (const s of ordenadas) {
        acumulado += volumeSessao(s);
        for (const alvo of def.alvos) if (acumulado >= alvo && !datas.has(alvo)) datas.set(alvo, s.data);
      }
      return { atual: acumulado, dataDe: (alvo) => datas.get(alvo) ?? null };
    }
    case 'recordes':
      return { atual: recordes.length, dataDe: (alvo) => recordes[alvo - 1]?.data ?? null };
  }
}

/**
 * As medalhas de cada meta. São calculadas a partir do histórico (nada é guardado à parte), então valem
 * em qualquer aparelho e acompanham os treinos sincronizados.
 */
export function calcularConquistas(h: Sessao[], meta: number, contexto: ContextoMedalhas = {}): Conquista[] {
  const ordenadas = [...h].sort(ordem);
  const recordes = historicoDeRecordes(h);
  const ctx = { ano: (contexto.hoje ?? new Date()).getFullYear(), regiaoDe: contexto.regiaoDe ?? (() => null) };
  return definicoes(ctx.ano).map((def) => {
    const { atual, dataDe } = medir(def, ordenadas, recordes, meta, ctx);
    const degraus: Degrau[] = def.alvos.map((alvo, i) => {
      const conquistado = atual >= alvo;
      return { nivel: NIVEIS[i], alvo, conquistado, data: conquistado ? dataDe(alvo) : null };
    });
    const feitos = degraus.filter((d) => d.conquistado);
    const ultimo = feitos.at(-1) ?? null;
    return {
      id: def.id,
      titulo: def.titulo,
      descricao: def.descricao,
      atual,
      degraus,
      nivel: ultimo?.nivel ?? null,
      dataDoNivel: ultimo?.data ?? null,
      proximo: degraus.find((d) => !d.conquistado) ?? null,
    };
  });
}

/** Maior nível primeiro; quem ainda não tem medalha vai para o fim. Empates mantêm a ordem de antes. */
export function ordenarPorNivel(conquistas: Conquista[]): Conquista[] {
  const peso = (c: Conquista) => (c.nivel ? NIVEIS.indexOf(c.nivel) : -1);
  return [...conquistas].sort((a, b) => peso(b) - peso(a));
}

/** Fração (0 a 1) do caminho já feito até o próximo nível; 1 quando já está no máximo. */
export function fracaoAteOProximo(c: Conquista): number {
  return c.proximo ? Math.min(1, c.atual / c.proximo.alvo) : 1;
}

/** A meta cujo próximo nível está mais perto de ser alcançado. `null` quando todas estão no nível máximo. */
export function proximaConquista(conquistas: Conquista[]): Conquista | null {
  return conquistas
    .filter((c) => c.proximo)
    .reduce<Conquista | null>((melhor, c) => (melhor === null || fracaoAteOProximo(c) > fracaoAteOProximo(melhor) ? c : melhor), null);
}

/** "21 de 25 treinos", "7 de 12 semanas", "42,4 t de 50 t": o caminho até um alvo, com a unidade dita uma vez só. */
export function formatarProgresso(id: TipoConquista, atual: number, alvo: number): string {
  return id === 'volume' ? `${formatarValor(id, atual)} de ${formatarValor(id, alvo)}` : `${atual} de ${formatarValor(id, alvo)}`;
}

/** Um valor com a unidade da meta: "62 treinos", "8 semanas", "2,5 t", "3 recordes". */
export function formatarValor(id: TipoConquista, v: number): string {
  switch (id) {
    case 'treinos':
    case 'ano':
      return `${v} ${v === 1 ? 'treino' : 'treinos'}`;
    case 'sequencia':
      return `${v} ${v === 1 ? 'dia' : 'dias'}`;
    case 'superiores':
    case 'inferiores':
      return `${v} ${v === 1 ? 'exercício' : 'exercícios'}`;
    case 'cardio':
      return `${v} ${v === 1 ? 'cardio' : 'cardios'}`;
    case 'constancia':
      return `${v} ${v === 1 ? 'semana' : 'semanas'}`;
    case 'recordes':
      return `${v} ${v === 1 ? 'recorde' : 'recordes'}`;
    case 'volume':
      return v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` : `${Math.round(v)} kg`;
  }
}

/** Um nível novo conquistado, ainda não visto pela pessoa. */
export interface NovaMedalha {
  id: TipoConquista;
  nivel: Nivel;
  /** Dia em que foi conquistado (yyyy-mm-dd). */
  em: string;
}

/** Níveis que subiram de `antes` para `depois`, um por meta (o maior alcançado). */
export function niveisGanhos(antes: Conquista[], depois: Conquista[], em: string): NovaMedalha[] {
  const rank = (n: Nivel | null) => (n ? NIVEIS.indexOf(n) : -1);
  const out: NovaMedalha[] = [];
  for (const d of depois) {
    const a = antes.find((x) => x.id === d.id);
    if (d.nivel && rank(d.nivel) > rank(a?.nivel ?? null)) out.push({ id: d.id, nivel: d.nivel, em });
  }
  return out;
}

/**
 * Identifica o que as medalhas guardadas levaram em conta: histórico, meta semanal e ano. Se mudar
 * (treino vindo da nuvem, meta alterada, virada do ano), é hora de recalcular; senão, vale o que está guardado.
 */
export function impressaoDoHistorico(h: Sessao[], meta: number, ano: number): string {
  const ultimo = h.reduce((m, s) => Math.max(m, s.concluidaEm ?? 0), 0);
  const soma = h.reduce((t, s) => t + (s.registros?.length ?? 0), 0);
  return `${h.length}:${ultimo}:${soma}:${meta}:${ano}`;
}
