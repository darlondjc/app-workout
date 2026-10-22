export interface Exercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

export interface Labels {
  force: Record<string, string>;
  level: Record<string, string>;
  mechanic: Record<string, string>;
  equipment: Record<string, string>;
  category: Record<string, string>;
  muscles: Record<string, string>;
}

export interface ItemFicha {
  exerciseId: string;
  series: number;
  /** Repetições, ou minutos quando `unidade` for 'min' (cardio). */
  reps: number;
  /** Ausente = repetições. */
  unidade?: 'reps' | 'min';
  carga: number;
  descanso: number;
}

export interface Ficha {
  id: string;
  nome: string;
  itens: ItemFicha[];
}

/** Valores realizados em uma série. */
export interface SerieRegistro {
  carga: number;
  reps: number;
  /** Segundos entre marcar a série anterior e marcar esta, com descanso e execução juntos (ausente na primeira série do exercício). */
  descanso?: number;
}

export interface RegistroExercicio {
  exerciseId: string;
  unidade?: 'reps' | 'min';
  series: SerieRegistro[];
}

export interface Sessao {
  /** Identificador estável, usado para sincronizar sem duplicar. */
  id?: string;
  /** Data local no formato yyyy-mm-dd */
  data: string;
  fichaId: string;
  fichaNome?: string;
  concluidaEm?: number;
  registros?: RegistroExercicio[];
}

export interface SerieEmAndamento {
  feita: boolean;
  carga: number;
  reps: number;
  /** Segundos desde que a série anterior foi marcada até marcar esta. */
  descanso?: number;
}

/** Treino começado e ainda não finalizado: permite retomar de onde parou. */
export interface EmAndamento {
  fichaId: string;
  indice: number;
  /** Séries por posição do exercício na ficha. */
  series: Record<string, SerieEmAndamento[]>;
  iniciadoEm: number;
  /** Exercícios trocados só neste treino: posição na ficha → exercício que entra no lugar. */
  trocas?: Record<string, string>;
}
