import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExerciseService } from '../core/exercise.service';
import { Evento, Perfil } from '../core/social';
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
  let fixture: ComponentFixture<EventoCard>;

  function criar(autor: string): void {
    fixture = TestBed.createComponent(EventoCard);
    fixture.componentRef.setInput('evento', evento(autor));
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const botao = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.classList.contains('acao--texto'))!;
  const dialogo = () => (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');

  beforeEach(() => {
    amigo = { lista: signal<Record<string, Sessao[]>>({}), chamadas: [] };
    const eu = signal<Perfil | null>({ uid: 'eu', nome: 'Eu', foto: null });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SocialService,
          useValue: {
            eu,
            nomeDe: (_: string, n: string) => n,
            fotoDe: () => null,
            ouvirCurtidas: () => () => undefined,
            ouvirComentarios: () => () => undefined,
            sessoesDe: (uid: string) => {
              amigo.chamadas.push(uid);
              return amigo.lista()[uid] ?? [];
            },
            sessoesCarregadas: (uid: string) => uid in amigo.lista(),
          },
        },
        { provide: PlanService, useValue: { historico: signal<Sessao[]>([treino]) } },
        { provide: ExerciseService, useValue: { get: () => ({ id: 'supino' }), nome: () => 'Supino reto', imagem: () => 'x.jpg' } },
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
});
