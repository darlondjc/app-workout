import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialogo } from './dialogo';

@Component({
  imports: [Dialogo],
  template: `
    <button id="abre" type="button" (click)="aberto.set(true)">abrir</button>
    @if (aberto()) {
      <app-dialogo titulo="Peito" subtitulo="Quinta" (fechar)="aberto.set(false); fechou = fechou + 1">
        <button id="dentro" type="button">dentro</button>
      </app-dialogo>
    }
  `,
})
class Anfitriao {
  readonly aberto = signal(false);
  fechou = 0;
}

describe('Dialogo', () => {
  let fixture: ComponentFixture<Anfitriao>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Anfitriao);
    document.body.appendChild(el()); // o foco só funciona com o elemento no documento
    fixture.detectChanges();
  });

  afterEach(() => el().remove());

  async function abrir(): Promise<void> {
    (el().querySelector('#abre') as HTMLButtonElement).focus();
    (el().querySelector('#abre') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('mostra título, subtítulo e o conteúdo, e é anunciado como diálogo', async () => {
    await abrir();
    const d = el().querySelector('[role="dialog"]')!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.textContent).toContain('Peito');
    expect(d.textContent).toContain('Quinta');
    expect(d.querySelector('#dentro')).not.toBeNull();
    expect(d.getAttribute('aria-labelledby')).toBe(d.querySelector('h2')!.id);
  });

  it('leva o foco para o botão de fechar ao abrir e devolve para quem abriu ao fechar', async () => {
    await abrir();
    expect(document.activeElement).toBe(el().querySelector('.x'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.fechou).toBe(1);
    expect(el().querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(el().querySelector('#abre'));
  });

  it('mantém o Tab dentro da janela', async () => {
    await abrir();
    const x = el().querySelector('.x') as HTMLButtonElement;
    const dentro = el().querySelector('#dentro') as HTMLButtonElement;
    dentro.focus();
    dentro.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(x);
    x.focus();
    x.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(dentro);
  });
});
