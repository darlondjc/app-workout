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

describe('PlanService: foto do treino', () => {
  let plans: PlanService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
    plans.criarComItens([{ nome: 'A', itens: [item('supino', 60)] }]);
  });

  it('concluir devolve o id da sessão e, com foto, já a marca', () => {
    const id = plans.registrarSessao(plans.fichas()[0].id, [], true);
    const s = plans.historico().find((x) => x.id === id);
    expect(s?.temFoto).toBeTrue();
  });

  it('concluir sem foto não marca nada', () => {
    const id = plans.registrarSessao(plans.fichas()[0].id, []);
    expect(plans.historico().find((x) => x.id === id)?.temFoto).toBeUndefined();
  });

  it('marcar e desmarcar a foto de um treino só mexe nele', () => {
    const a = plans.registrarSessao(plans.fichas()[0].id, []);
    const b = plans.registrarSessao(plans.fichas()[0].id, []);
    plans.marcarFoto(a, true);
    expect(plans.historico().find((x) => x.id === a)?.temFoto).toBeTrue();
    expect(plans.historico().find((x) => x.id === b)?.temFoto).toBeUndefined();
    plans.marcarFoto(a, false);
    expect('temFoto' in plans.historico().find((x) => x.id === a)!).toBeFalse();
  });
});

