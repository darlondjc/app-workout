import { Directive, ElementRef, DestroyRef, effect, inject, input } from '@angular/core';

/** Diminui a letra do título até caber em duas linhas; abaixo do tamanho mínimo, corta com reticências. */
export function ajustarTitulo(el: HTMLElement, minimo: number): void {
  el.style.fontSize = '';
  let tamanho = parseFloat(getComputedStyle(el).fontSize);
  // scrollHeight maior que clientHeight: o texto passou das duas linhas (o resto está escondido pelo corte).
  while (el.scrollHeight > el.clientHeight + 1 && tamanho > minimo) {
    tamanho -= 1;
    el.style.fontSize = `${tamanho}px`;
  }
}

/**
 * Use em um título: `appTituloEmDuasLinhas="texto"`. Refaz a conta quando o texto muda, quando a largura
 * disponível muda (girar o celular) e quando a fonte termina de carregar.
 */
@Directive({
  selector: '[appTituloEmDuasLinhas]',
  host: {
    '[style.display]': '"-webkit-box"',
    '[style.-webkit-box-orient]': '"vertical"',
    '[style.-webkit-line-clamp]': '2',
    '[style.line-clamp]': '2',
    '[style.overflow]': '"hidden"',
    '[style.overflow-wrap]': '"anywhere"',
  },
})
export class TituloEmDuasLinhas {
  /** O texto do título; ao mudar, o ajuste é refeito. */
  readonly appTituloEmDuasLinhas = input.required<string>();
  /** Menor tamanho de letra, em px (13 faz caber o maior nome da base, de 67 letras, em duas linhas). */
  readonly tamanhoMinimo = input(13);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private quadro = 0;

  constructor() {
    const refazer = () => {
      cancelAnimationFrame(this.quadro);
      this.quadro = requestAnimationFrame(() => ajustarTitulo(this.el, this.tamanhoMinimo()));
    };
    effect(() => {
      this.appTituloEmDuasLinhas();
      refazer();
    });
    if (typeof ResizeObserver !== 'undefined') {
      let largura = 0;
      const obs = new ResizeObserver(() => {
        const nova = this.el.clientWidth;
        if (nova !== largura) {
          largura = nova;
          refazer();
        }
      });
      obs.observe(this.el);
      inject(DestroyRef).onDestroy(() => obs.disconnect());
    }
    void document.fonts?.ready.then(refazer);
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.quadro));
  }
}
