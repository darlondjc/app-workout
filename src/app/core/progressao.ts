import { ItemFicha, RegistroExercicio } from './models';

export interface SugestaoCarga {
  /** Carga usada na última vez, em kg. */
  de: number;
  /** Carga sugerida para hoje, em kg. */
  para: number;
}

/**
 * Quanto subir a carga: cerca de 5%, em passos de 0,5 kg, nunca menos de 1 kg nem mais de 5 kg.
 * 20 kg → 1 kg; 40 kg → 2 kg; 60 kg → 3 kg; 100 kg ou mais → 5 kg.
 */
export function passoDeCarga(carga: number): number {
  const bruto = Math.round((carga * 0.05) / 0.5) * 0.5;
  return Math.min(5, Math.max(1, bruto));
}

/**
 * Sugere subir a carga quando, na última vez, a pessoa fez todas as séries da ficha com todas as repetições
 * previstas e sempre com a mesma carga (dupla progressão simples). Fora disso (série faltando, repetição abaixo
 * da meta, cargas diferentes em cada série, exercício em minutos ou sem carga) não há sugestão: o certo é repetir.
 */
export function sugerirCarga(item: Pick<ItemFicha, 'series' | 'reps' | 'unidade'>, ultimo: RegistroExercicio | undefined): SugestaoCarga | null {
  if (!ultimo || item.unidade === 'min' || ultimo.unidade === 'min') return null;
  if (ultimo.series.length < item.series || item.reps <= 0) return null;
  const carga = ultimo.series[0].carga;
  if (!(carga > 0)) return null;
  const completa = ultimo.series.every((s) => s.carga === carga && s.reps >= item.reps);
  if (!completa) return null;
  return { de: carga, para: Math.round((carga + passoDeCarga(carga)) * 2) / 2 };
}
