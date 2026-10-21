import { Exercise, ItemFicha } from './models';

export type Objetivo = 'hipertrofia' | 'forca' | 'resistencia' | 'emagrecimento';
export type Nivel = 'beginner' | 'intermediate' | 'expert';
export type Local = 'academia' | 'halteres' | 'corpo';

export interface Preferencias {
  objetivo: Objetivo;
  nivel: Nivel;
  dias: number;
  local: Local;
}

export interface FichaSugerida {
  nome: string;
  itens: ItemFicha[];
}

export const OBJETIVOS: { key: Objetivo; label: string; detalhe: string }[] = [
  { key: 'hipertrofia', label: 'Ganhar massa', detalhe: '3 a 4 séries de 8 a 12' },
  { key: 'forca', label: 'Ganhar força', detalhe: '5 séries de 5, descanso longo' },
  { key: 'resistencia', label: 'Resistência', detalhe: '3 séries de 15, descanso curto' },
  { key: 'emagrecimento', label: 'Emagrecimento', detalhe: 'Circuito, descanso curto e cardio' },
];

export const LOCAIS: { key: Local; label: string; detalhe: string }[] = [
  { key: 'academia', label: 'Academia', detalhe: 'Barras, cabos e máquinas' },
  { key: 'halteres', label: 'Casa com halteres', detalhe: 'Halteres e peso do corpo' },
  { key: 'corpo', label: 'Peso do corpo', detalhe: 'Sem nenhum equipamento' },
];

/** Equipamentos (campo `equipment` da base) aceitos em cada local. */
const EQUIPAMENTOS: Record<Local, (string | null)[]> = {
  academia: ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'other', 'e-z curl bar', 'kettlebells', null],
  halteres: ['dumbbell', 'body only', 'kettlebells', null],
  corpo: ['body only', null],
};

/** Exercícios que exigem barra fixa, paralelas ou aparelho: só entram na academia. */
const SO_ACADEMIA = new Set(['Pullups', 'Chin-Up', 'Wide-Grip_Rear_Pull-Up', 'Dips_-_Triceps_Version', 'Hyperextensions_Back_Extensions', 'Jogging_Treadmill', 'Bicycling_Stationary', 'Walking_Treadmill', 'Rope_Jumping', 'Elliptical_Trainer', 'Rowing_Stationary']);

const ORDEM_NIVEL: Record<string, number> = { beginner: 0, intermediate: 1, expert: 2 };

type Grupo =
  | 'peito' | 'peitoInclinado' | 'peitoIsolado'
  | 'ombro' | 'ombroLateral' | 'ombroPosterior'
  | 'puxada' | 'remada'
  | 'biceps' | 'triceps'
  | 'agachamento' | 'unilateral' | 'posterior' | 'flexora' | 'extensora' | 'gluteo' | 'panturrilha'
  | 'abdomen' | 'lombar' | 'trapezio'
  | 'cardio' | 'metabolico';

