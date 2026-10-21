import { equivalentes } from './equivalentes';
import { Exercise } from './models';

function ex(id: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: id,
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps'],
    instructions: [],
    category: 'strength',
    images: [],
    ...extra,
  };
}

describe('equivalentes', () => {
  const alvo = ex('supino');
  const ids = (l: Exercise[]) => l.map((e) => e.id);

  it('traz os de mesmo músculo, categoria, mecânica e força, mesmo com outro equipamento', () => {
    const todos = [alvo, ex('supino-halter', { equipment: 'dumbbell' }), ex('crucifixo', { mechanic: 'isolation' })];
    expect(ids(equivalentes(alvo, todos, new Set()))).toEqual(['supino-halter']);
  });

  it('não devolve o próprio exercício', () => {
    expect(equivalentes(alvo, [alvo], new Set())).toEqual([]);
  });

  it('descarta os que já estão nas fichas', () => {
    const todos = [alvo, ex('a'), ex('b')];
    expect(ids(equivalentes(alvo, todos, new Set(['a'])))).toEqual(['b']);
  });

  it('exige exatamente os mesmos músculos principais, em qualquer ordem', () => {
    const duplo = ex('duplo', { primaryMuscles: ['chest', 'shoulders'] });
    const duploInvertido = ex('duplo2', { primaryMuscles: ['shoulders', 'chest'] });
    const outro = ex('outro', { primaryMuscles: ['shoulders'] });
    expect(ids(equivalentes(duplo, [duplo, duploInvertido, outro, alvo], new Set()))).toEqual(['duplo2']);
  });

  it('separa categoria e força diferentes', () => {
    const todos = [alvo, ex('alongamento', { category: 'stretching' }), ex('puxar', { force: 'pull' })];
    expect(equivalentes(alvo, todos, new Set())).toEqual([]);
  });

  it('põe primeiro o que tem mais músculos secundários em comum', () => {
    const todos = [
      alvo,
      ex('longe', { secondaryMuscles: ['biceps'] }),
      ex('perto', { secondaryMuscles: ['triceps'] }),
    ];
    expect(ids(equivalentes(alvo, todos, new Set()))).toEqual(['perto', 'longe']);
  });
});
