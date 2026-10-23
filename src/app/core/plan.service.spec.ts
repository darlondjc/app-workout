import { TestBed } from '@angular/core/testing';
import { ItemFicha } from './models';
import { PlanService } from './plan.service';

const item = (exerciseId: string, carga: number): ItemFicha => ({ exerciseId, series: 4, reps: 8, carga, descanso: 90 });

describe('PlanService: troca de exercício', () => {
  let plans: PlanService;
  let fichaId: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
    [{ id: fichaId }] = plans.criarComItens([{ nome: 'A', itens: [item('supino', 60), item('remada', 40)] }]);
  });

  const itens = () => plans.get(fichaId)!.itens;

  it('trocar na ficha mantém séries, repetições, carga e descanso', () => {
    plans.trocarNaFicha(fichaId, 0, 'supino-halter');
    expect(itens()[0]).toEqual({ exerciseId: 'supino-halter', series: 4, reps: 8, carga: 60, descanso: 90 });
    expect(itens()[1].exerciseId).toBe('remada');
  });

  it('trocar só no treino não mexe na ficha e vale apenas para esse treino', () => {
    plans.trocarNoTreino(fichaId, 0, 'supino-halter');
    expect(itens()[0].exerciseId).toBe('supino');
    expect(plans.exerciciosEfetivos(plans.get(fichaId)!)).toEqual(['supino-halter', 'remada']);

    plans.registrarSessao(fichaId);
    expect(plans.exerciciosEfetivos(plans.get(fichaId)!)).toEqual(['supino', 'remada']);
  });

  it('troca só no treino começa o treino se ainda não havia um', () => {
    expect(plans.emAndamento()).toBeNull();
    plans.trocarNoTreino(fichaId, 1, 'remada-maquina');
    expect(plans.emAndamento()?.fichaId).toBe(fichaId);
  });

  it('séries já marcadas do exercício trocado voltam a "não feitas", sem perder carga e repetições', () => {
    plans.andamento(fichaId, (a) => ({ ...a, series: { 0: [{ feita: true, carga: 70, reps: 6 }], 1: [{ feita: true, carga: 40, reps: 8 }] } }));
    plans.trocarNoTreino(fichaId, 0, 'supino-halter');
    expect(plans.emAndamento()?.series[0]).toEqual([{ feita: false, carga: 70, reps: 6 }]);
    expect(plans.emAndamento()?.series[1]).toEqual([{ feita: true, carga: 40, reps: 8 }]);
  });

  it('trocar na ficha desfaz a troca de treino da mesma posição, mas não a de outra', () => {
    plans.trocarNoTreino(fichaId, 0, 'so-no-treino');
    plans.trocarNoTreino(fichaId, 1, 'outra-so-no-treino');
    plans.trocarNaFicha(fichaId, 0, 'definitivo');
    expect(plans.exerciciosEfetivos(plans.get(fichaId)!)).toEqual(['definitivo', 'outra-so-no-treino']);
  });

  it('trocas de treino de uma ficha não afetam outra', () => {
    const [outra] = plans.criarComItens([{ nome: 'B', itens: [item('supino', 50)] }]);
    plans.trocarNoTreino(fichaId, 0, 'supino-halter');
    expect(plans.exerciciosEfetivos(plans.get(outra.id)!)).toEqual(['supino']);
  });
});

describe('PlanService.treinouHoje', () => {
  let plans: PlanService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
  });

  it('é falso sem treinos e verdadeiro depois de concluir um hoje', () => {
    const [f] = plans.criarComItens([{ nome: 'A', itens: [item('supino', 60)] }]);
    expect(plans.treinouHoje()).toBeFalse();
    plans.registrarSessao(f.id, []);
    expect(plans.treinouHoje()).toBeTrue();
  });

  it('treino de outro dia não conta', () => {
    plans.historico.set([{ id: 'x', data: '2020-01-01', fichaId: 'f' }]);
    expect(plans.treinouHoje()).toBeFalse();
  });
});

describe('PlanService: ficha em rascunho', () => {
  let plans: PlanService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
    plans.criarComItens([{ nome: 'A', itens: [item('supino', 60)] }]);
  });

  it('o rascunho não entra na lista de fichas nem muda a ficha ativa, mas é encontrado pelo id', () => {
    const ativa = plans.ativaId();
    const r = plans.criarRascunho('Ficha B');
    expect(plans.fichas().length).toBe(1);
    expect(plans.ativaId()).toBe(ativa);
    expect(plans.get(r.id)?.nome).toBe('Ficha B');
  });

  it('renomear o rascunho continua sem gravar', () => {
    const r = plans.criarRascunho('Ficha B');
    plans.renomear(r.id, 'Pernas');
    expect(plans.get(r.id)?.nome).toBe('Pernas');
    expect(plans.fichas().length).toBe(1);
  });

  it('o primeiro exercício grava a ficha, com o nome dado, e ela vira a ativa', () => {
    const r = plans.criarRascunho('Ficha B');
    plans.renomear(r.id, 'Pernas');
    plans.definirAtiva(r.id);
    const { ficha } = plans.adicionar('agachamento');
    expect(ficha.id).toBe(r.id);
    expect(plans.rascunho()).toBeNull();
    expect(plans.fichas().map((f) => f.nome)).toEqual(['A', 'Pernas']);
    expect(plans.get(r.id)?.itens.map((i) => i.exerciseId)).toEqual(['agachamento']);
    expect(plans.ativaId()).toBe(r.id);
  });

  it('descartar o rascunho não deixa rastro, e adicionar depois vai para a ficha ativa de antes', () => {
    const ativa = plans.ativaId();
    const r = plans.criarRascunho('Ficha B');
    plans.definirAtiva(r.id);
    plans.descartarRascunho();
    expect(plans.get(r.id)).toBeUndefined();
    const { ficha } = plans.adicionar('remada');
    expect(ficha.id).toBe(ativa!);
    expect(plans.fichas().length).toBe(1);
  });

  it('sem ter tocado em "Adicionar exercício" no rascunho, a biblioteca segue adicionando à ficha ativa', () => {
    plans.criarRascunho('Ficha B');
    const { ficha } = plans.adicionar('remada');
    expect(ficha.id).toBe(plans.ativaId()!);
    expect(plans.rascunho()).not.toBeNull();
  });
});
