import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ExerciseImage } from '../core/exercise-image';
import { Carregando } from '../core/spinner';
import { ExerciseService } from '../core/exercise.service';
import { NavegacaoService } from '../core/navegacao.service';
import { Icon } from '../core/icon';
import { PlanService } from '../core/plan.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-exercise-detail',
  imports: [Icon, ExerciseImage, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (exercicio(); as e) {
      <div class="foto">
        <app-exercise-image [id]="e.id" [descricao]="'Demonstração: ' + nome()" />
        <button type="button" class="voltar" (click)="voltar()" aria-label="Voltar">
          <app-icon name="back" [size]="22" [stroke]="2.2" />
        </button>
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
        <button type="button" class="btn btn--claro" (click)="voltar()">Voltar</button>
      </section>
    } @else if (ex.error()) {
      <section class="page">
        <h1 class="titulo">Sem conexão</h1>
        <p class="apoio">Não foi possível carregar os exercícios.</p>
        <button type="button" class="btn btn--escuro" (click)="ex.carregar()">Tentar de novo</button>
      </section>
    } @else {
      <section class="page"><app-carregando texto="Carregando exercício…" /></section>
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
      border: 0;
      padding: 0;
      color: var(--ink);
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
  private readonly nav = inject(NavegacaoService);

  protected readonly exercicio = computed(() => this.ex.get(this.id()));
  protected readonly nome = computed(() => {
    const e = this.exercicio();
    return e ? this.ex.nome(e) : '';
  });

  protected readonly instrucoes = computed(() => {
    const e = this.exercicio();
    return e ? this.ex.instrucoes(e) : { passos: [], traduzido: true };
  });

  protected voltar(): void {
    this.nav.voltar('/biblioteca');
  }

  protected adicionar(): void {
    const { ficha, jaEstava } = this.plans.adicionar(this.id());
    this.toast.mostrar(jaEstava ? `Já está em “${ficha.nome}”` : `Adicionado a “${ficha.nome}”`);
  }
}
