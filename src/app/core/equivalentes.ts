import { Exercise } from './models';

const chave = (m: string[]) => [...m].sort().join('|');

/**
 * Exercícios que trabalham o mesmo grupo com o mesmo efeito: mesmos músculos principais,
 * mesma categoria, mesma mecânica (composto/isolado) e mesma força (empurrar/puxar).
 * O equipamento pode mudar, que é o objetivo da troca. Os mais parecidos (músculos
 * secundários em comum) vêm primeiro.
 */
export function equivalentes(alvo: Exercise, todos: Exercise[], excluidos: ReadonlySet<string>): Exercise[] {
  const principais = chave(alvo.primaryMuscles);
  const secundarios = new Set(alvo.secondaryMuscles);
  const parecido = (e: Exercise) => {
    const comum = e.secondaryMuscles.filter((m) => secundarios.has(m)).length;
    const uniao = new Set([...e.secondaryMuscles, ...alvo.secondaryMuscles]).size;
    return uniao ? comum / uniao : 1;
  };
  return todos
    .filter(
      (e) =>
        e.id !== alvo.id &&
        !excluidos.has(e.id) &&
        chave(e.primaryMuscles) === principais &&
        e.category === alvo.category &&
        e.mechanic === alvo.mechanic &&
        e.force === alvo.force,
    )
    .sort((a, b) => parecido(b) - parecido(a) || a.id.localeCompare(b.id));
}
