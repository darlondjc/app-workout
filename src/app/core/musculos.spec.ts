import { Exercise, RegistroExercicio, Sessao } from './models';
import {
  EstadoMusculo,
  LOOKBACK_DIAS,
  MUSCULOS,
  PESO_SECUNDARIO,
  calcularMusculos,
  corDoNivel,
  exerciciosDoMusculo,
  haDias,
  maisEMenos,
  rotuloDoNivel,
  ultimaVez,
} from './musculos';
import { dataISO } from './stats';

const HOJE = new Date(2026, 9, 26);
const atras = (n: number) => dataISO(new Date(2026, 9, 26 - n));

const ex = (id: string, principais: string[], secundarios: string[] = [], category = 'strength'): Exercise => ({
  id,
  name: id,
  force: null,
  level: 'beginner',
  mechanic: null,
  equipment: null,
  primaryMuscles: principais,
  secondaryMuscles: secundarios,
  instructions: [],
  category,
  images: [],
});

const BASE: Record<string, Exercise> = {
  supino: ex('supino', ['chest'], ['shoulders', 'triceps']),
  agachamento: ex('agachamento', ['quadriceps'], ['glutes', 'hamstrings', 'calves']),
  remada: ex('remada', ['lats', 'middle back'], ['biceps']),
  abdutora: ex('abdutora', ['abductors']),
  esteira: ex('esteira', ['quadriceps'], [], 'cardio'),
  alongar: ex('alongar', ['hamstrings'], [], 'stretching'),
};
const exercicioDe = (id: string) => BASE[id];

const reg = (exerciseId: string, series: number, unidade?: 'min'): RegistroExercicio => ({
  exerciseId,
  unidade,
  series: Array.from({ length: series }, () => ({ carga: 20, reps: 10 })),
});
const treino = (dia: number, ...registros: RegistroExercicio[]): Sessao => ({ id: `s${dia}`, data: atras(dia), fichaId: 'f', registros });

const estado = (lista: EstadoMusculo[], id: string) => lista.find((e) => e.id === id)!;
const calcular = (h: Sessao[]) => calcularMusculos(h, HOJE, exercicioDe);

