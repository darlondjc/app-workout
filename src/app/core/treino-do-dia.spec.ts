import { Exercise } from './models';
import { treinoDoDia } from './treino-do-dia';

function ex(id: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: id,
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
    ...extra,
  };
}

/** Uma base pequena: os clássicos de peito e alguns extras, mais cardio. */
const base: Exercise[] = [
  ex('Barbell_Bench_Press_-_Medium_Grip'),
  ex('Dumbbell_Bench_Press', { equipment: 'dumbbell' }),
  ex('Incline_Dumbbell_Press', { equipment: 'dumbbell' }),
  ex('Dumbbell_Flyes', { equipment: 'dumbbell', mechanic: 'isolation' }),
  ex('Cable_Crossover', { equipment: 'cable', mechanic: 'isolation' }),
  ex('Extra_A', { mechanic: 'isolation' }),
  ex('Extra_B', { mechanic: 'isolation' }),
  ex('Extra_Avancado', { level: 'expert' }),
  ex('Barbell_Curl', { primaryMuscles: ['biceps'], mechanic: 'isolation' }),
  ex('Hammer_Curls', { primaryMuscles: ['biceps'], mechanic: 'isolation', equipment: 'dumbbell' }),
  ex('Jogging_Treadmill', { category: 'cardio', equipment: 'machine', primaryMuscles: ['quadriceps'], mechanic: null }),
  ex('Bicycling_Stationary', { category: 'cardio', equipment: 'machine', primaryMuscles: ['quadriceps'], mechanic: null }),
];

const pedido = { grupos: ['peito'], cardio: false, nivel: 'beginner' as const, excluidos: new Set<string>() };
const ids = (t: { itens: { exerciseId: string }[] }) => t.itens.map((i) => i.exerciseId);

describe('treinoDoDia', () => {
  it('monta o treino só com o grupo pedido', () => {
    const r = treinoDoDia(base, pedido);
    expect(r.itens.length).toBe(6);
    expect(ids(r)).toContain('Barbell_Bench_Press_-_Medium_Grip');
    expect(ids(r)).not.toContain('Barbell_Curl');
  });

  it('nunca usa exercício que já está nas fichas', () => {
    const excluidos = new Set(['Barbell_Bench_Press_-_Medium_Grip', 'Extra_A']);
    expect(ids(treinoDoDia(base, { ...pedido, excluidos }))).not.toContain('Barbell_Bench_Press_-_Medium_Grip');
    expect(ids(treinoDoDia(base, { ...pedido, excluidos }))).not.toContain('Extra_A');
  });

  it('completa com outros exercícios do grupo quando os clássicos já estão nas fichas', () => {
    const excluidos = new Set(base.filter((e) => e.id.includes('Bench') || e.id.includes('Incline') || e.id.includes('Flyes') || e.id.includes('Crossover')).map((e) => e.id));
    const r = treinoDoDia(base, { ...pedido, excluidos });
    expect(ids(r)).toEqual(jasmine.arrayContaining(['Extra_A', 'Extra_B']));
  });

  it('respeita o nível: iniciante não recebe exercício avançado', () => {
    expect(ids(treinoDoDia(base, pedido))).not.toContain('Extra_Avancado');
    const avancado = treinoDoDia(base, { ...pedido, nivel: 'expert', excluidos: new Set(base.slice(0, 5).map((e) => e.id)) });
    expect(ids(avancado)).toContain('Extra_Avancado');
  });

  it('divide o treino entre vários grupos', () => {
    const r = treinoDoDia(base, { ...pedido, grupos: ['peito', 'biceps'] });
    expect(ids(r)).toEqual(jasmine.arrayContaining(['Barbell_Curl', 'Hammer_Curls']));
    expect(r.itens.length).toBe(6); // 4 de peito + 2 de bíceps (só há 2 de bíceps)
  });

  it('com cardio, termina com um cardio em minutos', () => {
    const r = treinoDoDia(base, { ...pedido, cardio: true });
    const ultimo = r.itens.at(-1);
    expect(ultimo?.exerciseId).toBe('Jogging_Treadmill');
    expect(ultimo?.unidade).toBe('min');
    expect(r.semCardio).toBeFalse();
  });

  it('cardio que já está nas fichas não entra; sem nenhum disponível, avisa', () => {
    const excluidos = new Set(['Jogging_Treadmill']);
    expect(ids(treinoDoDia(base, { ...pedido, cardio: true, excluidos })).at(-1)).toBe('Bicycling_Stationary');
    const nenhum = treinoDoDia(base, { ...pedido, cardio: true, excluidos: new Set(['Jogging_Treadmill', 'Bicycling_Stationary']) });
    expect(nenhum.semCardio).toBeTrue();
    expect(ids(nenhum)).not.toContain('Jogging_Treadmill');
  });

  it('a variação troca a escolha, mas a mesma variação repete o resultado', () => {
    const a = ids(treinoDoDia(base, { ...pedido, variacao: 0 }));
    expect(ids(treinoDoDia(base, { ...pedido, variacao: 0 }))).toEqual(a);
    expect(ids(treinoDoDia(base, { ...pedido, variacao: 1 }))).not.toEqual(a);
  });

  it('não repete exercício dentro do treino', () => {
    const r = ids(treinoDoDia(base, { ...pedido, grupos: ['peito', 'biceps'], cardio: true }));
    expect(new Set(r).size).toBe(r.length);
  });

  it('sem nada disponível devolve treino vazio', () => {
    const r = treinoDoDia(base, { ...pedido, excluidos: new Set(base.map((e) => e.id)) });
    expect(r.itens).toEqual([]);
  });
});
