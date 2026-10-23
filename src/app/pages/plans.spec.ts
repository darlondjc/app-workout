import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlanService } from '../core/plan.service';
import { Plans } from './plans';

describe('Plans — fichas com vários treinos', () => {
  let fixture: ComponentFixture<Plans>;
  let plans: PlanService;
  const el = () => fixture.nativeElement as HTMLElement;
  const item = (exerciseId: string) => ({ exerciseId, series: 3, reps: 10, carga: 0, descanso: 60 });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
    plans.criarComItens([{ nome: 'Antiga', itens: [item('supino')] }]);
    plans.criarConjunto('Divisão ABCD', ['Peito', 'Costas', 'Pernas', 'Braços'].map((nome) => ({ nome, itens: [item('x' + nome)] })));
    fixture = TestBed.createComponent(Plans);
    fixture.detectChanges();
  });

  it('uma ficha com 4 treinos conta como uma ficha só, ao lado da antiga', () => {
    expect(el().querySelector('header .apoio')!.textContent!.trim()).toBe('2 fichas');
    expect(el().querySelectorAll('.conjunto').length).toBe(1);
    expect(el().querySelector('.conjunto__nome')!.textContent).toBe('Divisão ABCD');
    expect(el().querySelector('.conjunto .apoio')!.textContent!.trim()).toBe('4 treinos');
  });

  it('os treinos aparecem dentro da ficha, com letras A a D', () => {
    const letras = [...el().querySelectorAll('.conjunto .letra')].map((l) => l.textContent!.trim());
    expect(letras).toEqual(['A', 'B', 'C', 'D']);
    expect(el().querySelectorAll('.item').length).toBe(5);
  });

  it('excluir a ficha inteira pede confirmação e leva os 4 treinos, sem tocar na antiga', () => {
    (el().querySelector('.conjunto__excluir') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('app-confirmacao')!.textContent).toContain('4 treinos');
    expect(plans.fichas().length).toBe(5);
    const botoes = [...el().querySelectorAll('app-confirmacao button')] as HTMLButtonElement[];
    botoes.find((b) => b.textContent!.trim() === 'Excluir')!.click();
    fixture.detectChanges();
    expect(plans.fichas().map((f) => f.nome)).toEqual(['Antiga']);
    expect(el().querySelector('.conjunto')).toBeNull();
  });

  describe('abrir e fechar', () => {
    const topos = () => [...el().querySelectorAll('.conjunto__topo')] as HTMLButtonElement[];
    const abertos = () => topos().map((t) => t.getAttribute('aria-expanded') === 'true');

    beforeEach(() => {
      // Uma segunda ficha com vários treinos: passa a ser a atual.
      plans.criarConjunto('Segunda', ['Peito', 'Costas'].map((nome) => ({ nome, itens: [item('y' + nome)] })));
      fixture.detectChanges();
    });

    it('só a ficha atual começa aberta; as outras mostram o resumo dos treinos', () => {
      expect(abertos()).toEqual([false, true]);
      expect(el().querySelectorAll('.conjunto')[0].querySelector('.item')).toBeNull();
      expect(el().querySelectorAll('.conjunto')[0].querySelector('.apoio')!.textContent).toContain('Peito · Costas · Pernas · Braços');
      expect(el().querySelectorAll('.conjunto')[1].querySelectorAll('.item').length).toBe(2);
    });

    it('tocar na ficha fechada a abre, e tocar de novo fecha; a outra não muda', () => {
      topos()[0].click();
      fixture.detectChanges();
      expect(abertos()).toEqual([true, true]);
      expect(el().querySelectorAll('.conjunto')[0].querySelectorAll('.item').length).toBe(4);
      topos()[0].click();
      fixture.detectChanges();
      expect(abertos()).toEqual([false, true]);
    });

    it('dá para fechar a ficha atual', () => {
      topos()[1].click();
      fixture.detectChanges();
      expect(abertos()).toEqual([false, false]);
    });

    it('a ficha solta continua sempre à vista', () => {
      topos()[1].click();
      fixture.detectChanges();
      expect(el().querySelectorAll('.item').length).toBe(1);
    });
  });
});
