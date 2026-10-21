import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Mostra as duas fotos do exercício (início e fim) alternando, como um GIF leve. */
@Component({
  selector: 'app-exercise-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="moldura" role="img" [attr.aria-label]="descricao()">
      <img [src]="'exercises/' + id() + '/0.jpg'" alt="" decoding="async" />
      @if (animado()) {
        <img class="fim" [src]="'exercises/' + id() + '/1.jpg'" alt="" decoding="async" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .moldura {
      position: relative;
      width: 100%;
      height: 100%;
      background: #fff;
      overflow: hidden;
    }
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .fim {
      opacity: 0;
      animation: alternar 1.4s steps(1, end) infinite;
    }
    @keyframes alternar {
      0% {
        opacity: 0;
      }
      50% {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .fim {
        animation: none;
      }
    }
  `,
})
export class ExerciseImage {
  readonly id = input.required<string>();
  readonly descricao = input('');
  readonly animado = input(true);
}
