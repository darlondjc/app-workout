import { Exercise, Sessao } from './models';
import { deIso, dias } from './stats';

/**
 * Quanto cada músculo foi trabalhado nos treinos recentes, para o mapa do corpo.
 *
 * Cada série feita conta para os músculos do exercício: 1 ponto para o principal e `PESO_SECUNDARIO` para os
 * secundários. O ponto vale menos quanto mais antigo o treino (cai pela metade a cada `MEIA_VIDA_DIAS`), então
 * treinar várias vezes seguidas acumula e ficar semanas sem treinar esvazia. É uma estimativa simples de carga
 * recente, não uma medida de recuperação.
 */

/** Só treinos dos últimos 56 dias entram; depois disso o ponto já vale menos de 1%. */
export const LOOKBACK_DIAS = 56;
export const MEIA_VIDA_DIAS = 7;
export const PESO_SECUNDARIO = 0.3;
/** Pontos que valem o nível máximo (cerca de 10 séries por semana, mantidas, no músculo principal). */
export const REFERENCIA_PONTOS = 16;

export interface Musculo {
  id: string;
  nome: string;
  /** Nome curto para a legenda ao lado do desenho. */
  curto: string;
  /** Músculos da base de exercícios (`primaryMuscles`/`secondaryMuscles`) que contam para este. */
  fontes: string[];
}

/** Os músculos mostrados no mapa. Abdutores do quadril contam nos glúteos; dorsais e meio das costas formam uma região só. */
export const MUSCULOS: Musculo[] = [
  { id: 'peito', nome: 'Peito', curto: 'Peito', fontes: ['chest'] },
  { id: 'ombros', nome: 'Ombros', curto: 'Ombros', fontes: ['shoulders'] },
  { id: 'biceps', nome: 'Bíceps', curto: 'Bíceps', fontes: ['biceps'] },
  { id: 'triceps', nome: 'Tríceps', curto: 'Tríceps', fontes: ['triceps'] },
  { id: 'antebracos', nome: 'Antebraços', curto: 'Antebraço', fontes: ['forearms'] },
  { id: 'abdomen', nome: 'Abdômen', curto: 'Abdômen', fontes: ['abdominals'] },
  { id: 'pescoco', nome: 'Pescoço', curto: 'Pescoço', fontes: ['neck'] },
  { id: 'trapezio', nome: 'Trapézio', curto: 'Trapézio', fontes: ['traps'] },
  { id: 'costas', nome: 'Dorsais e meio das costas', curto: 'Costas', fontes: ['lats', 'middle back'] },
  { id: 'lombar', nome: 'Lombar', curto: 'Lombar', fontes: ['lower back'] },
  { id: 'gluteos', nome: 'Glúteos', curto: 'Glúteos', fontes: ['glutes', 'abductors'] },
  { id: 'quadriceps', nome: 'Quadríceps', curto: 'Quadríceps', fontes: ['quadriceps'] },
  { id: 'posteriores', nome: 'Posteriores de coxa', curto: 'Posteriores', fontes: ['hamstrings'] },
  { id: 'adutores', nome: 'Adutores (parte interna da coxa)', curto: 'Adutores', fontes: ['adductors'] },
  { id: 'panturrilhas', nome: 'Panturrilhas', curto: 'Panturrilha', fontes: ['calves'] },
];

export interface EstadoMusculo {
  id: string;
  /** Séries somadas com o peso do músculo e da idade do treino. */
  pontos: number;
  /** De 0 (sem treino recente) a 1 (muito trabalhado). */
  nivel: number;
  /** Data (yyyy-mm-dd) do último treino que tem o músculo como principal; `null` se não houve nos últimos 56 dias. */
  ultimoTreino: string | null;
  diasDesdeUltimo: number | null;
  /** Séries em que o músculo foi o principal, nos últimos 7 dias (hoje e os 6 anteriores). */
  series7: number;
}

/** Um exercício feito em um treino do período da conta, com a idade do treino e o quanto ela desconta. */
interface SeriesFeitas {
  data: string;
  idade: number;
  decaimento: number;
  series: number;
  exercicio: Exercise;
}

