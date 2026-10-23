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
  const botao = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => /treino/i.test(b.textContent ?? '') && b.classList.contains('acao--texto'))!;

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
    expect(texto()).not.toContain('Supino reto');
    expect(botao().textContent).toContain('Ver treino');
  });

  it('seu treino abre pelo histórico do aparelho, com reps, carga e intervalo', () => {
    criar('eu');
    botao().click();
    fixture.detectChanges();
    expect(texto()).toContain('Supino reto');
    expect(texto()).toContain('22.5 kg');
    expect(texto()).toContain('1:15');
    expect(amigo.chamadas).toEqual([]);
    expect(botao().textContent).toContain('Ocultar treino');
  });

  it('treino de amigo: começa a ler os treinos dele, mostra "carregando" e depois o detalhe', () => {
    criar('ana');
    botao().click();
    fixture.detectChanges();
    expect(amigo.chamadas).toContain('ana');
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
