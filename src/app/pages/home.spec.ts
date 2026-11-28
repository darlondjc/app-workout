import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Conquista } from '../core/medalhas';
import { MedalhasService } from '../core/medalhas.service';
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

describe('Home — tela enxuta', () => {
  const item = (exerciseId: string) => ({ exerciseId, series: 3, reps: 10, carga: 0, descanso: 60 });
  const conquista = (id: Conquista['id'], nivel: Conquista['nivel']): Conquista => ({
    id,
    titulo: id === 'treinos' ? 'Treinos' : 'Constância',
    descricao: '',
    atual: 3,
    degraus: [{ nivel: 'bronze', alvo: 5, conquistado: nivel !== null, data: null }],
    nivel,
    dataDoNivel: null,
    proximo: { nivel: 'prata', alvo: 20, conquistado: false, data: null },
  });

  function montar(treinos: number, conquistas: Conquista[] = []) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MedalhasService, useValue: { conquistas: signal(conquistas), idsNovos: signal([]), reconhecer: () => undefined, aposTreino: () => [], pronto: () => true } },
      ],
    });
    const plans = TestBed.inject(PlanService);
    plans.criarConjunto('Divisão', Array.from({ length: treinos }, (_, i) => ({ nome: `Treino ${i + 1}`, itens: [item('a' + i)] })));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('Minhas fichas não repete a ficha que já é o treino de hoje', () => {
    const { el } = montar(3);
    const nomes = [...el.querySelectorAll('.linha .linha__nome')].map((x) => x.textContent!.trim());
    expect(el.querySelector('.destaque__nome')!.textContent).toContain('Treino 1');
    expect(nomes).toEqual(['Treino 2', 'Treino 3']);
  });

  it('com uma ficha só, a lista Minhas fichas não aparece', () => {
    const { el } = montar(1);
    expect(el.querySelector('[aria-labelledby="titulo-fichas"]')).toBeNull();
  });

  it('Registrar atividade fica na tela, sem botão flutuante, ao lado do treino customizado', () => {
    const { el } = montar(2);
    expect(el.querySelector('.fab')).toBeNull();
    const botoes = [...el.querySelectorAll('.acoes .btn')].map((b) => b.textContent!.trim());
    expect(botoes).toEqual(['Treino customizado', 'Registrar atividade']);
  });

  it('o botão Registrar atividade abre o diálogo', () => {
    const { fixture, el } = montar(2);
    (el.querySelectorAll('.acoes .btn')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-atividade-dialogo')).not.toBeNull();
  });

  it('sem nenhuma medalha ganha, não mostra o quadro de "Sem medalha", só o caminho até a próxima', () => {
    const { el } = montar(2, [conquista('treinos', null), conquista('constancia', null)]);
    expect(el.querySelector('app-quadro-medalhas')).toBeNull();
    expect(el.textContent).not.toContain('Sem medalha');
    expect(el.querySelector('.proxima')!.textContent).toContain('Próxima');
    // A galeria completa continua a um toque.
    expect([...el.querySelectorAll('.ver-todas')].some((b) => b.textContent!.trim() === 'Ver todas')).toBeTrue();
  });

  it('mostra só as medalhas ganhas no quadro', () => {
    const { el } = montar(2, [conquista('treinos', 'bronze'), conquista('constancia', null)]);
    const cartoes = [...el.querySelectorAll('app-quadro-medalhas .medalha-card')];
    expect(cartoes.length).toBe(1);
    expect(cartoes[0].textContent).toContain('Treinos');
    expect(el.textContent).not.toContain('Sem medalha');
  });
});
