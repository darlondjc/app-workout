import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { codificarFicha } from '../core/ficha-link';
import { PlanService } from '../core/plan.service';
import { FichaCompartilhada } from './ficha-compartilhada';

@Component({ template: 'fichas' })
class FichasFalsa {}

const EXERCICIOS = [
  { id: 'supino', name: 'Bench', force: null, level: 'beginner', mechanic: null, equipment: null, primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] },
  { id: 'remada', name: 'Row', force: null, level: 'beginner', mechanic: null, equipment: null, primaryMuscles: ['lats'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] },
];

describe('FichaCompartilhada (link de ficha)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: 'ficha-compartilhada', component: FichaCompartilhada },
            { path: 'fichas', component: FichasFalsa },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => localStorage.clear());

  /** Responde os quatro arquivos que o serviço de exercícios baixa ao abrir. */
  function responderExercicios(): void {
    http.expectOne('data/exercises.json').flush(EXERCICIOS);
    http.expectOne('data/i18n/pt-BR.labels.json').flush({ force: {}, level: {}, mechanic: {}, equipment: {}, category: {}, muscles: {} });
    http.expectOne('data/i18n/pt-BR.names.json').flush({ supino: 'Supino reto', remada: 'Remada curvada' });
    http.expectOne('data/i18n/pt-BR.instructions.json').flush({});
  }

  async function abrir(d: string): Promise<HTMLElement> {
    await harness.navigateByUrl('/ficha-compartilhada?d=' + d);
    responderExercicios();
    const el = harness.routeNativeElement as HTMLElement;
    // A descompressão é assíncrona: espera a tela sair de "Abrindo a ficha…".
    for (let i = 0; i < 100 && (!el.querySelector('h1') || el.querySelector('app-carregando')); i++) {
      await new Promise((r) => setTimeout(r, 5));
      harness.detectChanges();
    }
    return el;
  }

  const item = (exerciseId: string) => ({ exerciseId, series: 3, reps: 10, carga: 20, descanso: 60 });

  it('mostra a prévia com os exercícios da ficha e deixa de fora os que não existem', async () => {
    const codigo = await codificarFicha({ nome: 'Minha divisão', treinos: [{ nome: 'Peito', itens: [item('supino'), item('fantasma')] }, { nome: 'Costas', itens: [item('remada')] }] });
    const el = await abrir(codigo);
    expect(el.querySelector('h1')!.textContent).toContain('Minha divisão');
    expect(el.textContent).toContain('Supino reto');
    expect(el.textContent).toContain('Remada curvada');
    expect(el.textContent).not.toContain('fantasma');
    expect(el.textContent).toContain('1 exercício não existe');
  });

  it('adicionar cria a ficha com os treinos e leva para Fichas', async () => {
    const plans = TestBed.inject(PlanService);
    const codigo = await codificarFicha({ nome: 'Minha divisão', treinos: [{ nome: 'Peito', itens: [item('supino')] }, { nome: 'Costas', itens: [item('remada')] }] });
    const el = await abrir(codigo);
    (el.querySelector('.btn--escuro') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    const novas = plans.fichas();
    expect(novas.map((f) => f.nome)).toEqual(['Peito', 'Costas']);
    expect(novas[0].conjunto?.nome).toBe('Minha divisão');
    expect(novas[0].conjunto?.id).toBe(novas[1].conjunto?.id);
    expect(TestBed.inject(Router).url).toBe('/fichas');
  });

  it('uma ficha de um treino só entra como ficha solta, com o nome dela', async () => {
    const plans = TestBed.inject(PlanService);
    const codigo = await codificarFicha({ nome: 'Só peito', treinos: [{ nome: 'Treino', itens: [item('supino')] }] });
    const el = await abrir(codigo);
    (el.querySelector('.btn--escuro') as HTMLButtonElement).click();
    expect(plans.fichas().length).toBe(1);
    expect(plans.fichas()[0].nome).toBe('Só peito');
    expect(plans.fichas()[0].conjunto).toBeUndefined();
  });

  it('link quebrado mostra o aviso e não cria nada', async () => {
    const plans = TestBed.inject(PlanService);
    const el = await abrir('zzzz');
    expect(el.querySelector('h1')!.textContent).toContain('inválido');
    expect(plans.fichas().length).toBe(0);
  });
});
