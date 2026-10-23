import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { Dialogo } from './dialogo';
import { FotoBotao } from './foto-botao';

/** Último passo do treino: foto opcional para a timeline e o botão de concluir. Fechar volta para o treino. */
@Component({
  selector: 'app-concluir-treino',
  imports: [Dialogo, FotoBotao],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo titulo="Concluir treino" subtitulo="Quer postar uma foto deste treino na timeline?" (fechar)="cancelar.emit()">
      @if (foto(); as f) {
        <img class="previa" [src]="f" alt="Foto escolhida para o treino" />
        <div class="duas">
          <app-foto-botao rotulo="Trocar foto" (escolhida)="foto.set($event)" />
          <button type="button" class="btn btn--claro" (click)="foto.set(null)">Remover</button>
        </div>
      } @else {
        <app-foto-botao (escolhida)="foto.set($event)" />
      }
      <button type="button" class="btn btn--destaque concluir" (click)="concluir.emit(foto())">Concluir treino</button>
    </app-dialogo>
  `,
  styles: `
    .previa { display: block; width: 100%; max-height: 300px; object-fit: cover; border-radius: 16px; margin-bottom: 10px; background: var(--soft); }
    .duas { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
    .concluir { width: 100%; margin-top: 14px; }
  `,
})
export class ConcluirTreino {
  /** Foto escolhida (já reduzida) ou `null` para concluir sem foto. */
  readonly concluir = output<string | null>();
  readonly cancelar = output<void>();
  protected readonly foto = signal<string | null>(null);
}
