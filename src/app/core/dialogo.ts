import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, afterNextRender, inject, input, output, viewChild } from '@angular/core';
import { Icon } from './icon';

let contador = 0;
/** Diálogos abertos, do mais antigo para o mais novo: o Esc fecha só o de cima. */
const abertos: object[] = [];

/**
 * Janela de diálogo: título, botão de fechar e o conteúdo projetado, com rolagem própria.
 * Fecha com o X, tocando fora ou com Esc; o foco entra na janela e volta para quem a abriu.
 * Com `folha`, sobe de baixo da tela ocupando 85% da altura (bottom sheet), em vez de abrir no centro.
 */
@Component({
  selector: 'app-dialogo',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="fundo" tabindex="-1" aria-label="Fechar" (click)="fechar.emit()"></button>
    <div #caixa class="caixa" [class.caixa--folha]="folha()" role="dialog" aria-modal="true" [attr.aria-labelledby]="idTitulo" (keydown.tab)="prenderFoco($event, false)" (keydown.shift.tab)="prenderFoco($event, true)">
      <header class="topo">
        <div class="topo__txt">
          <h2 class="titulo" [id]="idTitulo">{{ titulo() }}</h2>
          @if (subtitulo()) {
            <p class="apoio">{{ subtitulo() }}</p>
          }
        </div>
        <button #botaoFechar type="button" class="x" aria-label="Fechar" (click)="fechar.emit()">
          <app-icon name="close" [size]="20" [stroke]="2.4" />
        </button>
      </header>
      <div class="corpo"><ng-content /></div>
    </div>
  `,
  styles: `
    .fundo { position: fixed; inset: 0; z-index: var(--dialogo-z, 50); border: 0; padding: 0; cursor: default; background: rgba(0, 0, 0, 0.6); }
    .caixa {
      position: fixed; z-index: calc(var(--dialogo-z, 50) + 1); left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: min(94%, 440px); max-height: 86dvh; box-sizing: border-box;
      display: flex; flex-direction: column; border-radius: 24px; background: var(--card, #fff); color: var(--ink);
    }
    .caixa--folha {
      top: auto; bottom: 0; transform: translateX(-50%); width: min(100%, 560px);
      height: 85dvh; max-height: 85dvh; border-radius: 24px 24px 0 0;
      animation: sobe 0.25s ease-out;
    }
    @keyframes sobe { from { transform: translate(-50%, 100%); } }
    @media (prefers-reduced-motion: reduce) { .caixa--folha { animation: none; } }
    .topo { display: flex; align-items: flex-start; gap: 12px; padding: 18px 16px 12px 20px; border-bottom: 1px solid var(--soft); }
    .topo__txt { flex: 1; min-width: 0; }
    .titulo { margin: 0; font-family: var(--font-display); font-size: 20px; line-height: 1.2; overflow-wrap: anywhere; }
    .topo__txt .apoio { margin: 2px 0 0; }
    .x { flex: none; width: 44px; height: 44px; margin: -6px -4px 0 0; border: 0; border-radius: 50%; background: var(--soft); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .corpo { padding: 16px 20px calc(20px + env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; }
  `,
})
export class Dialogo {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>('');
  /** Abre como folha de baixo para cima (85% da altura) em vez de janela centralizada. */
  readonly folha = input(false);
  readonly fechar = output<void>();

  protected readonly idTitulo = `dialogo-titulo-${++contador}`;
  private readonly caixa = viewChild.required<ElementRef<HTMLElement>>('caixa');
  private readonly botaoFechar = viewChild.required<ElementRef<HTMLButtonElement>>('botaoFechar');

  constructor() {
    const anterior = document.activeElement as HTMLElement | null;
    afterNextRender(() => this.botaoFechar().nativeElement.focus());
    abertos.push(this);
    inject(DestroyRef).onDestroy(() => {
      abertos.splice(abertos.indexOf(this), 1);
      if (anterior?.isConnected) anterior.focus();
    });
  }

  @HostListener('document:keydown.escape')
  protected aoApertarEsc(): void {
    if (abertos.at(-1) === this) this.fechar.emit();
  }

  /** Tab e Shift+Tab ficam dentro da janela. */
  protected prenderFoco(e: Event, voltando: boolean): void {
    const focaveis = [...this.caixa().nativeElement.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    if (focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const ativo = document.activeElement;
    if (voltando && ativo === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!voltando && ativo === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }
}
