import { Sessao } from './models';
import { calcularResumo, dataISO, descansoMedio, gerarInsights, inicioSemana, recordesDaSessao, sequenciaSemanas, treinosPorDia, volumeSessao } from './stats';

/** Soma `n` dias a uma data yyyy-mm-dd. */
function dia(iso: string, n = 0): string {
  const [a, m, d] = iso.split('-').map(Number);
  return dataISO(new Date(a, m - 1, d + n));
}

function sessao(data: string, extra: Partial<Sessao> = {}): Sessao {
  return { id: `s-${data}`, data, fichaId: 'f1', concluidaEm: new Date(`${data}T12:00:00`).getTime(), ...extra };
}

/** `n` treinos em dias seguidos a partir da segunda-feira `inicio`. */
function semana(inicio: string, n: number): Sessao[] {
  return Array.from({ length: n }, (_, i) => sessao(dia(inicio, i)));
}

function registro(exerciseId: string, cargas: number[], unidade?: 'min'): NonNullable<Sessao['registros']>[number] {
  return { exerciseId, unidade, series: cargas.map((carga) => ({ carga, reps: 10 })) };
}

describe('stats', () => {
  // 21/10/2026 é uma quarta-feira.
  const hoje = new Date(2026, 9, 21);

  describe('dataISO e inicioSemana', () => {
    it('formata com zeros à esquerda', () => {
      expect(dataISO(new Date(2026, 9, 5))).toBe('2026-10-05');
    });

    it('a semana começa na segunda-feira', () => {
      expect(dataISO(inicioSemana(new Date(2026, 9, 21)))).toBe('2026-10-19'); // quarta
      expect(dataISO(inicioSemana(new Date(2026, 9, 19)))).toBe('2026-10-19'); // segunda
      expect(dataISO(inicioSemana(new Date(2026, 9, 25)))).toBe('2026-10-19'); // domingo
    });
  });

  describe('volumeSessao', () => {
    it('soma carga × repetições e ignora cardio em minutos', () => {
      const s = sessao('2026-10-20', {
        registros: [
          { exerciseId: 'supino', series: [{ carga: 20, reps: 10 }, { carga: 22.5, reps: 8 }] },
          { exerciseId: 'esteira', unidade: 'min', series: [{ carga: 5, reps: 30 }] },
        ],
      });
      expect(volumeSessao(s)).toBe(380);
    });

    it('arredonda o total e aceita sessão sem registros', () => {
      expect(volumeSessao(sessao('2026-10-20', { registros: [{ exerciseId: 'x', series: [{ carga: 2.5, reps: 3 }] }] }))).toBe(8);
      expect(volumeSessao(sessao('2026-10-20'))).toBe(0);
    });
  });

  it('treinosPorDia conta mais de um treino no mesmo dia', () => {
    const m = treinosPorDia([sessao('2026-10-20'), sessao('2026-10-20', { id: 'outro' }), sessao('2026-10-21')]);
    expect(m.get('2026-10-20')).toBe(2);
    expect(m.get('2026-10-21')).toBe(1);
  });

  describe('sequenciaSemanas', () => {
    it('semana atual ainda incompleta: a contagem parte da anterior', () => {
      const h = [...semana('2026-10-05', 2), ...semana('2026-10-12', 2), ...semana('2026-10-19', 1)];
      expect(sequenciaSemanas(h, 2, hoje)).toEqual({ atual: 2, melhor: 2 });
    });

    it('semana atual cumprida entra na conta', () => {
      const h = [...semana('2026-10-12', 2), ...semana('2026-10-19', 2)];
      expect(sequenciaSemanas(h, 2, hoje).atual).toBe(2);
    });

    it('guarda a melhor sequência depois que ela é quebrada', () => {
      const h = [...semana('2026-09-07', 2), ...semana('2026-09-14', 2), ...semana('2026-09-21', 2), ...semana('2026-10-05', 2)];
      expect(sequenciaSemanas(h, 2, new Date(2026, 9, 7))).toEqual({ atual: 1, melhor: 3 });
    });

    it('sem treinos não há sequência', () => {
      expect(sequenciaSemanas([], 2, hoje)).toEqual({ atual: 0, melhor: 0 });
    });
  });

  describe('recordesDaSessao', () => {
    const antes = sessao('2026-09-01', { registros: [registro('supino', [40, 45]), registro('esteira', [0], 'min')] });

    it('marca o exercício com carga acima do melhor anterior', () => {
      const alvo = sessao('2026-10-01', { registros: [registro('supino', [50])] });
      expect(recordesDaSessao([antes, alvo], alvo)).toEqual([{ exerciseId: 'supino', carga: 50, antes: 45 }]);
    });

    it('carga igual ou menor não é recorde', () => {
      const alvo = sessao('2026-10-01', { registros: [registro('supino', [45])] });
      expect(recordesDaSessao([antes, alvo], alvo)).toEqual([]);
    });

    it('a primeira vez de um exercício não conta como recorde', () => {
      const alvo = sessao('2026-10-01', { registros: [registro('agachamento', [80])] });
      expect(recordesDaSessao([antes, alvo], alvo)).toEqual([]);
    });

    it('treino mais novo não interfere no recorde de um mais antigo', () => {
      const depois = sessao('2026-11-01', { registros: [registro('supino', [100])] });
      const alvo = sessao('2026-10-01', { registros: [registro('supino', [50])] });
      expect(recordesDaSessao([antes, alvo, depois], alvo).map((r) => r.antes)).toEqual([45]);
    });
  });

  describe('calcularResumo', () => {
    it('histórico vazio', () => {
      const r = calcularResumo([], hoje, 3);
      expect(r.totalTreinos).toBe(0);
      expect(r.diasSemTreinar).toBeNull();
      expect(r.treinouHoje).toBeFalse();
      expect(r.ultimasSemanas.length).toBe(8);
    });

    it('conta semana, mês e mês anterior', () => {
      const h = [sessao('2026-10-19'), sessao('2026-10-20'), sessao('2026-10-05'), sessao('2026-09-28')];
      const r = calcularResumo(h, hoje, 2);
      expect(r.treinosSemana).toBe(2);
      expect(r.totalTreinos).toBe(4);
      expect(r.treinosMes).toBe(3);
      expect(r.treinosMesAnterior).toBe(1);
      expect(r.diasSemTreinar).toBe(1);
      expect(r.treinouHoje).toBeFalse();
      expect(r.diasRestantesSemana).toBe(4);
    });

    it('as últimas 8 semanas terminam na semana atual', () => {
      const r = calcularResumo([sessao('2026-10-19'), sessao('2026-10-20')], hoje, 2);
      expect(r.ultimasSemanas[0].inicio).toBe('2026-08-31');
      expect(r.ultimasSemanas[7]).toEqual({ inicio: '2026-10-19', treinos: 2 });
    });

    it('treinou hoje', () => {
      expect(calcularResumo([sessao('2026-10-21')], hoje, 3).treinouHoje).toBeTrue();
    });
  });

  describe('gerarInsights', () => {
    it('sem treinos, convida a começar', () => {
      const [i] = gerarInsights(calcularResumo([], hoje, 3), hoje);
      expect(i.tipo).toBe('incentivo');
      expect(i.texto).toContain('primeiro treino');
    });

    it('ao ver um amigo, as mensagens falam dele e não de "você"', () => {
      const r = calcularResumo([sessao('2026-10-19'), sessao('2026-10-20'), sessao('2026-10-05'), sessao('2026-09-28')], hoje, 2);
      const doAmigo = gerarInsights(r, hoje, 'Ana');
      expect(doAmigo.length).toBeGreaterThan(0);
      expect(doAmigo.some((i) => i.texto.includes('Ana'))).toBeTrue();
      expect(doAmigo.some((i) => /\bvocê\b/i.test(i.texto))).toBeFalse();
    });

    it('meta batida vira conquista', () => {
      const r = calcularResumo([sessao('2026-10-19'), sessao('2026-10-20')], hoje, 2);
      expect(gerarInsights(r, hoje).some((i) => i.tipo === 'conquista' && i.texto.includes('Meta da semana batida'))).toBeTrue();
    });
  });
});

