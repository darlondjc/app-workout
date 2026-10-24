import { Exercise, Sessao } from './models';
import { dataISO } from './stats';
import { Conquista, calcularConquistas, formatarProgresso, formatarValor, fracaoAteOProximo, historicoDeRecordes, impressaoDoHistorico, niveisGanhos, ordenarPorNivel, proximaConquista, regiaoDoExercicio, RegiaoDoExercicio } from './medalhas';

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

/** `quantos` treinos em dias seguidos a partir de 1º de março de 2026. */
function treinos(quantos: number): Sessao[] {
  return Array.from({ length: quantos }, (_, i) => sessao(dataISO(new Date(2026, 2, 1 + i))));
}

const meta = (lista: Conquista[], id: Conquista['id']) => lista.find((c) => c.id === id)!;

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

describe('calcularConquistas', () => {
  it('tem uma trilha por meta, cada uma com bronze, prata, ouro e diamante', () => {
    const lista = calcularConquistas([], 3);
    expect(lista.map((c) => c.id)).toEqual(['treinos', 'ano', 'constancia', 'sequencia', 'volume', 'recordes', 'superiores', 'inferiores', 'cardio']);
    for (const c of lista) expect(c.degraus.map((d) => d.nivel)).toEqual(['bronze', 'prata', 'ouro', 'diamante']);
  });

  it('sem treinos, ninguém tem medalha e o próximo nível é o bronze', () => {
    for (const c of calcularConquistas([], 3)) {
      expect(c.nivel).toBeNull();
      expect(c.proximo?.nivel).toBe('bronze');
      expect(c.atual).toBe(0);
    }
  });

  it('treinos: ao alcançar o bronze, a data é a do treino que completou o alvo', () => {
    const c = meta(calcularConquistas(treinos(5), 3), 'treinos');
    expect(c.nivel).toBe('bronze');
    expect(c.dataDoNivel).toBe('2026-03-05');
    expect(c.proximo).toEqual(jasmine.objectContaining({ nivel: 'prata', alvo: 25, conquistado: false }));
  });

  it('o nível novo substitui o anterior: prata mostra só prata, mas o bronze segue na trilha como conquistado', () => {
    const c = meta(calcularConquistas(treinos(25), 3), 'treinos');
    expect(c.nivel).toBe('prata');
    expect(c.degraus.map((d) => d.conquistado)).toEqual([true, true, false, false]);
    expect(c.degraus[0].data).toBe('2026-03-05');
    expect(c.dataDoNivel).toBe(c.degraus[1].data);
  });

  it('no nível máximo não há próximo degrau', () => {
    const c = meta(calcularConquistas(treinos(250), 3), 'treinos');
    expect(c.nivel).toBe('diamante');
    expect(c.proximo).toBeNull();
    expect(fracaoAteOProximo(c)).toBe(1);
  });

  it('constância: semanas seguidas na meta, com a data do treino que fechou a meta', () => {
    // Semanas de segunda 2026-10-05 e 2026-10-12, as duas com meta 2 cumprida.
    const h = [sessao('2026-10-05'), sessao('2026-10-07'), sessao('2026-10-12'), sessao('2026-10-14')];
    const c = meta(calcularConquistas(h, 2), 'constancia');
    expect(c.atual).toBe(2);
    expect(c.nivel).toBe('bronze');
    expect(c.dataDoNivel).toBe('2026-10-14');
  });

  it('constância: uma semana sem bater a meta interrompe a sequência', () => {
    const h = [sessao('2026-10-05'), sessao('2026-10-07'), sessao('2026-10-19'), sessao('2026-10-21')];
    const c = meta(calcularConquistas(h, 2), 'constancia');
    expect(c.atual).toBe(1);
    expect(c.nivel).toBeNull();
  });

  it('carga levantada: soma kg × repetições e guarda o dia em que o alvo foi passado', () => {
    // 50 kg × 10 reps × 2 séries = 1000 kg por treino.
    const h = [sessao('2026-10-01', 'supino', [50, 50]), sessao('2026-10-03', 'supino', [50, 50])];
    const c = meta(calcularConquistas(h, 3), 'volume');
    expect(c.atual).toBe(2000);
    expect(c.nivel).toBe('bronze');
    expect(c.dataDoNivel).toBe('2026-10-01');
  });

  it('recordes: conta quantas vezes a carga foi superada', () => {
    const h = [sessao('2026-10-01', 'supino', [40]), sessao('2026-10-03', 'supino', [45]), sessao('2026-10-05', 'supino', [50])];
    const c = meta(calcularConquistas(h, 3), 'recordes');
    expect(c.atual).toBe(2);
    expect(c.nivel).toBe('bronze');
    expect(c.dataDoNivel).toBe('2026-10-03');
  });
});

