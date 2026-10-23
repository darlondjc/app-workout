import { Exercise, ItemFicha } from './models';
import { GRUPOS } from './exercise.service';
import { Nivel } from './suggestion';
import { treinoDoDia } from './treino-do-dia';

/** Um dia de treino montado pela pessoa: o que treinar e se termina com cardio. */
export interface DiaPersonalizado {
  /** Chaves de `GRUPOS` (peito, costas...). */
  grupos: string[];
  cardio: boolean;
  /** Nome escolhido pela pessoa; vazio usa o automático (ex.: "Bíceps e Tríceps + Cardio"). */
  nome: string;
}

export interface OpcoesPersonalizada {
  nivel: Nivel;
  /** Máximo de exercícios por dia; sem ele, vale a quantidade padrão por grupo. */
  maximo?: number;
  /** Muda a escolha de cada dia (mesma posição do dia) para gerar alternativas. */
  variacoes?: readonly number[];
}

export interface FichaGerada {
  nome: string;
  itens: ItemFicha[];
  /** Pediu cardio neste dia, mas não havia cardio disponível. */
  semCardio: boolean;
}

/** Um dia é válido com algum grupo ou só com cardio. */
export const diaValido = (d: DiaPersonalizado): boolean => d.grupos.length > 0 || d.cardio;

export function nomeDoDia(d: DiaPersonalizado): string {
  const manual = d.nome.trim();
  if (manual) return manual;
  const labels = GRUPOS.filter((g) => d.grupos.includes(g.key)).map((g) => g.label);
  if (d.cardio) labels.push('Cardio');
  if (labels.length === 0) return 'Treino';
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}`;
}

/**
 * Monta uma ficha para cada dia. Os dias são gerados em sequência e um exercício não se repete
 * em dois dias, então dois dias com o mesmo grupo ganham exercícios diferentes.
 */
export function gerarFichas(todos: Exercise[], dias: readonly DiaPersonalizado[], opcoes: OpcoesPersonalizada): FichaGerada[] {
  const usados = new Set<string>();
  return dias.map((d, i) => {
    const r = treinoDoDia(todos, {
      grupos: d.grupos,
      cardio: d.cardio,
      nivel: opcoes.nivel,
      excluidos: usados,
      variacao: opcoes.variacoes?.[i] ?? 0,
      ...(opcoes.maximo && d.grupos.length > 0 ? { maximo: opcoes.maximo } : {}),
    });
    for (const it of r.itens) usados.add(it.exerciseId);
    return { nome: nomeDoDia(d), itens: r.itens, semCardio: r.semCardio };
  });
}