describe('descansoMedio', () => {
  const comDescanso = (...descansos: (number | undefined)[]): Sessao =>
    sessao('2026-10-20', {
      registros: [
        { exerciseId: 'a', series: descansos.map((descanso) => ({ carga: 10, reps: 10, ...(descanso !== undefined ? { descanso } : {}) })) },
      ],
    });

  it('é nulo sem nenhum descanso registrado (treinos antigos ou sem séries)', () => {
    expect(descansoMedio([])).toBeNull();
    expect(descansoMedio([sessao('2026-10-20'), comDescanso(undefined, undefined)])).toBeNull();
  });

  it('faz a média dos descansos entre as séries de todos os treinos', () => {
    expect(descansoMedio([comDescanso(undefined, 60, 90), comDescanso(undefined, 30)])).toBe(60);
  });

  it('arredonda para o segundo mais próximo', () => {
    expect(descansoMedio([comDescanso(undefined, 45, 46)])).toBe(46);
  });

  it('ignora pausas acima de 10 minutos e valores inválidos', () => {
    expect(descansoMedio([comDescanso(undefined, 60, 3000, 0, -5)])).toBe(60);
  });

  it('aparece no resumo', () => {
    const r = calcularResumo([comDescanso(undefined, 80)], new Date(2026, 9, 21), 3);
    expect(r.descansoMedio).toBe(80);
  });
});
