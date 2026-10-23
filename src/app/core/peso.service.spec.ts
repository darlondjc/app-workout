import { TestBed } from '@angular/core/testing';
import { PesoService } from './peso.service';

describe('PesoService', () => {
  beforeEach(() => {
    localStorage.removeItem('app-workout:peso:v1');
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.removeItem('app-workout:peso:v1'));

  it('registra um peso por dia, e o mais recente vira o atual', () => {
    const s = TestBed.inject(PesoService);
    s.registrar('2026-10-22', 72);
    s.registrar('2026-10-23', 71.5);
    s.registrar('2026-10-23', 71.2);
    expect(s.registros().map((r) => [r.data, r.kg])).toEqual([
      ['2026-10-22', 72],
      ['2026-10-23', 71.2],
    ]);
    expect(s.atual()?.kg).toBe(71.2);
  });

  it('remove um registro', () => {
    const s = TestBed.inject(PesoService);
    s.registrar('2026-10-22', 72);
    s.remover('2026-10-22');
    expect(s.atual()).toBeNull();
  });

  it('grava no aparelho e relê ao iniciar', () => {
    const s = TestBed.inject(PesoService);
    s.registrar('2026-10-22', 72);
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('app-workout:peso:v1') ?? '[]')[0].kg).toBe(72);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(PesoService).atual()?.kg).toBe(72);
  });

  it('ignora lixo guardado no aparelho', () => {
    localStorage.setItem('app-workout:peso:v1', JSON.stringify([{ data: 'x', kg: 1 }, { data: '2026-10-22', kg: 72 }]));
    expect(TestBed.inject(PesoService).registros().length).toBe(1);
  });

  it('aplica o que veio da nuvem: troca, mescla, ou mantém o local se o documento é antigo', () => {
    const s = TestBed.inject(PesoService);
    s.registrar('2026-10-01', 80);

    s.aplicar(undefined, false);
    expect(s.registros().length).toBe(1);

    s.aplicar([{ data: '2026-10-02', kg: 79, em: 1 }], true);
    expect(s.registros().map((r) => r.data)).toEqual(['2026-10-01', '2026-10-02']);

    s.aplicar([{ data: '2026-10-05', kg: 78, em: 1 }], false);
    expect(s.registros().map((r) => r.data)).toEqual(['2026-10-05']);
  });

  it('limpar apaga tudo', () => {
    const s = TestBed.inject(PesoService);
    s.registrar('2026-10-22', 72);
    s.limpar();
    expect(s.registros()).toEqual([]);
  });
});
