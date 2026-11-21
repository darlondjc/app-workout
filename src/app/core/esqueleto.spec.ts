import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Esqueleto } from './esqueleto';

@Component({
  imports: [Esqueleto],
  template: `<app-esqueleto [modelo]="modelo" [quantidade]="quantidade" texto="Carregando exercícios…" />`,
})
class Hospedeiro {
  modelo: 'lista' | 'formulario' | 'detalhe' | 'treino' | 'texto' = 'lista';
  quantidade = 3;
}

describe('Esqueleto', () => {
  const montar = (modelo: Hospedeiro['modelo'], quantidade = 3) => {
    const f = TestBed.createComponent(Hospedeiro);
    f.componentInstance.modelo = modelo;
    f.componentInstance.quantidade = quantidade;
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  };

  it('anuncia o texto para leitor de tela e esconde o desenho', () => {
    const el = montar('lista');
    expect(el.querySelector('[role="status"] .sr-only')!.textContent).toBe('Carregando exercícios…');
    expect(el.querySelector('.forma')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('o modelo "lista" desenha a quantidade pedida de cartões', () => {
    expect(montar('lista', 4).querySelectorAll('.card.linha').length).toBe(4);
  });

  it('o modelo "texto" desenha a quantidade pedida de linhas', () => {
    expect(montar('texto', 5).querySelectorAll('.bloco').length).toBe(5);
  });

  it('os modelos de página desenham blocos', () => {
    for (const m of ['formulario', 'detalhe', 'treino'] as const) {
      expect(montar(m).querySelectorAll('.bloco').length).withContext(m).toBeGreaterThan(3);
    }
  });
});
