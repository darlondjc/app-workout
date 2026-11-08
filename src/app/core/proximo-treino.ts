import { Exercise, Ficha, Sessao } from './models';
import { MUSCULOS, PESO_SECUNDARIO, calcularMusculos } from './musculos';

/** Fichas com pontuação até esta diferença da melhor contam como empate, e o rodízio decide. */
export const MARGEM_EMPATE = 0.05;
/** Pontuação de uma ficha em que não dá para saber os músculos: nem a favorita, nem a última. */
export const NEUTRA = 0.5;

/**
 * Quão atrasados estão os músculos que a ficha trabalha, de 0 (todos muito trabalhados) a 1 (todos parados).
 * Cada série pesa 1 para o músculo principal e `PESO_SECUNDARIO` para os secundários. Cardio, alongamento e
 * exercícios desconhecidos não contam; sem nenhum exercício contável, devolve `null`.
 */
export function pontuacaoDaFicha(
  ficha: Ficha,
  nivelDe: ReadonlyMap<string, number>,
  exercicioDe: (id: string) => Exercise | undefined,
): number | null {
  let peso = 0;
  let atraso = 0;
  for (const item of ficha.itens) {
    const e = exercicioDe(item.exerciseId);
    if (!e || e.category === 'cardio' || e.category === 'stretching') continue;
    for (const m of MUSCULOS) {
      const p = e.primaryMuscles.some((x) => m.fontes.includes(x))
        ? 1
        : e.secondaryMuscles.some((x) => m.fontes.includes(x))
          ? PESO_SECUNDARIO
          : 0;
      if (p === 0) continue;
      peso += p * item.series;
      atraso += p * item.series * (1 - (nivelDe.get(m.id) ?? 0));
    }
  }
  return peso > 0 ? atraso / peso : null;
}

/**
 * Os treinos da ficha ativa (a divisão A, B, C… a que pertence a ficha ativa). Sem ficha ativa em uso, vale a ficha do
 * último treino concluído; sem nenhuma das duas, todos. Treinos soltos (sem ficha com vários treinos) contam como
 * uma ficha só, como na lista de fichas.
 */
export function treinosDaFichaAtiva(fichas: Ficha[], ativaId: string | null, historico: Sessao[]): Ficha[] {
  const ultima = historico.filter((s) => s.fichaId).at(-1);
  const referencia = fichas.find((f) => f.id === ativaId) ?? fichas.find((f) => f.id === ultima?.fichaId);
  if (!referencia) return fichas;
  const mesma = fichas.filter((f) => f.conjunto?.id === referencia.conjunto?.id);
  return mesma.length > 0 ? mesma : fichas;
}

/**
 * Escolhe o treino a sugerir entre as fichas (já na ordem da lista): o que trabalha os músculos menos trabalhados
 * nos últimos treinos. Quando as pontuações empatam (ou não há histórico de músculos), vale o rodízio: a ficha
 * seguinte à última concluída, A, B, C… Fichas sem exercício contável (só cardio, por exemplo) valem `NEUTRA`.
 */
export function escolherProximaFicha(
  fichas: Ficha[],
  historico: Sessao[],
  hoje: Date,
  exercicioDe: (id: string) => Exercise | undefined,
): Ficha | null {
  if (fichas.length === 0) return null;
  // Atividade fora da ficha não avança o rodízio.
  const ultima = historico.filter((s) => s.fichaId).at(-1);
  const idx = ultima ? fichas.findIndex((f) => f.id === ultima.fichaId) : -1;
  const emRodizio = fichas.map((_, i) => fichas[(idx + 1 + i) % fichas.length]);

  const nivelDe = new Map(calcularMusculos(historico, hoje, exercicioDe).map((m) => [m.id, m.nivel]));
  const notas = new Map(emRodizio.map((f) => [f.id, pontuacaoDaFicha(f, nivelDe, exercicioDe) ?? NEUTRA]));
  const melhor = Math.max(...notas.values());
  return emRodizio.find((f) => notas.get(f.id)! >= melhor - MARGEM_EMPATE) ?? emRodizio[0];
}