const HOJE = new Date(2026, 9, 23);
const regiaoDe = (id: string): RegiaoDoExercicio | null => (id === 'agachamento' ? 'inferior' : id === 'supino' ? 'superior' : id === 'esteira' ? 'cardio' : null);

describe('medalhas novas', () => {
  it('treinos no ano: só conta o ano de hoje, com diamante em 200', () => {
    const h = [sessao('2025-12-30'), sessao('2025-12-31'), sessao('2026-01-02'), sessao('2026-01-03')];
    const c = meta(calcularConquistas(h, 3, { hoje: HOJE }), 'ano');
    expect(c.titulo).toBe('Treinos em 2026');
    expect(c.atual).toBe(2);
    expect(c.degraus.at(-1)?.alvo).toBe(200);
  });

  it('treinos no ano: zera quando o ano muda', () => {
    const h = Array.from({ length: 25 }, (_, i) => sessao(dataISO(new Date(2026, 0, 1 + i))));
    expect(meta(calcularConquistas(h, 3, { hoje: HOJE }), 'ano').nivel).toBe('bronze');
    const novo = meta(calcularConquistas(h, 3, { hoje: new Date(2027, 0, 5) }), 'ano');
    expect(novo.titulo).toBe('Treinos em 2027');
    expect(novo.atual).toBe(0);
    expect(novo.nivel).toBeNull();
  });

  it('dias seguidos: a maior sequência, com a data em que o alvo foi alcançado', () => {
    const h = [sessao('2026-10-01'), sessao('2026-10-02'), sessao('2026-10-04'), sessao('2026-10-05'), sessao('2026-10-06')];
    const c = meta(calcularConquistas(h, 3, { hoje: HOJE }), 'sequencia');
    expect(c.atual).toBe(3);
    expect(c.nivel).toBe('bronze');
    expect(c.dataDoNivel).toBe('2026-10-06');
  });

  it('dias seguidos: dois treinos no mesmo dia contam como um dia', () => {
    const c = meta(calcularConquistas([sessao('2026-10-01'), sessao('2026-10-01'), sessao('2026-10-02')], 3, { hoje: HOJE }), 'sequencia');
    expect(c.atual).toBe(2);
  });

  it('inferiores, superiores e cardio contam exercícios feitos, cada um na sua região', () => {
    const cardio: Sessao = { id: 'c', data: '2026-10-03', fichaId: 'f1', registros: [{ exerciseId: 'esteira', series: [{ carga: 0, reps: 20 }] }] };
    const minutos: Sessao = { id: 'm', data: '2026-10-04', fichaId: 'f1', registros: [{ exerciseId: 'desconhecido', unidade: 'min', series: [{ carga: 0, reps: 15 }] }] };
    const h = [sessao('2026-10-01', 'supino'), sessao('2026-10-02', 'agachamento'), sessao('2026-10-02', 'outro'), cardio, minutos];
    const lista = calcularConquistas(h, 3, { hoje: HOJE, regiaoDe });
    expect(meta(lista, 'superiores').atual).toBe(1);
    expect(meta(lista, 'inferiores').atual).toBe(1);
    expect(meta(lista, 'cardio').atual).toBe(2);
  });

  it('sem saber a região dos exercícios, só o cardio em minutos conta', () => {
    const lista = calcularConquistas([sessao('2026-10-01', 'supino')], 3, { hoje: HOJE });
    expect(meta(lista, 'superiores').atual).toBe(0);
  });

  it('regiaoDoExercicio usa o músculo principal e a categoria', () => {
    const ex = (category: string, musculo: string) => ({ category, primaryMuscles: [musculo] }) as Exercise;
    expect(regiaoDoExercicio(ex('strength', 'quadriceps'))).toBe('inferior');
    expect(regiaoDoExercicio(ex('strength', 'chest'))).toBe('superior');
    expect(regiaoDoExercicio(ex('cardio', 'quadriceps'))).toBe('cardio');
    expect(regiaoDoExercicio(ex('strength', 'abdominals'))).toBeNull();
    expect(regiaoDoExercicio(undefined)).toBeNull();
  });
});

