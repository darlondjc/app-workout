import {
  DURACAO_MAXIMA_MIN,
  caloriasDaSessao,
  caloriasNoMes,
  duracaoDaSessao,
  duracaoDoTreino,
  kcal,
  kcalTexto,
  metAtividade,
  metForca,
  pesoNaData,
} from './calorias';
import { AtividadeRegistro, RegistroExercicio, RegistroPeso, Sessao } from './models';

const MIN = 60000;
/** 20 séries com 60 s de descanso cada = 20 min (um descanso único de 20 min passaria do limite e seria ignorado). */
const vinteMinutosDeDescanso = Array<number>(20).fill(60);

function forca(descansos: number[]): RegistroExercicio {
  return { exerciseId: 'supino', series: descansos.map((descanso) => ({ carga: 40, reps: 10, descanso })) };
}

function cardio(minutos: number): RegistroExercicio {
  return { exerciseId: 'esteira', unidade: 'min', series: [{ carga: 0, reps: minutos }] };
}

function treino(data: string, extra: Partial<Sessao> = {}): Sessao {
  return { id: `s-${data}`, data, fichaId: 'f1', ...extra };
}

function atividade(tipo: string, extra: Partial<AtividadeRegistro> = {}): AtividadeRegistro {
  return { tipo, nome: tipo, minutos: 60, ...extra };
}

