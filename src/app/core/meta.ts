export const CHAVE_META = 'app-workout:meta-semanal:v1';

/** Meta de treinos por semana escolhida pela pessoa (1 a 7), ou `null` se ainda não escolheu. */
export function lerMeta(): number | null {
  try {
    const v = Number(localStorage.getItem(CHAVE_META));
    return v >= 1 && v <= 7 ? v : null;
  } catch {
    return null;
  }
}

/** Sem meta escolhida, vale o número de fichas (entre 2 e 6; 3 se ainda não há fichas). */
export function metaPadrao(qtdFichas: number): number {
  return Math.max(2, Math.min(6, qtdFichas || 3));
}
