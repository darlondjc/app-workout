import { AVISO_DIAS, agruparEmBlocos, dataCurta, diasEntre, diasParaVencer, emAviso, limitarMeses, situacoes, somarMeses, textoDoPrazo } from './ciclo';
import { Ficha } from './models';

const f = (id: string, extra: Partial<Ficha> = {}): Ficha => ({ id, nome: id, itens: [], ...extra });

describe('ciclo', () => {
  describe('datas', () => {
    it('soma meses mantendo o dia, ou o último dia do mês quando ele não existe', () => {
      expect(somarMeses('2026-10-26', 4)).toBe('2027-02-26');
      expect(somarMeses('2026-10-31', 4)).toBe('2027-02-28');
      expect(somarMeses('2027-10-31', 4)).toBe('2028-02-29');
      expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15');
      expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    });

    it('conta dias entre datas, inclusive na troca de horário de verão e de ano', () => {
      expect(diasEntre('2026-10-26', '2026-10-26')).toBe(0);
      expect(diasEntre('2026-10-26', '2026-11-05')).toBe(10);
      expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
      expect(diasEntre('2026-10-26', '2026-10-20')).toBe(-6);
      expect(diasEntre('2026-03-01', '2026-11-01')).toBe(245);
    });

    it('formata a data e o prazo', () => {
      expect(dataCurta('2027-02-26')).toBe('26/02/2027');
      expect(textoDoPrazo(0)).toBe('Termina hoje');
      expect(textoDoPrazo(1)).toBe('Termina amanhã');
      expect(textoDoPrazo(8)).toBe('Termina em 8 dias');
    });

    it('limita a duração padrão a 1–12 meses', () => {
      expect(limitarMeses(0)).toBe(1);
      expect(limitarMeses(99)).toBe(12);
      expect(limitarMeses(4.4)).toBe(4);
      expect(limitarMeses('x')).toBe(4);
      expect(limitarMeses(NaN)).toBe(4);
    });
  });

  describe('agruparEmBlocos', () => {
    it('um treino solto é um bloco; os treinos de um conjunto ficam juntos onde está o primeiro', () => {
      const c = { id: 'c1', nome: 'Divisão' };
      const blocos = agruparEmBlocos([f('a'), f('b', { conjunto: c, inicio: '2026-10-01', fim: '2027-02-01' }), f('x'), f('d', { conjunto: c })]);
      expect(blocos.map((b) => [b.chave, b.nome, b.fichas.map((t) => t.id)])).toEqual([
        ['a', 'a', ['a']],
        ['c1', 'Divisão', ['b', 'd']],
        ['x', 'x', ['x']],
      ]);
      expect(blocos[1].inicio).toBe('2026-10-01');
      expect(blocos[1].fim).toBe('2027-02-01');
      expect(blocos[0].fim).toBeNull();
    });

    it('arquivada em qualquer treino arquiva o bloco todo', () => {
      const c = { id: 'c1', nome: 'D' };
      const [b] = agruparEmBlocos([f('a', { conjunto: c }), f('b', { conjunto: c, arquivada: true })]);
      expect(b.arquivadaPelaPessoa).toBeTrue();
    });
  });

  describe('situacoes', () => {
    const hoje = '2026-10-26';
    const bloco = (id: string, inicio: string | undefined, fim: string | undefined, extra: Partial<Ficha> = {}) => agruparEmBlocos([f(id, { inicio, fim, ...extra })])[0];

    it('sem data de fim (ficha antiga) e com fim no futuro: ativa', () => {
      const s = situacoes([bloco('a', undefined, undefined), bloco('b', '2026-10-01', '2027-02-01')], hoje);
      expect(s.get('a')).toBe('ativa');
      expect(s.get('b')).toBe('ativa');
    });

    it('vence no próprio dia do fim', () => {
      expect(situacoes([bloco('a', '2026-06-26', '2026-10-26')], hoje).get('a')).toBe('vencida');
      expect(situacoes([bloco('a', '2026-06-26', '2026-10-27')], hoje).get('a')).toBe('ativa');
    });

    it('com duas vencidas, a mais antiga é arquivada sozinha', () => {
      const s = situacoes([bloco('antiga', '2026-01-01', '2026-05-01'), bloco('recente', '2026-05-01', '2026-10-26')], hoje);
      expect(s.get('antiga')).toBe('arquivada');
      expect(s.get('recente')).toBe('vencida');
    });

    it('com três vencidas, só a mais recente fica à vista, qualquer que seja a ordem da lista', () => {
      const s = situacoes([bloco('b', '2026-03-01', '2026-07-01'), bloco('c', '2026-07-01', '2026-10-26'), bloco('a', '2026-01-01', '2026-05-01')], hoje);
      expect(s.get('c')).toBe('vencida');
      expect(s.get('b')).toBe('arquivada');
      expect(s.get('a')).toBe('arquivada');
    });

    it('empate no fim (várias encerradas no mesmo dia): fica à vista a que começou depois e, persistindo, a que veio por último', () => {
      const s = situacoes([bloco('a', '2026-06-01', '2026-10-26'), bloco('b', '2026-07-01', '2026-10-26'), bloco('c', '2026-07-01', '2026-10-26')], hoje);
      expect(s.get('c')).toBe('vencida');
      expect(s.get('a')).toBe('arquivada');
      expect(s.get('b')).toBe('arquivada');
    });

    it('arquivada pela pessoa não conta como vencida e não ocupa a vaga da vencida à vista', () => {
      const s = situacoes([bloco('guardada', '2026-01-01', '2026-05-01', { arquivada: true }), bloco('v', '2026-05-01', '2026-10-26')], hoje);
      expect(s.get('guardada')).toBe('arquivada');
      expect(s.get('v')).toBe('vencida');
    });

    it('ativas não são afetadas pelas vencidas', () => {
      const s = situacoes([bloco('v1', '2026-01-01', '2026-05-01'), bloco('v2', '2026-05-01', '2026-10-26'), bloco('nova', '2026-10-26', '2027-02-26')], hoje);
      expect(s.get('nova')).toBe('ativa');
    });
  });

  describe('aviso', () => {
    const hoje = '2026-10-26';
    const bloco = (fim?: string) => agruparEmBlocos([f('a', { fim })])[0];

    it('avisa quando faltam 10 dias ou menos, até o dia anterior ao fim', () => {
      expect(AVISO_DIAS).toBe(10);
      expect(emAviso(bloco('2026-11-05'), hoje)).toBeTrue();
      expect(emAviso(bloco('2026-11-06'), hoje)).toBeFalse();
      expect(emAviso(bloco('2026-10-27'), hoje)).toBeTrue();
    });

    it('no dia do fim ela já venceu (sem aviso) e sem data de fim não há aviso', () => {
      expect(emAviso(bloco('2026-10-26'), hoje)).toBeFalse();
      expect(emAviso(bloco(undefined), hoje)).toBeFalse();
      expect(diasParaVencer(bloco(undefined), hoje)).toBeNull();
      expect(diasParaVencer(bloco('2026-10-29'), hoje)).toBe(3);
    });
  });
});
