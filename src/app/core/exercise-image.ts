import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';

/**
 * Demonstração do exercício: WebP animado (início e fim, em loop). Com «reduzir movimento»
 * ativado no sistema, ou se a animação não existir, mostra a foto estática.
 */
@Component({
  selector: 'app-exercise-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="moldura" [class.carregando]="!carregada()" role="img" [attr.aria-label]="descricao()">
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
            (load)="carregada.set(true)"
            (error)="semAnimacao.set(true)"
          />
        </picture>
      } @else {
        <img
          [src]="'exercises/' + id() + '/0.jpg'"
          alt=""
          decoding="async"
          (load)="carregada.set(true)"
          (error)="carregada.set(true)"
        />
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
    .carregando {
      background: linear-gradient(100deg, var(--esqueleto) 30%, var(--esqueleto-brilho) 50%, var(--esqueleto) 70%) 0 0 / 200% 100%;
      animation: brilho 1.4s linear infinite;
    }
    @keyframes brilho {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .carregando {
        animation: none;
      }
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
  protected readonly carregada = signal(false);

  constructor() {
    // Ao trocar de exercício, volta ao estado de carregamento.
    effect(() => {
      this.id();
      this.carregada.set(false);
      this.semAnimacao.set(false);
    });
  }
}