/** Os exercícios que entram na conta do mapa: treinos dos últimos `LOOKBACK_DIAS`, sem cardio, alongamento ou atividades. */
function* seriesNoPeriodo(historico: Sessao[], base: Date, exercicioDe: (id: string) => Exercise | undefined): Generator<SeriesFeitas> {
  for (const s of historico) {
    if (s.atividade || !s.registros?.length) continue;
    const idade = dias(deIso(s.data), base);
    if (idade < 0 || idade > LOOKBACK_DIAS) continue;
    const decaimento = Math.pow(0.5, idade / MEIA_VIDA_DIAS);
    for (const r of s.registros) {
      if (r.unidade === 'min' || r.series.length === 0) continue;
      const e = exercicioDe(r.exerciseId);
      if (!e || e.category === 'cardio' || e.category === 'stretching') continue;
      yield { data: s.data, idade, decaimento, series: r.series.length, exercicio: e };
    }
  }
}

function papelNoMusculo(e: Exercise, m: Musculo): 'principal' | 'secundario' | null {
  if (e.primaryMuscles.some((x) => m.fontes.includes(x))) return 'principal';
  return e.secondaryMuscles.some((x) => m.fontes.includes(x)) ? 'secundario' : null;
}

export interface ExercicioFeito {
  id: string;
  papel: 'principal' | 'secundario';
  /** Séries feitas no período (56 dias). */
  series: number;
  treinos: number;
  /** Data (yyyy-mm-dd) do treino mais recente. */
  ultimo: string;
  diasDesdeUltimo: number;
  /** Fatia (0 a 1) dos pontos do músculo que vem deste exercício, já com o desconto pelo tempo. */
  parte: number;
}

/**
 * Os exercícios feitos no período da conta que dão a cor do músculo, do que mais pesa para o que menos pesa.
 * É a mesma conta de `calcularMusculos`, aberta por exercício.
 */
export function exerciciosFeitos(
  historico: Sessao[],
  hoje: Date,
  exercicioDe: (id: string) => Exercise | undefined,
  musculoId: string,
): ExercicioFeito[] {
  const musculo = MUSCULOS.find((m) => m.id === musculoId);
  if (!musculo) return [];
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const por = new Map<string, { papel: 'principal' | 'secundario'; series: number; datas: Set<string>; ultimo: string; pontos: number }>();
  let total = 0;
  for (const f of seriesNoPeriodo(historico, base, exercicioDe)) {
    const papel = papelNoMusculo(f.exercicio, musculo);
    if (!papel) continue;
    const pontos = f.series * (papel === 'principal' ? 1 : PESO_SECUNDARIO) * f.decaimento;
    total += pontos;
    const x = por.get(f.exercicio.id) ?? { papel, series: 0, datas: new Set<string>(), ultimo: f.data, pontos: 0 };
    x.series += f.series;
    x.datas.add(f.data);
    x.pontos += pontos;
    if (f.data > x.ultimo) x.ultimo = f.data;
    por.set(f.exercicio.id, x);
  }
  return [...por.entries()]
    .map(([id, x]) => ({
      id,
      papel: x.papel,
      series: x.series,
      treinos: x.datas.size,
      ultimo: x.ultimo,
      diasDesdeUltimo: dias(deIso(x.ultimo), base),
      parte: total > 0 ? x.pontos / total : 0,
      pontos: x.pontos,
    }))
    .sort((a, b) => b.pontos - a.pontos)
    .map(({ pontos: _, ...resto }) => resto);
}

/**
 * Estado de cada músculo (na ordem de `MUSCULOS`) a partir do histórico. Alongamentos e cardio ficam de fora, assim
 * como atividades sem exercícios (corrida, esporte): não há como saber que músculos trabalharam.
 */
export function calcularMusculos(
  historico: Sessao[],
  hoje: Date,
  exercicioDe: (id: string) => Exercise | undefined,
): EstadoMusculo[] {
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const estados = MUSCULOS.map((m) => ({ musculo: m, pontos: 0, ultimo: null as string | null, series7: 0 }));

  for (const { data, idade, decaimento, series, exercicio: e } of seriesNoPeriodo(historico, base, exercicioDe)) {
    for (const est of estados) {
      const papel = papelNoMusculo(e, est.musculo);
      if (!papel) continue;
      est.pontos += series * (papel === 'principal' ? 1 : PESO_SECUNDARIO) * decaimento;
      if (papel === 'principal') {
        if (!est.ultimo || data > est.ultimo) est.ultimo = data;
        if (idade <= 6) est.series7 += series;
      }
    }
  }

  return estados.map((e) => ({
    id: e.musculo.id,
    pontos: e.pontos,
    nivel: Math.min(1, e.pontos / REFERENCIA_PONTOS),
    ultimoTreino: e.ultimo,
    diasDesdeUltimo: e.ultimo ? dias(deIso(e.ultimo), base) : null,
    series7: e.series7,
  }));
}

