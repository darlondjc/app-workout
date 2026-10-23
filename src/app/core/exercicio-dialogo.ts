import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Dialogo } from './dialogo';
import { ExerciseImage } from './exercise-image';
import { ExerciseService } from './exercise.service';

/** Imagem animada de como o exercício é executado, em diálogo. Fica ao lado (não dentro) de outro diálogo. */
@Component({
  selector: 'app-exercicio-dialogo',
  imports: [Dialogo, ExerciseImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo [titulo]="nome()" [subtitulo]="detalhe()" (fechar)="fechar.emit()">
      <div class="img"><app-exercise-image [id]="id()" [descricao]="'Demonstração: ' + nome()" /></div>
    </app-dialogo>
  `,
  styles: `
    /* Abre por cima de outro diálogo (o do treino). */
    :host { --dialogo-z: 60; }
    .img { height: 280px; border-radius: 16px; overflow: hidden; background: #fff; }
  `,
})
export class ExercicioDialogo {
  readonly id = input.required<string>();
  readonly fechar = output<void>();
  private readonly ex = inject(ExerciseService);

  private readonly exercicio = computed(() => this.ex.get(this.id()));
  protected readonly nome = computed(() => {
    const e = this.exercicio();
    return e ? this.ex.nome(e) : this.id();
  });
  protected readonly detalhe = computed(() => {
    const e = this.exercicio();
    return e ? `${this.ex.equipamento(e.equipment)} · ${this.ex.nivel(e.level)}` : '';
  });
}
