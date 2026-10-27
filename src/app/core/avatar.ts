import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Usuario } from './sync';

/** Foto da conta Google; sem foto (ou se ela não carregar), mostra a inicial do nome. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (usuario().foto && !falhou()) {
      <img [src]="usuario().foto" alt="" referrerpolicy="no-referrer" (error)="falhou.set(true)" />
    } @else {
      <span aria-hidden="true">{{ inicial() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      border-radius: 50%;
      overflow: hidden;
      background: var(--accent);
      color: var(--on-accent);
      font-family: var(--font-display);
      font-weight: 700;
      width: var(--avatar, 40px);
      height: var(--avatar, 40px);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  host: { '[style.--avatar.px]': 'tamanho()', '[attr.aria-hidden]': 'true' },
})
export class Avatar {
  readonly usuario = input.required<Usuario>();
  readonly tamanho = input(40);
  protected readonly falhou = signal(false);
  protected readonly inicial = computed(() => (this.usuario().nome || this.usuario().email || '?').trim().charAt(0).toUpperCase());
}
