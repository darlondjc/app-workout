import { TestBed } from '@angular/core/testing';
import { MedidasService } from './medidas.service';

const CHAVE = 'app-workout:medidas:v1';

describe('MedidasService', () => {
  beforeEach(() => {
    localStorage.removeItem(CHAVE);
    TestBed.configureTestingModule({});
  });
  afterEach(() => localStorage.removeItem(CHAVE));

  it('registra medidas e atualiza só os campos informados no mesmo dia', () => {
    const s = TestBed.inject(MedidasService);
    s.registrar('2026-11-02', { cintura: 111.8, visceral: 15 });
    s.registrar('2026-11-02', { cintura: 110 });
    expect(s.registros()).toEqual([jasmine.objectContaining({ data: '2026-11-02', cintura: 110, visceral: 15 })]);
  });

  it('remove e restaura', () => {
    const s = TestBed.inject(MedidasService);
    s.registrar('2026-11-02', { tmb: 1849 });
    const r = s.remover('2026-11-02')!;
    expect(s.registros()).toEqual([]);
    s.restaurar(r);
    expect(s.registros()[0].tmb).toBe(1849);
  });

  it('grava no aparelho e relê ao iniciar', () => {
    TestBed.inject(MedidasService).registrar('2026-11-02', { tmb: 1849 });
    TestBed.tick();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(MedidasService).registros()[0].tmb).toBe(1849);
  });

  it('aplica o que veio da nuvem: troca, mescla, ou mantém o local se o documento é antigo', () => {
    const s = TestBed.inject(MedidasService);
    s.registrar('2026-11-01', { tmb: 1800 });
    s.aplicar(undefined, false);
    expect(s.registros().length).toBe(1);
    s.aplicar([{ data: '2026-11-02', tmb: 1849, em: 1 }], true);
    expect(s.registros().map((r) => r.data)).toEqual(['2026-11-01', '2026-11-02']);
    s.aplicar([{ data: '2026-11-05', tmb: 1700, em: 1 }], false);
    expect(s.registros().map((r) => r.data)).toEqual(['2026-11-05']);
  });

  it('limpar apaga tudo', () => {
    const s = TestBed.inject(MedidasService);
    s.registrar('2026-11-02', { tmb: 1849 });
    s.limpar();
    expect(s.registros()).toEqual([]);
  });
});
