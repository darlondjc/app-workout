import { Exercise, Ficha, Sessao } from './models';
import { LOOKBACK_DIAS, MUSCULOS, calcularMusculos } from './musculos';

/** Treinos com média de dias parados até esta diferença do mais parado contam como empate, e o rodízio decide. */
export const MARGEM_EMPATE_DIAS = 1;

/**
 * Há quantos dias, em média, os músculos que o treino trabalha foram treinados de forma direta (como músculo
 * principal), com cada músculo pesando pelas séries do treino. Músculo sem treino nos últimos `LOOKBACK_DIAS` conta
 * como parado há esse tempo, o máximo. Cardio, alongamento e exercícios desconhecidos não contam; sem nenhum exercício
 * contável, devolve `null`.
 *
 * Mede o tempo parado, e não o volume acumulado: um treino feito uma vez por semana, com poucos exercícios, não
 * parece "atrasado" só porque soma menos séries que músculos treinados em vários treinos.
 */
export function pontuacaoDaFicha(
  ficha: Ficha,
  diasParado: ReadonlyMap<string, number>,
  exercicioDe: (id: string) => Exercise | undefined,
): number | null {
  let peso = 0;
  let soma = 0;
  for (const item of ficha.itens) {
    const e = exercicioDe(item.exerciseId);
    if (!e || e.category === 'cardio' || e.category === 'stretching') continue;
    for (const m of MUSCULOS) {
      if (!e.primaryMuscles.some((x) => m.fontes.includes(x))) continue;
      peso += item.series;
      soma += item.series * (diasParado.get(m.id) ?? LOOKBACK_DIAS);
    }
  }
  return peso > 0 ? soma / peso : null;
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
 * Escolhe o treino a sugerir entre as fichas (já na ordem da lista): o que trabalha os músculos parados há mais
 * tempo, ou seja, o treino mais antigo da divisão. Quando os tempos empatam (ou não há histórico), vale o rodízio: a
 * ficha seguinte à última concluída, A, B, C… Fichas sem exercício contável (só cardio, por exemplo) valem a média das
 * outras: não ganham de quem está mais parado nem perdem para quem acabou de ser treinado.
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

  const diasParado = new Map(calcularMusculos(historico, hoje, exercicioDe).map((m) => [m.id, m.diasDesdeUltimo ?? LOOKBACK_DIAS]));
  const medidas = new Map(emRodizio.map((f) => [f.id, pontuacaoDaFicha(f, diasParado, exercicioDe)]));
  const conhecidas = [...medidas.values()].filter((v): v is number => v !== null);
  const media = conhecidas.length > 0 ? conhecidas.reduce((a, b) => a + b, 0) / conhecidas.length : 0;
  const nota = (f: Ficha) => medidas.get(f.id) ?? media;
  const maior = Math.max(...emRodizio.map(nota));
  return emRodizio.find((f) => nota(f) >= maior - MARGEM_EMPATE_DIAS) ?? emRodizio[0];
}