/** Candidatos por movimento, do mais clássico ao menos usual. */
const CANDIDATOS: Record<Grupo, string[]> = {
  peito: ['Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Bench_Press', 'Machine_Bench_Press', 'Pushups', 'Push-Up_Wide', 'Push-Ups_With_Feet_Elevated'],
  peitoInclinado: ['Incline_Dumbbell_Press', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Incline_Push-Up', 'Decline_Push-Up', 'Incline_Push-Up_Wide'],
  peitoIsolado: ['Dumbbell_Flyes', 'Cable_Crossover', 'Butterfly'],
  ombro: ['Seated_Dumbbell_Press', 'Machine_Shoulder_Military_Press', 'Barbell_Shoulder_Press', 'Standing_Dumbbell_Press'],
  ombroLateral: ['Side_Lateral_Raise', 'Dumbbell_Raise', 'Front_Dumbbell_Raise'],
  ombroPosterior: ['Reverse_Flyes', 'Cable_Rear_Delt_Fly', 'Reverse_Machine_Flyes'],
  puxada: ['Wide-Grip_Lat_Pulldown', 'Pullups', 'Close-Grip_Front_Lat_Pulldown', 'Chin-Up'],
  remada: ['Bent_Over_Barbell_Row', 'Seated_Cable_Rows', 'One-Arm_Dumbbell_Row', 'Bent_Over_Two-Dumbbell_Row', 'Inverted_Row', 'Leverage_High_Row'],
  biceps: ['Barbell_Curl', 'Dumbbell_Alternate_Bicep_Curl', 'Hammer_Curls', 'Dumbbell_Bicep_Curl', 'Concentration_Curls'],
  triceps: ['Triceps_Pushdown', 'Triceps_Overhead_Extension_with_Rope', 'Dumbbell_Tricep_Extension_-Pronated_Grip', 'Bench_Dips', 'Push-Ups_-_Close_Triceps_Position', 'Dips_-_Triceps_Version'],
  agachamento: ['Barbell_Squat', 'Leg_Press', 'Dumbbell_Squat', 'Goblet_Squat', 'Hack_Squat', 'Bodyweight_Squat'],
  unilateral: ['Dumbbell_Lunges', 'Bodyweight_Walking_Lunge', 'Step-up_with_Knee_Raise'],
  posterior: ['Romanian_Deadlift', 'Stiff-Legged_Dumbbell_Deadlift', 'Butt_Lift_Bridge'],
  flexora: ['Lying_Leg_Curls', 'Seated_Leg_Curl'],
  extensora: ['Leg_Extensions'],
  gluteo: ['Butt_Lift_Bridge', 'Single_Leg_Glute_Bridge', 'Glute_Kickback'],
  panturrilha: ['Standing_Calf_Raises', 'Seated_Calf_Raise', 'Calf_Raise_On_A_Dumbbell'],
  abdomen: ['Crunches', 'Cable_Crunch', 'Reverse_Crunch', 'Air_Bike', 'Dead_Bug', 'Oblique_Crunches_-_On_The_Floor', 'Flat_Bench_Lying_Leg_Raise'],
  lombar: ['Hyperextensions_Back_Extensions'],
  trapezio: ['Dumbbell_Shrug', 'Barbell_Shrug'],
  // Cardio contínuo, medido em minutos. O que exige aparelho só aparece na academia.
  cardio: ['Jogging_Treadmill', 'Bicycling_Stationary', 'Walking_Treadmill', 'Trail_Running_Walking', 'Rope_Jumping', 'Elliptical_Trainer', 'Rowing_Stationary', 'Fast_Skipping'],
  // Exercícios dinâmicos de corpo inteiro, feitos em repetições com pouco descanso.
  metabolico: ['Mountain_Climbers', 'Star_Jump', 'Knee_Tuck_Jump', 'Split_Jump', 'Double_Leg_Butt_Kick', 'Scissors_Jump'],
};

/** Movimentos multiarticulares recebem mais séries e descanso. */
const MINUTOS = new Set<Grupo>(['cardio']);

const COMPOSTOS = new Set<Grupo>(['peito', 'peitoInclinado', 'ombro', 'puxada', 'remada', 'agachamento', 'unilateral', 'posterior']);

interface Dia {
  nome: string;
  grupos: Grupo[];
}

/** Circuitos de corpo inteiro com finalização de cardio; dias extras são cardio e core. */
function modeloEmagrecimento(dias: number): Dia[] {
  const circuitos: Dia[] = [
    { nome: 'Circuito A', grupos: ['agachamento', 'peito', 'remada', 'ombro', 'abdomen', 'metabolico', 'cardio'] },
    { nome: 'Circuito B', grupos: ['posterior', 'peitoInclinado', 'puxada', 'ombroLateral', 'gluteo', 'metabolico', 'cardio'] },
    { nome: 'Circuito C', grupos: ['unilateral', 'peito', 'remada', 'triceps', 'abdomen', 'metabolico', 'cardio'] },
  ];
  const extras: Dia[] = [
    { nome: 'Cardio e abdômen', grupos: ['cardio', 'metabolico', 'abdomen', 'abdomen'] },
    { nome: 'Cardio intervalado', grupos: ['metabolico', 'cardio', 'metabolico', 'abdomen'] },
    { nome: 'Cardio leve e core', grupos: ['cardio', 'abdomen', 'gluteo', 'metabolico'] },
  ];
  return [...circuitos, ...extras].slice(0, Math.max(2, Math.min(dias, 6)));
}

function modelo(dias: number): Dia[] {
  switch (dias) {
    case 2:
      return [
        { nome: 'Corpo inteiro 1', grupos: ['agachamento', 'peito', 'remada', 'ombro', 'biceps', 'abdomen'] },
        { nome: 'Corpo inteiro 2', grupos: ['posterior', 'peitoInclinado', 'puxada', 'ombroLateral', 'triceps', 'abdomen'] },
      ];
    case 3:
      return [
        { nome: 'Corpo inteiro 1', grupos: ['agachamento', 'peito', 'remada', 'ombro', 'biceps', 'abdomen'] },
        { nome: 'Corpo inteiro 2', grupos: ['posterior', 'peitoInclinado', 'puxada', 'ombroLateral', 'triceps', 'panturrilha'] },
        { nome: 'Corpo inteiro 3', grupos: ['unilateral', 'peito', 'remada', 'ombroPosterior', 'gluteo', 'abdomen'] },
      ];
    case 4:
      return [
        { nome: 'Superior 1', grupos: ['peito', 'remada', 'ombro', 'puxada', 'biceps', 'triceps'] },
        { nome: 'Inferior 1', grupos: ['agachamento', 'posterior', 'flexora', 'panturrilha', 'abdomen'] },
        { nome: 'Superior 2', grupos: ['peitoInclinado', 'puxada', 'ombroLateral', 'remada', 'triceps', 'biceps'] },
        { nome: 'Inferior 2', grupos: ['unilateral', 'extensora', 'gluteo', 'flexora', 'panturrilha', 'abdomen'] },
      ];
    case 5:
      return [
        { nome: 'Peito e tríceps', grupos: ['peito', 'peitoInclinado', 'peitoIsolado', 'triceps', 'triceps'] },
        { nome: 'Costas e bíceps', grupos: ['puxada', 'remada', 'remada', 'biceps', 'biceps'] },
        { nome: 'Pernas', grupos: ['agachamento', 'unilateral', 'extensora', 'flexora', 'panturrilha'] },
        { nome: 'Ombros e abdômen', grupos: ['ombro', 'ombroLateral', 'ombroPosterior', 'trapezio', 'abdomen'] },
        { nome: 'Posterior e glúteos', grupos: ['posterior', 'gluteo', 'flexora', 'panturrilha', 'abdomen', 'lombar'] },
      ];
    default:
      return [
        { nome: 'Empurrar 1', grupos: ['peito', 'peitoInclinado', 'ombro', 'ombroLateral', 'triceps'] },
        { nome: 'Puxar 1', grupos: ['puxada', 'remada', 'ombroPosterior', 'biceps', 'trapezio'] },
        { nome: 'Pernas 1', grupos: ['agachamento', 'posterior', 'extensora', 'flexora', 'panturrilha'] },
        { nome: 'Empurrar 2', grupos: ['peito', 'peitoIsolado', 'ombro', 'ombroLateral', 'triceps'] },
        { nome: 'Puxar 2', grupos: ['remada', 'puxada', 'ombroPosterior', 'biceps', 'abdomen'] },
        { nome: 'Pernas 2', grupos: ['unilateral', 'gluteo', 'flexora', 'panturrilha', 'abdomen'] },
      ];
  }
}

const MINUTOS_CARDIO: Record<Nivel, number> = { beginner: 15, intermediate: 20, expert: 30 };

function parametros(objetivo: Objetivo, composto: boolean, nivel: Nivel, grupo: Grupo): Omit<ItemFicha, 'exerciseId' | 'carga'> {
  if (MINUTOS.has(grupo)) return { series: 1, reps: MINUTOS_CARDIO[nivel], unidade: 'min', descanso: 0 };
  let series: number;
  let reps: number;
  let descanso: number;
  if (objetivo === 'forca') {
    [series, reps, descanso] = composto ? [5, 5, 150] : [3, 8, 90];
  } else if (objetivo === 'resistencia') {
    [series, reps, descanso] = [3, 15, 45];
  } else if (objetivo === 'emagrecimento') {
    if (grupo === 'metabolico') [series, reps, descanso] = [3, 20, 30];
    else [series, reps, descanso] = composto ? [3, 12, 45] : [3, 15, 30];
  } else {
    [series, reps, descanso] = composto ? [4, 8, 90] : [3, 12, 60];
  }
  if (nivel === 'beginner') series = Math.max(2, series - 1);
  return { series, reps, descanso };
}

/**
 * Monta as fichas a partir das preferências. `variacao` desloca a escolha dentro de cada
 * lista de candidatos, para gerar alternativas sem repetir o mesmo conjunto.
 */
export function sugerirFichas(exercicios: Exercise[], pref: Preferencias, variacao = 0): FichaSugerida[] {
  const porId = new Map(exercicios.map((e) => [e.id, e]));
  const aceitos = EQUIPAMENTOS[pref.local];
  const nivelMax = ORDEM_NIVEL[pref.nivel];

  const elegiveis = (g: Grupo): Exercise[] => {
    const lista = CANDIDATOS[g]
      .filter((id) => pref.local === 'academia' || !SO_ACADEMIA.has(id))
      .map((id) => porId.get(id))
      .filter((e): e is Exercise => !!e && aceitos.includes(e.equipment));
    const noNivel = lista.filter((e) => ORDEM_NIVEL[e.level] <= nivelMax);
    return noNivel.length ? noNivel : lista;
  };

  const usos = new Map<Grupo, number>();
  const ja = new Set<string>();
  const total = Math.min(6, Math.max(2, pref.dias));
  // Sem equipamento há poucos exercícios distintos: acima de 4 dias, repete o ciclo de 4 fichas.
  const diasBase = pref.local === 'corpo' ? Math.min(total, 4) : total;
  const base = pref.objetivo === 'emagrecimento' ? modeloEmagrecimento(diasBase) : modelo(diasBase);
  const dias = Array.from({ length: total }, (_, i) => {
    const d = base[i % base.length];
    return i < base.length ? d : { ...d, nome: `${d.nome} (repetição)` };
  });

  return dias.map((dia) => {
    const itens: ItemFicha[] = [];
    for (const g of dia.grupos) {
      const lista = elegiveis(g);
      if (lista.length === 0) continue;
      const n = usos.get(g) ?? 0;
      usos.set(g, n + 1);
      // Procura a partir da posição deslocada, evitando repetir exercício já usado em outra ficha.
      let escolhido: Exercise | undefined;
      for (let k = 0; k < lista.length; k++) {
        const c = lista[(n + variacao + k) % lista.length];
        if (!ja.has(c.id) && !itens.some((i) => i.exerciseId === c.id)) {
          escolhido = c;
          break;
        }
      }
      escolhido ??= lista[(n + variacao) % lista.length];
      if (itens.some((i) => i.exerciseId === escolhido.id)) continue;
      ja.add(escolhido.id);
      itens.push({ exerciseId: escolhido.id, carga: 0, ...parametros(pref.objetivo, COMPOSTOS.has(g), pref.nivel, g) });
    }
    return { nome: dia.nome, itens };
  });
}
