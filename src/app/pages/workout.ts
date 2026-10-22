import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExerciseImage } from '../core/exercise-image';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { RegistroExercicio } from '../core/models';
import { NavegacaoService } from '../core/navegacao.service';
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
            <button type="button" class="sair" (click)="nav.voltar('/')" aria-label="Sair do treino">
              <app-icon name="close" [size]="20" [stroke]="2.2" />
            </button>
            <div>
              <p class="rotulo">Ficha {{ plans.letra(f.id) }} · {{ f.nome }}</p>
              <p class="posicao">Exercício {{ indice() + 1 }} de {{ f.itens.length }}</p>
            </div>
          </header>

          <div class="barra" role="progressbar" aria-label="Progresso do treino" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progresso()">
            <div class="barra__cheia" [style.width.%]="progresso()"></div>
          </div>

          <div class="exercicio">
            <a class="foto" [routerLink]="['/exercicio', it.exerciseId]" [queryParams]="{ ficha: f.id, treino: 1 }" aria-label="Ver instruções do exercício">
              <app-exercise-image [id]="it.exerciseId" [descricao]="'Demonstração: ' + nome()" />
            </a>
            <div>
              <h1>{{ nome() }}</h1>
              <a class="ver" [routerLink]="['/exercicio', it.exerciseId]" [queryParams]="{ ficha: f.id, treino: 1 }">Ver instruções</a>
            </div>
          </div>

          <div class="tabela" role="group" aria-label="Séries">
            <div class="cabecalho" aria-hidden="true">
              <span>Série</span><span>{{ it.unidade === 'min' ? 'Min' : 'Reps' }}</span><span>Carga (kg)</span><span>Feito</span>
            </div>
            @for (s of series(); track s.n) {
              <div class="serie" [class.feita]="s.feita">
                <span class="n">{{ s.n }}</span>
                <input class="valor" type="number" inputmode="numeric" min="0" [value]="s.reps"
                  [attr.aria-label]="(it.unidade === 'min' ? 'Minutos' : 'Repetições') + ' da série ' + s.n" (change)="editar(s.n - 1, 'reps', $event)" />
                <input class="valor" type="number" inputmode="decimal" min="0" step="0.5" [value]="s.carga"
                  [attr.aria-label]="'Carga da série ' + s.n + ' (kg)'" (change)="editar(s.n - 1, 'carga', $event)" />
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

          @if (ultima(); as u) {
            <p class="ultima">Última vez: {{ u }}</p>
          }

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
      border: 0;
      color: inherit;
      padding: 0;
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
    .valor {
      width: 100%;
      min-width: 0;
      height: 44px;
      border-radius: 10px;
      border: 1px solid #3a4046;
      background: #14171a;
      color: #fff;
      font: inherit;
      text-align: center;
    }
    .ultima {
      font-size: 13px;
      color: #b9c0ba;
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
  protected readonly nav = inject(NavegacaoService);

  protected readonly descansoAtivo = signal(0);
  private intervalo?: ReturnType<typeof setInterval>;

  protected readonly ficha = computed(() => this.plans.get(this.id()));
  /** Treino em andamento desta ficha, se houver (salvo no aparelho e na nuvem). */
  private readonly estado = computed(() => {
    const a = this.plans.emAndamento();
    return a && a.fichaId === this.id() ? a : null;
  });
  protected readonly indice = computed(() => {
    const max = Math.max(0, (this.ficha()?.itens.length ?? 1) - 1);
    return Math.min(this.estado()?.indice ?? 0, max);
  });
  /** O exercício da vez: o da ficha, ou o que foi trocado só para este treino. */
  protected readonly item = computed(() => {
    const base = this.ficha()?.itens[this.indice()];
    const troca = this.estado()?.trocas?.[this.indice()];
    return base && troca ? { ...base, exerciseId: troca } : base;
  });
  protected readonly ultimo = computed(() => this.indice() >= (this.ficha()?.itens.length ?? 1) - 1);

  protected readonly nome = computed(() => {
    const it = this.item();
    const e = it ? this.ex.get(it.exerciseId) : undefined;
    return e ? this.ex.nome(e) : (it?.exerciseId ?? '');
  });

  private readonly anterior_ = computed(() => {
    const it = this.item();
    return it ? this.plans.ultimoRegistro(it.exerciseId) : undefined;
  });

  protected readonly series = computed(() => {
    const it = this.item();
    if (!it) return [];
    const salvas = this.estado()?.series[this.indice()] ?? [];
    const ant = this.anterior_()?.series ?? [];
    return Array.from({ length: it.series }, (_, k) => ({
      n: k + 1,
      feita: !!salvas[k]?.feita,
      carga: salvas[k]?.carga ?? ant[k]?.carga ?? ant.at(-1)?.carga ?? it.carga,
      reps: salvas[k]?.reps ?? it.reps,
    }));
  });

  protected readonly ultima = computed(() => {
    const r = this.anterior_();
    if (!r) return '';
    const min = r.unidade === 'min';
    return r.series.map((s) => (min ? `${s.reps} min` : `${s.carga} kg × ${s.reps}`)).join(' · ');
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

  /** Grava a série k (valores atuais da tela + alteração) no treino em andamento. */
  private gravarSerie(k: number, mudanca: Partial<{ feita: boolean; carga: number; reps: number }>): void {
    const i = this.indice();
    const base = this.series().map((s) => ({ feita: s.feita, carga: s.carga, reps: s.reps }));
    base[k] = { ...base[k], ...mudanca };
    this.plans.andamento(this.id(), (a) => ({ ...a, indice: i, series: { ...a.series, [i]: base } }));
  }

  /** Ao mudar carga ou repetições de uma série, as de baixo que ainda não foram feitas ganham o mesmo valor. */
  protected editar(k: number, campo: 'carga' | 'reps', evento: Event): void {
    const v = (evento.target as HTMLInputElement).valueAsNumber;
    const valor = Number.isFinite(v) && v >= 0 ? v : 0;
    const i = this.indice();
    const base = this.series().map((s, j) => (j >= k && (j === k || !s.feita) ? { ...s, [campo]: valor } : s));
    this.plans.andamento(this.id(), (a) => ({
      ...a,
      indice: i,
      series: { ...a.series, [i]: base.map((s) => ({ feita: s.feita, carga: s.carga, reps: s.reps })) },
    }));
  }

  protected alternar(k: number): void {
    const it = this.item();
    if (!it) return;
    const ficouFeita = !this.series()[k].feita;
    this.gravarSerie(k, { feita: ficouFeita });
    const todas = this.series().every((s) => s.feita);
    if (ficouFeita && !todas) this.iniciarDescanso(it.descanso);
    else this.pararDescanso();
  }

  private irPara(indice: number): void {
    this.plans.andamento(this.id(), (a) => ({ ...a, indice }));
  }

  protected anterior(): void {
    this.pararDescanso();
    this.irPara(Math.max(0, this.indice() - 1));
  }

  protected proximo(): void {
    this.pararDescanso();
    if (!this.ultimo()) {
      this.irPara(this.indice() + 1);
      return;
    }
    const f = this.ficha();
    const salvo = this.estado();
    const efetivos = f ? this.plans.exerciciosEfetivos(f) : [];
    const registros: RegistroExercicio[] = (f?.itens ?? []).flatMap((it, i) => {
      const series = (salvo?.series[i] ?? []).filter((s) => s.feita).map((s) => ({ carga: s.carga, reps: s.reps }));
      return series.length ? [{ exerciseId: efetivos[i], ...(it.unidade ? { unidade: it.unidade } : {}), series }] : [];
    });
    this.plans.registrarSessao(this.id(), registros);
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
