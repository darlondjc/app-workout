import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PlanService } from '../core/plan.service';
import { SocialService } from '../core/social.service';
import { Workout } from './workout';

describe('Workout — marcar séries em bloco', () => {
  let fixture: ComponentFixture<Workout>;
  let plans: PlanService;
  let fichaId: string;

  const el = () => fixture.nativeElement as HTMLElement;
  const botao = (texto: string) =>
    [...el().querySelectorAll('button')].find((b) => b.textContent?.replace(/\s+/g, ' ').trim() === texto) as HTMLButtonElement | undefined;
  const marcas = () => [...el().querySelectorAll('.marca')] as HTMLButtonElement[];
  const feitas = () => marcas().filter((m) => m.getAttribute('aria-pressed') === 'true').length;
  const chave = () => el().querySelector('.chave input') as HTMLInputElement;
  const clicar = (b: HTMLElement | undefined) => {
    b!.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SocialService, useValue: { ativo: signal(false) } },
      ],
    });
    plans = TestBed.inject(PlanService);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const [ficha] = plans.criarComItens([
      {
        nome: 'Ficha A',
        itens: [
          { exerciseId: 'x1', series: 3, reps: 10, carga: 20, descanso: 60 },
          { exerciseId: 'x2', series: 2, reps: 12, carga: 30, descanso: 60 },
        ],
      },
    ]);
    fichaId = ficha.id;
    fixture = TestBed.createComponent(Workout);
    fixture.componentRef.setInput('id', fichaId);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('"Marcar todos" marca todas as séries do exercício e, de novo, desmarca', () => {
    expect(feitas()).toBe(0);
    clicar(botao('Marcar todos'));
    expect(feitas()).toBe(3);
    expect(botao('Desmarcar todos')).toBeDefined();
    clicar(botao('Desmarcar todos'));
    expect(feitas()).toBe(0);
  });

  it('"Marcar todos" com algumas já feitas completa as que faltam', () => {
    clicar(marcas()[0]);
    clicar(botao('Marcar todos'));
    expect(feitas()).toBe(3);
  });

  it('ao finalizar com séries sem marcar, pergunta antes de concluir', () => {
    clicar(botao('Próximo exercício'));
    clicar(botao('Finalizar treino'));
    const dialogo = el().querySelector('[role="alertdialog"]')!;
    expect(dialogo.textContent).toContain('Marcar o que falta como feito?');
    expect(dialogo.textContent).toContain('Faltam 5 séries');
    expect(plans.historico().length).toBe(0);
  });

  it('"Marcar e finalizar" grava todas as séries de todos os exercícios, inclusive os não visitados', () => {
    clicar(botao('Próximo exercício'));
    clicar(botao('Finalizar treino'));
    clicar(botao('Marcar e finalizar'));
    const [sessao] = plans.historico();
    expect(sessao.registros!.map((r) => r.series.length)).toEqual([3, 2]);
    expect(sessao.registros![0].series[0]).toEqual(jasmine.objectContaining({ carga: 20, reps: 10 }));
    expect(sessao.registros![1].series[0]).toEqual(jasmine.objectContaining({ carga: 30, reps: 12 }));
  });

  it('"Finalizar sem marcar" grava só o que foi marcado', () => {
    clicar(botao('Marcar todos'));
    clicar(botao('Próximo exercício'));
    clicar(botao('Finalizar treino'));
    expect(el().querySelector('[role="alertdialog"]')!.textContent).toContain('Faltam 2 séries');
    clicar(botao('Finalizar sem marcar'));
    const [sessao] = plans.historico();
    expect(sessao.registros!.length).toBe(1);
    expect(sessao.registros![0].series.length).toBe(3);
  });

  it('"Voltar ao treino" fecha a pergunta sem concluir', () => {
    clicar(botao('Próximo exercício'));
    clicar(botao('Finalizar treino'));
    clicar(botao('Voltar ao treino'));
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    expect(plans.historico().length).toBe(0);
  });

  it('com tudo marcado, conclui direto, sem perguntar', () => {
    clicar(botao('Marcar todos'));
    clicar(botao('Próximo exercício'));
    clicar(botao('Marcar todos'));
    clicar(botao('Finalizar treino'));
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    expect(plans.historico().length).toBe(1);
  });

  it('com a chave ligada, marca o que falta e conclui sem perguntar; a escolha fica guardada', () => {
    expect(chave().checked).toBeFalse();
    chave().click();
    fixture.detectChanges();
    expect(chave().checked).toBeTrue();
    expect(localStorage.getItem('app-workout:marcar-tudo-ao-finalizar:v1')).toBe('1');
    clicar(botao('Próximo exercício'));
    clicar(botao('Finalizar treino'));
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    expect(plans.historico()[0].registros!.map((r) => r.series.length)).toEqual([3, 2]);
  });

  it('a chave já começa ligada se foi deixada assim antes', () => {
    localStorage.setItem('app-workout:marcar-tudo-ao-finalizar:v1', '1');
    fixture = TestBed.createComponent(Workout);
    fixture.componentRef.setInput('id', fichaId);
    fixture.detectChanges();
    expect(chave().checked).toBeTrue();
  });
});
