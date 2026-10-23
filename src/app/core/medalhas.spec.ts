import { Sessao } from './models';
import { dataISO } from './stats';
import { Conquista, calcularConquistas, formatarProgresso, formatarValor, fracaoAteOProximo, historicoDeRecordes, proximaConquista } from './medalhas';

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
    expect(lista.map((c) => c.id)).toEqual(['treinos', 'constancia', 'volume', 'recordes']);
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
