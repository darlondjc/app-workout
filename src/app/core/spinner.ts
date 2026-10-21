import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Indicador de carregamento para ocupar o lugar de um conteúdo que ainda não chegou. */
@Component({
  selector: 'app-carregando',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caixa" role="status" aria-live="polite">
      <span class="roda" aria-hidden="true"></span>
      <span class="texto">{{ texto() }}</span>
    </div>
  `,
  styles: `
    .caixa {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 0;
      color: var(--muted);
      font-size: 14px;
    }
    .roda {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid var(--soft);
      border-top-color: var(--ink);
      animation: girar 0.8s linear infinite;
    }
    @keyframes girar {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .roda {
        animation-duration: 2.4s;
      }
    }
  `,
})
export class Carregando {
  readonly texto = input('Carregando…');
}
