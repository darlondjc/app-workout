import { Sessao } from './models';
import { evolucaoDoExercicio, umRm } from './evolucao';

const sessao = (data: string, series: { carga: number; reps: number }[], id = 'supino', unidade?: 'min'): Sessao => ({
  data,
  fichaId: 'f',
  registros: [{ exerciseId: id, ...(unidade ? { unidade } : {}), series }],
});

describe('evolução de um exercício', () => {
  it('um ponto por treino em que o exercício foi feito, na ordem do histórico', () => {
    const h = [
      sessao('2026-10-01', [{ carga: 40, reps: 10 }, { carga: 50, reps: 8 }]),
      sessao('2026-10-02', [{ carga: 100, reps: 5 }], 'agachamento'),
      sessao('2026-10-08', [{ carga: 50, reps: 10 }]),
    ];
    const e = evolucaoDoExercicio(h, 'supino');
    expect(e.pontos.map((p) => p.data)).toEqual(['2026-10-01', '2026-10-08']);
    expect(e.pontos[0].carga).toBe(50);
    expect(e.pontos[0].volume).toBe(40 * 10 + 50 * 8);
    expect(e.minutos).toBeFalse();
  });

  it('estima o 1RM pela melhor série (Epley) e uma repetição vale a própria carga', () => {
    expect(umRm(60, 1)).toBe(60);
    expect(umRm(60, 10)).toBe(80);
    const e = evolucaoDoExercicio([sessao('2026-10-01', [{ carga: 60, reps: 10 }, { carga: 70, reps: 3 }])], 'supino');
    expect(e.pontos[0].rm).toBe(80);
  });

  it('exercícios em minutos somam os minutos e avisam que não há carga', () => {
    const e = evolucaoDoExercicio([sessao('2026-10-01', [{ carga: 0, reps: 20 }], 'esteira', 'min'), sessao('2026-10-02', [{ carga: 0, reps: 25 }], 'esteira', 'min')], 'esteira');
    expect(e.minutos).toBeTrue();
    expect(e.pontos.map((p) => p.minutos)).toEqual([20, 25]);
  });

  it('guarda só os últimos treinos quando há muitos', () => {
    const h = Array.from({ length: 40 }, (_, i) => sessao(`2026-09-${String((i % 28) + 1).padStart(2, '0')}`, [{ carga: i, reps: 5 }]));
    const e = evolucaoDoExercicio(h, 'supino', 30);
    expect(e.pontos.length).toBe(30);
    expect(e.pontos.at(-1)!.carga).toBe(39);
  });

  it('sem treinos do exercício, não há pontos', () => {
    expect(evolucaoDoExercicio([sessao('2026-10-01', [{ carga: 1, reps: 1 }], 'outro')], 'supino').pontos).toEqual([]);
  });
});
