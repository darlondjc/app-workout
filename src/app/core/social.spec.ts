import { Atividade, Evento, chaveAmizade, gerarCodigo, idEvento, marcoDoTreino, montarTimeline, normalizarCodigo, tempoRelativo } from './social';

function evento(autor: string, id: string, criadoEm: number): Evento {
  return { id, autor, autorNome: autor, autorFoto: null, tipo: 'treino', criadoEm, sessaoId: id, data: '2026-10-20', fichaNome: 'A', exercicios: 3, volume: 1000, recordes: [] };
}

function atividade(id: string, criadoEm: number): Atividade {
  return { id, autor: 'ana', autorNome: 'Ana', autorFoto: null, tipo: 'curtida', eventoId: 'e1', criadoEm };
}

describe('social', () => {
  it('chaveAmizade é igual para os dois lados', () => {
    expect(chaveAmizade('b', 'a')).toBe('a_b');
    expect(chaveAmizade('a', 'b')).toBe('a_b');
  });

  describe('códigos de amigo', () => {
    it('tem 8 caracteres do alfabeto sem O, 0, I e 1', () => {
      for (let i = 0; i < 300; i++) expect(gerarCodigo()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{8}$/);
    });

    it('usa a fonte de aleatoriedade recebida', () => {
      expect(gerarCodigo(() => 0)).toBe('AAAAAAAA');
    });

    it('normaliza o que a pessoa digita', () => {
      expect(normalizarCodigo('ab-12 cd!')).toBe('AB12CD');
    });
  });

  describe('idEvento', () => {
    it('o mesmo treino gera sempre o mesmo id', () => {
      expect(idEvento(1_700_000_000_000, 's1')).toBe(idEvento(1_700_000_000_000, 's1'));
      expect(idEvento(1_700_000_000_000, 's1')).toBe('1700000000000_s1');
    });

    it('a ordem alfabética é a cronológica', () => {
      expect(idEvento(900, 'x') < idEvento(1000, 'x')).toBeTrue();
      expect(idEvento(99_999, 'x') < idEvento(100_000, 'x')).toBeTrue();
    });
  });

  describe('montarTimeline', () => {
    it('mistura treinos e reações, do mais novo para o mais antigo', () => {
      const t = montarTimeline([evento('eu', 'a', 100), evento('ana', 'b', 300)], [atividade('x', 200)]);
      expect(t.map((i) => i.criadoEm)).toEqual([300, 200, 100]);
      expect(t.map((i) => i.tipo)).toEqual(['evento', 'atividade', 'evento']);
    });

    it('a chave distingue o mesmo id de autores diferentes', () => {
      const t = montarTimeline([evento('eu', 'a', 100), evento('ana', 'a', 200)], []);
      expect(new Set(t.map((i) => i.chave)).size).toBe(2);
    });

    it('respeita o limite', () => {
      const eventos = Array.from({ length: 10 }, (_, i) => evento('eu', `e${i}`, i));
      expect(montarTimeline(eventos, [], 4).length).toBe(4);
      expect(montarTimeline(eventos, [], 4)[0].criadoEm).toBe(9);
    });
  });

  it('marcoDoTreino só aparece em números redondos', () => {
    expect(marcoDoTreino(10)).toBe('10º treino');
    expect(marcoDoTreino(100)).toBe('100º treino');
    expect(marcoDoTreino(11)).toBeUndefined();
    expect(marcoDoTreino(0)).toBeUndefined();
  });

  describe('tempoRelativo', () => {
    const agora = 1_800_000_000_000;
    const antes = (ms: number) => tempoRelativo(agora - ms, agora);

    it('escolhe a unidade conforme a idade', () => {
      expect(antes(30_000)).toBe('agora');
      expect(antes(5 * 60_000)).toBe('5 min');
      expect(antes(3 * 3_600_000)).toBe('3 h');
      expect(antes(24 * 3_600_000)).toBe('1 dia');
      expect(antes(2 * 24 * 3_600_000)).toBe('2 dias');
    });

    it('acima de uma semana mostra a data', () => {
      expect(antes(10 * 24 * 3_600_000)).not.toMatch(/dias?$/);
    });

    it('horário no futuro não dá número negativo', () => {
      expect(tempoRelativo(agora + 60_000, agora)).toBe('agora');
    });
  });
});
