import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Esqueleto de carregamento: o desenho vazio do que vai aparecer, no mesmo tamanho, para a tela não
 * ficar em branco nem "pular" quando o conteúdo chega. Quem usa leitor de tela ouve só o `texto`.
 */
@Component({
  selector: 'app-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-live="polite">
      <span class="sr-only">{{ texto() }}</span>
      <div class="forma" aria-hidden="true">
        @switch (modelo()) {
          @case ('lista') {
            @for (i of vezes(); track i) {
              <div class="card linha">
                <span class="bloco bloco--foto"></span>
                <span class="coluna">
                  <span class="bloco" style="width: 70%; height: 16px"></span>
                  <span class="bloco" style="width: 45%; height: 12px"></span>
                </span>
              </div>
            }
          }
          @case ('formulario') {
            <span class="bloco" style="width: 40%; height: 18px"></span>
            <div class="pilulas">
              @for (i of [88, 96, 80, 104, 76, 92, 100, 84, 90]; track $index) {
                <span class="bloco bloco--pilula" [style.width.px]="i"></span>
              }
            </div>
            <span class="bloco" style="width: 100%; height: 52px; border-radius: 999px"></span>
          }
          @case ('detalhe') {
            <span class="bloco" style="width: 100%; height: 240px; border-radius: 16px"></span>
            <div class="pilulas">
              @for (i of [84, 96, 72]; track $index) {
                <span class="bloco bloco--pilula" [style.width.px]="i"></span>
              }
            </div>
            <span class="bloco" style="width: 100%; height: 44px; border-radius: 14px"></span>
            @for (i of [100, 92, 96, 70]; track $index) {
              <span class="bloco" [style.width.%]="i" style="height: 14px"></span>
            }
          }
          @case ('treino') {
            <span class="bloco" style="width: 55%; height: 18px"></span>
            <div class="linha-treino">
              <span class="bloco bloco--foto" style="width: 92px; height: 92px"></span>
              <span class="coluna">
                <span class="bloco" style="width: 90%; height: 20px"></span>
                <span class="bloco" style="width: 60%; height: 14px"></span>
              </span>
            </div>
            <div class="pilulas">
              @for (i of [1, 2, 3]; track i) {
                <span class="bloco" style="flex: 1; height: 56px; border-radius: 14px"></span>
              }
            </div>
            <span class="bloco" style="width: 100%; height: 220px; border-radius: 20px"></span>
          }
          @default {
            @for (i of vezes(); track i) {
              <span class="bloco" [style.width.%]="i % 3 === 0 ? 70 : 100" style="height: 14px"></span>
            }
          }
        }
      </div>
    </div>
  `,
  styles: `
    .forma {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 4px 0;
    }
    /* 94 px é a altura de uma linha real da Biblioteca: o conteúdo entra sem empurrar nada. */
    .linha {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      min-height: 94px;
    }
    .coluna {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .linha-treino {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .pilulas {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .bloco {
      display: block;
      max-width: 100%;
      border-radius: 8px;
      background: linear-gradient(90deg, var(--soft) 0%, color-mix(in srgb, var(--soft) 50%, var(--card)) 50%, var(--soft) 100%);
      background-size: 200% 100%;
      animation: brilho 1.4s ease-in-out infinite;
    }
    .bloco--foto {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      flex: none;
    }
    .bloco--pilula {
      height: 44px;
      border-radius: 999px;
    }
    @keyframes brilho {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: -100% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bloco {
        animation: none;
        background: var(--soft);
      }
    }
  `,
})
export class Esqueleto {
  /** O desenho: `lista` (cartões com foto), `formulario` (título, botões de escolha e botão), `detalhe` (foto grande e texto), `treino` ou `texto` (linhas). */
  readonly modelo = input<'lista' | 'formulario' | 'detalhe' | 'treino' | 'texto'>('texto');
  /** Quantos cartões ou linhas (nos modelos `lista` e `texto`). */
  readonly quantidade = input(5);
  /** O que o leitor de tela anuncia. */
  readonly texto = input('Carregando…');
  protected readonly vezes = computed(() => Array.from({ length: this.quantidade() }, (_, i) => i + 1));
}
