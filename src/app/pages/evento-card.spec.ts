import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExerciseService } from '../core/exercise.service';
import { Comentario, Evento, Perfil } from '../core/social';
import { Sessao } from '../core/models';
import { PlanService } from '../core/plan.service';
import { SocialService } from '../core/social.service';
import { EventoCard } from './evento-card';

const evento = (autor: string): Evento => ({
  id: 'ev1',
  autor,
  autorNome: autor,
  autorFoto: null,
  tipo: 'treino',
  criadoEm: Date.now(),
  sessaoId: 's1',
  data: '2026-10-22',
  fichaNome: 'Peito',
  exercicios: 1,
  volume: 240,
  recordes: [],
});

const treino: Sessao = {
  id: 's1',
  data: '2026-10-22',
  fichaId: 'f',
  registros: [{ exerciseId: 'supino', series: [{ carga: 20, reps: 12 }, { carga: 22.5, reps: 10, descanso: 75 }] }],
};

describe('EventoCard: ver treino', () => {
  let amigo: { lista: ReturnType<typeof signal<Record<string, Sessao[]>>>; chamadas: string[] };
  let comentariosCb: ((c: Comentario[]) => void) | undefined;
  let apagar: jasmine.Spy;
  let fotos: Record<string, string>;
  let definirFoto: jasmine.Spy;
  let fixture: ComponentFixture<EventoCard>;

  function criar(autor: string, extra: Partial<Evento> = {}): void {
    fixture = TestBed.createComponent(EventoCard);
    fixture.componentRef.setInput('evento', { ...evento(autor), ...extra });
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const botao = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.classList.contains('acao--texto'))!;
  const dialogo = () => (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');

  beforeEach(() => {
    amigo = { lista: signal<Record<string, Sessao[]>>({}), chamadas: [] };
    const eu = signal<Perfil | null>({ uid: 'eu', nome: 'Eu', foto: null });
    comentariosCb = undefined;
    apagar = jasmine.createSpy('apagarComentario').and.resolveTo();
    fotos = {};
    definirFoto = jasmine.createSpy('definirFoto').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SocialService,
          useValue: {
            eu,
            nomeDe: (_: string, n: string) => n,
            fotoDe: () => null,
            ouvirCurtidas: () => () => undefined,
            ouvirComentarios: (_dono: string, _ev: string, cb: (c: Comentario[]) => void) => {
              comentariosCb = cb;
              return () => undefined;
            },
            apagarComentario: (...args: unknown[]) => apagar(...args),
            lerFoto: (uid: string, sessao: string) => Promise.resolve(fotos[`${uid}/${sessao}`] ?? null),
            definirFoto: (...args: unknown[]) => definirFoto(...args),
            sessoesDe: (uid: string) => {
              amigo.chamadas.push(uid);
              return amigo.lista()[uid] ?? [];
            },
            sessoesCarregadas: (uid: string) => uid in amigo.lista(),
          },
        },
        { provide: PlanService, useValue: { historico: signal<Sessao[]>([treino]) } },
        { provide: ExerciseService, useValue: { get: () => ({ id: 'supino', equipment: 'barbell', level: 'beginner' }), nome: () => 'Supino reto', imagem: () => 'x.jpg', equipamento: () => 'Barra', nivel: () => 'Iniciante' } },
      ],
    });
  });

  it('o detalhe começa fechado', () => {
    criar('eu');
    expect(dialogo()).toBeNull();
    expect(texto()).not.toContain('Supino reto');
    expect(botao().textContent).toContain('Ver treino');
  });

  it('seu treino abre num diálogo, pelo histórico do aparelho, com reps, carga e intervalo', () => {
    criar('eu');
    botao().click();
    fixture.detectChanges();
    expect(dialogo()).not.toBeNull();
    expect(dialogo()?.textContent).toContain('Peito');
    expect(dialogo()?.textContent).toContain('Você ·');
    expect(dialogo()?.textContent).toContain('Supino reto');
    expect(dialogo()?.textContent).toContain('22.5 kg');
    expect(dialogo()?.textContent).toContain('1:15');
    expect(amigo.chamadas).toEqual([]);
  });

  it('fecha com Esc, com o X e tocando fora', () => {
    criar('eu');
    const el = fixture.nativeElement as HTMLElement;
    botao().click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(dialogo()).toBeNull();

    botao().click();
    fixture.detectChanges();
    (el.querySelector('.x') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialogo()).toBeNull();

    botao().click();
    fixture.detectChanges();
    (el.querySelector('.fundo') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialogo()).toBeNull();
  });

  it('treino de amigo: começa a ler os treinos dele, mostra "carregando" e depois o detalhe', () => {
    criar('ana');
    botao().click();
    fixture.detectChanges();
    expect(amigo.chamadas).toContain('ana');
    expect(dialogo()?.textContent).toContain('ana ·'); // o serviço de mentira devolve o nome como veio
    expect(texto()).toContain('Carregando o treino');

    amigo.lista.set({ ana: [treino] });
    fixture.detectChanges();
    expect(texto()).toContain('Supino reto');
  });

  it('treino de amigo que não está entre os lidos avisa em vez de ficar vazio', () => {
    amigo.lista.set({ ana: [] });
    criar('ana');
    botao().click();
    fixture.detectChanges();
    expect(texto()).toContain('Não encontrei os detalhes');
  });
  describe('apagar comentário', () => {
    const meu: Comentario = { id: 'c1', autor: 'eu', autorNome: 'Eu', autorFoto: null, texto: 'Boa, treino forte!', criadoEm: 1 };
    const el = () => fixture.nativeElement as HTMLElement;

    function abrirComentarios(): void {
      comentariosCb?.([meu]);
      (el().querySelectorAll('.acao')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    const xApagar = () => el().querySelector('.apagar') as HTMLButtonElement;
    const botoesDialogo = () => [...el().querySelectorAll('[role="dialog"] .confirma button')] as HTMLButtonElement[];

    it('o X só pede confirmação: nada é apagado antes de confirmar', () => {
      criar('eu');
      abrirComentarios();
      xApagar().click();
      fixture.detectChanges();
      expect(dialogo()).not.toBeNull();
      expect(dialogo()?.textContent).toContain('Apagar comentário?');
      expect(dialogo()?.textContent).toContain('Boa, treino forte!');
      expect(dialogo()?.textContent).toContain('Seu comentário');
      expect(apagar).not.toHaveBeenCalled();
    });

    it('confirmar apaga o comentário e fecha o diálogo', () => {
      criar('eu');
      abrirComentarios();
      xApagar().click();
      fixture.detectChanges();
      botoesDialogo()[0].click();
      fixture.detectChanges();
      expect(apagar).toHaveBeenCalledOnceWith('eu', 'ev1', meu);
      expect(dialogo()).toBeNull();
    });

    it('cancelar, Esc e tocar fora não apagam', () => {
      criar('eu');
      abrirComentarios();
      xApagar().click();
      fixture.detectChanges();
      botoesDialogo()[1].click();
      fixture.detectChanges();
      expect(dialogo()).toBeNull();

      xApagar().click();
      fixture.detectChanges();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(dialogo()).toBeNull();

      xApagar().click();
      fixture.detectChanges();
      (el().querySelector('.fundo') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialogo()).toBeNull();
      expect(apagar).not.toHaveBeenCalled();
    });

    it('dono do treino apagando o comentário de um amigo: o diálogo diz de quem é', () => {
      criar('eu');
      comentariosCb?.([{ ...meu, id: 'c2', autor: 'ana', autorNome: 'ana', texto: 'Parabéns!' }]);
      (el().querySelectorAll('.acao')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      xApagar().click();
      fixture.detectChanges();
      expect(dialogo()?.textContent).toContain('Comentário de ana');
    });
  });
  describe('imagem do exercício no detalhe', () => {
    const dialogos = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="dialog"]')];
    const abrirExercicio = () => ((fixture.nativeElement as HTMLElement).querySelector('.ex__topo') as HTMLButtonElement);

    function abrirDetalhe(): void {
      criar('eu');
      botao().click();
      fixture.detectChanges();
    }

    it('foto e nome formam um botão que abre a imagem de execução por cima do treino', () => {
      abrirDetalhe();
      const b = abrirExercicio();
      expect(b.querySelector('img')).not.toBeNull();
      expect(b.textContent).toContain('Supino reto');
      expect(b.getAttribute('aria-label')).toBe('Ver imagem de Supino reto');
      expect(dialogos().length).toBe(1);

      b.click();
      fixture.detectChanges();
      expect(dialogos().length).toBe(2);
      const imagem = dialogos()[1];
      expect(imagem.textContent).toContain('Supino reto');
      expect(imagem.textContent).toContain('Barra · Iniciante');
      expect(imagem.querySelector('app-exercise-image')).not.toBeNull();
    });

    it('Esc fecha só a imagem; o treino continua aberto', () => {
      abrirDetalhe();
      abrirExercicio().click();
      fixture.detectChanges();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(dialogos().length).toBe(1);
      expect(dialogos()[0].textContent).toContain('Supino reto');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(dialogos().length).toBe(0);
    });

    it('o X da imagem a fecha e o foco volta para o botão do exercício', async () => {
      abrirDetalhe();
      abrirExercicio().focus();
      abrirExercicio().click();
      fixture.detectChanges();
      await fixture.whenStable();
      ((dialogos()[1] as HTMLElement).querySelector('.x') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialogos().length).toBe(1);
      expect(document.activeElement).toBe(abrirExercicio());
    });

    it('fechar o treino também fecha a imagem', () => {
      abrirDetalhe();
      abrirExercicio().click();
      fixture.detectChanges();
      ((dialogos()[0] as HTMLElement).querySelector('.x') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialogos().length).toBe(0);
    });
  });

  describe('foto do treino', () => {
    const FOTO = 'data:image/jpeg;base64,/9j/AAAA';
    const el = () => fixture.nativeElement as HTMLElement;
    const imagem = () => el().querySelector('.foto img') as HTMLImageElement | null;
    const pronto = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('treino sem foto não mostra imagem; o dono vê o botão para adicionar, o amigo não', () => {
      criar('eu');
      expect(el().querySelector('.foto')).toBeNull();
      expect(el().querySelector('app-foto-botao')).not.toBeNull();
      criar('ana');
      expect(el().querySelector('app-foto-botao')).toBeNull();
    });

    it('com temFoto, lê e mostra a foto no card', async () => {
      fotos['ana/s1'] = FOTO;
      criar('ana', { temFoto: true });
      await pronto();
      expect(imagem()?.src).toBe(FOTO);
      expect(imagem()?.alt).toContain('Peito');
      expect(el().querySelector('.foto__x')).toBeNull(); // amigo não remove
    });

    it('aviso de foto sem foto na nuvem some, sem deixar um quadro vazio', async () => {
      criar('ana', { temFoto: true });
      await pronto();
      expect(el().querySelector('.foto')).toBeNull();
    });

    it('o dono adiciona uma foto: grava e já mostra', async () => {
      criar('eu');
      fixture.debugElement.query((d) => d.name === 'app-foto-botao').triggerEventHandler('escolhida', FOTO);
      await pronto();
      expect(definirFoto).toHaveBeenCalledOnceWith(jasmine.objectContaining({ id: 'ev1' }), FOTO);
      expect(imagem()?.src).toBe(FOTO);
      expect(el().querySelector('app-foto-botao')).toBeNull();
    });

    it('se o envio falha, avisa e não mostra a foto', async () => {
      definirFoto.and.resolveTo(false);
      criar('eu');
      fixture.debugElement.query((d) => d.name === 'app-foto-botao').triggerEventHandler('escolhida', FOTO);
      await pronto();
      expect(imagem()).toBeNull();
      expect(el().querySelector('.erro-foto')?.textContent).toContain('Não consegui enviar');
    });

    it('remover a foto pede confirmação antes de apagar', async () => {
      fotos['eu/s1'] = FOTO;
      criar('eu', { temFoto: true });
      await pronto();
      (el().querySelector('.foto__x') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelector('[role="dialog"]')?.textContent).toContain('Remover foto?');
      expect(definirFoto).not.toHaveBeenCalled();

      const cancelar = [...el().querySelectorAll('[role="dialog"] button')].find((b) => b.textContent?.trim() === 'Cancelar') as HTMLButtonElement;
      cancelar.click();
      fixture.detectChanges();
      expect(definirFoto).not.toHaveBeenCalled();
      expect(imagem()).not.toBeNull();

      (el().querySelector('.foto__x') as HTMLButtonElement).click();
      fixture.detectChanges();
      const remover = [...el().querySelectorAll('[role="dialog"] button')].find((b) => b.textContent?.trim() === 'Remover') as HTMLButtonElement;
      remover.click();
      await pronto();
      expect(definirFoto).toHaveBeenCalledOnceWith(jasmine.objectContaining({ id: 'ev1' }), null);
      expect(imagem()).toBeNull();
    });
  });
});
