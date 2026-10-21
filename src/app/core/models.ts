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

export interface Sessao {
  /** Data local no formato yyyy-mm-dd */
  data: string;
  fichaId: string;
}
