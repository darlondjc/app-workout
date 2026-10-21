import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * Demonstração do exercício: WebP animado (início e fim, em loop). Com «reduzir movimento»
 * ativado no sistema, ou se a animação não existir, mostra a foto estática.
 */
@Component({
  selector: 'app-exercise-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="moldura" role="img" [attr.aria-label]="descricao()">
      @if (animado() && !semAnimacao()) {
        <picture>
          <source
            [srcset]="'exercises/' + id() + '/0.jpg'"
            media="(prefers-reduced-motion: reduce)"
          />
          <img
            [src]="'exercises/' + id() + '/anim.webp'"
            alt=""
            decoding="async"
            (error)="semAnimacao.set(true)"
          />
        </picture>
      } @else {
        <img [src]="'exercises/' + id() + '/0.jpg'" alt="" decoding="async" />
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
    picture {
      display: contents;
    }
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,
})
export class ExerciseImage {
  readonly id = input.required<string>();
  readonly descricao = input('');
  readonly animado = input(true);
  protected readonly semAnimacao = signal(false);
}
