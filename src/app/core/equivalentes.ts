import { Exercise } from './models';

const chave = (m: string[]) => [...m].sort().join('|');

/**
 * Exercícios que trabalham o mesmo grupo com o mesmo efeito: mesmos músculos principais,
 * mesma categoria, mesma mecânica (composto/isolado) e mesma força (empurrar/puxar).
 * O equipamento pode mudar, que é o objetivo da troca. Vêm em ordem alfabética pelo nome.
 */
export function equivalentes(alvo: Exercise, todos: Exercise[], excluidos: ReadonlySet<string>): Exercise[] {
  const principais = chave(alvo.primaryMuscles);
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
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id));
}
