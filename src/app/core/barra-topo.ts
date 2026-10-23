import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input } from '@angular/core';

/**
 * Barra que aparece no topo conforme a tela rola: título à esquerda e, à direita, o que for projetado (foto, botão).
 * Ocupa um ponto fixo de altura zero (sticky) na página, então não muda o layout. O quanto ela já apareceu (`--p`, de 0 a 1)
 * vem da rolagem; opacidade e transform são a única coisa animada. Fica decorativa para leitores de tela
 * (o cabeçalho grande continua lá), e só recebe toques depois de bem visível.
 */
@Component({
  selector: 'app-barra-topo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="barra">
      <span class="nome">{{ titulo() }}</span>
      <span class="acao"><ng-content /></span>
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      top: env(safe-area-inset-top, 0px);
      z-index: 5;
      display: block;
      height: 0;
      margin-bottom: -16px;
      --mov: 1;
    }
    .barra {
      position: absolute;
      top: 0;
      left: -20px;
      right: -20px;
      height: 56px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      isolation: isolate;
      pointer-events: none;
    }
    /* O fundo fosco aparece primeiro (e rápido), para cobrir o que passa por baixo antes do título entrar. */
    .barra::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background: color-mix(in srgb, var(--bg) 94%, transparent);
      -webkit-backdrop-filter: saturate(1.4) blur(14px);
      backdrop-filter: saturate(1.4) blur(14px);
      box-shadow: 0 1px 0 color-mix(in srgb, var(--line) 70%, transparent);
      opacity: calc(var(--p, 0) * 3);
      will-change: opacity;
    }
    :host([data-rolado]) .barra {
      pointer-events: auto;
    }
    .nome {
      min-width: 0;
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: calc((var(--p, 0) - 0.3) / 0.7);
      transform: translate3d(0, calc((1 - var(--p, 0)) * 8px * var(--mov)), 0);
      will-change: opacity, transform;
    }
    .acao {
      flex: none;
      display: flex;
      opacity: calc((var(--p, 0) - 0.3) / 0.7);
      transform: scale(calc(0.8 + var(--p, 0) * 0.2));
      will-change: opacity, transform;
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        --mov: 0;
      }
    }
  `,
})
export class BarraTopo {
  readonly titulo = input.required<string>();
  /** Quanto a tela precisa rolar para a barra começar a aparecer, e a distância até ela ficar inteira. */
  readonly inicio = input(62);
  readonly distancia = input(46);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destruir = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      let quadro = 0;
      const atualizar = () => {
        quadro = 0;
        const t = Math.min(1, Math.max(0, (window.scrollY - this.inicio()) / this.distancia()));
        const p = t * t * (3 - 2 * t); // começa e termina devagar
        el.style.setProperty('--p', p.toFixed(3));
        el.toggleAttribute('data-rolado', p > 0.6);
      };
      const aoRolar = () => {
        if (!quadro) quadro = requestAnimationFrame(atualizar);
      };
      window.addEventListener('scroll', aoRolar, { passive: true });
      atualizar();
      destruir.onDestroy(() => {
        window.removeEventListener('scroll', aoRolar);
        cancelAnimationFrame(quadro);
      });
    });
  }
}
