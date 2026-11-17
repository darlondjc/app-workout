import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExerciseService } from '../core/exercise.service';
import { Exercise } from '../core/models';
import { PlanService } from '../core/plan.service';
import { NewWorkout } from './new-workout';

const ex = (id: string, primaryMuscles: string[], category = 'strength') =>
  ({ id, name: id, category, level: 'beginner', equipment: 'machine', mechanic: 'compound', primaryMuscles, secondaryMuscles: [], instructions: [], images: [] }) as unknown as Exercise;
const item = (exerciseId: string) => ({ exerciseId, series: 3, reps: 10, carga: 0, descanso: 60 });

describe('NewWorkout: completar a ficha', () => {
  let fixture: ComponentFixture<NewWorkout>;
  const el = () => fixture.nativeElement as HTMLElement;
  const opcoes = () => [...el().querySelectorAll('.caminho')] as HTMLElement[];

  function abrir(ids: string[], pronto = true): string {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const exercicios = TestBed.inject(ExerciseService);
    exercicios.exercises.set([
      ex('supino', ['chest']),
      ex('remada', ['middle back']),
      ex('agachamento', ['quadriceps']),
      ex('desenvolvimento', ['shoulders']),
      ex('abdominal', ['abdominals']),
      ex('rosca', ['biceps']),
      ex('triceps_corda', ['triceps']),
      ex('esteira', ['quadriceps'], 'cardio'),
    ]);
    exercicios.ready.set(pronto);
    const [f] = TestBed.inject(PlanService).criarConjunto('Divisão', [{ nome: 'A', itens: ids.map(item) }]);
    fixture = TestBed.createComponent(NewWorkout);
    fixture.componentRef.setInput('conjunto', f.conjunto!.id);
    fixture.detectChanges();
    return f.conjunto!.id;
  }

  afterEach(() => localStorage.clear());

  it('mostra a terceira opção, depois de "Montar do zero" e "Treino sugerido"', () => {
    abrir(['supino', 'remada']);
    expect(opcoes().map((o) => o.querySelector('strong')!.textContent)).toEqual(['Montar do zero', 'Treino sugerido', 'Completar a ficha']);
  });

  it('diz quais grupos faltam e leva ao treino sugerido no modo de completar, para essa ficha', () => {
    const conjunto = abrir(['supino', 'remada']);
    const completar = opcoes()[2];
    expect(completar.textContent).toContain('Faltam na ficha: Pernas, Ombros, Abdômen, Bíceps e Tríceps');
    const href = completar.getAttribute('href')!;
    expect(href).toContain('/treino-do-dia');
    expect(href).toContain(`conjunto=${conjunto}`);
    expect(href).toContain('completar=1');
  });

  it('cardio na ficha não conta como pernas', () => {
    abrir(['esteira', 'supino']);
    expect(opcoes()[2].textContent).toContain('Pernas');
  });

  it('com todos os grupos principais na ficha, a opção fica desligada e explica', () => {
    abrir(['supino', 'remada', 'agachamento', 'desenvolvimento', 'abdominal', 'rosca', 'triceps_corda']);
    const completar = opcoes()[2];
    expect(completar.tagName).toBe('DIV');
    expect(completar.getAttribute('aria-disabled')).toBe('true');
    expect(completar.getAttribute('href')).toBeNull();
    expect(completar.textContent).toContain('já trabalha todos os grupos musculares principais');
  });

  it('enquanto os exercícios carregam, a opção já aparece, sem a lista de grupos', () => {
    abrir(['supino'], false);
    expect(opcoes()[2].tagName).toBe('A');
    expect(opcoes()[2].textContent).not.toContain('Faltam na ficha');
  });
});
