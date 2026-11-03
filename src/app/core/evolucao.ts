import { Sessao } from './models';

export type Metrica = 'carga' | 'rm' | 'volume' | 'minutos';

export interface PontoEvolucao {
  /** Data do treino (yyyy-mm-dd). */
  data: string;
  /** Maior carga usada em uma série. */
  carga: number;
  /** Maior carga estimada para 1 repetição entre as séries (fórmula de Epley). */
  rm: number;
  /** Soma de carga × repetições das séries. */
  volume: number;
  /** Soma dos minutos (exercícios medidos em minutos, como o cardio). */
  minutos: number;
}

export interface Evolucao {
  pontos: PontoEvolucao[];
  /** O exercício é medido em minutos: não há carga para acompanhar. */
  minutos: boolean;
}

const arredondar = (v: number) => Math.round(v * 2) / 2;

/** Carga estimada para uma repetição (Epley). Com uma só repetição é a própria carga. */
export function umRm(carga: number, reps: number): number {
  return reps <= 1 ? carga : carga * (1 + reps / 30);
}

/** Um ponto por treino em que o exercício foi feito, do mais antigo ao mais novo; no máximo os `limite` últimos. */
export function evolucaoDoExercicio(historico: Sessao[], exerciseId: string, limite = 30): Evolucao {
  const pontos: PontoEvolucao[] = [];
  let minutos = false;
  for (const s of historico) {
    const r = s.registros?.find((x) => x.exerciseId === exerciseId && x.series.length > 0);
    if (!r) continue;
    if (r.unidade === 'min') minutos = true;
    pontos.push({
      data: s.data,
      carga: Math.max(...r.series.map((x) => x.carga)),
      rm: arredondar(Math.max(...r.series.map((x) => umRm(x.carga, x.reps)))),
      volume: Math.round(r.series.reduce((t, x) => t + x.carga * x.reps, 0)),
      minutos: r.series.reduce((t, x) => t + x.reps, 0),
    });
  }
  return { pontos: pontos.slice(-limite), minutos };
}

/** Valor de um ponto na métrica escolhida. */
export function valorDe(p: PontoEvolucao, m: Metrica): number {
  return p[m];
}
