import { Sessao } from './models';
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
export type TipoConquista = 'treinos' | 'constancia' | 'volume' | 'recordes';

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

const DEFINICOES: Definicao[] = [
  { id: 'treinos', titulo: 'Treinos', descricao: 'Treinos concluídos', alvos: [5, 25, 100, 250] },
  { id: 'constancia', titulo: 'Constância', descricao: 'Semanas seguidas cumprindo a meta', alvos: [2, 4, 12, 24] },
  { id: 'volume', titulo: 'Carga levantada', descricao: 'Carga total somada (kg × repetições)', alvos: [1000, 10000, 50000, 200000] },
  { id: 'recordes', titulo: 'Recordes', descricao: 'Vezes em que você superou a sua melhor carga', alvos: [1, 10, 30, 100] },
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

/** Quanto a pessoa tem em cada meta e o dia em que passou cada alvo. */
function medir(def: Definicao, ordenadas: Sessao[], recordes: RecordeEvento[], meta: number): { atual: number; dataDe: (alvo: number) => string | null } {
  switch (def.id) {
    case 'treinos':
      return { atual: ordenadas.length, dataDe: (alvo) => ordenadas[alvo - 1]?.data ?? null };
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
export function calcularConquistas(h: Sessao[], meta: number): Conquista[] {
  const ordenadas = [...h].sort(ordem);
  const recordes = historicoDeRecordes(h);
  return DEFINICOES.map((def) => {
    const { atual, dataDe } = medir(def, ordenadas, recordes, meta);
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
      return `${v} ${v === 1 ? 'treino' : 'treinos'}`;
    case 'constancia':
      return `${v} ${v === 1 ? 'semana' : 'semanas'}`;
    case 'recordes':
      return `${v} ${v === 1 ? 'recorde' : 'recordes'}`;
    case 'volume':
      return v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` : `${Math.round(v)} kg`;
  }
}
