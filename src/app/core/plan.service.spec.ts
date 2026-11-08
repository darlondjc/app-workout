import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExerciseService } from './exercise.service';
import { FavoritosService } from './favoritos.service';
import { Exercise, ItemFicha } from './models';
import { PlanService, dataLocal } from './plan.service';

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

  it('concluir um treino em andamento grava a duração em minutos', () => {
    const fichaId = plans.fichas()[0].id;
    plans.andamento(fichaId, (a) => ({ ...a, iniciadoEm: Date.now() - 45 * 60000 }));
    const id = plans.registrarSessao(fichaId, []);
    expect(plans.historico().find((x) => x.id === id)?.duracaoMin).toBe(45);
  });

  it('concluir sem treino em andamento não inventa duração', () => {
    const id = plans.registrarSessao(plans.fichas()[0].id, []);
    expect('duracaoMin' in plans.historico().find((x) => x.id === id)!).toBeFalse();
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

  it('as fichas novas entram depois das atuais, sem alterar nenhuma delas (a antiga só é encerrada hoje)', () => {
    const [antiga] = plans.criarComItens([{ nome: 'Minha ficha', itens: [item('supino', 60)] }]);
    const antes = JSON.stringify({ ...plans.get(antiga.id), fim: dataLocal() });
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
    plans.reativarBloco(t[0].conjunto!.id);
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

  it('adicionarTreino com a ficha indicada entra nela, mesmo que a ativa seja outra', () => {
    const t = plans.criarConjunto('Divisão', [{ nome: 'x', itens: [] }, { nome: 'y', itens: [] }]);
    const outra = plans.criarComItens([{ nome: 'Outra', itens: [] }])[0];
    const r = plans.adicionarTreino('Novo', [item('rosca', 10)], t[0].conjunto!.id);
    expect(r.ficha).toBe('Divisão');
    expect(plans.fichas().map((f) => f.nome)).toEqual(['x', 'y', 'Novo', 'Outra']);
    expect(plans.get(outra.id)!.conjunto).toBeUndefined();
  });

  it('treino em rascunho de uma ficha só é gravado no primeiro exercício, dentro dela e sem encerrar as outras', () => {
    const t = plans.criarConjunto('Divisão', [{ nome: 'x', itens: [] }, { nome: 'y', itens: [] }]);
    const r = plans.criarRascunho('Treino C', t[0].conjunto);
    expect(plans.fichas().length).toBe(2);
    expect(plans.rotulo(r.id)).toBe('Divisão · Novo treino');
    plans.definirAtiva(r.id);
    plans.adicionar('rosca');
    expect(plans.fichas().map((f) => f.nome)).toEqual(['x', 'y', 'Treino C']);
    expect(plans.letra(r.id)).toBe('C');
    expect(plans.get(r.id)!.fim).toBe(plans.get(t[0].id)!.fim);
    expect(plans.blocosAtivos().length).toBe(1);
  });

  it('reordenarItem leva o exercício para a nova posição, mantendo os demais na ordem', () => {
    const [f] = plans.criarComItens([{ nome: 'A', itens: [item('a', 1), item('b', 1), item('c', 1), item('d', 1)] }]);
    plans.reordenarItem(f.id, 0, 2);
    expect(plans.get(f.id)!.itens.map((i) => i.exerciseId)).toEqual(['b', 'c', 'a', 'd']);
    plans.reordenarItem(f.id, 3, 1);
    expect(plans.get(f.id)!.itens.map((i) => i.exerciseId)).toEqual(['b', 'd', 'c', 'a']);
    plans.reordenarItem(f.id, 1, 9);
    expect(plans.get(f.id)!.itens.map((i) => i.exerciseId)).toEqual(['b', 'd', 'c', 'a']);
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

describe('PlanService: corrigir e apagar treinos do histórico', () => {
  let plans: PlanService;
  const serie = { carga: 20, reps: 10 };
  const reg = (id: string) => ({ exerciseId: id, series: [serie, serie] });
  let sid: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
    const [f] = plans.criarComItens([{ nome: 'A', itens: [] }]);
    sid = plans.registrarSessao(f.id, [reg('supino'), reg('remada')]);
  });

  it('editarSessao troca as séries e a nota e marca a hora da correção', () => {
    plans.editarSessao(sid, { registros: [{ exerciseId: 'supino', series: [{ carga: 30, reps: 8 }] }], nota: '  ombro ok  ' });
    const s = plans.historico()[0];
    expect(s.registros).toEqual([{ exerciseId: 'supino', series: [{ carga: 30, reps: 8 }] }]);
    expect(s.nota).toBe('ombro ok');
    expect(s.editadaEm).toBeGreaterThan(0);
    plans.editarSessao(sid, { registros: s.registros!, nota: '' });
    expect(plans.historico()[0].nota).toBeUndefined();
  });

  it('excluirSessao tira do histórico e deixa um marcador para sincronizar', () => {
    plans.excluirSessao(sid);
    expect(plans.historico().length).toBe(0);
    const marcadores = plans.sessoesParaSincronizar();
    expect(marcadores.length).toBe(1);
    expect(marcadores[0]).toEqual(jasmine.objectContaining({ id: sid, excluida: true }));
    expect(plans.ultimoRegistro('supino')).toBeUndefined();
  });

  it('um treino apagado não volta quando a nuvem ainda o tem', () => {
    const antes = plans.historico()[0];
    plans.excluirSessao(sid);
    plans.mesclarSessoes([antes]);
    expect(plans.historico().length).toBe(0);
  });

  it('o marcador de apagado vindo de outro aparelho remove o treino daqui', () => {
    plans.mesclarSessoes([{ id: sid, data: '2026-10-20', fichaId: '', excluida: true, editadaEm: 99 }]);
    expect(plans.historico().length).toBe(0);
  });

  it('restaurarSessao desfaz a exclusão com uma versão mais nova que a do marcador', () => {
    const apagada = plans.excluirSessao(sid)!;
    const marcador = plans.sessoesParaSincronizar()[0];
    plans.restaurarSessao(apagada);
    expect(plans.historico().map((s) => s.id)).toEqual([sid]);
    const [volta] = plans.sessoesParaSincronizar();
    expect(volta.excluida).toBeUndefined();
    expect(volta.editadaEm!).toBeGreaterThan(marcador.editadaEm!);
    expect(plans.ultimoRegistro('supino')).toBeDefined();
  });

  it('o eco atrasado da exclusão não apaga o treino já restaurado', () => {
    const apagada = plans.excluirSessao(sid)!;
    const marcador = plans.sessoesParaSincronizar()[0];
    plans.restaurarSessao(apagada);
    plans.mesclarSessoes([marcador]);
    expect(plans.historico().length).toBe(1);
  });

  it('a correção feita em outro aparelho vale se for mais nova; a mais velha não', () => {
    const base = plans.historico()[0];
    plans.mesclarSessoes([{ ...base, nota: 'de fora', editadaEm: 100 }]);
    expect(plans.historico()[0].nota).toBe('de fora');
    plans.mesclarSessoes([{ ...base, nota: 'velha', editadaEm: 50 }]);
    expect(plans.historico()[0].nota).toBe('de fora');
  });
});

describe('PlanService: carga da ficha acompanha o último treino', () => {
  let plans: PlanService;
  let fichaId: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
    [{ id: fichaId }] = plans.criarComItens([{ nome: 'A', itens: [item('supino', 0), item('remada', 40)] }]);
  });

  const cargas = () => plans.get(fichaId)!.itens.map((i) => i.carga);

  it('depois de concluir, a ficha passa a mostrar a carga usada', () => {
    plans.registrarSessao(fichaId, [{ exerciseId: 'supino', series: [{ carga: 47.5, reps: 8 }, { carga: 47.5, reps: 8 }] }]);
    expect(cargas()).toEqual([47.5, 40]);
  });

  it('não mexe em repetições e séries da ficha', () => {
    plans.registrarSessao(fichaId, [{ exerciseId: 'supino', series: [{ carga: 50, reps: 12 }] }]);
    expect(plans.get(fichaId)!.itens[0]).toEqual(jasmine.objectContaining({ series: 4, reps: 8, carga: 50 }));
  });

  it('carga zero, exercício em minutos e exercício que não está na ficha não alteram nada', () => {
    plans.registrarSessao(fichaId, [
      { exerciseId: 'supino', series: [{ carga: 0, reps: 10 }] },
      { exerciseId: 'remada', unidade: 'min', series: [{ carga: 99, reps: 20 }] },
      { exerciseId: 'trocado', series: [{ carga: 30, reps: 10 }] },
    ]);
    expect(cargas()).toEqual([0, 40]);
  });
});

describe('PlanService: ajuste único das cargas das fichas antigas', () => {
  it('na primeira abertura, a ficha recebe a carga do último treino; depois disso, edições valem', () => {
    localStorage.clear();
    const ficha = { id: 'f1', nome: 'A', itens: [{ exerciseId: 'supino', series: 3, reps: 10, carga: 0, descanso: 60 }] };
    localStorage.setItem('app-workout:fichas:v1', JSON.stringify([ficha]));
    localStorage.setItem('app-workout:historico:v1', JSON.stringify([
      { id: 's1', data: '2026-10-01', fichaId: 'f1', registros: [{ exerciseId: 'supino', series: [{ carga: 40, reps: 10 }] }] },
      { id: 's2', data: '2026-11-01', fichaId: 'f1', registros: [{ exerciseId: 'supino', series: [{ carga: 47.5, reps: 8 }] }] },
    ]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const plans = TestBed.inject(PlanService);
    expect(plans.get('f1')!.itens[0].carga).toBe(47.5);

    plans.editarItem('f1', 0, 'carga', 10);
    TestBed.flushEffects();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(PlanService).get('f1')!.itens[0].carga).toBe(10);
  });
});

describe('PlanService: próximo treino sugerido', () => {
  let plans: PlanService;
  let ids: string[];

  const ex = (id: string, primaryMuscles: string[]) =>
    ({ id, name: id, category: 'strength', primaryMuscles, secondaryMuscles: [], instructions: [], images: [] }) as unknown as Exercise;
  const feito = (exerciseId: string) => [{ exerciseId, series: [{ carga: 20, reps: 10 }, { carga: 20, reps: 10 }, { carga: 20, reps: 10 }] }];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(ExerciseService).exercises.set([ex('supino', ['chest']), ex('remada', ['middle back']), ex('agachamento', ['quadriceps'])]);
    plans = TestBed.inject(PlanService);
    ids = plans.criarConjunto('Divisão', [
      { nome: 'A', itens: [item('supino', 0)] },
      { nome: 'B', itens: [item('remada', 0)] },
      { nome: 'C', itens: [item('agachamento', 0)] },
    ]).map((f) => f.id);
    TestBed.flushEffects();
  });

  it('ao concluir um treino, recalcula pelos músculos menos trabalhados da ficha', () => {
    plans.registrarSessao(ids[0], feito('supino'));
    // Costas e pernas estão frios; vale o rodízio depois de A.
    expect(plans.proxima()?.id).toBe(ids[1]);
    plans.registrarSessao(ids[1], feito('remada'));
    expect(plans.proxima()?.id).toBe(ids[2]);
  });

  it('só muda ao concluir um treino ou salvar um treino da ficha: mudar o histórico por fora não mexe', () => {
    plans.registrarSessao(ids[0], feito('supino'));
    expect(plans.proxima()?.id).toBe(ids[1]);
    // Costas ficam quentes sem passar pelos dois momentos: a sugestão guardada continua a mesma.
    plans.historico.update((h) => [...h, { id: 'x', data: dataLocal(), fichaId: '', registros: feito('remada') }]);
    TestBed.flushEffects();
    expect(plans.proxima()?.id).toBe(ids[1]);
  });

  it('ao salvar um treino da ficha ativa, recalcula: a mudança pode trazer músculos frios', () => {
    plans.registrarSessao(ids[0], feito('supino'));
    expect(plans.proxima()?.id).toBe(ids[1]); // B (costas)
    // B passa a ter um exercício de peito, que está quente: as pernas (C) viram a melhor opção.
    plans.trocarNaFicha(ids[1], 0, 'supino');
    TestBed.flushEffects();
    expect(plans.proxima()?.id).toBe(ids[2]);
  });

  it('salvar um treino de outra ficha não recalcula a sugestão', () => {
    plans.registrarSessao(ids[0], feito('supino'));
    expect(plans.proxima()?.id).toBe(ids[1]);
    plans.historico.update((h) => [...h, { id: 'y', data: dataLocal(), fichaId: '', registros: feito('remada') }]);
    const [outra] = plans.criarComItens([{ nome: 'Solta', itens: [item('supino', 0)] }]);
    plans.blocos().forEach((b) => plans.reativarBloco(b.chave)); // criar uma ficha nova vence as anteriores
    plans.definirAtiva(ids[0]);
    TestBed.flushEffects();
    plans.trocarNaFicha(outra.id, 0, 'remada');
    TestBed.flushEffects();
    expect(plans.proxima()?.id).toBe(ids[1]);
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

describe('PlanService: notas', () => {
  let plans: PlanService;
  let fichaId: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
    [{ id: fichaId }] = plans.criarComItens([{ nome: 'A', itens: [item('supino', 60), item('remada', 40)] }]);
  });

  it('nota do exercício: grava só no item escolhido, sem espaços nas pontas', () => {
    plans.definirNotaDoItem(fichaId, 1, '  banco no 4 ');
    const itens = plans.get(fichaId)!.itens;
    expect(itens[1].nota).toBe('banco no 4');
    expect('nota' in itens[0]).toBeFalse();
  });

  it('nota do exercício: texto vazio apaga o campo', () => {
    plans.definirNotaDoItem(fichaId, 0, 'algo');
    plans.definirNotaDoItem(fichaId, 0, '   ');
    expect('nota' in plans.get(fichaId)!.itens[0]).toBeFalse();
  });

  it('nota do exercício respeita o limite de tamanho', () => {
    plans.definirNotaDoItem(fichaId, 0, 'a'.repeat(500));
    expect(plans.get(fichaId)!.itens[0].nota!.length).toBe(200);
  });

  it('nota do treino: vai para o andamento e, ao concluir, para a sessão', () => {
    plans.definirNotaDoTreino(fichaId, ' ombro incomodando ');
    expect(plans.emAndamento()?.nota).toBe('ombro incomodando');
    const id = plans.registrarSessao(fichaId, []);
    expect(plans.historico().find((s) => s.id === id)?.nota).toBe('ombro incomodando');
    expect(plans.emAndamento()).toBeNull();
  });

  it('nota do treino: apagar o texto tira o campo do andamento', () => {
    plans.definirNotaDoTreino(fichaId, 'algo');
    plans.definirNotaDoTreino(fichaId, '');
    expect('nota' in plans.emAndamento()!).toBeFalse();
  });

  it('sessão sem nota não ganha o campo', () => {
    const id = plans.registrarSessao(fichaId, []);
    expect('nota' in plans.historico().find((s) => s.id === id)!).toBeFalse();
  });

  it('a nota de um treino de outra ficha não vai para esta sessão', () => {
    const [outra] = plans.criarComItens([{ nome: 'B', itens: [item('agachamento', 80)] }]);
    plans.definirNotaDoTreino(outra.id, 'só da B');
    const id = plans.registrarSessao(fichaId, []);
    expect('nota' in plans.historico().find((s) => s.id === id)!).toBeFalse();
  });
});


describe('PlanService: desfazer a exclusão de fichas', () => {
  let plans: PlanService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
  });

  it('remover devolve o desfazer, que põe a ficha na mesma posição e de novo como ativa', () => {
    const [a, b, c] = plans.criarComItens([
      { nome: 'A', itens: [item('supino', 60)] },
      { nome: 'B', itens: [item('remada', 40)] },
      { nome: 'C', itens: [item('agachamento', 80)] },
    ]);
    plans.definirAtiva(b.id);
    const desfazer = plans.remover(b.id);
    expect(plans.fichas().map((f) => f.nome)).toEqual(['A', 'C']);
    expect(plans.ativaId()).not.toBe(b.id);
    desfazer();
    expect(plans.fichas().map((f) => f.id)).toEqual([a.id, b.id, c.id]);
    expect(plans.ativaId()).toBe(b.id);
  });

  it('desfazer a exclusão de um conjunto devolve todos os treinos', () => {
    const t = plans.criarConjunto('Divisão AB', [
      { nome: 'A', itens: [item('supino', 60)] },
      { nome: 'B', itens: [item('remada', 40)] },
    ]);
    const desfazer = plans.removerConjunto(t[0].conjunto!.id);
    expect(plans.fichas().length).toBe(0);
    desfazer();
    expect(plans.fichas().map((f) => f.id)).toEqual(t.map((f) => f.id));
  });

  it('desfazer duas vezes não duplica a ficha', () => {
    const [a] = plans.criarComItens([{ nome: 'A', itens: [item('supino', 60)] }]);
    const desfazer = plans.remover(a.id);
    desfazer();
    desfazer();
    expect(plans.fichas().length).toBe(1);
  });
});

describe('PlanService: favoritos no documento da nuvem', () => {
  let plans: PlanService;
  let favoritos: FavoritosService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    plans = TestBed.inject(PlanService);
    favoritos = TestBed.inject(FavoritosService);
  });

  const estado = (fav?: string[]) => ({ fichas: [], ativaId: null, emAndamento: null, ...(fav ? { favoritos: fav } : {}) });

  it('os favoritos vão junto com as fichas', () => {
    favoritos.alternar('supino');
    expect(plans.estadoNuvem().favoritos).toEqual(['supino']);
  });

  it('no primeiro contato junta os da nuvem com os do aparelho; depois, vale a nuvem', () => {
    favoritos.alternar('supino');
    plans.aplicarEstadoNuvem(estado(['remada']), true);
    expect([...favoritos.ids()].sort()).toEqual(['remada', 'supino']);
    plans.aplicarEstadoNuvem(estado(['remada']), false);
    expect([...favoritos.ids()]).toEqual(['remada']);
  });

  it('documento de versão antiga (sem favoritos) não apaga os do aparelho', () => {
    favoritos.alternar('supino');
    plans.aplicarEstadoNuvem(estado(), false);
    expect([...favoritos.ids()]).toEqual(['supino']);
  });

  it('sair da conta limpa os favoritos', () => {
    favoritos.alternar('supino');
    plans.limparLocal();
    expect(favoritos.ids().size).toBe(0);
  });
});
