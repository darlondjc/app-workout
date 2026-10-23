import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TituloEmDuasLinhas, ajustarTitulo } from './ajuste-titulo';

@Component({
  imports: [TituloEmDuasLinhas],
  template: '<div style="width: 220px"><h1 [appTituloEmDuasLinhas]="texto()">{{ texto() }}</h1></div>',
  styles: 'h1 { margin: 0; font-size: 24px; line-height: 1.2; }',
})
class Hospedeiro {
  readonly texto = signal('Supino reto');
}

describe('título em duas linhas', () => {
  let fixture: ComponentFixture<Hospedeiro>;
  const h1 = () => (fixture.nativeElement as HTMLElement).querySelector('h1') as HTMLElement;
  const linhas = () => Math.round(h1().scrollHeight / (parseFloat(getComputedStyle(h1()).fontSize) * 1.2));
  const quadro = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  beforeEach(() => {
    fixture = TestBed.createComponent(Hospedeiro);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });
  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  it('título curto mantém o tamanho da letra', async () => {
    await quadro();
    expect(parseFloat(getComputedStyle(h1()).fontSize)).toBe(24);
  });

  it('título longo diminui a letra até caber em duas linhas', async () => {
    fixture.componentInstance.texto.set('Elevação lateral de ombros com halteres sentado');
    fixture.detectChanges();
    await quadro();
    expect(parseFloat(getComputedStyle(h1()).fontSize)).toBeLessThan(24);
    expect(h1().scrollHeight).toBeLessThanOrEqual(h1().clientHeight + 1);
    expect(linhas()).toBeLessThanOrEqual(2);
  });

  it('voltando a um título curto, a letra volta ao tamanho normal', async () => {
    fixture.componentInstance.texto.set('Elevação lateral de ombros com halteres sentado');
    fixture.detectChanges();
    await quadro();
    fixture.componentInstance.texto.set('Remada');
    fixture.detectChanges();
    await quadro();
    expect(parseFloat(getComputedStyle(h1()).fontSize)).toBe(24);
  });

  it('não passa do tamanho mínimo: se ainda não couber, corta', () => {
    const el = document.createElement('div');
    el.style.cssText = 'width: 60px; font-size: 24px; line-height: 1.2; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden';
    el.textContent = 'Palavra enorme demais para uma caixa tão pequena assim mesmo '.repeat(4);
    document.body.appendChild(el);
    ajustarTitulo(el, 16);
    expect(parseFloat(getComputedStyle(el).fontSize)).toBe(16);
    el.remove();
  });
});
