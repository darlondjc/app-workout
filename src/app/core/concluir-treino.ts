import { ChangeDetectionStrategy, Component, output, signal, viewChild } from '@angular/core';
import { Dialogo } from './dialogo';
import { EnquadrarFoto } from './enquadrar-foto';
import { FotoBotao } from './foto-botao';

/** Último passo do treino: foto opcional para a timeline e o botão de concluir. Fechar volta para o treino. */
@Component({
  selector: 'app-concluir-treino',
  imports: [Dialogo, FotoBotao, EnquadrarFoto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo titulo="Concluir treino" subtitulo="Quer postar uma foto deste treino na timeline?" (fechar)="cancelar.emit()">
      @if (foto(); as f) {
        <app-enquadrar-foto [foto]="f" />
        <div class="duas">
          <app-foto-botao rotulo="Trocar foto" (escolhida)="foto.set($event)" />
          <button type="button" class="btn btn--claro" (click)="foto.set(null)">Remover</button>
        </div>
      } @else {
        <app-foto-botao (escolhida)="foto.set($event)" />
      }
      <button type="button" class="btn btn--destaque concluir" [disabled]="concluindo()" (click)="finalizar()">{{ concluindo() ? 'Preparando a foto…' : 'Concluir treino' }}</button>
    </app-dialogo>
  `,
  styles: `
    .duas { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
    .concluir { width: 100%; margin-top: 14px; }
  `,
})
export class ConcluirTreino {
  /** Foto escolhida (já reduzida) ou `null` para concluir sem foto. */
  readonly concluir = output<string | null>();
  readonly cancelar = output<void>();
  protected readonly foto = signal<string | null>(null);
  protected readonly concluindo = signal(false);
  private readonly enquadrador = viewChild(EnquadrarFoto);

  /** Entrega a foto já recortada no que a pessoa enquadrou; se o recorte falhar, vai a foto inteira. */
  protected async finalizar(): Promise<void> {
    const original = this.foto();
    if (!original) {
      this.concluir.emit(null);
      return;
    }
    this.concluindo.set(true);
    let final = original;
    try {
      final = (await this.enquadrador()?.recortar()) ?? original;
    } catch {
      /* mantém a foto inteira */
    }
    this.concluindo.set(false);
    this.concluir.emit(final);
  }
}
