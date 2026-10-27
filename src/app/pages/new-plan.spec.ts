import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PlanService } from '../core/plan.service';
import { NewPlan } from './new-plan';

describe('NewPlan', () => {
  let fixture: ComponentFixture<NewPlan>;
  let plans: PlanService;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
    fixture = TestBed.createComponent(NewPlan);
    fixture.detectChanges();
  });

  it('oferece três caminhos, cada um com explicação', () => {
    const nomes = [...el().querySelectorAll('.caminho strong')].map((s) => s.textContent);
    expect(nomes).toEqual(['Montar do zero', 'Sugestão automática', 'Personalizada']);
    expect(el().querySelectorAll('.caminho .ideal').length).toBe(3);
  });

  it('os caminhos automáticos levam às telas de sugestão e personalizada', () => {
    const links = [...el().querySelectorAll('a.caminho')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/fichas/sugestao', '/fichas/personalizada']);
  });

  it('montar do zero abre um rascunho no editor', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    (el().querySelector('button.caminho') as HTMLButtonElement).click();
    expect(navegar).toHaveBeenCalled();
    expect((navegar.calls.mostRecent().args[0] as string[])[0]).toBe('/ficha');
  });

  it('avisa que a ficha ativa será encerrada, só quando existe uma', () => {
    expect(el().textContent).not.toContain('encerrada');
    plans.criarComItens([{ nome: 'Atual', itens: [] }]);
    fixture.detectChanges();
    expect(el().textContent).toContain('"Atual"');
    expect(el().textContent).toContain('encerrada');
  });

  it('tem um atalho para importar uma ficha recebida por link', () => {
    expect(el().querySelector('a.importar')!.getAttribute('href')).toBe('/fichas/importar');
  });
});