/**
 * Os `n` músculos mais e os `n` menos trabalhados. Nos mais, só entram os que tiveram algum treino; nos menos,
 * valem os parados há mais tempo (quem nunca treinou vem primeiro). Empates seguem a ordem de `MUSCULOS`.
 */
export function maisEMenos(estados: EstadoMusculo[], n = 3): { mais: EstadoMusculo[]; menos: EstadoMusculo[] } {
  const ordem = new Map(MUSCULOS.map((m, i) => [m.id, i]));
  const porOrdem = (a: EstadoMusculo, b: EstadoMusculo) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0);
  const mais = estados
    .filter((e) => e.nivel > 0)
    .sort((a, b) => b.nivel - a.nivel || porOrdem(a, b))
    .slice(0, n);
  const menos = [...estados]
    .sort(
      (a, b) =>
        a.nivel - b.nivel ||
        (b.diasDesdeUltimo ?? Infinity) - (a.diasDesdeUltimo ?? Infinity) ||
        porOrdem(a, b),
    )
    .slice(0, n);
  return { mais, menos };
}

const PARADAS: { ate: number; cor: [number, number, number] }[] = [
  { ate: 0, cor: [31, 78, 153] }, // azul escuro: sem treino recente
  { ate: 0.18, cor: [111, 163, 220] }, // azul claro
  { ate: 0.4, cor: [233, 238, 245] }, // quase branco: meio termo
  { ate: 0.68, cor: [240, 138, 107] }, // laranja avermelhado
  { ate: 1, cor: [179, 38, 30] }, // vermelho escuro: muito trabalhado
];

/** Cor do músculo: azul escuro sem treino, passando por azul claro e quase branco, até vermelho escuro. */
export function corDoNivel(nivel: number): string {
  const n = Math.min(1, Math.max(0, nivel));
  let i = PARADAS.findIndex((p) => n <= p.ate);
  if (i <= 0) i = 1;
  const a = PARADAS[i - 1];
  const b = PARADAS[i];
  const t = (n - a.ate) / (b.ate - a.ate);
  const [r, g, bl] = a.cor.map((c, k) => Math.round(c + (b.cor[k] - c) * t));
  return `rgb(${r}, ${g}, ${bl})`;
}

/**
 * Exercícios que trabalham o músculo como principal, para a pessoa escolher o que treinar. Alongamentos e cardio ficam
 * de fora, como na conta do mapa. A ordem é a recebida (quem chama ordena pelo nome em português).
 */
export function exerciciosDoMusculo(exercicios: readonly Exercise[], musculoId: string): Exercise[] {
  const fontes = MUSCULOS.find((m) => m.id === musculoId)?.fontes;
  if (!fontes) return [];
  return exercicios.filter((e) => e.category !== 'cardio' && e.category !== 'stretching' && e.primaryMuscles.some((m) => fontes.includes(m)));
}

/** Descrição em palavras do estado do músculo, para quem não enxerga as cores. */
export function rotuloDoNivel(e: EstadoMusculo): string {
  if (e.pontos === 0) return 'Sem treino nas últimas 8 semanas';
  if (e.nivel < 0.2) return 'Pouco trabalhado';
  if (e.nivel < 0.5) return 'Trabalhado';
  if (e.nivel < 0.8) return 'Bem trabalhado';
  return 'Muito trabalhado';
}

/** 0 → "hoje"; 1 → "ontem"; 5 → "há 5 dias". */
export function haDias(n: number): string {
  if (n <= 0) return 'hoje';
  if (n === 1) return 'ontem';
  return `há ${n} dias`;
}

/** Texto do último treino direto do músculo, ex.: "ontem" ou "há 12 dias"; sem treino, "sem treino nas últimas 8 semanas". */
export function ultimaVez(e: EstadoMusculo): string {
  return e.diasDesdeUltimo === null ? 'sem treino direto nas últimas 8 semanas' : haDias(e.diasDesdeUltimo);
}
