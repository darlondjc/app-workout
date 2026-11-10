import { MEDIDAS, lerMedida, limparMedidas, mesclarMedidas, registrarMedidas, restaurarMedidas, ultimasMedidas } from './medidas';

const m = (chave: string) => MEDIDAS.find((x) => x.chave === chave)!;

describe('lerMedida', () => {
  it('vazio é opcional, inválido é null, e respeita as casas', () => {
    expect(lerMedida('', m('cintura'))).toBeUndefined();
    expect(lerMedida('111,8', m('cintura'))).toBe(111.8);
    expect(lerMedida('15', m('visceral'))).toBe(15);
    expect(lerMedida('15,5', m('visceral'))).toBeNull();
    expect(lerMedida('1849', m('tmb'))).toBe(1849);
    expect(lerMedida('10', m('cintura'))).toBeNull();
    expect(lerMedida('abc', m('gordura'))).toBeNull();
  });
});

describe('limparMedidas', () => {
  it('descarta registros malformados, vazios e valores absurdos', () => {
    const sujo = [
      { data: '2026-11-02', cintura: 111.8, tmb: 1, gordura: 'x' },
      { data: 'ontem', cintura: 100 },
      { data: '2026-11-03' },
      null,
    ];
    expect(limparMedidas(sujo)).toEqual([{ data: '2026-11-02', cintura: 111.8 }]);
    expect(limparMedidas({})).toEqual([]);
  });
});

describe('registrarMedidas', () => {
  it('no mesmo dia só muda os campos informados', () => {
    const a = registrarMedidas([], '2026-11-02', { cintura: 111.8, tmb: 1849 }, 1);
    const b = registrarMedidas(a, '2026-11-02', { cintura: 110 }, 2);
    expect(b).toEqual([{ data: '2026-11-02', cintura: 110, tmb: 1849, em: 2 }]);
  });

  it('mantém a ordem de data', () => {
    const l = registrarMedidas(registrarMedidas([], '2026-11-05', { cintura: 110 }, 1), '2026-11-01', { cintura: 112 }, 2);
    expect(l.map((r) => r.data)).toEqual(['2026-11-01', '2026-11-05']);
  });
});

describe('restaurarMedidas', () => {
  it('não passa por cima de um dia que ganhou outro registro', () => {
    const antigo = { data: '2026-11-02', cintura: 111 };
    expect(restaurarMedidas([], antigo)).toEqual([antigo]);
    const novo = [{ data: '2026-11-02', cintura: 109 }];
    expect(restaurarMedidas(novo, antigo)).toBe(novo);
  });
});

describe('mesclarMedidas', () => {
  it('une por dia e vale o registrado por último', () => {
    const l = mesclarMedidas([{ data: '2026-11-01', cintura: 1 + 99, em: 5 }], [{ data: '2026-11-01', cintura: 98, em: 9 }, { data: '2026-11-02', tmb: 1800 }]);
    expect(l).toEqual([{ data: '2026-11-01', cintura: 98, em: 9 }, { data: '2026-11-02', tmb: 1800 }]);
  });
});

describe('ultimasMedidas', () => {
  it('pega o valor mais recente de cada medida, mesmo de dias diferentes', () => {
    const u = ultimasMedidas([
      { data: '2026-09-01', cintura: 115, tmb: 1800 },
      { data: '2026-11-01', cintura: 111.8 },
    ]).map((x) => [x.medida.chave, x.valor, x.data]);
    expect(u).toEqual([['cintura', 111.8, '2026-11-01'], ['tmb', 1800, '2026-09-01']]);
  });
});
