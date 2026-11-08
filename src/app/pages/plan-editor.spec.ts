import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { somarDias } from '../core/ciclo';
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

describe('PlanEditor — prazo', () => {
  let fixture: ComponentFixture<PlanEditor>;
  let plans: PlanService;
  const el = () => fixture.nativeElement as HTMLElement;
  const item = { exerciseId: 'supino', series: 3, reps: 10, carga: 0, descanso: 60 };
  const abrir = (id: string) => {
    fixture = TestBed.createComponent(PlanEditor);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
  });

  it('um treino de uma ficha com vários treinos não mostra o prazo: ele é da ficha', () => {
    const [a] = plans.criarConjunto('Divisão', [{ nome: 'A', itens: [item] }, { nome: 'B', itens: [item] }]);
    abrir(a.id);
    expect(el().querySelector('.periodo')).toBeNull();
    expect(el().textContent).not.toContain('Alterar prazo');
  });

  it('um treino solto, que é a própria ficha, mostra o prazo e a opção de alterar', () => {
    const [solto] = plans.criarComItens([{ nome: 'Solta', itens: [item] }]);
    abrir(solto.id);
    expect(el().querySelector('.periodo')).not.toBeNull();
    expect(el().textContent).toContain('Alterar prazo');
    // Uma data só, no mesmo lugar da opção de alterar: sem campo extra embaixo.
    expect(el().querySelectorAll('input[type="date"]').length).toBe(1);
    expect(el().querySelector('.periodo')!.querySelector('input[type="date"]')).not.toBeNull();
  });

  it('escolher uma nova data no treino solto atualiza o prazo da ficha', () => {
    const [solto] = plans.criarComItens([{ nome: 'Solta', itens: [item] }]);
    abrir(solto.id);
    const campo = el().querySelector('.periodo input[type="date"]') as HTMLInputElement;
    const fim = somarDias(plans.hoje(), 60);
    campo.value = fim;
    campo.dispatchEvent(new Event('change'));
    expect(plans.get(solto.id)!.fim).toBe(fim);
  });
});

