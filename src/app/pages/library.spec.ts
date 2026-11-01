import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExerciseService } from '../core/exercise.service';
import { PlanService } from '../core/plan.service';
import { Library } from './library';

describe('Library', () => {
  let fixture: ComponentFixture<Library>;

  beforeEach(() => {
    localStorage.clear();
    const exercicios = ['supino', 'remada'].map((id) => ({ id, name: id, primaryMuscles: ['chest'], category: 'strength', equipment: 'barbell', level: 'beginner' }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ExerciseService,
          useValue: {
            ready: signal(true),
            error: signal(false),
            exercises: signal(exercicios),
            equipamentos: signal([]),
            niveis: signal([]),
            buscar: () => exercicios,
            nome: (e: { name: string }) => e.name,
            musculo: (m: string) => m,
            categoria: (c: string) => c,
            equipamento: (e: string) => e,
            imagem: () => '',
          },
        },
      ],
    });
    const plans = TestBed.inject(PlanService);
    plans.criarComItens([{ nome: 'A', itens: [{ exerciseId: 'supino', series: 3, reps: 10, carga: 0, descanso: 60 }] }]);
    fixture = TestBed.createComponent(Library);
    fixture.detectChanges();
  });

  it('exercício que já está na ficha mostra um visto em vez do +', () => {
    const linhas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li.linha'));
    const [supino, remada] = linhas.map((l) => l.textContent ?? '');
    expect(linhas.length).toBe(2);
    expect(linhas[0].querySelector('button[aria-label^="Adicionar"]')).toBeNull();
    expect(linhas[0].querySelector('[aria-label$="já está na ficha"]')).not.toBeNull();
    expect(linhas[1].querySelector('button[aria-label^="Adicionar"]')).not.toBeNull();
    expect(supino).toContain('supino');
    expect(remada).toContain('remada');
  });
});
