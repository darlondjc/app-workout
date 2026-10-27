import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlanService } from '../core/plan.service';
import { ArchivedPlans } from './archived-plans';

describe('ArchivedPlans', () => {
  let fixture: ComponentFixture<ArchivedPlans>;
  let plans: PlanService;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
    const [a] = plans.criarComItens([{ nome: 'Velha', itens: [] }]);
    plans.arquivarBloco(a.id);
    fixture = TestBed.createComponent(ArchivedPlans);
    fixture.detectChanges();
  });

  it('lista as arquivadas', () => {
    expect(el().querySelectorAll('.bloco').length).toBe(1);
    expect(el().querySelector('.bloco__nome')!.textContent).toBe('Velha');
  });

  it('reativar devolve a ficha às ativas', () => {
    ([...el().querySelectorAll('.acoes button')][0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(plans.blocosAtivos().map((b) => b.nome)).toEqual(['Velha']);
    expect(el().querySelector('.vazio')).not.toBeNull();
  });

  it('excluir pede confirmação e remove a ficha', () => {
    ([...el().querySelectorAll('.acoes button')][1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(plans.fichas().length).toBe(1);
    ([...el().querySelectorAll('app-confirmacao button')].find((b) => b.textContent!.trim() === 'Excluir') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(plans.fichas().length).toBe(0);
  });
});
