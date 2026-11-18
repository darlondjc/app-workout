import { Exercise, Ficha, Sessao } from './models';
import { escolherProximaFicha, pontuacaoDaFicha, treinosDaFichaAtiva } from './proximo-treino';

const ex = (id: string, primary: string[], category = 'strength', secondary: string[] = []) =>
  ({ id, category, primaryMuscles: primary, secondaryMuscles: secondary }) as unknown as Exercise;

const base: Record<string, Exercise> = {
  supino: ex('supino', ['chest'], 'strength', ['triceps']),
  remada: ex('remada', ['middle back'], 'strength', ['biceps']),
  agachamento: ex('agachamento', ['quadriceps'], 'strength', ['glutes']),
  esteira: ex('esteira', [], 'cardio'),
};
const exercicioDe = (id: string) => base[id];

const ficha = (id: string, ...ids: string[]): Ficha =>
  ({ id, nome: id, itens: ids.map((exerciseId) => ({ exerciseId, series: 4, reps: 8, carga: 0, descanso: 60 })) }) as unknown as Ficha;

const hoje = new Date(2026, 10, 7);
const sessao = (fichaId: string, data: string, ...ids: string[]): Sessao =>
  ({ id: `${fichaId}-${data}`, data, fichaId, registros: ids.map((exerciseId) => ({ exerciseId, series: [{}, {}, {}, {}] })) }) as unknown as Sessao;

const peito = ficha('A', 'supino');
const costas = ficha('B', 'remada');
const pernas = ficha('C', 'agachamento');

describe('próximo treino pelo tempo parado dos músculos', () => {
  it('sem fichas, não sugere nada', () => {
    expect(escolherProximaFicha([], [], hoje, exercicioDe)).toBeNull();
  });

  it('sem histórico, segue a ordem da lista', () => {
    expect(escolherProximaFicha([peito, costas, pernas], [], hoje, exercicioDe)?.id).toBe('A');
  });

  it('pula a ficha seguinte do rodízio quando os músculos dela foram trabalhados há pouco', () => {
    // Depois de A o rodízio daria B, mas a costas foi treinada há 1 dia e as pernas estão paradas.
    const h = [sessao('B', '2026-11-06', 'remada'), sessao('A', '2026-11-06', 'supino')];
    expect(escolherProximaFicha([peito, costas, pernas], h, hoje, exercicioDe)?.id).toBe('C');
  });

  it('sugere a ficha parada há mais tempo mesmo que o rodízio apontasse outra', () => {
    // Fez B há 20 dias e A ontem; o rodízio dá B, que também é a mais parada: confirma que o critério não atrapalha.
    const h = [sessao('B', '2026-10-18', 'remada'), sessao('A', '2026-11-06', 'supino')];
    expect(escolherProximaFicha([peito, costas], h, hoje, exercicioDe)?.id).toBe('B');
  });

  it('em empate, vale o rodízio', () => {
    // Peito e costas treinados no mesmo dia, A por último: o rodízio dá B.
    const h = [sessao('B', '2026-11-06', 'remada'), sessao('A', '2026-11-06', 'supino')];
    expect(escolherProximaFicha([peito, costas], h, hoje, exercicioDe)?.id).toBe('B');
  });

  it('atividade fora da ficha não avança o rodízio', () => {
    const h = [sessao('A', '2026-10-01', 'supino'), { id: 'x', data: '2026-11-06', fichaId: '', registros: [] } as unknown as Sessao];
    expect(escolherProximaFicha([peito, costas], h, hoje, exercicioDe)?.id).toBe('B');
  });

  it('ficha só de cardio vale a média das outras: ganha de quem acabou de ser treinado', () => {
    const cardio = ficha('D', 'esteira');
    expect(pontuacaoDaFicha(cardio, new Map(), exercicioDe)).toBeNull();
    const h = [sessao('A', '2026-11-04', 'supino'), sessao('A', '2026-11-05', 'supino'), sessao('A', '2026-11-06', 'supino')];
    expect(escolherProximaFicha([peito, cardio], h, hoje, exercicioDe)?.id).toBe('D');
  });
});

