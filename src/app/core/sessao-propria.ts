import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ExerciseService } from './exercise.service';
import { Icon } from './icon';
import { RegistroExercicio, Sessao } from './models';
import { NOTA_TREINO_MAX } from './notas';
import { PlanService } from './plan.service';
import { SessaoDetalhe } from './sessao-detalhe';
import { ToastService } from './toast.service';

interface SerieRascunho {
  carga: number;
  reps: number;
  descanso?: number;
}
interface ExercicioRascunho {
  exerciseId: string;
  unidade?: 'reps' | 'min';
  series: SerieRascunho[];
}

/** Copia só o que vale guardar: sem exercícios vazios e sem `descanso` indefinido (o Firestore não aceita `undefined`). */
export function registrosDoRascunho(r: ExercicioRascunho[]): RegistroExercicio[] {
  return r
    .filter((e) => e.series.length > 0)
    .map((e) => ({
      exerciseId: e.exerciseId,
      ...(e.unidade ? { unidade: e.unidade } : {}),
      series: e.series.map((s) => ({ carga: s.carga, reps: s.reps, ...(s.descanso != null ? { descanso: s.descanso } : {}) })),
    }));
}

/**
 * Um treino da própria pessoa: o detalhe de sempre, mais corrigir (séries e nota) e apagar.
 * Apagar pede um segundo toque no próprio lugar, sem abrir outro diálogo por cima do treino.
 */
