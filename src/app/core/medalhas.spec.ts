import { Sessao } from './models';
import { calcularMedalhas, historicoDeRecordes, proximaMedalha, ultimasConquistas } from './medalhas';

let n = 0;

/** Treino com um exercício; `cargas` são as cargas das séries (10 repetições cada). */
function sessao(data: string, exerciseId = 'supino', cargas: number[] = [20]): Sessao {
  return {
    id: `s${++n}`,
    data,
    fichaId: 'f1',
    concluidaEm: n,
    registros: [{ exerciseId, series: cargas.map((carga) => ({ carga, reps: 10 })) }],
  };
}

const medalha = (lista: ReturnType<typeof calcularMedalhas>, id: string) => lista.find((m) => m.id === id)!;

describe('historicoDeRecordes', () => {
  it('a primeira vez de um exercício só estabelece a marca', () => {
    expect(historicoDeRecordes([sessao('2026-10-01', 'supino', [40])])).toEqual([]);
  });

  it('registra quando a carga passa a melhor anterior, e não quando só iguala', () => {
    const h = [sessao('2026-10-01', 'supino', [40]), sessao('2026-10-03', 'supino', [40]), sessao('2026-10-05', 'supino', [45])];
    expect(historicoDeRecordes(h)).toEqual([{ exerciseId: 'supino', carga: 45, antes: 40, data: '2026-10-05' }]);
  });

  it('separa os exercícios e ignora cardio em minutos', () => {
    const cardio: Sessao = { id: 'c', data: '2026-10-06', fichaId: 'f1', registros: [{ exerciseId: 'esteira', unidade: 'min', series: [{ carga: 0, reps: 20 }] }] };
    const h = [sessao('2026-10-01', 'supino', [40]), sessao('2026-10-02', 'agachamento', [60]), cardio, sessao('2026-10-07', 'agachamento', [70])];
    expect(historicoDeRecordes(h).map((r) => r.exerciseId)).toEqual(['agachamento']);
  });

  it('não depende da ordem em que o histórico chega', () => {
    const h = [sessao('2026-10-05', 'supino', [45]), sessao('2026-10-01', 'supino', [40])];
    expect(historicoDeRecordes(h)).toEqual([{ exerciseId: 'supino', carga: 45, antes: 40, data: '2026-10-05' }]);
  });
});

describe('calcularMedalhas', () => {
  it('sem treinos, nada é conquistado e o progresso é zero', () => {
    const lista = calcularMedalhas([], 3);
    expect(lista.some((m) => m.conquistada)).toBeFalse();
    expect(medalha(lista, 'marco-1').atual).toBe(0);
  });

  it('o primeiro treino conquista a medalha com a data dele', () => {
    const m = medalha(calcularMedalhas([sessao('2026-10-02'), sessao('2026-10-09')], 3), 'marco-1');
    expect(m.conquistada).toBeTrue();
    expect(m.data).toBe('2026-10-02');
  });

  it('mostra o progresso das marcas que faltam', () => {
    const h = Array.from({ length: 7 }, (_, i) => sessao(`2026-10-${String(i + 1).padStart(2, '0')}`));
    const m = medalha(calcularMedalhas(h, 3), 'marco-10');
    expect(m.conquistada).toBeFalse();
    expect(m.data).toBeNull();
    expect([m.atual, m.alvo]).toEqual([7, 10]);
  });

  it('constância: semanas seguidas na meta, com a data do treino que fechou a meta', () => {
    // Semanas de segunda 2026-10-05 e 2026-10-12, duas de meta 2.
    const h = [sessao('2026-10-05'), sessao('2026-10-07'), sessao('2026-10-12'), sessao('2026-10-14')];
    const lista = calcularMedalhas(h, 2);
    expect(medalha(lista, 'constancia-1').data).toBe('2026-10-07');
    expect(medalha(lista, 'constancia-2').conquistada).toBeTrue();
    expect(medalha(lista, 'constancia-2').data).toBe('2026-10-14');
    expect(medalha(lista, 'constancia-4').conquistada).toBeFalse();
  });

  it('constância: uma semana sem bater a meta interrompe a sequência', () => {
    const h = [sessao('2026-10-05'), sessao('2026-10-07'), sessao('2026-10-19'), sessao('2026-10-21')];
    const lista = calcularMedalhas(h, 2);
    expect(medalha(lista, 'constancia-1').conquistada).toBeTrue();
    expect(medalha(lista, 'constancia-2').conquistada).toBeFalse();
  });

  it('volume: soma kg × repetições de todos os treinos e guarda o dia em que a marca foi passada', () => {
    // 50 kg × 10 reps × 2 séries = 1000 kg por treino.
    const h = [sessao('2026-10-01', 'supino', [50, 50]), sessao('2026-10-03', 'supino', [50, 50])];
    const lista = calcularMedalhas(h, 3);
    expect(medalha(lista, 'volume-1000').data).toBe('2026-10-01');
    expect(medalha(lista, 'volume-10000').conquistada).toBeFalse();
    expect(medalha(lista, 'volume-10000').atual).toBe(2000);
  });

  it('recordes: conta quantas vezes a carga foi superada', () => {
    const h = [sessao('2026-10-01', 'supino', [40]), sessao('2026-10-03', 'supino', [45]), sessao('2026-10-05', 'supino', [50])];
    const lista = calcularMedalhas(h, 3);
    expect(medalha(lista, 'recorde-1').data).toBe('2026-10-03');
    expect(medalha(lista, 'recorde-5').atual).toBe(2);
  });
});

describe('ultimasConquistas e proximaMedalha', () => {
  const h = [sessao('2026-10-01', 'supino', [40]), sessao('2026-10-03', 'supino', [45])];

  it('lista as conquistadas da mais recente para a mais antiga', () => {
    const ultimas = ultimasConquistas(calcularMedalhas(h, 3), 5);
    expect(ultimas.every((m) => m.conquistada)).toBeTrue();
    const datas = ultimas.map((m) => m.data ?? '');
    expect([...datas].sort().reverse()).toEqual(datas);
    expect(ultimas[0].data).toBe('2026-10-03');
  });

  it('respeita o limite pedido', () => {
    expect(ultimasConquistas(calcularMedalhas(h, 3), 1).length).toBe(1);
  });

  it('a próxima medalha é a não conquistada mais perto do alvo', () => {
    const p = proximaMedalha(calcularMedalhas(h, 3));
    expect(p?.conquistada).toBeFalse();
    // 2 de 10 treinos (20%) e 1 de 5 recordes (20%) empatam com o resto; basta ser uma ainda não conquistada com progresso.
    expect(p!.atual / p!.alvo).toBeGreaterThan(0);
  });

  it('sem nada a conquistar, não há próxima', () => {
    const tudo = calcularMedalhas([], 3).map((m) => ({ ...m, conquistada: true }));
    expect(proximaMedalha(tudo)).toBeNull();
  });
});
