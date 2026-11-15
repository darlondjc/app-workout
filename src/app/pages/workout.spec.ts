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
  const celulas = () => [...el().querySelectorAll('.celula')] as HTMLButtonElement[];
  const feitas = () => celulas().filter((c) => c.classList.contains('celula--feita')).length;
  const valores = () => celulas().map((c) => c.querySelector('b')!.textContent!.trim());
  const chave = () => el().querySelector('.chave input') as HTMLInputElement;
  const clicar = (b: Element | null | undefined) => {
    (b as HTMLElement).click();
    fixture.detectChanges();
  };
  const ok = () => el().querySelector('.foco__ok');
  /** Escolhe a série k na faixa e toca no botão grande (marca, ou desmarca se já estava feita). */
  const marcar = (k: number) => {
    clicar(celulas()[k]);
    clicar(ok());
  };
  const proximo = () => clicar(el().querySelector('.proximo'));
  const anterior = () => clicar(el().querySelector('.anterior'));

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
    marcar(0);
    clicar(botao('Marcar todos'));
    expect(feitas()).toBe(3);
  });

  it('ao finalizar com séries sem marcar, pergunta antes de concluir', () => {
    proximo();
    clicar(botao('Finalizar treino'));
    const dialogo = el().querySelector('[role="alertdialog"]')!;
    expect(dialogo.textContent).toContain('Marcar o que falta como feito?');
    expect(dialogo.textContent).toContain('Faltam 5 séries');
    expect(plans.historico().length).toBe(0);
  });

  it('"Marcar e finalizar" grava todas as séries de todos os exercícios, inclusive os não visitados', () => {
    proximo();
    clicar(botao('Finalizar treino'));
    clicar(botao('Marcar e finalizar'));
    const [sessao] = plans.historico();
    expect(sessao.registros!.map((r) => r.series.length)).toEqual([3, 2]);
    expect(sessao.registros![0].series[0]).toEqual(jasmine.objectContaining({ carga: 20, reps: 10 }));
    expect(sessao.registros![1].series[0]).toEqual(jasmine.objectContaining({ carga: 30, reps: 12 }));
  });

  it('ao concluir, mostra o resumo e só volta para o início quando a pessoa toca em OK', () => {
    proximo();
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
    proximo();
    clicar(botao('Finalizar treino'));
    expect(el().querySelector('[role="alertdialog"]')!.textContent).toContain('Faltam 2 séries');
    clicar(botao('Finalizar sem marcar'));
    const [sessao] = plans.historico();
    expect(sessao.registros!.length).toBe(1);
    expect(sessao.registros![0].series.length).toBe(3);
  });

  it('"Voltar ao treino" fecha a pergunta sem concluir', () => {
    proximo();
    clicar(botao('Finalizar treino'));
    clicar(botao('Voltar ao treino'));
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    expect(plans.historico().length).toBe(0);
  });

  it('com tudo marcado, conclui direto, sem perguntar', () => {
    clicar(botao('Marcar todos'));
    proximo();
    clicar(botao('Marcar todos'));
    clicar(botao('Finalizar treino'));
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    expect(plans.historico().length).toBe(1);
  });

  it('a chave fica na pergunta; ligada, da próxima vez marca o que falta e conclui sem perguntar', () => {
    expect(chave()).toBeNull();
    proximo();
    clicar(botao('Finalizar treino'));
    expect(chave().checked).toBeFalse();
    chave().click();
    fixture.detectChanges();
    expect(chave().checked).toBeTrue();
    expect(localStorage.getItem('app-workout:marcar-tudo-ao-finalizar:v1')).toBe('1');
    clicar(botao('Voltar ao treino'));
    clicar(botao('Finalizar treino'));
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    expect(plans.historico()[0].registros!.map((r) => r.series.length)).toEqual([3, 2]);
  });

  it('a chave já começa ligada se foi deixada assim antes', () => {
    localStorage.setItem('app-workout:marcar-tudo-ao-finalizar:v1', '1');
    fixture = TestBed.createComponent(Workout);
    fixture.componentRef.setInput('id', fichaId);
    fixture.detectChanges();
    proximo();
    clicar(botao('Finalizar treino'));
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    expect(plans.historico().length).toBe(1);
  });

  describe('série em foco', () => {
    const botaoAria = (rotulo: string) => el().querySelector(`[aria-label="${rotulo}"]`);

    it('começa na primeira série e avança para a próxima ao concluir', () => {
      expect(ok()!.textContent).toContain('Concluir série 1');
      expect(el().querySelector('.foco__rotulo')!.textContent).toContain('Série 1 de 3');
      clicar(ok());
      clicar(el().querySelector('.proxima__ir'));
      expect(ok()!.textContent).toContain('Concluir série 2');
    });

    it('− e + mudam a série em foco e copiam para as de baixo que ainda não foram feitas', () => {
      clicar(botaoAria('Aumentar carga'));
      expect(valores()).toEqual(['10×22,5', '10×22,5', '10×22,5']);
      clicar(botaoAria('Diminuir repetições'));
      expect(valores()).toEqual(['9×22,5', '9×22,5', '9×22,5']);
      expect(plans.emAndamento()?.series[0].map((x) => [x.reps, x.carga])).toEqual([[9, 22.5], [9, 22.5], [9, 22.5]]);
    });

    it('os valores nunca ficam abaixo de zero', () => {
      for (let i = 0; i < 12; i++) clicar(botaoAria('Diminuir repetições'));
      expect(valores()[0]).toBe('0×20');
    });

    it('escolher uma série na faixa traz os valores dela para edição', () => {
      clicar(celulas()[2]);
      expect(el().querySelector('.foco__rotulo')!.textContent).toContain('Série 3 de 3');
      expect(celulas()[2].classList.contains('celula--agora')).toBeTrue();
    });

    it('o rodapé mostra o nome do próximo exercício', () => {
      expect(el().querySelector('.proximo')!.textContent).toContain('x2');
    });

    it('a barra do topo tem um segmento por exercício e enche ao marcar', () => {
      const cheios = () => [...el().querySelectorAll('.seg__cheio')].map((e) => (e as HTMLElement).style.width);
      expect(cheios()).toEqual(['0%', '0%']);
      clicar(botao('Marcar todos'));
      expect(cheios()).toEqual(['100%', '0%']);
    });

    it('ao terminar o exercício, mostra o volume e a diferença para a última vez', () => {
      plans.registrarSessao(fichaId, [{ exerciseId: 'x1', series: [{ carga: 15, reps: 10 }, { carga: 15, reps: 10 }] }]);
      fixture.detectChanges();
      clicar(botao('Marcar todos'));
      const c = el().querySelector('.concluido')!;
      expect(c.textContent).toContain('Exercício concluído');
      expect(c.textContent).toContain('450 kg de volume');
      expect(c.textContent).toContain('+150 kg');
    });

    describe('descanso', () => {
      beforeEach(() => jasmine.clock().install().mockDate(new Date(2026, 9, 23, 10, 0, 0)));
      afterEach(() => jasmine.clock().uninstall());

      it('mostra o cartão de descanso e a próxima série; "Começar" o esconde sem parar o cronômetro', () => {
        clicar(ok());
        expect(el().querySelector('.descanso')).not.toBeNull();
        expect(el().querySelector('.proxima__valor')!.textContent).toContain('10 reps × 20 kg');
        clicar(el().querySelector('.proxima__ir'));
        expect(el().querySelector('.descanso')).toBeNull();
        jasmine.clock().tick(4000);
        fixture.detectChanges();
        expect(el().querySelector('.tempo--mini')!.textContent).toContain('00:04');
      });

      it('"Pular descanso" para o cronômetro; a próxima série fica sem descanso guardado', () => {
        clicar(ok());
        jasmine.clock().tick(5000);
        clicar(botao('Pular descanso'));
        expect(el().querySelector('.descanso')).toBeNull();
        expect(el().querySelector('.tempo')).toBeNull();
        clicar(ok());
        expect(plans.emAndamento()?.series[0][1].descanso).toBeUndefined();
      });

      it('−15 s e +15 s mudam o tempo de descanso previsto', () => {
        clicar(ok());
        clicar(botao('+15 s'));
        expect(el().querySelector('.anel__limite')!.textContent).toContain('01:15');
        expect(plans.emAndamento()?.descanso?.limite).toBe(75);
        clicar(botao('−15 s'));
        clicar(botao('−15 s'));
        expect(plans.emAndamento()?.descanso?.limite).toBe(45);
      });

      it('passando do limite, o anel avisa quanto passou e segue contando', () => {
        clicar(ok());
        jasmine.clock().tick(68000);
        fixture.detectChanges();
        expect(el().querySelector('.descanso')!.classList).toContain('estourou');
        expect(el().querySelector('.anel__limite')!.textContent).toContain('+00:08');
        expect(el().querySelector('.tempo')!.textContent!.trim()).toBe('01:08');
      });
    });
  });

  describe('séries a mais ou a menos no treino', () => {
    it('"Série extra" acrescenta uma série só neste treino, com os valores da última', () => {
      expect(celulas().length).toBe(3);
      clicar(botao('Série extra'));
      expect(celulas().length).toBe(4);
      expect(plans.emAndamento()?.qtdSeries?.[0]).toBe(4);
      expect(plans.get(fichaId)!.itens[0].series).toBe(3);
    });

    it('"Tirar série" remove a última e sempre deixa pelo menos uma', () => {
      clicar(botao('Tirar série'));
      clicar(botao('Tirar série'));
      expect(celulas().length).toBe(1);
      expect(botao('Tirar série')?.disabled).toBeTrue();
    });

    it('a série extra entra no que é gravado ao finalizar', () => {
      clicar(botao('Série extra'));
      [0, 1, 2, 3].forEach(marcar);
      expect(plans.emAndamento()?.series[0].filter((s) => s.feita).length).toBe(4);
    });
  });

  describe('cronômetro de descanso', () => {
    /** O cronômetro só aparece enquanto conta; parado, é 00:00. */
    const tempo = () => el().querySelector('.tempo')?.textContent?.trim() ?? '00:00';
    const passar = (ms: number) => {
      jasmine.clock().tick(ms);
      fixture.detectChanges();
    };

    beforeEach(() => jasmine.clock().install().mockDate(new Date(2026, 9, 23, 10, 0, 0)));
    afterEach(() => jasmine.clock().uninstall());

    it('marcar uma série que não é a última inicia o cronômetro', () => {
      marcar(0);
      passar(3000);
      expect(tempo()).toBe('00:03');
    });

    it('marcar a última série do exercício zera o cronômetro e o deixa parado', () => {
      [0, 1].forEach(marcar);
      passar(3000);
      marcar(2);
      passar(5000);
      expect(tempo()).toBe('00:00');
      proximo();
      passar(5000);
      expect(tempo()).toBe('00:00');
    });

    it('a primeira série do exercício seguinte não guarda descanso', () => {
      [0, 1, 2].forEach(marcar);
      passar(5000);
      proximo();
      marcar(0);
      const salvo = plans.emAndamento()?.series[1][0];
      expect(salvo?.descanso).toBeUndefined();
    });

    it('trocar de exercício não interrompe nem reinicia o cronômetro', () => {
      [0, 1].forEach(marcar);
      passar(5000);
      proximo();
      expect(tempo()).toBe('00:05');
      passar(2000);
      expect(tempo()).toBe('00:07');
      anterior();
      passar(1000);
      expect(tempo()).toBe('00:08');
    });

    it('marcar uma série no exercício seguinte reinicia a contagem', () => {
      [0, 1].forEach(marcar);
      passar(5000);
      proximo();
      marcar(0);
      expect(tempo()).toBe('00:00');
    });

    it('"Marcar todos" zera o cronômetro', () => {
      clicar(botao('Marcar todos'));
      passar(2000);
      expect(tempo()).toBe('00:00');
    });

    it('desmarcar uma série não mexe no cronômetro', () => {
      marcar(0);
      passar(4000);
      marcar(0);
      passar(1000);
      expect(tempo()).toBe('00:05');
    });

    it('ao ver as instruções de um exercício e voltar, o cronômetro seguiu contando', () => {
      [0, 1].forEach(marcar);
      passar(7000);
      fixture.destroy(); // vai para a tela do exercício, sem pausar
      jasmine.clock().tick(10000);
      fixture = TestBed.createComponent(Workout);
      fixture.componentRef.setInput('id', fichaId);
      fixture.detectChanges();
      fixture.detectChanges();
      expect(tempo()).toBe('00:17');
    });

    it('sair e voltar nos primeiros segundos não perde frações de segundo', () => {
      [0, 1].forEach(marcar);
      passar(1900);
      expect(tempo()).toBe('00:01');
      fixture.destroy();
      jasmine.clock().tick(900); // 2,8 s desde que a série foi marcada
      fixture = TestBed.createComponent(Workout);
      fixture.componentRef.setInput('id', fichaId);
      fixture.detectChanges();
      fixture.detectChanges();
      expect(tempo()).toBe('00:02');
    });

    it('várias saídas e voltas seguidas não atrasam o cronômetro', () => {
      [0, 1].forEach(marcar);
      for (let i = 0; i < 4; i++) {
        passar(900);
        fixture.destroy();
        jasmine.clock().tick(900);
        fixture = TestBed.createComponent(Workout);
        fixture.componentRef.setInput('id', fichaId);
        fixture.detectChanges();
        fixture.detectChanges();
      }
      // 4 × (0,9 + 0,9) = 7,2 s desde que a série foi marcada
      expect(tempo()).toBe('00:07');
    });

    it('se o app fechar ou reiniciar sem sair da tela, o cronômetro retoma contando o tempo fora', () => {
      [0, 1].forEach(marcar);
      passar(7000);
      // Sem destroy: a tela some de uma vez (app encerrado), só o que foi guardado sobrevive.
      jasmine.clock().tick(20000);
      const nova = TestBed.createComponent(Workout);
      nova.componentRef.setInput('id', fichaId);
      nova.detectChanges();
      nova.detectChanges();
      expect((nova.nativeElement as HTMLElement).querySelector('.tempo')?.textContent?.trim()).toBe('00:27');
      nova.destroy();
    });

    it('depois de pausar e continuar, o cronômetro segue de onde estava', () => {
      [0, 1].forEach(marcar);
      passar(7000);
      (fixture.componentInstance as unknown as { pausar(): void }).pausar();
      fixture.destroy();
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
    const linhas = () => celulas();
    const piscando = () => linhas().map((l) => l.classList.contains('pisca-a') || l.classList.contains('pisca-b'));
    const digitar = (linha: number, campo: 0 | 1, valor: string) => {
      clicar(celulas()[linha]);
      const input = el().querySelectorAll('.passos input')[campo] as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };

    it('mudar a carga de uma série faz piscar só as de baixo que mudaram sozinhas', () => {
      digitar(0, 1, '40');
      expect(piscando()).toEqual([false, true, true]);
    });

    it('séries já feitas não são alteradas e não piscam', () => {
      marcar(1);
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
      proximo();
      expect(piscando().some(Boolean)).toBeFalse();
    });
  });

  describe('último treino do exercício', () => {
    const botaoUltimo = () => botao('Último treino');

    it('sem treino anterior, não mostra o botão', () => {
      expect(botaoUltimo()).toBeUndefined();
    });

    it('abre o último treino com as séries em repetições × carga', () => {
      plans.registrarSessao(fichaId, [{ exerciseId: 'x1', series: [{ carga: 45, reps: 10 }, { carga: 47.5, reps: 8 }] }]);
      fixture.detectChanges();
      const dicas = [...el().querySelectorAll('.stp__dica')].map((d) => d.textContent!.trim());
      expect(dicas).toEqual(['Última vez: 10', 'Última vez: 45 kg']);
      clicar(botaoUltimo());
      const itens = [...el().querySelectorAll('.ultimo-lista li')].map((li) => li.textContent!.replace(/\s+/g, ' ').trim());
      expect(itens).toEqual(['1 10 × 45 kg', '2 8 × 47.5 kg']);
    });
  });

  it('o topo mostra só a letra e o nome do treino, sem o nome da ficha', () => {
    expect(el().querySelector('.rotulo')!.textContent!.trim()).toBe('Ficha A · Ficha A');
  });

  describe('repetições do último treino', () => {
    it('sem treino anterior, vêm da ficha', () => {
      expect(valores()).toEqual(['10×20', '10×20', '10×20']);
    });

    it('depois de um treino, repetem o que foi feito em cada série', () => {
      plans.registrarSessao(fichaId, [{ exerciseId: 'x1', series: [{ carga: 20, reps: 12 }, { carga: 20, reps: 9 }, { carga: 20, reps: 7 }] }]);
      fixture.detectChanges();
      expect(valores()).toEqual(['12×20', '9×20', '7×20']);
    });

    it('série extra repete a última', () => {
      plans.registrarSessao(fichaId, [{ exerciseId: 'x1', series: [{ carga: 20, reps: 12 }, { carga: 20, reps: 9 }, { carga: 20, reps: 7 }] }]);
      fixture.detectChanges();
      clicar(botao('Série extra'));
      expect(valores()).toEqual(['12×20', '9×20', '7×20', '7×20']);
    });

    it('"Usar" a carga sugerida volta as repetições para a meta da ficha', () => {
      plans.registrarSessao(fichaId, [{ exerciseId: 'x1', series: [{ carga: 40, reps: 12 }, { carga: 40, reps: 12 }, { carga: 40, reps: 12 }] }]);
      fixture.detectChanges();
      clicar(el().querySelector('.sugestao__botao') as HTMLElement);
      expect(valores()).toEqual(['10×42', '10×42', '10×42']);
    });
  });

  describe('sugestão de carga', () => {
    const sugestao = () => el().querySelector('.sugestao');
    const treinoAnterior = (series: [number, number][]) => {
      plans.registrarSessao(fichaId, [{ exerciseId: 'x1', series: series.map(([carga, reps]) => ({ carga, reps })) }]);
      fixture.detectChanges();
    };

    it('o x fecha a sugestão só daquele exercício', () => {
      treinoAnterior([[40, 10], [40, 10], [40, 10]]);
      expect(sugestao()).not.toBeNull();
      clicar(el().querySelector('.sugestao__fechar') as HTMLElement);
      expect(sugestao()).toBeNull();
    });

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
      expect(valores()).toEqual(['10×40', '10×40', '10×40']);
      clicar(botao('Usar 42 kg'));
      expect(valores()).toEqual(['10×42', '10×42', '10×42']);
      expect(sugestao()).toBeNull();
    });

    it('repetição abaixo da meta na última vez: não sugere', () => {
      treinoAnterior([[40, 10], [40, 10], [40, 8]]);
      expect(sugestao()).toBeNull();
    });

    it('depois de marcar uma série, o aviso some', () => {
      treinoAnterior([[40, 10], [40, 10], [40, 10]]);
      marcar(0);
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
      proximo();
      clicar(botao('Finalizar treino'));
      clicar(botao('Marcar e finalizar'));
      expect(plans.historico()[0].nota).toBe('treino pesado');
    });

    it('sem nota escrita, a sessão não ganha o campo', () => {
      clicar(botao('Marcar todos'));
      proximo();
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
    (el.querySelector('.foco__ok') as HTMLButtonElement).click();
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

describe('Workout — exercícios conjugados', () => {
  let fixture: ComponentFixture<Workout>;
  let plans: PlanService;
  let fichaId: string;

  const el = () => fixture.nativeElement as HTMLElement;
  const item = (exerciseId: string, extra: object = {}) => ({ exerciseId, series: 3, reps: 12, carga: 20, descanso: 60, ...extra });
  const celulas = () => [...el().querySelectorAll('.celula')] as HTMLButtonElement[];
  const ok = () => el().querySelector('.foco__ok');
  /** Conclui a rodada em foco (se o descanso está na tela, toca em "Começar" antes). */
  const concluir = () => {
    const comecar = el().querySelector('.proxima__ir');
    if (comecar) clicar(comecar);
    clicar(ok());
  };
  const proximo = () => clicar(el().querySelector('.proximo'));
  const anterior = () => clicar(el().querySelector('.anterior'));
  const botao = (texto: string) =>
    [...el().querySelectorAll('button')].find((b) => b.textContent?.replace(/\s+/g, ' ').trim() === texto) as HTMLButtonElement | undefined;
  const clicar = (e: Element | null | undefined) => {
    (e as HTMLElement).click();
    fixture.detectChanges();
  };
  const estado = () => plans.emAndamento()!;
  const feitas = (i: number) => (estado()?.series[i] ?? []).map((s) => !!s.feita);
  const tempo = () => el().querySelector('.tempo')?.textContent?.trim() ?? '00:00';

  function abrir(itens: object[]): void {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: SocialService, useValue: { ativo: signal(false) } }],
    });
    plans = TestBed.inject(PlanService);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    [{ id: fichaId }] = plans.criarComItens([{ nome: 'Braços', itens: itens as never }]);
    fixture = TestBed.createComponent(Workout);
    fixture.componentRef.setInput('id', fichaId);
    fixture.detectChanges();
  }

  const par = () => [item('rosca', { par: 'p', descanso: 30 }), item('triceps', { par: 'p', descanso: 90, carga: 25 }), item('martelo')];

  beforeEach(() => jasmine.clock().install().mockDate(new Date(2026, 10, 8, 10, 0, 0)));
  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.clear();
  });

  it('o par aparece numa tela só, sem rótulo, com uma rodada por vez em foco', () => {
    abrir(par());
    expect(el().querySelector('.conjugado-tag')).toBeNull();
    expect(el().querySelector('.posicao')!.textContent).toContain('Exercícios 1 e 2 de 3');
    expect([...el().querySelectorAll('.membro__nome')].length).toBe(2);
    expect([...el().querySelectorAll('.membro .rot')].map((r) => r.textContent!.trim())).toEqual(['A1', 'A2']);
    expect(celulas().length).toBe(3);
    expect(el().querySelector('.serie')).toBeNull();
    expect(celulas()[0].classList.contains('celula--agora')).toBeTrue();
    expect(el().querySelector('.foco__rotulo')!.textContent).toContain('Rodada 1 de 3');
    expect(ok()!.textContent).toContain('Concluir rodada 1');
  });

  it('tocar na imagem abre os detalhes do exercício, com a lupa como indicação', () => {
    abrir(par());
    const link = el().querySelector('.membro a.foto') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/exercicio/rosca');
    expect(link.querySelector('.lupa')).not.toBeNull();
  });

  it('concluir a rodada marca a série dos dois exercícios, mostra o descanso e depois a próxima rodada', () => {
    abrir(par());
    clicar(ok());
    expect(feitas(0)).toEqual([true, false, false]);
    expect(feitas(1)).toEqual([true, false, false]);
    expect(celulas()[0].classList.contains('celula--feita')).toBeTrue();
    expect(el().querySelector('.descanso')).not.toBeNull();
    expect(el().querySelector('.proxima__rotulo')!.textContent).toContain('Rodada 2 de 3');
    clicar(el().querySelector('.proxima__ir'));
    expect(el().querySelector('.descanso')).toBeNull();
    expect(el().querySelector('.foco__rotulo')!.textContent).toContain('Rodada 2 de 3');
    expect(celulas()[1].classList.contains('celula--agora')).toBeTrue();
  });

  it('o descanso começa ao marcar a rodada, com o tempo do par (o do segundo exercício)', () => {
    abrir(par());
    clicar(ok());
    jasmine.clock().tick(5000);
    fixture.detectChanges();
    expect(tempo()).toBe('00:05');
    expect(estado().descanso?.limite).toBe(90);
  });

  it('"Começar" esconde o descanso, mas o cronômetro segue e guarda um descanso só por rodada, na primeira série dela', () => {
    abrir(par());
    clicar(ok());
    jasmine.clock().tick(40000);
    concluir();
    expect(estado().series[0][1].descanso).toBe(40);
    expect(estado().series[1][1].descanso).toBeUndefined();
  });

  it('marcar a última rodada zera o cronômetro e mostra o exercício concluído', () => {
    abrir(par());
    for (let k = 0; k < 3; k++) {
      concluir();
      jasmine.clock().tick(2000);
      fixture.detectChanges();
    }
    expect(feitas(0)).toEqual([true, true, true]);
    expect(tempo()).toBe('00:00');
    expect(estado().descanso).toBeUndefined();
    expect(el().querySelector('.concluido')).not.toBeNull();
    expect(celulas().every((c) => c.classList.contains('celula--feita'))).toBeTrue();
  });

  it('escolher uma rodada feita e tocar no botão desmarca a rodada inteira', () => {
    abrir(par());
    clicar(ok());
    clicar(celulas()[0]);
    expect(ok()!.textContent).toContain('Desmarcar rodada 1');
    clicar(ok());
    expect(feitas(0)).toEqual([false, false, false]);
    expect(feitas(1)).toEqual([false, false, false]);
    expect(estado().series[0][0].descanso).toBeUndefined();
  });

  it('com séries diferentes, a rodada extra tem só o exercício que tem mais séries', () => {
    abrir([item('rosca', { par: 'p', series: 4 }), item('triceps', { par: 'p', series: 3 })]);
    expect(celulas().length).toBe(4);
    clicar(celulas()[3]);
    expect(el().querySelector('.sem-par')!.textContent).toContain('sem par nesta rodada');
    expect(el().querySelectorAll('.foco input').length).toBe(2);
    for (let k = 0; k < 4; k++) concluir();
    expect(feitas(0)).toEqual([true, true, true, true]);
    expect(feitas(1)).toEqual([true, true, true]);
    expect(tempo()).toBe('00:00');
  });

  it('o cardio em minutos pode ser um dos dois', () => {
    abrir([item('supino', { par: 'p', series: 3 }), item('esteira', { par: 'p', series: 3, reps: 3, unidade: 'min', carga: 0 })]);
    expect([...el().querySelectorAll('.vbox__valor small')].map((x) => x.textContent)).toContain('min');
    expect(el().querySelector('input[aria-label*="Minutos"]')).not.toBeNull();
  });

  it('editar reps de um exercício copia para as rodadas de baixo, só dele', () => {
    abrir(par());
    const reps = el().querySelectorAll('.linha-par input')[0] as HTMLInputElement;
    reps.value = '8';
    reps.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(estado().series[0].map((s) => s.reps)).toEqual([8, 8, 8]);
    expect(estado().series[1]).toBeUndefined();
  });

  it('os botões − e + mudam repetições e carga do exercício da linha', () => {
    abrir(par());
    const botoes = [...el().querySelectorAll('.linha-par')[1].querySelectorAll('.vbox__btn')] as HTMLButtonElement[];
    clicar(botoes[3]); // + carga de A2: 25 → 27,5
    clicar(botoes[0]); // − reps de A2: 12 → 11
    expect(estado().series[1].map((s) => [s.reps, s.carga])).toEqual([[11, 27.5], [11, 27.5], [11, 27.5]]);
    expect(estado().series[0]).toBeUndefined();
  });

  it('o menu ⋯ de cada exercício tem Série extra, Tirar série, Marcar todas e Notas', () => {
    abrir(par());
    clicar(el().querySelectorAll('[data-menu]')[1]);
    expect([...el().querySelectorAll('.menu button')].map((b) => b.textContent!.trim())).toEqual(['Série extra', 'Tirar série', 'Marcar todas as séries', 'Adicionar nota']);
    clicar(botao('Série extra'));
    expect(el().querySelector('.menu')).toBeNull();
    expect(celulas().length).toBe(4);
    clicar(celulas()[3]);
    expect(el().querySelector('.sem-par')).not.toBeNull();
    clicar(el().querySelectorAll('[data-menu]')[1]);
    clicar(botao('Tirar série'));
    expect(celulas().length).toBe(3);
  });

  it('Marcar todas as séries de um exercício marca só o dele', () => {
    abrir(par());
    clicar(el().querySelectorAll('[data-menu]')[0]);
    clicar(botao('Marcar todas as séries'));
    expect(feitas(0)).toEqual([true, true, true]);
    expect(estado().series[1]?.some((s) => s.feita) ?? false).toBeFalse();
  });

  it('a nota é de cada exercício do par', () => {
    abrir(par());
    clicar(el().querySelectorAll('[data-menu]')[1]);
    clicar(botao('Adicionar nota'));
    expect(el().querySelector('app-dialogo')!.textContent).toContain('Notas');
    const campo = el().querySelector('app-dialogo textarea') as HTMLTextAreaElement;
    campo.value = 'cabo na posição 3';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    clicar(botao('Salvar notas'));
    expect(plans.get(fichaId)!.itens[1].nota).toBe('cabo na posição 3');
    expect(plans.get(fichaId)!.itens[0].nota).toBeUndefined();
    expect(el().querySelector('.nota-fixa')!.textContent).toContain('cabo na posição 3');
  });

  it('Último treino é de cada exercício', () => {
    abrir(par());
    plans.registrarSessao(fichaId, [{ exerciseId: 'triceps', series: [{ carga: 25, reps: 10 }, { carga: 27.5, reps: 8 }] }]);
    fixture.detectChanges();
    const botoes = [...el().querySelectorAll('.membro button.ver')].filter((b) => b.textContent!.trim() === 'Último treino');
    expect(botoes.length).toBe(1); // só o tríceps tem treino anterior
    clicar(botoes[0]);
    const itens = [...el().querySelectorAll('.ultimo-lista li')].map((li) => li.textContent!.replace(/\s+/g, ' ').trim());
    expect(itens).toEqual(['1 10 × 25 kg', '2 8 × 27.5 kg']);
  });

  it('Próximo vai para o bloco seguinte e Anterior volta ao par', () => {
    abrir(par());
    proximo();
    expect(el().querySelector('.posicao')!.textContent).toContain('Exercício 3 de 3');
    expect(el().querySelector('.membro')).toBeNull();
    expect(celulas().length).toBe(3);
    expect(botao('Finalizar treino')).toBeDefined();
    anterior();
    expect(el().querySelector('.posicao')!.textContent).toContain('Exercícios 1 e 2 de 3');
    expect(el().querySelector('.membro')).not.toBeNull();
  });

  it('quando o próximo é um par, o botão mostra os dois nomes', () => {
    abrir([item('supino'), item('rosca', { par: 'p' }), item('triceps', { par: 'p' })]);
    const nomes = [...el().querySelectorAll('.proximo__texto b')].map((b) => b.textContent!.trim());
    expect(nomes).toEqual(['rosca', 'triceps']);
  });

  it('concluir grava os dois exercícios do par com as séries feitas', () => {
    abrir(par());
    for (let k = 0; k < 3; k++) concluir();
    proximo();
    clicar(celulas()[0]);
    clicar(ok());
    clicar(botao('Marcar todos'));
    clicar(botao('Finalizar treino'));
    const sessao = plans.historico().at(-1)!;
    expect(sessao.registros!.map((r) => [r.exerciseId, r.series.length])).toEqual([['rosca', 3], ['triceps', 3], ['martelo', 3]]);
    expect(plans.emAndamento()).toBeNull();
  });

  it('Finalizar com rodadas sem marcar pergunta se pode marcar o que falta', () => {
    abrir([item('rosca', { par: 'p' }), item('triceps', { par: 'p' })]);
    clicar(ok());
    clicar(botao('Finalizar treino'));
    expect(el().querySelector('[role="alertdialog"]')!.textContent).toContain('Faltam 4 séries');
  });

  it('o progresso conta blocos: um par vale uma etapa', () => {
    abrir(par());
    const barra = () => Number(el().querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow'));
    expect(barra()).toBe(0);
    for (let k = 0; k < 3; k++) concluir();
    expect(barra()).toBe(50); // o par (1 de 2 blocos) está pronto
  });

  it('a sugestão de carga aparece por exercício do par', () => {
    abrir([item('rosca', { par: 'p' }), item('triceps', { par: 'p', carga: 25 })]);
    plans.registrarSessao(fichaId, [{ exerciseId: 'rosca', series: [{ carga: 40, reps: 12 }, { carga: 40, reps: 12 }, { carga: 40, reps: 12 }] }]);
    fixture.detectChanges();
    const sugestoes = [...el().querySelectorAll('.sugestao')];
    expect(sugestoes.length).toBe(1);
    expect(sugestoes[0].textContent).toContain('42 kg');
    clicar(botao('Usar 42 kg'));
    expect(estado().series[0].map((s) => s.carga)).toEqual([42, 42, 42]);
    expect(el().querySelector('.sugestao')).toBeNull();
  });
});