describe('PlanEditor — card do exercício', () => {
  let fixture: ComponentFixture<PlanEditor>;
  let plans: PlanService;
  let fichaId: string;
  const el = () => fixture.nativeElement as HTMLElement;
  const cards = () => [...el().querySelectorAll('li.item')] as HTMLElement[];
  const resumo = (i: number) => cards()[i].querySelector('.item__resumo')!.textContent!.replace(/\s+/g, ' ').trim();
  const clicar = (e: Element | null | undefined) => {
    (e as HTMLElement).click();
    fixture.detectChanges();
  };
  const abrirMenu = (i: number) => clicar(cards()[i].querySelector('[data-menu]'));
  const itemDoMenu = (texto: string) => [...el().querySelectorAll('.menu button')].find((b) => b.textContent!.trim() === texto) as HTMLButtonElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
    [{ id: fichaId }] = plans.criarComItens([
      {
        nome: 'Braços',
        itens: [
          { exerciseId: 'rosca', series: 3, reps: 12, carga: 47.5, descanso: 60 },
          { exerciseId: 'triceps', series: 4, reps: 10, carga: 0, descanso: 90 },
        ],
      },
    ]);
    fixture = TestBed.createComponent(PlanEditor);
    fixture.componentRef.setInput('id', fichaId);
    fixture.detectChanges();
  });

  it('fechado, cada exercício mostra só o resumo, sem os campos', () => {
    expect(resumo(0)).toBe('3 × 12 · 47,5 kg · desc. 60 s');
    expect(resumo(1)).toBe('4 × 10 · 0 kg · desc. 90 s');
    expect(el().querySelectorAll('.campos').length).toBe(0);
  });

  it('tocar no resumo abre os campos só daquele exercício, e tocar de novo fecha', () => {
    clicar(cards()[0].querySelector('.item__resumo'));
    expect(cards()[0].querySelectorAll('.campos input').length).toBe(4);
    expect(cards()[1].querySelectorAll('.campos').length).toBe(0);
    expect(cards()[0].querySelector('.item__resumo')!.getAttribute('aria-expanded')).toBe('true');
    clicar(cards()[0].querySelector('.item__resumo'));
    expect(el().querySelectorAll('.campos').length).toBe(0);
  });

  it('editar um campo grava na ficha e atualiza o resumo', () => {
    clicar(cards()[0].querySelector('.item__resumo'));
    const carga = cards()[0].querySelectorAll('.campos input')[2] as HTMLInputElement;
    carga.value = '50';
    carga.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(plans.get(fichaId)!.itens[0].carga).toBe(50);
    expect(resumo(0)).toBe('3 × 12 · 50 kg · desc. 60 s');
  });

  it('nome e foto continuam levando às instruções', () => {
    const nome = cards()[0].querySelector('a.item__nome')!;
    expect(nome.getAttribute('href')).toContain('/exercicio/rosca');
  });

  it('o menu ⋯ abre com as três ações e fecha ao tocar fora', () => {
    abrirMenu(0);
    // O primeiro exercício tem outro logo abaixo, sozinho: pode ser conjugado com ele.
    expect([...el().querySelectorAll('.menu button')].map((b) => b.textContent!.trim())).toEqual(['Mover para cima', 'Mover para baixo', 'Conjugar com o de baixo', 'Remover da ficha']);
    expect(itemDoMenu('Mover para cima').disabled).toBeTrue();
    document.body.click();
    fixture.detectChanges();
    expect(el().querySelector('.menu')).toBeNull();
  });

  it('Mover para baixo no menu troca a ordem na ficha e fecha o menu', () => {
    abrirMenu(0);
    clicar(itemDoMenu('Mover para baixo'));
    expect(plans.get(fichaId)!.itens.map((i) => i.exerciseId)).toEqual(['triceps', 'rosca']);
    expect(el().querySelector('.menu')).toBeNull();
  });

  it('Remover da ficha no menu pede confirmação', () => {
    abrirMenu(1);
    clicar(itemDoMenu('Remover da ficha'));
    expect(el().querySelector('[role="dialog"], [role="alertdialog"]')).not.toBeNull();
    expect(plans.get(fichaId)!.itens.length).toBe(2);
  });

  it('não há mais os botões soltos de subir, descer e remover nos cards', () => {
    expect(el().querySelectorAll('li.item > .item__topo > button[data-mover]').length).toBe(0);
    expect(el().querySelectorAll('li.item .btn-icone').length).toBe(2);
  });
});

