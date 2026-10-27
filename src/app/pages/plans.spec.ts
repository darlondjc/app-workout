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
  /** Criar uma ficha nova vence as anteriores; aqui queremos todas ativas ao mesmo tempo. */
  const ativarTodas = () => plans.blocos().forEach((b) => plans.reativarBloco(b.chave));
  const item = (exerciseId: string) => ({ exerciseId, series: 3, reps: 10, carga: 0, descanso: 60 });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
    plans.criarComItens([{ nome: 'Antiga', itens: [item('supino')] }]);
    plans.criarConjunto('Divisão ABCD', ['Peito', 'Costas', 'Pernas', 'Braços'].map((nome) => ({ nome, itens: [item('x' + nome)] })));
    ativarTodas();
    fixture = TestBed.createComponent(Plans);
    fixture.detectChanges();
  });

  it('uma ficha com 4 treinos conta como uma ficha só, ao lado da antiga', () => {
    expect(el().querySelector('header .apoio')!.textContent!.trim()).toBe('2 fichas ativas');
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
      ativarTodas();
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

  describe('chip do próximo treino', () => {
    const chips = () => [...el().querySelectorAll('.chip-proximo')];
    const nomeDoChip = () => chips()[0]?.closest('.link')?.querySelector('.linha__nome')?.textContent?.trim();

    it('marca só o treino sugerido como próximo', () => {
      expect(chips().length).toBe(1);
      expect(chips()[0].textContent!.trim()).toBe('Próximo sugerido');
      expect(nomeDoChip()).toBe('Antiga');
    });

    it('depois de concluir um treino, o chip passa para o seguinte', () => {
      plans.registrarSessao(plans.fichas()[0].id);
      fixture.detectChanges();
      expect(chips().length).toBe(1);
      expect(nomeDoChip()).toBe('Peito');
    });

    it('com um treino em andamento, o chip vira "Em andamento"', () => {
      plans.trocarNoTreino(plans.fichas()[1].id, 0, 'outro');
      fixture.detectChanges();
      expect(chips().length).toBe(1);
      expect(chips()[0].textContent!.trim()).toBe('Em andamento');
    });
  });

  describe('ciclo das fichas', () => {
    beforeEach(() => {
      localStorage.clear();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
      plans = TestBed.inject(PlanService);
      plans.criarComItens([{ nome: 'Velha', itens: [item('a')] }]);
      plans.criarComItens([{ nome: 'Nova', itens: [item('b')] }]);
      fixture = TestBed.createComponent(Plans);
      fixture.detectChanges();
    });

    it('"Nova ficha" é o primeiro botão e leva à escolha de como criar', () => {
      const primeiro = el().querySelector('.btn') as HTMLAnchorElement;
      expect(primeiro.textContent).toContain('Nova ficha');
      expect(primeiro.getAttribute('href')).toBe('/fichas/nova');
    });

    it('a anterior fica numa seção "Vencida" recolhida; só a nova aparece na lista', () => {
      expect(el().querySelectorAll('.item').length).toBe(1);
      expect(el().querySelector('.vencidas__topo')!.textContent).toContain('Velha');
      expect(el().querySelector('.vencidas__topo')!.getAttribute('aria-expanded')).toBe('false');
      expect(el().querySelector('#vencidas-lista')).toBeNull();
    });

    it('abrir a seção mostra a ficha vencida com Renovar e Arquivar', () => {
      (el().querySelector('.vencidas__topo') as HTMLButtonElement).click();
      fixture.detectChanges();
      const botoes = [...el().querySelectorAll('.vencida__acoes button')].map((b) => b.textContent!.trim());
      expect(botoes).toEqual(['Renovar por 4 meses', 'Arquivar']);
    });

    it('arquivar tira a ficha da seção e mostra o botão de fichas arquivadas', () => {
      (el().querySelector('.vencidas__topo') as HTMLButtonElement).click();
      fixture.detectChanges();
      ([...el().querySelectorAll('.vencida__acoes button')][1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelector('.vencidas')).toBeNull();
      const link = [...el().querySelectorAll('a.btn')].find((a) => a.textContent!.includes('Fichas arquivadas'));
      expect(link!.textContent).toContain('(1)');
      expect(link!.getAttribute('href')).toBe('/fichas/arquivadas');
    });

    it('renovar traz a ficha de volta para a lista', () => {
      (el().querySelector('.vencidas__topo') as HTMLButtonElement).click();
      fixture.detectChanges();
      ([...el().querySelectorAll('.vencida__acoes button')][0] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelectorAll('.item').length).toBe(2);
      expect(el().querySelector('.vencidas')).toBeNull();
    });

    it('a ficha ativa mostra o prazo', () => {
      expect(el().querySelector('.item')).not.toBeNull();
      expect(plans.blocosAtivos()[0].fim).toBeTruthy();
    });
  });
});