@Component({
  selector: 'app-sessao-propria',
  imports: [SessaoDetalhe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editando()) {
      <form class="editor" (submit)="$event.preventDefault(); salvar()">
        @for (e of rascunho(); track $index; let i = $index) {
          <fieldset class="ex">
            <legend class="ex__nome">{{ nome(e.exerciseId) }}</legend>
            @for (s of e.series; track $index; let k = $index) {
              <div class="serie">
                <span class="n">{{ k + 1 }}</span>
                <label>
                  <span class="sr-only">{{ e.unidade === 'min' ? 'Minutos' : 'Repetições' }} da série {{ k + 1 }} de {{ nome(e.exerciseId) }}</span>
                  <input class="valor" type="number" inputmode="numeric" min="0" [value]="s.reps" (change)="mudar(i, k, 'reps', $event)" />
                </label>
                @if (e.unidade !== 'min') {
                  <label>
                    <span class="sr-only">Carga da série {{ k + 1 }} de {{ nome(e.exerciseId) }}, em quilos</span>
                    <input class="valor" type="number" inputmode="decimal" min="0" step="0.5" [value]="s.carga" (change)="mudar(i, k, 'carga', $event)" />
                  </label>
                  <span class="un">kg</span>
                }
                <button type="button" class="tirar" [attr.aria-label]="'Tirar a série ' + (k + 1) + ' de ' + nome(e.exerciseId)" (click)="tirarSerie(i, k)">
                  <app-icon name="close" [size]="16" [stroke]="2.4" />
                </button>
              </div>
            }
            @if (e.series.length === 0) {
              <p class="apoio">Sem séries: este exercício sai do treino ao salvar.</p>
            }
          </fieldset>
        }
        <label class="nota-campo">
          <span class="apoio">Nota do treino</span>
          <textarea rows="3" [attr.maxlength]="notaMax" [value]="nota()" (input)="nota.set(lerCampo($event))"></textarea>
        </label>
        @if (vazio()) {
          <p class="apoio aviso">Deixe ao menos uma série. Para tirar o treino do histórico, use Excluir.</p>
        }
        <div class="botoes">
          <button type="submit" class="btn btn--escuro" [disabled]="vazio()">Salvar correção</button>
          <button type="button" class="btn btn--claro" (click)="editando.set(false)">Cancelar</button>
        </div>
      </form>
    } @else {
      <app-sessao-detalhe [sessao]="sessao()" [kcal]="kcal()" (verExercicio)="verExercicio.emit($event)" />
      <div class="acoes">
        @if (!sessao().atividade && sessao().registros?.length) {
          <button type="button" class="btn btn--claro" (click)="comecarEdicao()">Corrigir treino</button>
        }
        @if (confirmando()) {
          <p class="apoio pergunta">Excluir este treino do histórico? Estatísticas e medalhas serão refeitas.</p>
          <button type="button" class="btn btn--perigo" (click)="excluir()">Sim, excluir</button>
          <button type="button" class="btn btn--claro" (click)="confirmando.set(false)">Não, manter</button>
        } @else {
          <button type="button" class="btn btn--borda-perigo" (click)="confirmando.set(true)">Excluir treino</button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .acoes { display: flex; flex-direction: column; gap: 8px; }
    .pergunta { margin: 4px 0 0; }
    .btn--perigo { background: #b3261e; color: #fff; }
    .btn--borda-perigo { background: transparent; border-color: var(--perigo); color: var(--perigo); }
    .editor { display: flex; flex-direction: column; gap: 14px; }
    .ex { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .ex__nome { padding: 0; font-size: 15px; font-weight: 700; line-height: 1.25; margin-bottom: 4px; }
    .serie { display: flex; align-items: center; gap: 8px; }
    .n { width: 20px; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 14px; }
    .valor { width: 76px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); font: inherit; font-size: 16px; text-align: center; }
    .un { color: var(--muted); font-size: 14px; }
    .tirar { margin-left: auto; width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; }
    .nota-campo { display: flex; flex-direction: column; gap: 4px; }
    .nota-campo textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); font: inherit; font-size: 16px; resize: vertical; }
    .aviso { margin: 0; }
    .botoes { display: flex; flex-direction: column; gap: 8px; }
    button:disabled { opacity: 0.45; }
  `,
})
export class SessaoPropria {
  readonly sessao = input.required<Sessao>();
  readonly kcal = input<number | null>(null);
  /** Quem usa decide como mostrar a imagem do exercício. */
  readonly verExercicio = output<string>();
  /** O treino foi apagado: quem o mostrava deve fechar o diálogo. */
  readonly excluida = output<void>();

  private readonly plans = inject(PlanService);
  private readonly ex = inject(ExerciseService);
  private readonly toast = inject(ToastService);

  protected readonly notaMax = NOTA_TREINO_MAX;
  protected readonly editando = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly rascunho = signal<ExercicioRascunho[]>([]);
  protected readonly nota = signal('');
  protected readonly vazio = computed(() => registrosDoRascunho(this.rascunho()).length === 0);

  protected nome(id: string): string {
    const e = this.ex.get(id);
    return e ? this.ex.nome(e) : id;
  }

  protected lerCampo(evento: Event): string {
    return (evento.target as HTMLTextAreaElement).value;
  }

  protected comecarEdicao(): void {
    const s = this.sessao();
    this.rascunho.set(
      (s.registros ?? []).map((r) => ({
        exerciseId: r.exerciseId,
        ...(r.unidade ? { unidade: r.unidade } : {}),
        series: r.series.map((x) => ({ ...x })),
      })),
    );
    this.nota.set(s.nota ?? '');
    this.confirmando.set(false);
    this.editando.set(true);
  }

  protected mudar(i: number, k: number, campo: 'reps' | 'carga', evento: Event): void {
    const v = (evento.target as HTMLInputElement).valueAsNumber;
    const valor = Number.isFinite(v) && v >= 0 ? v : 0;
    this.rascunho.update((l) => l.map((e, a) => (a !== i ? e : { ...e, series: e.series.map((s, b) => (b === k ? { ...s, [campo]: valor } : s)) })));
  }

  protected tirarSerie(i: number, k: number): void {
    this.rascunho.update((l) => l.map((e, a) => (a !== i ? e : { ...e, series: e.series.filter((_, b) => b !== k) })));
  }

  protected salvar(): void {
    const id = this.sessao().id;
    if (!id || this.vazio()) return;
    this.plans.editarSessao(id, { registros: registrosDoRascunho(this.rascunho()), nota: this.nota() });
    this.editando.set(false);
    this.toast.mostrar('Treino corrigido');
  }

  protected excluir(): void {
    const id = this.sessao().id;
    if (!id) return;
    const apagada = this.plans.excluirSessao(id);
    this.confirmando.set(false);
    if (apagada) this.toast.mostrar('Treino excluído', { rotulo: 'Desfazer', executar: () => this.plans.restaurarSessao(apagada) });
    this.excluida.emit();
  }
}
