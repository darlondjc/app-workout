import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExerciseImage } from '../core/exercise-image';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { PlanService } from '../core/plan.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-workout',
  imports: [RouterLink, Icon, ExerciseImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ficha(); as f) {
      @if (item(); as it) {
        <div class="treino">
          <header class="topo">
            <a class="sair" routerLink="/" aria-label="Sair do treino">
              <app-icon name="close" [size]="20" [stroke]="2.2" />
            </a>
            <div>
              <p class="rotulo">Ficha {{ plans.letra(f.id) }} · {{ f.nome }}</p>
              <p class="posicao">Exercício {{ indice() + 1 }} de {{ f.itens.length }}</p>
            </div>
          </header>

          <div class="barra" role="progressbar" aria-label="Progresso do treino" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progresso()">
            <div class="barra__cheia" [style.width.%]="progresso()"></div>
          </div>

          <div class="exercicio">
            <div class="foto">
              <app-exercise-image [id]="it.exerciseId" [descricao]="'Demonstração: ' + nome()" />
            </div>
            <div>
              <h1>{{ nome() }}</h1>
              <a class="ver" [routerLink]="['/exercicio', it.exerciseId]">Ver instruções</a>
            </div>
          </div>

          <div class="tabela" role="group" aria-label="Séries">
            <div class="cabecalho" aria-hidden="true">
              <span>Série</span><span>Carga (kg)</span><span>{{ it.unidade === 'min' ? 'Min' : 'Reps' }}</span><span>Feito</span>
            </div>
            @for (s of series(); track s.n) {
              <div class="serie" [class.feita]="s.feita">
                <span class="n">{{ s.n }}</span>
                <span>{{ it.carga }}</span>
                <span>{{ it.reps }}</span>
                <button
                  type="button"
                  class="marca"
                  [attr.aria-pressed]="s.feita"
                  [attr.aria-label]="'Marcar série ' + s.n + ' como feita'"
                  (click)="alternar(s.n - 1)"
                >
                  <app-icon name="check" [size]="20" [stroke]="3" />
                </button>
              </div>
            }
          </div>

          <div class="descanso" role="timer" aria-live="off">
            <div>
              <p class="rotulo">{{ descansoAtivo() > 0 ? 'Descansando' : 'Descanso' }}</p>
              <p class="tempo">{{ tempo() }}</p>
            </div>
            <span class="selo">{{ feitas() }} de {{ series().length }} séries</span>
          </div>

          <div class="rodape">
            @if (indice() > 0) {
              <button type="button" class="btn btn--claro-escuro" (click)="anterior()">Anterior</button>
            }
            <button type="button" class="btn btn--destaque" (click)="proximo()">
              {{ ultimo() ? 'Finalizar treino' : 'Próximo exercício' }}
              @if (!ultimo()) {
                <app-icon name="chevron" [size]="18" [stroke]="2.5" />
              }
            </button>
          </div>
        </div>
      } @else {
        <section class="page">
          <h1 class="titulo">Ficha vazia</h1>
          <p class="apoio">Adicione exercícios antes de iniciar o treino.</p>
          <a class="btn btn--claro" [routerLink]="['/ficha', f.id]">Montar ficha</a>
        </section>
      }
    } @else {
      <section class="page">
        <h1 class="titulo">Ficha não encontrada</h1>
        <a class="btn btn--claro" routerLink="/fichas">Voltar para as fichas</a>
      </section>
    }
  `,
  styles: `
    .treino {
      min-height: 100dvh;
      background: var(--ink);
      color: #fff;
      padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .topo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sair {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--dark2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rotulo {
      font-size: 13px;
      color: #b9c0ba;
    }
    .posicao {
      font-weight: 700;
      font-size: 15px;
    }
    .barra {
      height: 6px;
      border-radius: 3px;
      background: var(--dark2);
      overflow: hidden;
    }
    .barra__cheia {
      height: 100%;
      background: var(--accent);
      transition: width 0.25s;
    }
    .exercicio {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .foto {
      flex: none;
      width: 96px;
      height: 96px;
      border-radius: 16px;
      overflow: hidden;
    }
    h1 {
      font-family: var(--font-display);
      font-size: 24px;
      line-height: 1.15;
    }
    .ver {
      display: inline-block;
      margin-top: 6px;
      font-size: 14px;
      color: var(--accent);
      text-decoration: underline;
    }
    .tabela {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cabecalho,
    .serie {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr) minmax(0, 1fr) 52px;
      gap: 8px;
      align-items: center;
      text-align: center;
    }
    .cabecalho {
      padding: 0 8px;
      font-size: 12px;
      color: #b9c0ba;
    }
    .cabecalho span:first-child,
    .serie .n {
      text-align: left;
      padding-left: 8px;
    }
    .serie {
      padding: 6px 8px;
      border-radius: 14px;
      background: #1d2125;
      font-weight: 700;
      font-size: 18px;
    }
    .serie.feita {
      background: #232a1b;
    }
    .marca {
      width: 44px;
      height: 44px;
      margin: 0 auto;
      border-radius: 50%;
      border: 1.5px solid #8a918c;
      background: transparent;
      color: #8a918c;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .marca[aria-pressed='true'] {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--ink);
    }
    .descanso {
      background: var(--dark2);
      border-radius: 20px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tempo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 34px;
      line-height: 1.1;
    }
    .selo {
      background: var(--accent);
      color: var(--ink);
      font-size: 14px;
      font-weight: 700;
      border-radius: 999px;
      padding: 10px 16px;
    }
    .rodape {
      margin-top: auto;
      display: flex;
      gap: 10px;
    }
    .rodape .btn {
      flex: 1;
      min-height: 56px;
    }
    .btn--claro-escuro {
      background: var(--dark2);
      color: #fff;
    }
  `,
})
export class Workout {
  readonly id = input.required<string>();

  protected readonly plans = inject(PlanService);
  private readonly ex = inject(ExerciseService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly indice = signal(0);
  private readonly marcadas = signal<Record<number, boolean[]>>({});
  protected readonly descansoAtivo = signal(0);
  private intervalo?: ReturnType<typeof setInterval>;

  protected readonly ficha = computed(() => this.plans.get(this.id()));
  protected readonly item = computed(() => this.ficha()?.itens[this.indice()]);
  protected readonly ultimo = computed(() => this.indice() >= (this.ficha()?.itens.length ?? 1) - 1);

  protected readonly nome = computed(() => {
    const it = this.item();
    const e = it ? this.ex.get(it.exerciseId) : undefined;
    return e ? this.ex.nome(e) : (it?.exerciseId ?? '');
  });

  protected readonly series = computed(() => {
    const it = this.item();
    if (!it) return [];
    const feitas = this.marcadas()[this.indice()] ?? [];
    return Array.from({ length: it.series }, (_, k) => ({ n: k + 1, feita: !!feitas[k] }));
  });

  protected readonly feitas = computed(() => this.series().filter((s) => s.feita).length);

  protected readonly progresso = computed(() => {
    const total = this.ficha()?.itens.length ?? 0;
    const series = this.series().length;
    if (total === 0) return 0;
    const fracao = series > 0 ? this.feitas() / series : 0;
    return Math.round(((this.indice() + fracao) / total) * 100);
  });

  protected readonly tempo = computed(() => {
    const segundos = this.descansoAtivo() > 0 ? this.descansoAtivo() : (this.item()?.descanso ?? 0);
    const m = String(Math.floor(segundos / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    return `${m}:${s}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararDescanso());
  }

  protected alternar(k: number): void {
    const it = this.item();
    if (!it) return;
    const i = this.indice();
    let ficouFeita = false;
    this.marcadas.update((m) => {
      const atual = [...(m[i] ?? Array<boolean>(it.series).fill(false))];
      atual[k] = !atual[k];
      ficouFeita = atual[k];
      return { ...m, [i]: atual };
    });
    const todas = (this.marcadas()[i] ?? []).filter(Boolean).length === it.series;
    if (ficouFeita && !todas) this.iniciarDescanso(it.descanso);
    else this.pararDescanso();
  }

  protected anterior(): void {
    this.pararDescanso();
    this.indice.update((n) => Math.max(0, n - 1));
  }

  protected proximo(): void {
    this.pararDescanso();
    if (!this.ultimo()) {
      this.indice.update((n) => n + 1);
      return;
    }
    this.plans.registrarSessao(this.id());
    this.toast.mostrar('Treino concluído. Bom trabalho!');
    this.router.navigate(['/']);
  }

  private iniciarDescanso(segundos: number): void {
    this.pararDescanso();
    if (segundos <= 0) return;
    this.descansoAtivo.set(segundos);
    this.intervalo = setInterval(() => {
      this.descansoAtivo.update((v) => v - 1);
      if (this.descansoAtivo() <= 0) {
        this.pararDescanso();
        navigator.vibrate?.(200);
      }
    }, 1000);
  }

  private pararDescanso(): void {
    clearInterval(this.intervalo);
    this.intervalo = undefined;
    this.descansoAtivo.set(0);
  }
}
