import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExerciseService } from './exercise.service';
import { Exercise } from './models';

function ex(id: string, primaryMuscles: string[], category = 'strength'): Exercise {
  return {
    id,
    name: id,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles,
    secondaryMuscles: [],
    instructions: [],
    category,
    images: [],
  };
}

describe('ExerciseService.gruposDe', () => {
  let service: ExerciseService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExerciseService);
    service.exercises.set([
      ex('supino', ['chest']),
      ex('crucifixo', ['chest']),
      ex('triceps-testa', ['triceps']),
      ex('agachamento', ['quadriceps', 'glutes']),
      ex('remada', ['middle back', 'lats']),
      ex('esteira', ['quadriceps'], 'cardio'),
    ]);
  });

  it('agrupa os músculos e ordena do mais frequente para o menos', () => {
    expect(service.gruposDe(['supino', 'crucifixo', 'triceps-testa'])).toEqual(['Peito', 'Tríceps']);
  });

  it('conta cada grupo uma vez por exercício (quadríceps e glúteos viram só Pernas)', () => {
    expect(service.gruposDe(['agachamento', 'remada'])).toEqual(['Costas', 'Pernas']);
  });

  it('ignora cardio quando há musculação, mas usa o cardio se for só ele', () => {
    expect(service.gruposDe(['supino', 'esteira'])).toEqual(['Peito']);
    expect(service.gruposDe(['esteira'])).toEqual(['Pernas']);
  });

  it('ignora exercícios que não existem mais e devolve vazio sem exercícios', () => {
    expect(service.gruposDe(['sumiu'])).toEqual([]);
    expect(service.gruposDe([])).toEqual([]);
  });
});
