import { TestBed } from '@angular/core/testing';
import { CHAVE_PALETA, CHAVE_TEMA, TemaService, paletaValida, preferenciaValida } from './tema.service';

describe('TemaService', () => {
  beforeEach(() => {
    localStorage.removeItem(CHAVE_TEMA);
    delete document.documentElement.dataset['tema'];
  });
  afterEach(() => {
    localStorage.removeItem(CHAVE_TEMA);
    delete document.documentElement.dataset['tema'];
  });

  it('sem escolha, segue o aparelho', () => {
    const t = TestBed.inject(TemaService);
    expect(t.preferencia()).toBe('sistema');
    expect(['claro', 'escuro']).toContain(document.documentElement.dataset['tema']!);
  });

  it('escolher escuro aplica o atributo e guarda a escolha', () => {
    const t = TestBed.inject(TemaService);
    t.definir('escuro');
    expect(document.documentElement.dataset['tema']).toBe('escuro');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('escuro');
    t.definir('claro');
    expect(document.documentElement.dataset['tema']).toBe('claro');
  });

  it('lembra a escolha ao abrir de novo e ignora valor inválido', () => {
    localStorage.setItem(CHAVE_TEMA, 'escuro');
    expect(TestBed.inject(TemaService).preferencia()).toBe('escuro');
    TestBed.resetTestingModule();
    localStorage.setItem(CHAVE_TEMA, 'roxo');
    expect(TestBed.inject(TemaService).preferencia()).toBe('sistema');
  });

  it('atualiza a cor da barra do aparelho', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#14171A';
    document.head.appendChild(meta);
    TestBed.inject(TemaService).definir('escuro');
    expect(meta.content).toBe('#14171A');
    meta.remove();
  });

  it('valida a preferência', () => {
    expect(preferenciaValida('claro')).toBeTrue();
    expect(preferenciaValida('x')).toBeFalse();
    expect(preferenciaValida(null)).toBeFalse();
  });

  it('paleta: começa em limão, aplica o atributo, guarda e ignora valor inválido', () => {
    localStorage.removeItem(CHAVE_PALETA);
    const t = TestBed.inject(TemaService);
    expect(t.paleta()).toBe('limao');
    t.definirPaleta('violeta');
    expect(document.documentElement.dataset['paleta']).toBe('violeta');
    expect(localStorage.getItem(CHAVE_PALETA)).toBe('violeta');
    expect(paletaValida('violeta')).toBeTrue();
    expect(paletaValida('xyz')).toBeFalse();
    localStorage.removeItem(CHAVE_PALETA);
  });
});
