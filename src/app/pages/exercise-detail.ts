import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExerciseImage } from '../core/exercise-image';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { PlanService } from '../core/plan.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-exercise-detail',
  imports: [RouterLink, Icon, ExerciseImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (exercicio(); as e) {
      <div class="foto">
        <app-exercise-image [id]="e.id" [descricao]="'Demonstração: ' + nome()" />
        <a class="voltar" routerLink="/biblioteca" aria-label="Voltar para a biblioteca">
          <app-icon name="back" [size]="22" [stroke]="2.2" />
        </a>
      </div>

      <section class="corpo">
        <header>
          <h1 class="nome">{{ nome() }}</h1>
          <p class="apoio">Original em inglês: {{ e.name }}</p>
        </header>

        <div class="tags">
          @for (m of e.primaryMuscles; track m) {
            <span class="tag tag--destaque">{{ ex.musculo(m) }}</span>
          }
          @for (m of e.secondaryMuscles; track m) {
            <span class="tag">{{ ex.musculo(m) }}</span>
          }
          <span class="tag">{{ ex.equipamento(e.equipment) }}</span>
          <span class="tag">{{ ex.nivel(e.level) }}</span>
          @if (ex.mecanica(e.mechanic); as mec) {
            <span class="tag">{{ mec }}</span>
          }
        </div>

        <section aria-labelledby="como-fazer">
          <h2 id="como-fazer" class="sub">Como fazer</h2>
          @if (!instrucoes().traduzido) {
            <p class="apoio aviso-idioma">Instruções disponíveis apenas em inglês.</p>
          }
          <ol class="passos" [attr.lang]="instrucoes().traduzido ? 'pt-BR' : 'en'">
            @for (p of instrucoes().passos; track $index) {
              <li>{{ p }}</li>
            }
          </ol>
        </section>
      </section>

      <div class="rodape">
        <button type="button" class="btn btn--escuro" (click)="adicionar()">
          <app-icon name="plus" [size]="20" [stroke]="2.5" /> Adicionar à ficha
        </button>
      </div>
    } @else if (ex.ready()) {
      <section class="page">
        <h1 class="titulo">Exercício não encontrado</h1>
        <a class="btn btn--claro" routerLink="/biblioteca">Voltar para a biblioteca</a>
      </section>
    } @else {
      <section class="page"><p class="apoio">Carregando…</p></section>
    }
  `,
  styles: `
    .foto {
      position: relative;
      height: 300px;
      background: #fff;
    }
    .voltar {
      position: absolute;
      top: 20px;
      left: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 4px rgba(20, 23, 26, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .corpo {
      padding: 20px 20px 110px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .nome {
      font-family: var(--font-display);
      font-size: 26px;
      line-height: 1.15;
      letter-spacing: -0.3px;
      margin-bottom: 6px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sub {
      font-size: 18px;
    }
    .aviso-idioma {
      margin: 4px 0 10px;
    }
    .passos {
      margin: 0;
      padding-left: 22px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 15px;
      line-height: 1.45;
    }
    .rodape {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      padding: 12px 20px calc(20px + env(safe-area-inset-bottom));
      background: linear-gradient(to top, var(--bg) 70%, transparent);
    }
    .rodape .btn {
      width: 100%;
      min-height: 56px;
    }
  `,
})
export class ExerciseDetail {
  readonly id = input.required<string>();

  protected readonly ex = inject(ExerciseService);
  private readonly plans = inject(PlanService);
  private readonly toast = inject(ToastService);

  protected readonly exercicio = computed(() => this.ex.get(this.id()));
  protected readonly nome = computed(() => {
    const e = this.exercicio();
    return e ? this.ex.nome(e) : '';
  });

  protected readonly instrucoes = computed(() => {
    const e = this.exercicio();
    return e ? this.ex.instrucoes(e) : { passos: [], traduzido: true };
  });

  protected adicionar(): void {
    const { ficha, jaEstava } = this.plans.adicionar(this.id());
    this.toast.mostrar(jaEstava ? `Já está em “${ficha.nome}”` : `Adicionado a “${ficha.nome}”`);
  }
}