describe('musculos', () => {
  describe('calcularMusculos', () => {
    it('sem histórico, todos os músculos ficam zerados e na ordem de MUSCULOS', () => {
      const r = calcular([]);
      expect(r.map((e) => e.id)).toEqual(MUSCULOS.map((m) => m.id));
      expect(r.every((e) => e.pontos === 0 && e.nivel === 0 && e.ultimoTreino === null && e.diasDesdeUltimo === null && e.series7 === 0)).toBeTrue();
    });

    it('cada série vale 1 ponto no músculo principal e 0,3 nos secundários', () => {
      const r = calcular([treino(0, reg('supino', 4))]);
      expect(estado(r, 'peito').pontos).toBeCloseTo(4);
      expect(estado(r, 'ombros').pontos).toBeCloseTo(4 * PESO_SECUNDARIO);
      expect(estado(r, 'triceps').pontos).toBeCloseTo(4 * PESO_SECUNDARIO);
      expect(estado(r, 'quadriceps').pontos).toBe(0);
    });

    it('o último treino direto só considera o músculo principal', () => {
      const r = calcular([treino(2, reg('supino', 3))]);
      expect(estado(r, 'peito').ultimoTreino).toBe(atras(2));
      expect(estado(r, 'peito').diasDesdeUltimo).toBe(2);
      expect(estado(r, 'ombros').ultimoTreino).toBeNull();
      expect(estado(r, 'ombros').pontos).toBeGreaterThan(0);
    });

    it('o ponto cai pela metade a cada 7 dias', () => {
      expect(estado(calcular([treino(7, reg('supino', 4))]), 'peito').pontos).toBeCloseTo(2);
      expect(estado(calcular([treino(14, reg('supino', 4))]), 'peito').pontos).toBeCloseTo(1);
    });

    it('treinar de novo acumula', () => {
      const r = calcular([treino(0, reg('supino', 4)), treino(1, reg('supino', 4))]);
      expect(estado(r, 'peito').pontos).toBeCloseTo(4 + 4 * Math.pow(0.5, 1 / 7));
      expect(estado(r, 'peito').ultimoTreino).toBe(atras(0));
    });

    it('o nível passa de 0 a 1 e não ultrapassa 1', () => {
      expect(estado(calcular([treino(0, reg('supino', 4))]), 'peito').nivel).toBeCloseTo(0.25);
      expect(estado(calcular([treino(0, reg('supino', 40))]), 'peito').nivel).toBe(1);
    });

    it('treino além de 56 dias, de data futura ou de exercício desconhecido não conta', () => {
      expect(estado(calcular([treino(LOOKBACK_DIAS + 1, reg('supino', 4))]), 'peito').pontos).toBe(0);
      expect(estado(calcular([treino(LOOKBACK_DIAS, reg('supino', 4))]), 'peito').pontos).toBeGreaterThan(0);
      expect(estado(calcular([treino(-1, reg('supino', 4))]), 'peito').pontos).toBe(0);
      expect(calcular([treino(0, reg('inexistente', 4))]).every((e) => e.pontos === 0)).toBeTrue();
    });

    it('cardio, alongamento, exercício em minutos e atividade ficam de fora', () => {
      const atividade: Sessao = { id: 'a', data: atras(0), fichaId: '', atividade: { tipo: 'corrida', nome: 'Corrida', minutos: 30 }, registros: [] };
      const r = calcular([treino(0, reg('esteira', 1), reg('alongar', 3), reg('supino', 1, 'min')), atividade]);
      expect(r.every((e) => e.pontos === 0)).toBeTrue();
    });

    it('dorsais e meio das costas formam um músculo só: não contam em dobro', () => {
      expect(estado(calcular([treino(0, reg('remada', 3))]), 'costas').pontos).toBeCloseTo(3);
    });

    it('abdutores do quadril contam nos glúteos', () => {
      expect(estado(calcular([treino(0, reg('abdutora', 3))]), 'gluteos').pontos).toBeCloseTo(3);
    });

    it('séries dos últimos 7 dias: hoje e os 6 anteriores', () => {
      const r = calcular([treino(6, reg('supino', 3)), treino(7, reg('supino', 5))]);
      expect(estado(r, 'peito').series7).toBe(3);
    });
  });

  describe('maisEMenos', () => {
    const e = (id: string, nivel: number, dias: number | null): EstadoMusculo => ({
      id,
      pontos: nivel * 16,
      nivel,
      ultimoTreino: dias === null ? null : atras(dias),
      diasDesdeUltimo: dias,
      series7: 0,
    });
    const lista = [e('peito', 0.9, 1), e('ombros', 0.5, 3), e('biceps', 0.1, 20), e('panturrilhas', 0, null), e('lombar', 0, null), e('triceps', 0.3, 5)];

    it('os mais trabalhados vêm do maior nível para o menor', () => {
      expect(maisEMenos(lista, 2).mais.map((x) => x.id)).toEqual(['peito', 'ombros']);
    });

    it('os menos trabalhados: quem não treinou vem primeiro, na ordem de MUSCULOS', () => {
      expect(maisEMenos(lista, 3).menos.map((x) => x.id)).toEqual(['lombar', 'panturrilhas', 'biceps']);
    });

    it('nos mais não entra quem está zerado', () => {
      expect(maisEMenos([e('peito', 0, null)], 3).mais).toEqual([]);
    });

    it('entre dois do mesmo nível, o parado há mais tempo é o menos trabalhado', () => {
      const r = maisEMenos([e('peito', 0.1, 5), e('ombros', 0.1, 30)], 1);
      expect(r.menos[0].id).toBe('ombros');
    });
  });

  describe('corDoNivel', () => {
    it('vai do azul escuro ao vermelho escuro, passando por um tom quase branco', () => {
      expect(corDoNivel(0)).toBe('rgb(31, 78, 153)');
      expect(corDoNivel(0.4)).toBe('rgb(233, 238, 245)');
      expect(corDoNivel(1)).toBe('rgb(179, 38, 30)');
    });

    it('valores fora de 0 a 1 ficam nas pontas', () => {
      expect(corDoNivel(-3)).toBe(corDoNivel(0));
      expect(corDoNivel(7)).toBe(corDoNivel(1));
    });

    it('a primeira metade clareia (o vermelho sobe) e a segunda esquenta (o azul desce)', () => {
      const canal = (c: string, i: number) => Number(c.match(/\d+/g)![i]);
      const clareia = [0, 0.18, 0.4].map((n) => canal(corDoNivel(n), 0));
      expect(clareia).toEqual([...clareia].sort((x, y) => x - y));
      const esquenta = [0.4, 0.68, 1].map((n) => canal(corDoNivel(n), 2));
      expect(esquenta).toEqual([...esquenta].sort((x, y) => y - x));
    });
  });

  describe('textos', () => {
    const base: EstadoMusculo = { id: 'peito', pontos: 8, nivel: 0.5, ultimoTreino: atras(3), diasDesdeUltimo: 3, series7: 4 };

    it('rótulos por faixa de nível', () => {
      expect(rotuloDoNivel({ ...base, pontos: 0, nivel: 0 })).toBe('Sem treino nas últimas 8 semanas');
      expect(rotuloDoNivel({ ...base, nivel: 0.1 })).toBe('Pouco trabalhado');
      expect(rotuloDoNivel({ ...base, nivel: 0.3 })).toBe('Trabalhado');
      expect(rotuloDoNivel({ ...base, nivel: 0.6 })).toBe('Bem trabalhado');
      expect(rotuloDoNivel({ ...base, nivel: 0.95 })).toBe('Muito trabalhado');
    });

    it('há quantos dias', () => {
      expect(haDias(0)).toBe('hoje');
      expect(haDias(1)).toBe('ontem');
      expect(haDias(12)).toBe('há 12 dias');
    });

    it('última vez do músculo', () => {
      expect(ultimaVez(base)).toBe('há 3 dias');
      expect(ultimaVez({ ...base, ultimoTreino: null, diasDesdeUltimo: null })).toBe('sem treino direto nas últimas 8 semanas');
    });
  });
});

describe('exerciciosDoMusculo', () => {
  const lista = [
    ex('supino', ['chest'], ['triceps']),
    ex('crucifixo', ['chest']),
    ex('remada', ['middle back'], ['chest']),
    ex('puxada', ['lats']),
    ex('esteira', ['quadriceps'], [], 'cardio'),
    ex('alongar-peito', ['chest'], [], 'stretching'),
  ];

  it('traz só os exercícios em que o músculo é o principal', () => {
    expect(exerciciosDoMusculo(lista, 'peito').map((e) => e.id)).toEqual(['supino', 'crucifixo']);
  });

  it('um músculo que reúne várias fontes junta todas', () => {
    expect(exerciciosDoMusculo(lista, 'costas').map((e) => e.id)).toEqual(['remada', 'puxada']);
  });

  it('ignora alongamento e cardio, e músculo desconhecido devolve vazio', () => {
    expect(exerciciosDoMusculo(lista, 'quadriceps')).toEqual([]);
    expect(exerciciosDoMusculo(lista, 'nao-existe')).toEqual([]);
  });
});

