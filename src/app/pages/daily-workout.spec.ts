import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ExerciseService } from '../core/exercise.service';
import { Exercise } from '../core/models';
import { PlanService } from '../core/plan.service';
import { DailyWorkout } from './daily-workout';

const ex = (id: string, primaryMuscles: string[]) =>
  ({ id, name: id, category: 'strength', level: 'beginner', equipment: 'machine', mechanic: 'compound', force: 'push', primaryMuscles, secondaryMuscles: [], instructions: [], images: [] }) as unknown as Exercise;
const item = (exerciseId: string) => ({ exerciseId, series: 3, reps: 10, carga: 0, descanso: 60 });

describe('DailyWorkout: completar a ficha', () => {
  let fixture: ComponentFixture<DailyWorkout>;
  let plans: PlanService;
  const el = () => fixture.nativeElement as HTMLElement;
  /** Só os chips do grupo muscular (o primeiro bloco), na ordem da tela. */
  const chipsDosGrupos = () => [...el().querySelector('fieldset')!.querySelectorAll('.chip')] as HTMLButtonElement[];
  const chip = (rotulo: string) => chipsDosGrupos().find((c) => c.textContent!.trim() === rotulo)!;
  const marcados = () => chipsDosGrupos().filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.textContent!.trim());
  const botao = (texto: string) => [...el().querySelectorAll('button')].find((b) => b.textContent!.replace(/\s+/g, ' ').trim() === texto) as HTMLButtonElement | undefined;
  const clicar = (b: HTMLElement | undefined) => {
    b!.click();
    fixture.detectChanges();
  };

  function abrir(ids: string[], completar: boolean): string {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const exercicios = TestBed.inject(ExerciseService);
    exercicios.exercises.set([
      ex('supino', ['chest']),
      ex('remada', ['middle back']),
      ex('agachamento', ['quadriceps']),
      ex('leg_press', ['quadriceps']),
      ex('desenvolvimento', ['shoulders']),
      ex('elevacao_lateral', ['shoulders']),
      ex('abdominal', ['abdominals']),
      ex('rosca', ['biceps']),
      ex('triceps_corda', ['triceps']),
    ]);
    exercicios.ready.set(true);
    plans = TestBed.inject(PlanService);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const [f] = plans.criarConjunto('Divisão', [{ nome: 'A', itens: ids.map(item) }]);
    fixture = TestBed.createComponent(DailyWorkout);
    fixture.componentRef.setInput('conjunto', f.conjunto!.id);
    if (completar) fixture.componentRef.setInput('completar', '1');
    fixture.detectChanges();
    fixture.detectChanges();
    return f.conjunto!.id;
  }

  afterEach(() => localStorage.clear());

  it('já marca os dois maiores grupos que faltam, diz o que falta e avisa que o resto fica para depois', () => {
    abrir(['supino', 'remada'], true);
    expect(el().querySelector('h1')!.textContent).toContain('Completar a ficha');
    expect(marcados()).toEqual(['Ombros', 'Pernas']);
    const texto = el().querySelector('header')!.textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain('Faltam na ficha Divisão: Pernas, Ombros, Abdômen, Bíceps e Tríceps');
    expect(texto).toContain('Os outros ficam para um próximo treino de complemento');
  });

  it('com um grupo só faltando, marca só ele e não fala em "outros"', () => {
    abrir(['supino', 'remada', 'agachamento', 'desenvolvimento', 'abdominal', 'rosca'], true);
    expect(marcados()).toEqual(['Tríceps']);
    expect(el().querySelector('header')!.textContent).not.toContain('Os outros ficam');
  });

  it('a pessoa pode trocar os grupos marcados', () => {
    abrir(['supino', 'remada'], true);
    clicar(chip('Pernas'));
    clicar(chip('Tríceps'));
    expect(marcados()).toEqual(['Ombros', 'Tríceps']);
  });

  it('o treino aceito entra na mesma ficha, com o nome dos grupos completados', () => {
    const conjunto = abrir(['supino', 'remada'], true);
    clicar(botao('Sugerir treino'));
    clicar(botao('Aceitar e iniciar treino'));
    const doConjunto = plans.fichas().filter((f) => f.conjunto?.id === conjunto);
    expect(doConjunto.length).toBe(2);
    const novo = doConjunto[1];
    expect(novo.nome).toBe('Complemento · Pernas e Ombros');
    expect(novo.itens.map((i) => i.exerciseId).sort()).toEqual(['agachamento', 'desenvolvimento', 'elevacao_lateral', 'leg_press']);
  });

  it('ficha que já trabalha tudo: avisa e deixa escolher os grupos à mão', () => {
    abrir(['supino', 'remada', 'agachamento', 'desenvolvimento', 'abdominal', 'rosca', 'triceps_corda'], true);
    expect(el().querySelector('header')!.textContent).toContain('já trabalha todos os grupos musculares principais');
    expect(marcados()).toEqual([]);
  });

  it('sem o pedido de completar, nada vem marcado e o título é o de sempre', () => {
    abrir(['supino', 'remada'], false);
    expect(el().querySelector('h1')!.textContent).toContain('Treino do dia');
    expect(marcados()).toEqual([]);
  });
});
