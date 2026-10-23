import { Sessao } from './models';
import { intervalo, montarLinhas } from './sessao-detalhe';

const nomeDe = (id: string) => `Nome de ${id}`;

describe('sessao-detalhe', () => {
  it('formata o intervalo em minutos e segundos', () => {
    expect(intervalo(5)).toBe('0:05');
    expect(intervalo(65)).toBe('1:05');
    expect(intervalo(600)).toBe('10:00');
  });

  it('monta uma linha por exercício com as séries feitas', () => {
    const s: Sessao = {
      id: 's',
      data: '2026-10-22',
      fichaId: 'f',
      registros: [
        { exerciseId: 'supino', series: [{ carga: 20, reps: 12 }, { carga: 22.5, reps: 10, descanso: 75 }] },
        { exerciseId: 'esteira', unidade: 'min', series: [{ carga: 0, reps: 20 }] },
      ],
    };
    const l = montarLinhas(s, nomeDe);
    expect(l.length).toBe(2);
    expect(l[0]).toEqual({
      id: 'supino',
      nome: 'Nome de supino',
      minutos: false,
      temIntervalo: true,
      series: [
        { n: 1, reps: 12, carga: 20, intervalo: null },
        { n: 2, reps: 10, carga: 22.5, intervalo: '1:15' },
      ],
    });
    expect(l[1].minutos).toBeTrue();
    expect(l[1].temIntervalo).toBeFalse();
  });

  it('treinos antigos, sem intervalo ou sem registros, não quebram', () => {
    expect(montarLinhas({ id: 's', data: 'd', fichaId: 'f' }, nomeDe)).toEqual([]);
    const antigo: Sessao = { id: 's', data: 'd', fichaId: 'f', registros: [{ exerciseId: 'x', series: [{ carga: 5, reps: 5 }] }, { exerciseId: 'vazio', series: [] }] };
    const l = montarLinhas(antigo, nomeDe);
    expect(l.length).toBe(1);
    expect(l[0].temIntervalo).toBeFalse();
  });
});
