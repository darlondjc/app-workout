import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { kcalTexto } from './calorias';
import { ExerciseService } from './exercise.service';
import { Sessao } from './models';

export interface LinhaSerie {
  n: number;
  reps: number;
  carga: number;
  /** Tempo desde a série anterior, em "m:ss"; ausente na primeira série e em treinos antigos. */
  intervalo: string | null;
}

export interface LinhaExercicio {
  id: string;
  nome: string;
  minutos: boolean;
  series: LinhaSerie[];
  temIntervalo: boolean;
}

/** 65 → "1:05". */
export function intervalo(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/** Um exercício por linha, com as séries realmente feitas no treino. */
export function montarLinhas(s: Sessao, nomeDe: (id: string) => string): LinhaExercicio[] {
  return (s.registros ?? [])
    .filter((r) => r.series.length > 0)
    .map((r) => {
      const series = r.series.map((x, i) => ({
        n: i + 1,
        reps: x.reps,
        carga: x.carga,
        intervalo: typeof x.descanso === 'number' && x.descanso > 0 ? intervalo(x.descanso) : null,
      }));
      return { id: r.exerciseId, nome: nomeDe(r.exerciseId), minutos: r.unidade === 'min', series, temIntervalo: series.some((x) => x.intervalo !== null) };
    });
}

/** O que foi feito em um treino concluído: cada exercício com suas séries (repetições, carga e intervalo). */
@Component({
  selector: 'app-sessao-detalhe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sessao().nota; as n) {
      <p class="nota"><span class="apoio">Nota do treino</span>{{ n }}</p>
    }
    @if (kcal(); as k) {
      <p class="kcal">
        <strong>{{ kcalTexto(k) }}</strong>
        <span class="apoio">estimativa a partir do seu peso e da duração do treino</span>
      </p>
    }
    @for (r of linhas(); track $index) {
      <section class="ex">
        <h4 class="ex__titulo">
          <button type="button" class="ex__topo" aria-haspopup="dialog" [attr.aria-label]="'Ver imagem de ' + r.nome" (click)="verExercicio.emit(r.id)">
            <img class="ex__img" [src]="ex.imagem(r.id, 0)" alt="" loading="lazy" />
            <span class="ex__nome">{{ r.nome }}</span>
          </button>
        </h4>
        <table class="series">
          <caption class="sr-only">Séries de {{ r.nome }}</caption>
          <thead>
            <tr>
              <th scope="col">Série</th>
              <th scope="col">{{ r.minutos ? 'Min' : 'Reps' }}</th>
              @if (!r.minutos) {
                <th scope="col">Carga</th>
              }
              @if (r.temIntervalo) {
                <th scope="col">Intervalo</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (s of r.series; track s.n) {
              <tr>
                <td>{{ s.n }}</td>
                <td>{{ s.reps }}</td>
                @if (!r.minutos) {
                  <td>{{ s.carga }} kg</td>
                }
                @if (r.temIntervalo) {
                  <td>{{ s.intervalo ?? '—' }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </section>
    } @empty {
      <p class="apoio">Este treino não tem os exercícios registrados.</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .nota { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--soft); display: flex; flex-direction: column; gap: 2px; font-size: 15px; line-height: 1.35; white-space: pre-line; overflow-wrap: anywhere; }
    .nota .apoio { font-size: 12px; }
    .kcal { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--soft); display: flex; flex-direction: column; gap: 2px; }
    .kcal strong { font-family: var(--font-display); font-size: 18px; }
    .kcal span { font-size: 12px; }
    .ex { display: flex; flex-direction: column; gap: 6px; }
    .ex__titulo { margin: 0; }
    .ex__topo { width: 100%; display: flex; align-items: center; gap: 10px; padding: 0; border: 0; background: none; font: inherit; color: inherit; text-align: left; border-radius: 12px; }
    .ex__img { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; background: #fff; flex: none; }
    .ex__nome { font-size: 15px; font-weight: 700; line-height: 1.25; text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 3px; }
    .series { width: 100%; table-layout: fixed; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    .series th { text-align: left; font-size: 12px; font-weight: 500; color: var(--muted); padding: 2px 8px 2px 0; }
    .series td { font-size: 15px; padding: 4px 8px 4px 0; border-top: 1px solid var(--soft); }
  `,
})
export class SessaoDetalhe {
  readonly sessao = input.required<Sessao>();
  /** Calorias estimadas do treino. Quem usa passa só nos treinos da própria pessoa; sem valor, a linha não aparece. */
  readonly kcal = input<number | null>(null);
  protected readonly kcalTexto = kcalTexto;
  /** Quem usa decide como mostrar a imagem (o diálogo do treino não pode abrir outro dentro dele). */
  readonly verExercicio = output<string>();
  protected readonly ex = inject(ExerciseService);

  protected readonly linhas = computed(() =>
    montarLinhas(this.sessao(), (id) => {
      const e = this.ex.get(id);
      return e ? this.ex.nome(e) : id;
    }),
  );
}
