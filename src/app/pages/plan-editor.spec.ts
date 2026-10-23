import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PlanService } from '../core/plan.service';
import { PlanEditor } from './plan-editor';

describe('PlanEditor — ficha nova', () => {
  let fixture: ComponentFixture<PlanEditor>;
  let plans: PlanService;
  let navegar: jasmine.Spy;

  const el = () => fixture.nativeElement as HTMLElement;
  const dialogo = () => el().querySelector('[role="dialog"]');
  const botao = (texto: string) =>
    [...el().querySelectorAll('button, a')].find((b) => b.textContent?.trim() === texto) as HTMLElement | undefined;

  function abrir(id: string): void {
    fixture = TestBed.createComponent(PlanEditor);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('ficha vazia e não gravada mostra Cancelar no lugar de Excluir e Salvar', () => {
    const r = plans.criarRascunho('Ficha A');
    abrir(r.id);
    expect(botao('Cancelar')).toBeDefined();
    expect(botao('Excluir ficha')).toBeUndefined();
    expect(botao('Salvar ficha')).toBeUndefined();
  });

  it('Cancelar descarta o rascunho e volta para a lista, sem gravar nada', () => {
    const r = plans.criarRascunho('Ficha A');
    abrir(r.id);
    botao('Cancelar')!.click();
    expect(plans.rascunho()).toBeNull();
    expect(plans.fichas().length).toBe(0);
    expect(navegar).toHaveBeenCalledWith(['/fichas']);
  });

  it('com o primeiro exercício a ficha é gravada e passa a mostrar Excluir ficha', () => {
    const r = plans.criarRascunho('Ficha A');
    abrir(r.id);
    plans.definirAtiva(r.id);
    plans.adicionar('supino');
    fixture.detectChanges();
    expect(plans.fichas().length).toBe(1);
    expect(botao('Cancelar')).toBeUndefined();
    expect(botao('Excluir ficha')).toBeDefined();
    expect(botao('Salvar ficha')).toBeDefined();
  });

  it('Excluir ficha pede confirmação: nada some antes de confirmar', () => {
    plans.criarComItens([{ nome: 'A', itens: [{ exerciseId: 'supino', series: 3, reps: 10, carga: 0, descanso: 60 }] }]);
    const id = plans.fichas()[0].id;
    abrir(id);
    botao('Excluir ficha')!.click();
    fixture.detectChanges();
    expect(dialogo()?.textContent).toContain('Excluir ficha?');
    expect(plans.fichas().length).toBe(1);

    botao('Cancelar')!.click();
    fixture.detectChanges();
    expect(dialogo()).toBeNull();
    expect(plans.fichas().length).toBe(1);

    botao('Excluir ficha')!.click();
    fixture.detectChanges();
    botao('Excluir')!.click();
    fixture.detectChanges();
    expect(plans.fichas().length).toBe(0);
    expect(navegar).toHaveBeenCalledWith(['/fichas']);
  });
});