describe('ordenarPorNivel', () => {
  it('maior nível primeiro, sem medalha no fim, e empate mantém a ordem', () => {
    const base = calcularConquistas([], 3);
    const com = (id: Conquista['id'], nivel: Conquista['nivel']) => ({ ...base.find((c) => c.id === id)!, nivel });
    const lista = [com('treinos', 'bronze'), com('ano', null), com('constancia', 'diamante'), com('sequencia', 'bronze'), com('volume', 'ouro')];
    expect(ordenarPorNivel(lista).map((c) => c.id)).toEqual(['constancia', 'volume', 'treinos', 'sequencia', 'ano']);
  });
});

describe('proximaConquista', () => {
  it('é a meta cujo próximo nível está mais perto', () => {
    // 20 treinos: 80% do caminho até a prata (25). As demais metas estão mais longe.
    const p = proximaConquista(calcularConquistas(treinos(20), 3));
    expect(p?.id).toBe('treinos');
    expect(p?.proximo?.nivel).toBe('prata');
  });

  it('com tudo no máximo, não há próxima', () => {
    const maximo = calcularConquistas([], 3).map((c) => ({ ...c, proximo: null }));
    expect(proximaConquista(maximo)).toBeNull();
  });
});

describe('formatarProgresso', () => {
  it('diz a unidade uma vez só', () => {
    expect(formatarProgresso('treinos', 21, 25)).toBe('21 de 25 treinos');
    expect(formatarProgresso('constancia', 7, 12)).toBe('7 de 12 semanas');
    expect(formatarProgresso('volume', 42400, 50000)).toBe('42,4 t de 50 t');
  });
});

describe('formatarValor', () => {
  it('usa a unidade de cada meta, no singular e no plural', () => {
    expect(formatarValor('treinos', 1)).toBe('1 treino');
    expect(formatarValor('treinos', 25)).toBe('25 treinos');
    expect(formatarValor('constancia', 1)).toBe('1 semana');
    expect(formatarValor('recordes', 10)).toBe('10 recordes');
  });

  it('carga: kg abaixo de uma tonelada, toneladas a partir dela', () => {
    expect(formatarValor('volume', 840)).toBe('840 kg');
    expect(formatarValor('volume', 10000)).toBe('10 t');
    expect(formatarValor('volume', 2500)).toBe('2,5 t');
  });
});

describe('niveisGanhos', () => {
  const ctx = { hoje: new Date(2026, 2, 31), regiaoDe: () => null };
  const calc = (h: Sessao[]) => calcularConquistas(h, 3, ctx);

  it('aponta a meta cujo nível subiu com o último treino', () => {
    const todos = treinos(5);
    const novas = niveisGanhos(calc(todos.slice(0, 4)), calc(todos), '2026-03-10');
    const treinosNova = novas.find((x) => x.id === 'treinos');
    expect(treinosNova?.nivel).toBe('bronze');
    expect(treinosNova?.em).toBe('2026-03-10');
  });

  it('não aponta nada quando nenhum nível mudou', () => {
    const todos = treinos(7);
    expect(niveisGanhos(calc(todos.slice(0, 6)), calc(todos), '2026-03-07').find((x) => x.id === 'treinos')).toBeUndefined();
  });
});

describe('impressaoDoHistorico', () => {
  it('muda com treino novo, meta ou ano, e é estável caso contrário', () => {
    const h = treinos(3);
    const base = impressaoDoHistorico(h, 3, 2026);
    expect(impressaoDoHistorico([...h], 3, 2026)).toBe(base);
    expect(impressaoDoHistorico([...h, sessao('2026-03-20')], 3, 2026)).not.toBe(base);
    expect(impressaoDoHistorico(h, 4, 2026)).not.toBe(base);
    expect(impressaoDoHistorico(h, 3, 2027)).not.toBe(base);
  });
});