describe('próximo treino: o mais antigo da divisão', () => {
  const ex2 = (id: string, primary: string) => ex(id, [primary]);
  const exercicios: Record<string, Exercise> = Object.fromEntries(
    [
      ['rosca', 'biceps'], ['triceps_corda', 'triceps'], ['hiper', 'lower back'],
      ['agachamento', 'quadriceps'], ['flexora', 'hamstrings'], ['panturrilha', 'calves'], ['abdominal', 'abdominals'],
      ['puxada', 'lats'], ['remada', 'middle back'], ['lateral', 'shoulders'], ['supino', 'chest'],
    ].map(([id, m]) => [id, ex2(id, m)]),
  );
  const de = (id: string) => exercicios[id];
  const divisao = [
    ficha('A', 'rosca', 'triceps_corda', 'hiper'),
    ficha('B', 'agachamento', 'flexora', 'panturrilha', 'abdominal'),
    ficha('C', 'puxada', 'remada', 'lateral', 'abdominal'),
    ficha('D', 'supino', 'panturrilha'),
  ];
  const feito = (f: string, data: string) => sessao(f, data, ...divisao.find((x) => x.id === f)!.itens.map((i) => i.exerciseId));

  it('sugere o treino feito há mais tempo, mesmo que outro tenha músculos com menos volume acumulado', () => {
    // C há 12 dias, A há 9, B há 7 e D há 2: pernas (B) é só uma vez por semana, mas C está parado há mais tempo.
    const h = [feito('C', '2026-10-26'), feito('A', '2026-10-29'), feito('B', '2026-10-31'), feito('D', '2026-11-05')];
    expect(escolherProximaFicha(divisao, h, hoje, de)?.id).toBe('C');
  });

  it('mede pelos músculos, não pela ficha: o que foi treinado em outro treino também conta', () => {
    // A foi feito há 9 dias, mas B treinou o abdômen e a panturrilha depois; entre B e D, B tem músculos parados há mais tempo.
    const h = [feito('A', '2026-10-29'), feito('D', '2026-11-05')];
    expect(escolherProximaFicha([divisao[1], divisao[3]], h, hoje, de)?.id).toBe('B');
  });

  it('músculo nunca treinado conta como o mais parado', () => {
    const h = [feito('A', '2026-11-06')];
    expect(escolherProximaFicha([divisao[0], divisao[1]], h, hoje, de)?.id).toBe('B');
  });

  it('diferença de menos de um dia na média é empate e o rodízio decide', () => {
    // B há 8 dias (média 7,75, com o abdômen treinado por C há 7) e C há 7 (média 7): B está só 0,75 dia à frente.
    // O último concluído do histórico é B, então o rodízio aponta C; sem a margem de empate, B ganharia.
    const h = [feito('C', '2026-10-31'), feito('B', '2026-10-30')];
    expect(escolherProximaFicha([divisao[1], divisao[2]], h, hoje, de)?.id).toBe('C');
  });

  it('diferença maior que um dia não é empate: o mais parado ganha do rodízio', () => {
    // Agora B está 2 dias à frente de C (B há 9 dias e C há 7): o rodízio ainda aponta C, mas B está parado há mais tempo.
    const h = [feito('C', '2026-10-31'), feito('B', '2026-10-29')];
    expect(escolherProximaFicha([divisao[1], divisao[2]], h, hoje, de)?.id).toBe('B');
  });
});

describe('treinosDaFichaAtiva', () => {
  const conj = { id: 'c1', nome: 'Divisão' };
  const doConjunto = (id: string, ...ids: string[]) => ({ ...ficha(id, ...ids), conjunto: conj }) as Ficha;
  const a = doConjunto('A', 'supino');
  const b = doConjunto('B', 'remada');
  const solta = ficha('S', 'agachamento');

  it('sem ficha ativa nem histórico, devolve todos', () => {
    expect(treinosDaFichaAtiva([a, b, solta], null, [])).toEqual([a, b, solta]);
  });

  it('vale a ficha ativa, mesmo que o último treino seja de outra', () => {
    expect(treinosDaFichaAtiva([a, b, solta], 'B', [sessao('S', '2026-11-05', 'agachamento')])).toEqual([a, b]);
    expect(treinosDaFichaAtiva([a, b, solta], 'S', [sessao('A', '2026-11-05', 'supino')])).toEqual([solta]);
  });

  it('sem ficha ativa em uso, vale a ficha do último treino concluído', () => {
    expect(treinosDaFichaAtiva([a, b, solta], null, [sessao('A', '2026-11-05', 'supino')])).toEqual([a, b]);
  });

  it('atividade fora da ficha não conta como último treino', () => {
    const h = [sessao('S', '2026-11-04', 'agachamento'), { id: 'x', data: '2026-11-06', fichaId: '', registros: [] } as unknown as Sessao];
    expect(treinosDaFichaAtiva([a, b, solta], null, h)).toEqual([solta]);
  });
});
