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
  /** Nota fixa do exercício nesta ficha (ex.: "banco na posição 4"); aparece em todo treino. */
  nota?: string;
}

export interface Ficha {
  id: string;
  /** Nome do treino (ex.: "Peito e Tríceps"). */
  nome: string;
  itens: ItemFicha[];
  /**
   * Quando o treino faz parte de uma ficha com vários treinos (A, B, C…), a ficha a que pertence.
   * Sem isto, é uma ficha de um treino só, como eram todas antes.
   */
  conjunto?: { id: string; nome: string };
  /** Primeiro dia da ficha (yyyy-mm-dd). Todos os treinos de uma ficha com vários treinos têm o mesmo período. Ausente nas fichas criadas antes da 1.24. */
  inicio?: string;
  /** Último dia da ficha (yyyy-mm-dd): nesse dia ela passa a vencida. */
  fim?: string;
  /** Guardada em "Fichas arquivadas" pela pessoa. Fichas vencidas além da mais recente também ficam arquivadas, sem este campo. */
  arquivada?: true;
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

/** Atividade física fora da ficha (corrida, esporte…), registrada à mão. */
export interface AtividadeRegistro {
  /** Chave do tipo em `TIPOS_ATIVIDADE` ('corrida', 'futebol'…). */
  tipo: string;
  /** Nome mostrado: o do tipo, ou o que a pessoa digitou em "Outra". */
  nome: string;
  minutos: number;
  /** Só quando informada. */
  distanciaKm?: number;
  esforco?: 'leve' | 'moderado' | 'intenso';
}

export interface Sessao {
  /** Identificador estável, usado para sincronizar sem duplicar. */
  id?: string;
  /** Data local no formato yyyy-mm-dd */
  data: string;
  /** Vazio quando a sessão é uma atividade (`atividade`), que não pertence a nenhuma ficha. */
  fichaId: string;
  fichaNome?: string;
  /** Presente quando a sessão é uma atividade registrada fora da ficha; `registros` fica vazio. */
  atividade?: AtividadeRegistro;
  concluidaEm?: number;
  /** Nota escrita durante o treino (ex.: "ombro incomodando"). */
  nota?: string;
  /** Minutos do começo à conclusão do treino. Ausente nos treinos anteriores à 1.20 e nas atividades (que têm os seus). */
  duracaoMin?: number;
  registros?: RegistroExercicio[];
  /** Este treino tem uma foto guardada na nuvem (a foto em si não fica no histórico). */
  temFoto?: boolean;
}

/** Peso corporal de um dia. Um registro por dia: registrar de novo no mesmo dia substitui o anterior. */
export interface RegistroPeso {
  /** Data local no formato yyyy-mm-dd */
  data: string;
  kg: number;
  /** Quando foi registrado (ms); desempata o mesmo dia vindo de dois aparelhos. */
  em?: number;
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
  /** Nota do treino, escrita enquanto ele acontece; vai para a sessão ao concluir. */
  nota?: string;
  /** Exercícios trocados só neste treino: posição na ficha → exercício que entra no lugar. */
  trocas?: Record<string, string>;
  /**
   * Cronômetro de descanso, guardado quando começa e de novo ao fechar a tela do treino. Ao voltar ele segue daí:
   * parado se o treino foi pausado, ou contando o tempo fora (instruções do exercício, app fechado ou reiniciado).
   */
  descanso?: { decorrido: number; limite: number; saiuEm: number; pausado: boolean };
}
