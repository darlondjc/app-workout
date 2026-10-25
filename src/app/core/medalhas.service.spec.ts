import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExerciseService } from './exercise.service';
import { MedalhasService } from './medalhas.service';
import { Sessao } from './models';
import { PlanService, dataLocal } from './plan.service';

const CHAVE = 'app-workout:medalhas:v1';
let n = 0;

/** Treino de `atras` dias para trás, com uma série. */
function sessao(atras: number): Sessao {
  const d = new Date();
  d.setDate(d.getDate() - atras);
  return { id: `s${++n}`, data: dataLocal(d), fichaId: 'f1', concluidaEm: d.getTime() + n, registros: [{ exerciseId: 'x', series: [{ carga: 20, reps: 10 }] }] };
}

/** `quantos` treinos em dias seguidos, terminando hoje. */
const treinos = (quantos: number) => Array.from({ length: quantos }, (_, i) => sessao(quantos - 1 - i));

function montar(historico: Sessao[]) {
  localStorage.setItem('app-workout:historico:v1', JSON.stringify(historico));
  TestBed.configureTestingModule({ providers: [{ provide: ExerciseService, useValue: { ready: signal(true), get: () => undefined } }] });
  const plans = TestBed.inject(PlanService);
  const medalhas = TestBed.inject(MedalhasService);
  TestBed.tick();
  return { plans, medalhas };
}

const nivelDe = (m: MedalhasService, id: string) => m.conquistas().find((c) => c.id === id)?.nivel ?? null;
const guardado = () => JSON.parse(localStorage.getItem(CHAVE) ?? 'null');

describe('MedalhasService', () => {
  beforeEach(() => localStorage.clear());

  it('no primeiro uso calcula e guarda as medalhas, sem marcar nada como novo', () => {
    const { medalhas } = montar(treinos(5));
    expect(nivelDe(medalhas, 'treinos')).toBe('bronze');
    expect(medalhas.novas()).toEqual([]);
    expect(guardado().conquistas.length).toBeGreaterThan(0);
  });

  it('ao concluir um treino, devolve e guarda o nível que subiu', () => {
    const { plans, medalhas } = montar(treinos(4));
    expect(nivelDe(medalhas, 'treinos')).toBeNull();

    const nova = sessao(0);
    plans.historico.update((h) => [...h, nova]);
    const ganhos = medalhas.aposTreino(nova.id!);

    expect(ganhos.find((g) => g.id === 'treinos')?.nivel).toBe('bronze');
    expect(nivelDe(medalhas, 'treinos')).toBe('bronze');
    expect(medalhas.idsNovos()).toContain('treinos');
    expect(guardado().novas.some((x: { id: string }) => x.id === 'treinos')).toBeTrue();
  });

  it('ganhosDoTreino diz o que um treino já concluído fez subir, sem mexer no que está guardado', () => {
    const todos = treinos(5);
    const { medalhas } = montar(todos);
    const antes = guardado();
    expect(medalhas.ganhosDoTreino(todos, todos[4]).find((g) => g.id === 'treinos')).toEqual(jasmine.objectContaining({ nivel: 'bronze', titulo: jasmine.any(String) }));
    expect(medalhas.ganhosDoTreino(todos, todos[0])).toEqual([]);
    expect(guardado()).toEqual(antes);
  });

  it('conquistasDe calcula as medalhas de qualquer histórico', () => {
    const { medalhas } = montar([]);
    expect(medalhas.conquistasDe(treinos(5), 3).find((c) => c.id === 'treinos')?.nivel).toBe('bronze');
  });

  it('treino que não muda nenhum nível não gera novas', () => {
    const { plans, medalhas } = montar(treinos(6));
    const nova = sessao(0);
    plans.historico.update((h) => [...h, nova]);
    expect(medalhas.aposTreino(nova.id!).find((g) => g.id === 'treinos')).toBeUndefined();
    expect(medalhas.idsNovos()).not.toContain('treinos');
  });

  it('treino que chega de outro aparelho também marca o nível novo', () => {
    const { plans, medalhas } = montar(treinos(4));
    plans.historico.update((h) => [...h, sessao(0)]);
    TestBed.tick();
    expect(nivelDe(medalhas, 'treinos')).toBe('bronze');
    expect(medalhas.idsNovos()).toContain('treinos');
  });

  it('recalcular por mudança externa mantém as novas que já estavam pendentes', () => {
    const { plans, medalhas } = montar(treinos(4));
    const quinta = sessao(0);
    plans.historico.update((h) => [...h, quinta]);
    medalhas.aposTreino(quinta.id!);
    plans.historico.update((h) => [...h, sessao(0)]);
    TestBed.tick();
    expect(medalhas.idsNovos()).toContain('treinos');
  });

  it('reconhecer apaga as novas, inclusive do que está guardado', () => {
    const { plans, medalhas } = montar(treinos(4));
    const nova = sessao(0);
    plans.historico.update((h) => [...h, nova]);
    medalhas.aposTreino(nova.id!);
    medalhas.reconhecer();
    expect(medalhas.novas()).toEqual([]);
    expect(guardado().novas).toEqual([]);
    expect(nivelDe(medalhas, 'treinos')).toBe('bronze');
  });

  it('novas antigas deixam de aparecer', () => {
    localStorage.setItem(CHAVE, JSON.stringify({ v: 1, base: 'x', conquistas: [], novas: [{ id: 'treinos', nivel: 'bronze', em: '2020-01-01' }] }));
    const { medalhas } = montar(treinos(5));
    expect(medalhas.novas()).toEqual([]);
  });

  it('limpar apaga o que está guardado e esvazia as medalhas', () => {
    const { medalhas } = montar(treinos(5));
    medalhas.limpar();
    expect(localStorage.getItem(CHAVE)).toBeNull();
    expect(medalhas.conquistas()).toEqual([]);
  });

  it('ignora um guardado corrompido e recalcula', () => {
    localStorage.setItem(CHAVE, '{não é json');
    const { medalhas } = montar(treinos(5));
    expect(nivelDe(medalhas, 'treinos')).toBe('bronze');
  });
});
