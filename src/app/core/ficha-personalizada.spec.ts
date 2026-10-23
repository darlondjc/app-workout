import { DiaPersonalizado, diaValido, gerarFichas, nomeDoDia } from './ficha-personalizada';
import { Exercise } from './models';

const ex = (id: string, muscle: string, extra: Partial<Exercise> = {}): Exercise => ({
  id, name: id, force: null, level: 'beginner', mechanic: 'compound', equipment: 'machine',
  primaryMuscles: [muscle], secondaryMuscles: [], instructions: [], category: 'strength', images: [], ...extra,
});
const base: Exercise[] = [
  ...Array.from({ length: 8 }, (_, i) => ex('peito' + i, 'chest')),
  ...Array.from({ length: 6 }, (_, i) => ex('biceps' + i, 'biceps', { mechanic: 'isolation' })),
  ...Array.from({ length: 6 }, (_, i) => ex('triceps' + i, 'triceps', { mechanic: 'isolation' })),
  ex('esteira', 'quadriceps', { category: 'cardio', equipment: 'machine' }),
  ex('bike', 'quadriceps', { category: 'cardio', equipment: 'machine' }),
];
const dia = (grupos: string[], cardio = false, nome = ''): DiaPersonalizado => ({ grupos, cardio, nome });

describe('ficha personalizada', () => {
  it('nome automático junta os grupos e o cardio', () => {
    expect(nomeDoDia(dia(['peito']))).toBe('Peito');
    expect(nomeDoDia(dia(['biceps', 'triceps']))).toBe('Bíceps e Tríceps');
    expect(nomeDoDia(dia(['peito', 'costas'], true))).toBe('Peito, Costas e Cardio');
    expect(nomeDoDia(dia([], true))).toBe('Cardio');
  });

  it('o nome escolhido vale mais que o automático', () => {
    expect(nomeDoDia(dia(['peito'], false, '  Dia do peito '))).toBe('Dia do peito');
  });

  it('o dia precisa de grupo ou de cardio', () => {
    expect(diaValido(dia([]))).toBeFalse();
    expect(diaValido(dia([], true))).toBeTrue();
    expect(diaValido(dia(['peito']))).toBeTrue();
  });

  it('gera uma ficha por dia, com cardio só nos dias pedidos', () => {
    const f = gerarFichas(base, [dia(['peito']), dia(['biceps', 'triceps'], true), dia(['peito'], true)], { nivel: 'intermediate' });
    expect(f.map((x) => x.nome)).toEqual(['Peito', 'Bíceps, Tríceps e Cardio', 'Peito e Cardio']);
    const cardio = (i: number) => f[i].itens.filter((it) => it.exerciseId === 'esteira' || it.exerciseId === 'bike').length;
    expect([cardio(0), cardio(1), cardio(2)]).toEqual([0, 1, 1]);
  });

  it('o dia de bíceps e tríceps só tem exercícios desses grupos', () => {
    const [f] = gerarFichas(base, [dia(['biceps', 'triceps'])], { nivel: 'intermediate' });
    expect(f.itens.length).toBeGreaterThan(1);
    expect(f.itens.every((i) => /^(biceps|triceps)/.test(i.exerciseId))).toBeTrue();
  });

  it('um exercício não se repete entre os dias, mesmo com o mesmo grupo', () => {
    const f = gerarFichas(base, [dia(['peito']), dia(['peito'])], { nivel: 'intermediate' });
    const ids = f.flatMap((x) => x.itens.map((i) => i.exerciseId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('o máximo limita os exercícios do dia', () => {
    const [f] = gerarFichas(base, [dia(['peito'], true)], { nivel: 'intermediate', maximo: 4 });
    expect(f.itens.length).toBeLessThanOrEqual(4);
  });

  it('dia só de cardio traz o cardio', () => {
    const [f] = gerarFichas(base, [dia([], true)], { nivel: 'intermediate' });
    expect(f.itens.length).toBe(1);
    expect(f.itens[0].unidade).toBe('min');
  });

  it('a variação de um dia muda a escolha dele', () => {
    const a = gerarFichas(base, [dia(['peito'])], { nivel: 'intermediate' })[0].itens.map((i) => i.exerciseId);
    const b = gerarFichas(base, [dia(['peito'])], { nivel: 'intermediate', variacoes: [1] })[0].itens.map((i) => i.exerciseId);
    expect(b).not.toEqual(a);
  });
});