describe('calorias', () => {
  describe('metAtividade', () => {
    it('usa o MET base do tipo no esforço moderado ou sem esforço', () => {
      expect(metAtividade(atividade('futebol'))).toBe(7);
      expect(metAtividade(atividade('futebol', { esforco: 'moderado' }))).toBe(7);
    });

    it('ajusta pelo esforço', () => {
      expect(metAtividade(atividade('futebol', { esforco: 'intenso' }))).toBeCloseTo(8.75);
      expect(metAtividade(atividade('natacao', { esforco: 'leve' }))).toBeCloseTo(4.64);
    });

    it('corrida sem distância usa o esforço', () => {
      expect(metAtividade(atividade('corrida'))).toBe(9.8);
      expect(metAtividade(atividade('corrida', { esforco: 'leve' }))).toBeCloseTo(7.84);
    });

    it('corrida com distância usa o ritmo', () => {
      // 5 km em 37,5 min = 8 km/h
      expect(metAtividade(atividade('corrida', { distanciaKm: 5, minutos: 37.5 }))).toBeCloseTo(8.3, 0);
      // 5 km em 30 min = 10 km/h
      expect(metAtividade(atividade('corrida', { distanciaKm: 5, minutos: 30 }))).toBeCloseTo(10.12, 1);
    });

    it('tipo desconhecido vale como atividade geral', () => {
      expect(metAtividade(atividade('xadrez-boxe'))).toBe(5);
    });
  });

  describe('metForca', () => {
    it('descanso curto é mais intenso', () => {
      expect(metForca(45)).toBe(6);
      expect(metForca(60)).toBe(6);
      expect(metForca(90)).toBe(4.5);
      expect(metForca(120)).toBe(4.5);
      expect(metForca(150)).toBe(3.5);
    });

    it('sem dado de descanso usa o valor mais baixo', () => {
      expect(metForca(null)).toBe(3.5);
    });
  });

  describe('kcal', () => {
    it('é MET × kg × horas', () => {
      expect(kcal(6, 70, 60)).toBe(420);
      expect(kcal(3.5, 80, 45)).toBe(210);
    });
  });

  describe('duracaoDoTreino', () => {
    it('usa o tempo real quando é coerente com os descansos', () => {
      expect(duracaoDoTreino(0, 50 * MIN, [forca(vinteMinutosDeDescanso)])).toBe(50);
    });

    it('limita um treino deixado aberto pela soma dos descansos', () => {
      // 5 h reais, 20 min de descansos: teto de 20 × 2 + 10 = 50 min
      expect(duracaoDoTreino(0, 300 * MIN, [forca(vinteMinutosDeDescanso)])).toBe(50);
    });

    it('sem descansos, limita em 3 horas', () => {
      expect(duracaoDoTreino(0, 300 * MIN, [])).toBe(DURACAO_MAXIMA_MIN);
    });

    it('nunca devolve menos de 1 minuto', () => {
      expect(duracaoDoTreino(0, 30000, [])).toBe(1);
    });

    it('ignora intervalos acima de 10 minutos na soma', () => {
      // o único descanso (15 min) é pausa e não conta: sem soma válida, vale o teto de 3 h
      expect(duracaoDoTreino(0, 120 * MIN, [forca([900])])).toBe(120);
    });
  });

  describe('duracaoDaSessao', () => {
    it('atividade traz a própria duração', () => {
      expect(duracaoDaSessao(treino('2026-10-20', { fichaId: '', atividade: atividade('corrida', { minutos: 40 }) }))).toBe(40);
    });

    it('treino novo traz duracaoMin', () => {
      expect(duracaoDaSessao(treino('2026-10-20', { duracaoMin: 55, registros: [forca([60])] }))).toBe(55);
    });

    it('treino antigo é estimado pela soma dos descansos', () => {
      expect(duracaoDaSessao(treino('2026-10-20', { registros: [forca([60, 60, 60])] }))).toBe(3);
    });

    it('sem duração nem descansos, devolve null', () => {
      expect(duracaoDaSessao(treino('2026-10-20', { registros: [{ exerciseId: 'a', series: [{ carga: 1, reps: 1 }] }] }))).toBeNull();
    });
  });

  describe('pesoNaData', () => {
    const pesos: RegistroPeso[] = [
      { data: '2026-10-01', kg: 80 },
      { data: '2026-10-20', kg: 78 },
    ];

    it('usa o último registro até a data', () => {
      expect(pesoNaData(pesos, '2026-10-10')).toBe(80);
      expect(pesoNaData(pesos, '2026-10-25')).toBe(78);
    });

    it('antes do primeiro registro, usa o mais antigo', () => {
      expect(pesoNaData(pesos, '2026-09-01')).toBe(80);
    });

    it('sem registros, devolve null', () => {
      expect(pesoNaData([], '2026-10-10')).toBeNull();
    });
  });

  describe('caloriasDaSessao', () => {
    const pesos: RegistroPeso[] = [{ data: '2026-10-01', kg: 70 }];

    it('musculação: MET pelo descanso médio', () => {
      const s = treino('2026-10-20', { duracaoMin: 60, registros: [forca([45, 45])] });
      expect(caloriasDaSessao(s, pesos)).toBe(420);
    });

    it('atividade: MET do tipo', () => {
      const s = treino('2026-10-20', { fichaId: '', atividade: atividade('corrida') });
      expect(caloriasDaSessao(s, pesos)).toBe(686);
    });

    it('cardio da ficha conta à parte da musculação', () => {
      const s = treino('2026-10-20', { duracaoMin: 60, registros: [forca([90, 90]), cardio(20)] });
      // musculação: 4,5 × 70 × 40/60 = 210; cardio: 6 × 70 × 20/60 = 140
      expect(caloriasDaSessao(s, pesos)).toBe(350);
    });

    it('sem peso registrado, devolve null', () => {
      expect(caloriasDaSessao(treino('2026-10-20', { duracaoMin: 60, registros: [forca([45])] }), [])).toBeNull();
    });

    it('sem duração, devolve null', () => {
      expect(caloriasDaSessao(treino('2026-10-20', { registros: [] }), pesos)).toBeNull();
    });
  });

  describe('caloriasNoMes', () => {
    const pesos: RegistroPeso[] = [{ data: '2026-09-01', kg: 70 }];

    it('soma só as sessões do mês que têm estimativa', () => {
      const h = [
        treino('2026-10-05', { duracaoMin: 60, registros: [forca([45])] }),
        treino('2026-10-12', { fichaId: '', atividade: atividade('corrida') }),
        treino('2026-10-14', { registros: [] }),
        treino('2026-09-28', { duracaoMin: 60, registros: [forca([45])] }),
      ];
      expect(caloriasNoMes(h, pesos, 2026, 9)).toBe(420 + 686);
    });

    it('sem nenhuma estimativa no mês, devolve null', () => {
      expect(caloriasNoMes([treino('2026-10-14', { registros: [] })], pesos, 2026, 9)).toBeNull();
      expect(caloriasNoMes([treino('2026-10-05', { duracaoMin: 60, registros: [forca([45])] })], [], 2026, 9)).toBeNull();
    });
  });

  describe('kcalTexto', () => {
    it('arredonda de 5 em 5 e usa ≈', () => {
      expect(kcalTexto(237)).toBe('≈ 235 kcal');
      expect(kcalTexto(2)).toBe('≈ 5 kcal');
    });

    it('separa milhares à brasileira', () => {
      expect(kcalTexto(1240)).toBe('≈ 1.240 kcal');
    });
  });
});
