import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PlanService } from '../core/plan.service';
import { SocialService } from '../core/social.service';
import { TelaLigada } from '../core/tela-ligada';
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

  it('ao concluir, mostra o resumo e só volta para o início quando a pessoa toca em OK', () => {
    clicar(botao('Próximo exercício'));
    clicar(botao('Finalizar treino'));
    clicar(botao('Marcar e finalizar'));
    const navegar = TestBed.inject(Router).navigate as jasmine.Spy;
    expect(navegar).not.toHaveBeenCalled();
    const resumo = el().querySelector('app-resumo-treino')!;
    expect(resumo.textContent).toContain('Treino concluído');
    expect(resumo.textContent).toContain('Ficha A');
    clicar(resumo.querySelector('button.ok') as HTMLButtonElement);
    expect(navegar).toHaveBeenCalledWith(['/']);
    expect(el().querySelector('app-resumo-treino')).toBeNull();
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

  describe('cronômetro de descanso', () => {
    const tempo = () => el().querySelector('.tempo')?.textContent?.trim();
    const passar = (ms: number) => {
      jasmine.clock().tick(ms);
      fixture.detectChanges();
    };

    beforeEach(() => jasmine.clock().install().mockDate(new Date(2026, 9, 23, 10, 0, 0)));
    afterEach(() => jasmine.clock().uninstall());

    it('marcar a última série do exercício também inicia o cronômetro', () => {
      marcas().forEach((m) => clicar(m));
      passar(3000);
      expect(tempo()).toBe('00:03');
    });

    it('trocar de exercício não interrompe nem reinicia o cronômetro', () => {
      marcas().forEach((m) => clicar(m));
      passar(5000);
      clicar(botao('Próximo exercício'));
      expect(tempo()).toBe('00:05');
      passar(2000);
      expect(tempo()).toBe('00:07');
      clicar(botao('Anterior'));
      passar(1000);
      expect(tempo()).toBe('00:08');
    });

    it('marcar uma série no exercício seguinte reinicia a contagem', () => {
      marcas().forEach((m) => clicar(m));
      passar(5000);
      clicar(botao('Próximo exercício'));
      clicar(marcas()[0]);
      expect(tempo()).toBe('00:00');
    });

    it('"Marcar todos" também inicia o cronômetro', () => {
      clicar(botao('Marcar todos'));
      passar(2000);
      expect(tempo()).toBe('00:02');
    });

    it('desmarcar uma série não mexe no cronômetro', () => {
      clicar(marcas()[0]);
      passar(4000);
      clicar(marcas()[0]);
      passar(1000);
      expect(tempo()).toBe('00:05');
    });

    it('depois de pausar e continuar, o cronômetro segue de onde estava', () => {
      marcas().forEach((m) => clicar(m));
      passar(7000);
      fixture.destroy(); // pausar: sai da tela com o treino em andamento
      jasmine.clock().tick(60000); // o tempo parado não conta
      fixture = TestBed.createComponent(Workout);
      fixture.componentRef.setInput('id', fichaId);
      fixture.detectChanges();
      fixture.detectChanges();
      expect(tempo()).toBe('00:07');
      passar(2000);
      expect(tempo()).toBe('00:09');
    });
  });

  describe('linhas copiadas piscam', () => {
    const linhas = () => [...el().querySelectorAll('.serie')] as HTMLElement[];
    const piscando = () => linhas().map((l) => l.classList.contains('pisca-a') || l.classList.contains('pisca-b'));
    const digitar = (linha: number, campo: 0 | 1, valor: string) => {
      const input = linhas()[linha].querySelectorAll('input')[campo] as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };

    it('mudar a carga de uma série faz piscar só as de baixo que mudaram sozinhas', () => {
      digitar(0, 1, '40');
      expect(piscando()).toEqual([false, true, true]);
    });

    it('séries já feitas não são alteradas e não piscam', () => {
      clicar(marcas()[1]);
      digitar(0, 1, '40');
      expect(piscando()).toEqual([false, false, true]);
    });

    it('se nada mudou nas de baixo, nada pisca', () => {
      digitar(0, 0, '10');
      expect(piscando()).toEqual([false, false, false]);
    });

    it('editar a última série não faz nada piscar', () => {
      digitar(2, 1, '50');
      expect(piscando()).toEqual([false, false, false]);
    });

    it('uma nova edição repete o efeito (troca a classe da animação)', () => {
      digitar(0, 1, '40');
      expect(linhas()[1].classList).toContain('pisca-a');
      digitar(0, 1, '45');
      expect(linhas()[1].classList).toContain('pisca-b');
      expect(linhas()[1].classList).not.toContain('pisca-a');
    });

    it('ao trocar de exercício o efeito é limpo', () => {
      digitar(0, 1, '40');
      clicar(botao('Próximo exercício'));
      expect(piscando().some(Boolean)).toBeFalse();
    });
  });

  describe('sugestão de carga', () => {
    const sugestao = () => el().querySelector('.sugestao');
    const cargas = () =>
      [...el().querySelectorAll('input[aria-label^="Carga"]')].map((i) => Number((i as HTMLInputElement).value));
    const treinoAnterior = (series: [number, number][]) => {
      plans.registrarSessao(fichaId, [{ exerciseId: 'x1', series: series.map(([carga, reps]) => ({ carga, reps })) }]);
      fixture.detectChanges();
    };

    it('sem treino anterior, não sugere nada', () => {
      expect(sugestao()).toBeNull();
    });

    it('com todas as séries e repetições feitas na última vez, sugere subir a carga', () => {
      treinoAnterior([[40, 10], [40, 10], [40, 10]]);
      expect(sugestao()?.textContent).toContain('40 kg');
      expect(sugestao()?.textContent).toContain('42 kg');
    });

    it('"Usar" põe a carga sugerida em todas as séries e some com o aviso', () => {
      treinoAnterior([[40, 10], [40, 10], [40, 10]]);
      expect(cargas()).toEqual([40, 40, 40]);
      clicar(botao('Usar 42 kg'));
      expect(cargas()).toEqual([42, 42, 42]);
      expect(sugestao()).toBeNull();
    });

    it('repetição abaixo da meta na última vez: não sugere', () => {
      treinoAnterior([[40, 10], [40, 10], [40, 8]]);
      expect(sugestao()).toBeNull();
    });

    it('depois de marcar uma série, o aviso some', () => {
      treinoAnterior([[40, 10], [40, 10], [40, 10]]);
      clicar(marcas()[0]);
      expect(sugestao()).toBeNull();
    });
  });

  describe('notas', () => {
    const abrir = () => clicar(botao('Adicionar nota') ?? botao('Editar notas'));
    const campos = () => [...el().querySelectorAll('app-dialogo textarea')] as HTMLTextAreaElement[];
    const digitar = (campo: HTMLTextAreaElement, valor: string) => {
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('começa sem notas e oferece adicionar', () => {
      expect(botao('Adicionar nota')).toBeDefined();
      expect(el().querySelector('.nota-fixa')).toBeNull();
    });

    it('a nota do exercício vai para a ficha e a do treino para o treino em andamento', () => {
      abrir();
      expect(campos().length).toBe(2);
      digitar(campos()[0], '  banco na posição 4  ');
      digitar(campos()[1], 'ombro incomodando');
      clicar(botao('Salvar notas'));
      expect(plans.get(fichaId)!.itens[0].nota).toBe('banco na posição 4');
      expect(plans.emAndamento()?.nota).toBe('ombro incomodando');
      const fixas = [...el().querySelectorAll('.nota-fixa')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
      expect(fixas).toEqual(['Nota banco na posição 4', 'Hoje ombro incomodando']);
      expect(botao('Editar notas')).toBeDefined();
    });

    it('apagar o texto remove a nota', () => {
      abrir();
      digitar(campos()[0], 'banco no 4');
      clicar(botao('Salvar notas'));
      abrir();
      digitar(campos()[0], '   ');
      clicar(botao('Salvar notas'));
      expect('nota' in plans.get(fichaId)!.itens[0]).toBeFalse();
      expect(el().querySelector('.nota-fixa')).toBeNull();
    });

    it('a nota do treino fica na sessão ao concluir', () => {
      abrir();
      digitar(campos()[1], 'treino pesado');
      clicar(botao('Salvar notas'));
      clicar(botao('Próximo exercício'));
      clicar(botao('Finalizar treino'));
      clicar(botao('Marcar e finalizar'));
      expect(plans.historico()[0].nota).toBe('treino pesado');
    });

    it('sem nota escrita, a sessão não ganha o campo', () => {
      clicar(botao('Marcar todos'));
      clicar(botao('Próximo exercício'));
      clicar(botao('Marcar todos'));
      clicar(botao('Finalizar treino'));
      expect('nota' in plans.historico()[0]).toBeFalse();
    });
  });
});

describe('Workout — tela ligada', () => {
  const tela = { ligar: jasmine.createSpy('ligar'), desligar: jasmine.createSpy('desligar') };
  let fixture: ComponentFixture<Workout>;
  let plans: PlanService;

  beforeEach(() => {
    localStorage.clear();
    tela.ligar.calls.reset();
    tela.desligar.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SocialService, useValue: { ativo: signal(false) } },
        { provide: TelaLigada, useValue: tela },
      ],
    });
    plans = TestBed.inject(PlanService);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const [ficha] = plans.criarComItens([{ nome: 'Ficha A', itens: [{ exerciseId: 'x1', series: 1, reps: 10, carga: 20, descanso: 60 }] }]);
    fixture = TestBed.createComponent(Workout);
    fixture.componentRef.setInput('id', ficha.id);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('liga a tela ao abrir o treino', () => {
    expect(tela.ligar).toHaveBeenCalledTimes(1);
    expect(tela.desligar).not.toHaveBeenCalled();
  });

  it('solta a tela ao concluir o treino', () => {
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.marca') as HTMLButtonElement).click();
    fixture.detectChanges();
    ([...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Finalizar treino')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(tela.desligar).toHaveBeenCalled();
  });

  it('solta a tela ao sair da página sem concluir', () => {
    fixture.destroy();
    expect(tela.desligar).toHaveBeenCalled();
  });
});
