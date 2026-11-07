import { Exercise, Ficha, Sessao } from './models';
import { escolherProximaFicha, pontuacaoDaFicha } from './proximo-treino';

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

describe('próximo treino pelos músculos menos trabalhados', () => {
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

  it('ficha só de cardio vale pontuação neutra: ganha de quem acabou de ser treinado', () => {
    const cardio = ficha('D', 'esteira');
    expect(pontuacaoDaFicha(cardio, new Map(), exercicioDe)).toBeNull();
    const h = [sessao('A', '2026-11-04', 'supino'), sessao('A', '2026-11-05', 'supino'), sessao('A', '2026-11-06', 'supino')];
    expect(escolherProximaFicha([peito, cardio], h, hoje, exercicioDe)?.id).toBe('D');
  });
});
