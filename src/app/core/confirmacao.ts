import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Dialogo } from './dialogo';

/**
 * Pergunta de confirmação em diálogo: título, texto opcional (ou conteúdo projetado) e dois botões.
 * Fechar de qualquer jeito (Cancelar, X, Esc, tocar fora) emite `cancelar`; nada acontece até `confirmar`.
 */
@Component({
  selector: 'app-confirmacao',
  imports: [Dialogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo [titulo]="titulo()" [subtitulo]="subtitulo()" (fechar)="cancelar.emit()">
      <ng-content />
      @if (mensagem()) {
        <p class="apoio">{{ mensagem() }}</p>
      }
      <div class="confirma">
        <button type="button" class="btn" [class.btn--perigo]="perigo()" [class.btn--escuro]="!perigo()" (click)="confirmar.emit()">{{ rotulo() }}</button>
        <button type="button" class="btn btn--claro" (click)="cancelar.emit()">{{ rotuloCancelar() }}</button>
      </div>
    </app-dialogo>
  `,
  styles: `
    .confirma { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
    .btn--perigo { background: #b3261e; color: #fff; }
  `,
})
export class Confirmacao {
  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  readonly mensagem = input('');
  /** Texto do botão que confirma (ex.: "Apagar"). */
  readonly rotulo = input('Confirmar');
  readonly rotuloCancelar = input('Cancelar');
  /** Ação destrutiva: o botão de confirmar fica vermelho. */
  readonly perigo = input(true);

  readonly confirmar = output<void>();
  readonly cancelar = output<void>();
}
