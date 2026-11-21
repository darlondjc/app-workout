import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExerciseService, FILTRO_CARDIO } from './exercise.service';
import { Exercise } from './models';

const ex = (id: string, category: string, muscles: string[]): Exercise => ({
  id, name: id, force: null, level: 'beginner', mechanic: null, equipment: null,
  primaryMuscles: muscles, secondaryMuscles: [], instructions: [], category, images: [],
});

describe('ExerciseService — filtro de cardio', () => {
  let svc: ExerciseService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(ExerciseService);
    svc.exercises.set([ex('esteira', 'cardio', ['quadriceps']), ex('bike', 'cardio', ['quadriceps']), ex('agachamento', 'strength', ['quadriceps']), ex('supino', 'strength', ['chest'])]);
  });

  it('o chip de cardio mostra só os exercícios de cardio', () => {
    expect(svc.buscar('', FILTRO_CARDIO, '', '').map((e) => e.id)).toEqual(['bike', 'esteira']);
  });

  it('o cardio continua aparecendo em Pernas, e Pernas não perde nada', () => {
    expect(svc.buscar('', 'pernas', '', '').map((e) => e.id).sort()).toEqual(['agachamento', 'bike', 'esteira']);
  });

  it('o cardio combina com a busca por texto', () => {
    expect(svc.buscar('esteira', FILTRO_CARDIO, '', '').map((e) => e.id)).toEqual(['esteira']);
    expect(svc.buscar('supino', FILTRO_CARDIO, '', '')).toEqual([]);
  });

  it('sem filtro, todos aparecem', () => {
    expect(svc.buscar('', '', '', '').length).toBe(4);
  });
});

describe('ExerciseService — instruções sob demanda', () => {
  let svc: ExerciseService;
  let http: HttpTestingController;
  const supino = ex('supino', 'strength', ['chest']);
  const semTraducao = ex('raro', 'strength', ['chest']);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(ExerciseService);
    http = TestBed.inject(HttpTestingController);
  });

  it('não baixa as instruções ao abrir o app (só dados da lista)', () => {
    http.expectOne('data/exercises.json');
    http.expectOne('data/i18n/pt-BR.labels.json');
    http.expectOne('data/i18n/pt-BR.names.json');
    http.expectNone('data/i18n/pt-BR.instructions.json');
  });

  it('enquanto o arquivo não chega, avisa que está carregando', () => {
    expect(svc.instrucoes(supino).carregando).toBeTrue();
  });

  it('baixa uma vez só, mesmo pedindo de novo, e devolve os passos em português', () => {
    svc.carregarInstrucoes('supino');
    svc.carregarInstrucoes('supino');
    http.expectOne('data/i18n/pt-BR.instructions.json').flush({ supino: ['Deite no banco.'] });
    expect(svc.instrucoes(supino)).toEqual({ passos: ['Deite no banco.'], traduzido: true });
    http.expectNone('data/i18n/en.instructions.json');
  });

  it('sem tradução, busca os passos em inglês e marca como não traduzido', () => {
    svc.carregarInstrucoes('raro');
    http.expectOne('data/i18n/pt-BR.instructions.json').flush({});
    expect(svc.instrucoes(semTraducao).carregando).toBeTrue();
    http.expectOne('data/i18n/en.instructions.json').flush({ raro: ['Lie down.'] });
    expect(svc.instrucoes(semTraducao)).toEqual({ passos: ['Lie down.'], traduzido: false });
  });

  it('se o arquivo falhar, para de mostrar "carregando"', () => {
    svc.carregarInstrucoes('supino');
    http.expectOne('data/i18n/pt-BR.instructions.json').error(new ProgressEvent('error'));
    expect(svc.instrucoes(supino)).toEqual({ passos: [], traduzido: true });
  });
});
