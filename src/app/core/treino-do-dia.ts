import { Exercise, ItemFicha } from './models';
import { GRUPOS } from './exercise.service';
import { CANDIDATOS, COMPOSTOS, EQUIPAMENTOS, Grupo, Nivel, ORDEM_NIVEL, parametros } from './suggestion';

export interface PedidoTreinoDia {
  /** Chaves de `GRUPOS` (peito, costas...). */
  grupos: string[];
  cardio: boolean;
  nivel: Nivel;
  /** Exercícios que não podem entrar (os que já estão nas fichas da pessoa). */
  excluidos: ReadonlySet<string>;
  /** Máximo de exercícios do treino (cardio incluído). Sem ele, vale a quantidade padrão por grupo. */
  maximo?: number;
  /** Muda a escolha para gerar alternativas. */
  variacao?: number;
}

export interface TreinoDoDia {
  itens: ItemFicha[];
  /** Pediu cardio, mas não sobrou nenhum que não esteja nas fichas. */
  semCardio: boolean;
}

/** Movimentos de cada grupo, na ordem em que entram no treino. */
const MOVIMENTOS: Record<string, Grupo[]> = {
  peito: ['peito', 'peitoInclinado', 'peitoIsolado', 'peito', 'peitoInclinado', 'peitoIsolado'],
  costas: ['puxada', 'remada', 'remada', 'puxada', 'trapezio', 'lombar'],
  ombros: ['ombro', 'ombroLateral', 'ombroPosterior', 'ombroLateral', 'ombro', 'ombroPosterior'],
  biceps: ['biceps', 'biceps', 'biceps', 'biceps', 'biceps', 'biceps'],
  triceps: ['triceps', 'triceps', 'triceps', 'triceps', 'triceps', 'triceps'],
  pernas: ['agachamento', 'posterior', 'extensora', 'flexora', 'panturrilha', 'unilateral', 'gluteo'],
  abdomen: ['abdomen', 'abdomen', 'abdomen', 'abdomen', 'abdomen', 'abdomen'],
};

/** Quantos exercícios por grupo, conforme quantos grupos foram escolhidos. */
function porGrupo(qtdGrupos: number): number {
  return [6, 6, 4, 3, 2, 2][qtdGrupos] ?? 1;
}

/** Reparte `total` exercícios entre `n` grupos, o que sobrar vai para os primeiros; cada grupo ganha ao menos 1 enquanto houver vaga. */
export function repartir(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const resto = total % n;
  return Array.from({ length: n }, (_, i) => Math.max(total >= n ? 1 : 0, base + (i < resto ? 1 : 0)));
}

/** Sorteio repetível: a mesma `variacao` dá sempre a mesma ordem. */
function aleatorio(semente: number): () => number {
  let a = (semente + 1) * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monta um treino de um dia, para quem quer treinar algo diferente da ficha. Usa os movimentos
 * clássicos de cada grupo e completa com o restante da base. Nada que esteja em `excluidos` entra.
 * Pensado para academia: aceita os equipamentos de lá.
 */
export function treinoDoDia(todos: Exercise[], pedido: PedidoTreinoDia): TreinoDoDia {
  const variacao = pedido.variacao ?? 0;
  const sorteio = aleatorio(variacao);
  const porId = new Map(todos.map((e) => [e.id, e]));
  const nivelMax = ORDEM_NIVEL[pedido.nivel];
  const aceitos = EQUIPAMENTOS.academia;
  const usados = new Set<string>(pedido.excluidos);

  const serve = (e: Exercise | undefined): e is Exercise =>
    !!e && !usados.has(e.id) && ORDEM_NIVEL[e.level] <= nivelMax && aceitos.includes(e.equipment);

  const itens: ItemFicha[] = [];
  const adicionar = (e: Exercise, grupo: Grupo, composto: boolean) => {
    usados.add(e.id);
    itens.push({ exerciseId: e.id, carga: 0, ...parametros('hipertrofia', composto, pedido.nivel, grupo) });
  };

  const grupos = GRUPOS.filter((g) => pedido.grupos.includes(g.key));
  const cotas =
    pedido.maximo && grupos.length > 0
      ? repartir(Math.max(0, pedido.maximo - (pedido.cardio ? 1 : 0)), grupos.length)
      : grupos.map(() => porGrupo(grupos.length));

  for (const [gi, g] of grupos.entries()) {
    const cota = cotas[gi];
    const antes = itens.length;
    const usosPorMovimento = new Map<Grupo, number>();
    for (const mov of (MOVIMENTOS[g.key] ?? []).slice(0, cota)) {
      const lista = CANDIDATOS[mov].map((id) => porId.get(id)).filter(serve);
      if (lista.length === 0) continue;
      const n = usosPorMovimento.get(mov) ?? 0;
      usosPorMovimento.set(mov, n + 1);
      const escolhido = lista[(n + variacao) % lista.length];
      adicionar(escolhido, mov, COMPOSTOS.has(mov));
    }
    // Completa com o resto da base quando os clássicos acabam (ou não existem para o grupo).
    const falta = cota - (itens.length - antes);
    if (falta > 0) {
      const extras = todos
        .filter((e) => serve(e) && e.category === 'strength' && e.primaryMuscles.some((m) => g.muscles.includes(m)))
        .map((e) => ({ e, chave: (e.mechanic === 'compound' ? 0 : 1) + sorteio() }))
        .sort((a, b) => a.chave - b.chave)
        .slice(0, falta);
      for (const { e } of extras) adicionar(e, 'triceps', e.mechanic === 'compound');
    }
  }

  let semCardio = false;
  if (pedido.cardio) {
    const classicos = CANDIDATOS.cardio.map((id) => porId.get(id)).filter(serve);
    const outros = todos.filter((e) => serve(e) && e.category === 'cardio');
    const cardio = classicos.length ? classicos[variacao % classicos.length] : outros[0];
    if (cardio) adicionar(cardio, 'cardio', false);
    else semCardio = true;
  }

  return { itens, semCardio };
}
