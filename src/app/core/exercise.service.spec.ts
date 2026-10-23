import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
