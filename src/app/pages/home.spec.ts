import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlanService } from '../core/plan.service';
import { Home } from './home';

describe('Home — card do treino de hoje', () => {
  let fixture: ComponentFixture<Home>;
  let plans: PlanService;
  const el = () => fixture.nativeElement as HTMLElement;
  const item = (exerciseId: string) => ({ exerciseId, series: 3, reps: 10, carga: 0, descanso: 60 });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
    plans.criarConjunto('Divisão de 2 treinos', [
      { nome: 'Peito', itens: [item('a')] },
      { nome: 'Costas', itens: [item('b')] },
    ]);
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
  });

  const rotulos = () => [...el().querySelectorAll('.destaque__rotulo')].map((x) => x.textContent!.trim());

  it('mostra a letra do treino, sem o nome da ficha', () => {
    expect(rotulos()[0]).toBe('Treino de hoje · Treino A');
  });

  it('treino nunca feito mostra "Ainda não feito"', () => {
    expect(rotulos()).toContain('Ainda não feito');
  });

  it('mostra quando o treino foi feito pela última vez', () => {
    const [a, b] = plans.fichas();
    const dia = new Date();
    dia.setDate(dia.getDate() - 3);
    const data = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    plans.historico.set([
      { id: 's1', data, fichaId: b.id, fichaNome: b.nome, registros: [] },
      { id: 's2', data, fichaId: a.id, fichaNome: a.nome, registros: [] },
    ]);
    fixture.detectChanges();
    // O rodízio volta ao treino B, feito há 3 dias.
    expect(rotulos()).toContain('Último treino: há 3 dias');
  });
});
