import { RegistroPeso } from './models';
import { MEDIDAS, lerMedida, limparPesos, lerPeso, mesclarPesos, registrarPeso, serieDePeso, soPeso, ultimasMedidas } from './peso';

const r = (data: string, kg: number, em?: number): RegistroPeso => ({ data, kg, ...(em !== undefined ? { em } : {}) });

describe('lerPeso', () => {
  it('aceita vírgula ou ponto', () => {
    expect(lerPeso('72,5')).toBe(72.5);
    expect(lerPeso(' 72.5 ')).toBe(72.5);
    expect(lerPeso('80')).toBe(80);
  });

  it('recusa texto inválido e valores fora de 20 a 400 kg', () => {
    for (const t of ['', 'abc', '19,9', '401', '-70', '70,5kg', '7,2,5']) expect(lerPeso(t)).withContext(t).toBeNull();
  });
});

describe('limparPesos', () => {
  it('descarta registros malformados e mantém os bons em ordem de data', () => {
    const sujo = [r('2026-10-05', 71), { data: 'ontem', kg: 70 }, { data: '2026-10-01', kg: 'x' }, null, r('2026-10-02', 500), r('2026-10-01', 72)];
    expect(limparPesos(sujo)).toEqual([r('2026-10-01', 72), r('2026-10-05', 71)]);
  });

  it('devolve lista vazia quando não é uma lista', () => {
    expect(limparPesos(undefined)).toEqual([]);
    expect(limparPesos({})).toEqual([]);
  });
});

describe('registrarPeso', () => {
  it('registrar de novo no mesmo dia substitui o anterior', () => {
    const lista = registrarPeso([r('2026-10-05', 72, 1)], r('2026-10-05', 71.4, 2));
    expect(lista).toEqual([r('2026-10-05', 71.4, 2)]);
  });

  it('mantém a ordem de data mesmo registrando um dia antigo depois', () => {
    const lista = registrarPeso([r('2026-10-05', 72), r('2026-10-09', 71)], r('2026-10-07', 71.5));
    expect(lista.map((x) => x.data)).toEqual(['2026-10-05', '2026-10-07', '2026-10-09']);
  });
});

describe('mesclarPesos', () => {
  it('une os dias dos dois lados', () => {
    const m = mesclarPesos([r('2026-10-01', 72, 1)], [r('2026-10-02', 71, 1)]);
    expect(m.map((x) => x.data)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('no mesmo dia vale o registrado por último', () => {
    expect(mesclarPesos([r('2026-10-01', 72, 10)], [r('2026-10-01', 70, 20)])).toEqual([r('2026-10-01', 70, 20)]);
    expect(mesclarPesos([r('2026-10-01', 72, 30)], [r('2026-10-01', 70, 20)])).toEqual([r('2026-10-01', 72, 30)]);
  });
});

describe('serieDePeso', () => {
  const hoje = new Date(2026, 9, 23); // 23 de outubro de 2026

  it('semana: só os últimos 7 dias, com x de 0 a 1 e a variação entre as pontas', () => {
    const s = serieDePeso([r('2026-10-16', 80), r('2026-10-17', 72), r('2026-10-23', 71)], 'semana', hoje);
    expect(s.pontos.map((p) => p.rotulo)).toEqual(['17/10', '23/10']);
    expect(s.pontos.map((p) => p.x)).toEqual([0, 1]);
    expect(s.variacao).toBe(-1);
    expect([s.inicio, s.fim]).toEqual(['17/10', '23/10']);
  });

  it('mês: os últimos 30 dias', () => {
    const s = serieDePeso([r('2026-09-23', 80), r('2026-09-24', 75), r('2026-10-10', 74)], 'mes', hoje);
    expect(s.pontos.length).toBe(2);
    expect(s.pontos[0].x).toBe(0);
    expect(s.variacao).toBe(-1);
    expect([s.minimo, s.maximo]).toEqual([74, 75]);
  });

  it('ano: média de cada mês nos últimos 12 meses', () => {
    const s = serieDePeso([r('2025-10-30', 90), r('2025-12-05', 78), r('2026-09-10', 75), r('2026-10-01', 72), r('2026-10-20', 74)], 'ano', hoje);
    // 2025-10 fica de fora (a janela começa em novembro de 2025).
    expect(s.pontos.map((p) => p.kg)).toEqual([78, 75, 73]);
    expect(s.pontos[2].x).toBe(1);
    expect(s.variacao).toBe(-5);
    expect(s.fim).toBe('out');
  });

  it('sem registros no período, a série é vazia e sem variação', () => {
    const s = serieDePeso([r('2024-01-01', 80)], 'mes', hoje);
    expect(s.pontos).toEqual([]);
    expect(s.variacao).toBeNull();
  });

  it('um único ponto não tem variação', () => {
    expect(serieDePeso([r('2026-10-23', 71)], 'semana', hoje).variacao).toBeNull();
  });
});

describe('medidas de bioimpedância', () => {
  const m = (chave: string) => MEDIDAS.find((x) => x.chave === chave)!;

  it('lerMedida: vazio é opcional, inválido é null, e respeita as casas', () => {
    expect(lerMedida('', m('cintura'))).toBeUndefined();
    expect(lerMedida('111,8', m('cintura'))).toBe(111.8);
    expect(lerMedida('15', m('visceral'))).toBe(15);
    expect(lerMedida('15,5', m('visceral'))).toBeNull();
    expect(lerMedida('1849', m('tmb'))).toBe(1849);
    expect(lerMedida('10', m('cintura'))).toBeNull();
    expect(lerMedida('abc', m('gordura'))).toBeNull();
  });

  it('limparPesos mantém medidas válidas e descarta as absurdas', () => {
    const [x] = limparPesos([{ data: '2026-11-02', kg: 101.4, cintura: 111.8, tmb: 1, gordura: 'x' }]);
    expect(x).toEqual({ data: '2026-11-02', kg: 101.4, cintura: 111.8 });
  });

  it('ultimasMedidas pega o valor mais recente de cada medida', () => {
    const lista = [{ ...r('2026-10-01', 100), cintura: 115 }, { ...r('2026-11-01', 99), cintura: 111.8, tmb: 1849 }, r('2026-11-05', 98)];
    const u = ultimasMedidas(lista).map((x) => [x.medida.chave, x.valor]);
    expect(u).toEqual([['cintura', 111.8], ['tmb', 1849]]);
  });

  it('soPeso tira as medidas antes de compartilhar com amigos', () => {
    expect(soPeso([{ ...r('2026-11-01', 99, 5), cintura: 111.8 }])).toEqual([r('2026-11-01', 99, 5)]);
  });
});
