import { Sessao } from './models';
import { dataISO, deIso, dias, inicioSemana, volumeSessao } from './stats';

export type GrupoMedalha = 'marcos' | 'constancia' | 'volume' | 'recordes';

export interface Medalha {
  id: string;
  grupo: GrupoMedalha;
  titulo: string;
  descricao: string;
  conquistada: boolean;
  /** Dia em que foi conquistada (yyyy-mm-dd). Só existe quando `conquistada`. */
  data: string | null;
  /** Quanto a pessoa já tem e quanto falta para o alvo (ex.: 7 de 10 treinos). */
  atual: number;
  alvo: number;
}

/** Uma vez em que a carga de um exercício passou o melhor que a pessoa tinha até então. */
export interface RecordeEvento {
  exerciseId: string;
  carga: number;
  antes: number;
  data: string;
}

export const NOMES_GRUPO: Record<GrupoMedalha, string> = {
  marcos: 'Marcos',
  constancia: 'Constância',
  volume: 'Volume',
  recordes: 'Recordes',
};

const MARCOS: [number, string][] = [
  [1, 'Primeiro treino'],
  [10, '10 treinos'],
  [25, '25 treinos'],
  [50, '50 treinos'],
  [100, '100 treinos'],
  [250, '250 treinos'],
];

const CONSTANCIA: [number, string][] = [
  [1, 'Meta batida'],
  [2, '2 semanas seguidas'],
  [4, '4 semanas seguidas'],
  [8, '8 semanas seguidas'],
  [12, '12 semanas seguidas'],
];

const VOLUME: [number, string][] = [
  [1000, '1 tonelada'],
  [10000, '10 toneladas'],
  [50000, '50 toneladas'],
  [100000, '100 toneladas'],
];

const RECORDES: [number, string][] = [
  [1, 'Primeiro recorde'],
  [5, '5 recordes'],
  [10, '10 recordes'],
  [25, '25 recordes'],
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

function toneladas(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` : `${kg} kg`;
}

/**
 * Todas as medalhas, conquistadas ou não. São calculadas a partir do histórico (nada é guardado à parte),
 * então valem em qualquer aparelho e acompanham os treinos que a pessoa apagar ou sincronizar.
 */
export function calcularMedalhas(h: Sessao[], meta: number): Medalha[] {
  const ordenadas = [...h].sort(ordem);
  const out: Medalha[] = [];

  for (const [n, titulo] of MARCOS) {
    const ok = ordenadas.length >= n;
    out.push({
      id: `marco-${n}`,
      grupo: 'marcos',
      titulo,
      descricao: n === 1 ? 'Conclua o seu primeiro treino' : `Conclua ${n} treinos`,
      conquistada: ok,
      data: ok ? ordenadas[n - 1].data : null,
      atual: Math.min(ordenadas.length, n),
      alvo: n,
    });
  }

  const { melhor, datas } = constancia(ordenadas, meta);
  for (const [n, titulo] of CONSTANCIA) {
    const ok = melhor >= n;
    out.push({
      id: `constancia-${n}`,
      grupo: 'constancia',
      titulo,
      descricao: n === 1 ? 'Cumpra a meta de treinos em uma semana' : `Cumpra a meta de treinos por ${n} semanas seguidas`,
      conquistada: ok,
      data: ok ? (datas.get(n) ?? null) : null,
      atual: Math.min(melhor, n),
      alvo: n,
    });
  }

  let acumulado = 0;
  const dataDoVolume = new Map<number, string>();
  for (const s of ordenadas) {
    acumulado += volumeSessao(s);
    for (const [alvo] of VOLUME) if (acumulado >= alvo && !dataDoVolume.has(alvo)) dataDoVolume.set(alvo, s.data);
  }
  for (const [alvo, titulo] of VOLUME) {
    const ok = acumulado >= alvo;
    out.push({
      id: `volume-${alvo}`,
      grupo: 'volume',
      titulo,
      descricao: `Some ${toneladas(alvo)} de carga levantada (kg × repetições)`,
      conquistada: ok,
      data: ok ? (dataDoVolume.get(alvo) ?? null) : null,
      atual: Math.min(acumulado, alvo),
      alvo,
    });
  }

  const recordes = historicoDeRecordes(h);
  for (const [n, titulo] of RECORDES) {
    const ok = recordes.length >= n;
    out.push({
      id: `recorde-${n}`,
      grupo: 'recordes',
      titulo,
      descricao: n === 1 ? 'Supere a sua melhor carga em um exercício' : `Supere a sua melhor carga ${n} vezes`,
      conquistada: ok,
      data: ok ? recordes[n - 1].data : null,
      atual: Math.min(recordes.length, n),
      alvo: n,
    });
  }

  return out;
}

/** As conquistas mais recentes, da mais nova para a mais antiga (no mesmo dia, a de maior alvo primeiro). */
export function ultimasConquistas(medalhas: Medalha[], quantas: number): Medalha[] {
  return medalhas
    .filter((m) => m.conquistada)
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '') || b.alvo - a.alvo)
    .slice(0, quantas);
}

/** A medalha ainda não conquistada que está mais perto (maior fração do alvo). */
export function proximaMedalha(medalhas: Medalha[]): Medalha | null {
  const faltam = medalhas.filter((m) => !m.conquistada);
  if (faltam.length === 0) return null;
  return faltam.reduce((a, b) => (b.atual / b.alvo > a.atual / a.alvo ? b : a));
}