describe('PlanService: criar fichas novas com as que já existem', () => {
  let plans: PlanService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
  });

  it('as fichas novas entram depois das atuais, sem alterar nenhuma delas', () => {
    const [antiga] = plans.criarComItens([{ nome: 'Minha ficha', itens: [item('supino', 60)] }]);
    const antes = JSON.stringify(plans.get(antiga.id));
    const novas = plans.criarComItens([
      { nome: 'Peito', itens: [item('crucifixo', 10)] },
      { nome: 'Costas', itens: [item('remada', 40)] },
    ]);
    expect(plans.fichas().map((f) => f.nome)).toEqual(['Minha ficha', 'Peito', 'Costas']);
    expect(JSON.stringify(plans.get(antiga.id))).toBe(antes);
    expect(plans.letra(antiga.id)).toBe('A');
    expect(novas.map((f) => plans.letra(f.id))).toEqual(['B', 'C']);
  });

  it('criarConjunto cria uma ficha com vários treinos A, B, C, sem mexer nas fichas soltas', () => {
    const [solta] = plans.criarComItens([{ nome: 'Antiga', itens: [item('supino', 60)] }]);
    const treinos = plans.criarConjunto('Divisão ABC', [
      { nome: 'Peito', itens: [item('supino', 60)] },
      { nome: 'Costas', itens: [item('remada', 40)] },
      { nome: 'Pernas', itens: [item('agachamento', 80)] },
    ]);
    expect(plans.fichas().length).toBe(4);
    expect(new Set(treinos.map((t) => t.conjunto!.id)).size).toBe(1);
    expect(treinos[0].conjunto!.nome).toBe('Divisão ABC');
    expect(plans.get(solta.id)!.conjunto).toBeUndefined();
    expect(treinos.map((t) => plans.letra(t.id))).toEqual(['A', 'B', 'C']);
    expect(plans.letra(solta.id)).toBe('A');
    expect(plans.rotulo(treinos[1].id)).toBe('Divisão ABC · Treino B');
    expect(plans.rotulo(solta.id)).toBe('Ficha A');
    expect(plans.ativaId()).toBe(treinos[0].id);
  });

  it('duas fichas com vários treinos têm letras próprias', () => {
    const a = plans.criarConjunto('Ficha 1', [{ nome: 'x', itens: [] }, { nome: 'y', itens: [] }]);
    const b = plans.criarConjunto('Ficha 2', [{ nome: 'x', itens: [] }, { nome: 'y', itens: [] }, { nome: 'z', itens: [] }]);
    expect(a.map((t) => plans.letra(t.id))).toEqual(['A', 'B']);
    expect(b.map((t) => plans.letra(t.id))).toEqual(['A', 'B', 'C']);
  });

  it('removerConjunto exclui só os treinos daquela ficha', () => {
    const [solta] = plans.criarComItens([{ nome: 'Antiga', itens: [item('supino', 60)] }]);
    const a = plans.criarConjunto('Ficha 1', [{ nome: 'x', itens: [] }, { nome: 'y', itens: [] }]);
    const b = plans.criarConjunto('Ficha 2', [{ nome: 'z', itens: [] }]);
    plans.removerConjunto(a[0].conjunto!.id);
    expect(plans.fichas().map((f) => f.id)).toEqual([solta.id, b[0].id]);
  });

  it('excluir um treino da ficha mantém os outros, que seguem juntos', () => {
    const t = plans.criarConjunto('Ficha 1', [{ nome: 'x', itens: [] }, { nome: 'y', itens: [] }, { nome: 'z', itens: [] }]);
    plans.remover(t[1].id);
    expect(plans.fichas().map((f) => f.nome)).toEqual(['x', 'z']);
    expect(plans.letra(t[2].id)).toBe('B');
  });

  it('adicionarTreino entra como o próximo treino da ficha atual, sem tocar nas outras fichas', () => {
    const [solta] = plans.criarComItens([{ nome: 'Antiga', itens: [item('supino', 60)] }]);
    const t = plans.criarConjunto('Divisão', [{ nome: 'x', itens: [] }, { nome: 'y', itens: [] }]);
    const outra = plans.criarComItens([{ nome: 'Outra', itens: [] }])[0];
    plans.definirAtiva(t[0].id);
    const r = plans.adicionarTreino('Treino do dia · 23/10', [item('rosca', 10)]);
    expect(r.ficha).toBe('Divisão');
    expect(plans.fichas().map((f) => f.nome)).toEqual(['Antiga', 'x', 'y', 'Treino do dia · 23/10', 'Outra']);
    expect(plans.letra(r.treino.id)).toBe('C');
    expect(plans.get(solta.id)!.conjunto).toBeUndefined();
    expect(plans.get(outra.id)!.conjunto).toBeUndefined();
    expect(plans.ativaId()).toBe(t[0].id);
  });

  it('adicionarTreino numa ficha de um treino só a transforma em ficha com dois treinos', () => {
    const [solta] = plans.criarComItens([{ nome: 'Circuito A', itens: [item('supino', 60)] }]);
    const r = plans.adicionarTreino('Treino do dia', [item('rosca', 10)]);
    expect(r.ficha).toBe('Circuito A');
    expect(plans.get(solta.id)!.conjunto!.id).toBe(r.treino.conjunto!.id);
    expect([plans.letra(solta.id), plans.letra(r.treino.id)]).toEqual(['A', 'B']);
    expect(plans.fichas().length).toBe(2);
  });

  it('adicionarTreino sem nenhuma ficha cria a primeira', () => {
    plans.adicionarTreino('Treino do dia', [item('rosca', 10)]);
    expect(plans.fichas().map((f) => f.nome)).toEqual(['Treino do dia']);
  });

  it('nomes iguais não se misturam: cada ficha continua sendo a sua', () => {
    const [a] = plans.criarComItens([{ nome: 'Peito', itens: [item('supino', 60)] }]);
    const [b] = plans.criarComItens([{ nome: 'Peito', itens: [item('crucifixo', 10)] }]);
    expect(a.id).not.toBe(b.id);
    expect(plans.get(a.id)!.itens[0].exerciseId).toBe('supino');
    expect(plans.fichas().length).toBe(2);
  });
});

describe('PlanService: atividade fora da ficha', () => {
  let plans: PlanService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
  });

  it('vale como o treino do dia, com o nome da atividade', () => {
    expect(plans.treinouHoje()).toBeFalse();
    const id = plans.registrarAtividade({ tipo: 'corrida', nome: 'Corrida', minutos: 30, distanciaKm: 5 }, true);
    expect(plans.treinouHoje()).toBeTrue();
    expect(plans.historico()).toEqual([jasmine.objectContaining({ id, fichaId: '', fichaNome: 'Corrida', temFoto: true, registros: [] })]);
  });

  it('não avança o rodízio das fichas', () => {
    const [a, b] = plans.criarComItens([
      { nome: 'A', itens: [item('supino', 60)] },
      { nome: 'B', itens: [item('remada', 40)] },
    ]);
    plans.registrarSessao(a.id);
    expect(plans.proxima()?.id).toBe(b.id);
    plans.registrarAtividade({ tipo: 'futebol', nome: 'Futebol', minutos: 60 });
    expect(plans.proxima()?.id).toBe(b.id);
  });
});
