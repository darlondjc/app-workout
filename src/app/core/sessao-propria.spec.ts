import { registrosDoRascunho } from './sessao-propria';

describe('registrosDoRascunho', () => {
  it('tira exercícios sem série e não leva `descanso` indefinido', () => {
    const r = registrosDoRascunho([
      { exerciseId: 'a', series: [{ carga: 10, reps: 5, descanso: 45 }, { carga: 10, reps: 5 }] },
      { exerciseId: 'b', series: [] },
      { exerciseId: 'c', unidade: 'min', series: [{ carga: 0, reps: 20 }] },
    ]);
    expect(r.map((x) => x.exerciseId)).toEqual(['a', 'c']);
    expect(r[0].series[1]).toEqual({ carga: 10, reps: 5 });
    expect('descanso' in r[0].series[1]).toBeFalse();
    expect(r[1].unidade).toBe('min');
  });
});