describe('PlanEditor — exercícios conjugados', () => {
  let fixture: ComponentFixture<PlanEditor>;
  let plans: PlanService;
  let fichaId: string;
  const el = () => fixture.nativeElement as HTMLElement;
  const clicar = (e: Element | null | undefined) => {
    (e as HTMLElement).click();
    fixture.detectChanges();
  };
  const blocos = () => [...el().querySelectorAll('li.bloco')] as HTMLElement[];
  const menuDe = (i: number) => clicar(el().querySelectorAll('[data-menu]')[i]);
  const opcoes = () => [...el().querySelectorAll('.menu button')].map((b) => b.textContent!.trim());
  const opcao = (texto: string) => [...el().querySelectorAll('.menu button')].find((b) => b.textContent!.trim() === texto);
  const item = (exerciseId: string, extra: object = {}) => ({ exerciseId, series: 3, reps: 12, carga: 20, descanso: 60, ...extra });

  function abrir(itens: object[]): void {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    plans = TestBed.inject(PlanService);
    [{ id: fichaId }] = plans.criarComItens([{ nome: 'Braços', itens: itens as never }]);
    fixture = TestBed.createComponent(PlanEditor);
    fixture.componentRef.setInput('id', fichaId);
    fixture.detectChanges();
  }

  it('Conjugar com o de baixo forma um bloco com A1 e A2', () => {
    abrir([item('rosca'), item('triceps'), item('martelo')]);
    expect(blocos().length).toBe(3);
    menuDe(0);
    expect(opcoes()).toContain('Conjugar com o de baixo');
    clicar(opcao('Conjugar com o de baixo'));
    expect(blocos().length).toBe(2);
    const grupo = el().querySelector('li.grupo')!;
    expect(grupo.querySelector('.tag')!.textContent).toContain('Conjugado');
    expect([...grupo.querySelectorAll('.rot')].map((r) => r.textContent!.trim())).toEqual(['A1', 'A2']);
    expect(plans.get(fichaId)!.itens.map((i) => !!i.par)).toEqual([true, true, false]);
  });

  it('o último exercício não oferece conjugar, e quem tem o de baixo num par também não', () => {
    abrir([item('rosca'), item('triceps', { par: 'p' }), item('martelo', { par: 'p' })]);
    menuDe(0); // o de baixo já está num par
    expect(opcoes()).not.toContain('Conjugar com o de baixo');
    document.body.click();
    fixture.detectChanges();
    abrir([item('rosca'), item('triceps')]);
    menuDe(1); // último
    expect(opcoes()).not.toContain('Conjugar com o de baixo');
  });

  it('o menu de quem está num par oferece Separar do conjugado, e separar desfaz o bloco', () => {
    abrir([item('rosca', { par: 'p' }), item('triceps', { par: 'p' }), item('martelo')]);
    menuDe(0);
    expect(opcoes()).toEqual(['Mover o par para cima', 'Mover o par para baixo', 'Separar do conjugado', 'Remover da ficha']);
    clicar(opcao('Separar do conjugado'));
    expect(el().querySelector('li.grupo')).toBeNull();
    expect(blocos().length).toBe(3);
    expect(plans.get(fichaId)!.itens.some((i) => i.par)).toBeFalse();
  });

  it('o descanso do par fica no cabeçalho do bloco e é o do segundo exercício', () => {
    abrir([item('rosca', { par: 'p', descanso: 30 }), item('triceps', { par: 'p', descanso: 90 })]);
    const resumo = el().querySelector('.gs')!;
    expect(resumo.textContent).toContain('desc. 90 s após a rodada');
    clicar(resumo);
    const campo = el().querySelector('.campos--par input') as HTMLInputElement;
    campo.value = '120';
    campo.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(plans.get(fichaId)!.itens[1].descanso).toBe(120);
    expect(plans.get(fichaId)!.itens[0].descanso).toBe(30);
    expect(el().querySelector('.gs')!.textContent).toContain('desc. 120 s após a rodada');
  });

  it('cada exercício do par tem as suas séries, reps e carga', () => {
    abrir([item('rosca', { par: 'p', series: 4 }), item('triceps', { par: 'p', series: 3 })]);
    const resumos = [...el().querySelectorAll('.mb .item__resumo')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim());
    expect(resumos).toEqual(['4 × 12 · 20 kg', '3 × 12 · 20 kg']);
    clicar(el().querySelectorAll('.mb .item__resumo')[1]);
    const campos = [...el().querySelectorAll('.campos--membro input')] as HTMLInputElement[];
    expect(campos.length).toBe(3);
    campos[0].value = '5';
    campos[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(plans.get(fichaId)!.itens.map((i) => i.series)).toEqual([4, 5]);
  });

  it('mover o par leva os dois exercícios juntos', () => {
    abrir([item('rosca', { par: 'p' }), item('triceps', { par: 'p' }), item('martelo')]);
    menuDe(0);
    expect((opcao('Mover o par para cima') as HTMLButtonElement).disabled).toBeTrue();
    clicar(opcao('Mover o par para baixo'));
    expect(plans.get(fichaId)!.itens.map((i) => i.exerciseId)).toEqual(['martelo', 'rosca', 'triceps']);
    expect(plans.get(fichaId)!.itens.map((i) => !!i.par)).toEqual([false, true, true]);
  });

  it('remover um exercício do par deixa o outro sozinho', () => {
    abrir([item('rosca', { par: 'p' }), item('triceps', { par: 'p' })]);
    menuDe(1);
    clicar(opcao('Remover da ficha'));
    const confirmar = [...el().querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Remover');
    clicar(confirmar);
    expect(plans.get(fichaId)!.itens.map((i) => i.exerciseId)).toEqual(['rosca']);
    expect(plans.get(fichaId)!.itens[0].par).toBeUndefined();
    expect(el().querySelector('li.grupo')).toBeNull();
  });
});
