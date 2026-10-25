import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** Imagem do grupo: a foto escolhida pelo dono ou, sem ela, a inicial do nome sobre fundo escuro. */
@Component({
  selector: 'app-avatar-grupo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (foto() && !falhou()) {
      <img [src]="foto()" alt="" (error)="falhou.set(true)" />
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
      overflow: hidden;
      width: var(--tamanho, 48px);
      height: var(--tamanho, 48px);
      border-radius: calc(var(--tamanho, 48px) * 0.29);
      background: var(--ink);
      color: var(--accent);
      font-family: var(--font-display);
      font-weight: 700;
      font-size: calc(var(--tamanho, 48px) * 0.46);
    }
    img { width: 100%; height: 100%; object-fit: cover; }
  `,
  host: { '[style.--tamanho.px]': 'tamanho()' },
})
export class AvatarGrupo {
  readonly nome = input.required<string>();
  readonly foto = input<string | null | undefined>(null);
  readonly tamanho = input(48);

  protected readonly falhou = signal(false);
  protected readonly inicial = computed(() => this.nome().trim().charAt(0).toLocaleUpperCase('pt-BR') || '?');
}
