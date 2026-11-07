import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';
import { Carregando } from '../core/spinner';
import {
  LOCAIS,
  Local,
  Nivel,
  OBJETIVOS,
  Objetivo,
  sugerirFichas,
} from '../core/suggestion';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-suggest',
  imports: [RouterLink, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/fichas')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Sugerir ficha</h1>
        <p class="apoio">Responda quatro perguntas e eu monto uma ficha com os treinos da semana.</p>
      </header>

      <fieldset>
        <legend>Objetivo</legend>
        <div class="opcoes">
          @for (o of objetivos; track o.key) {
            <button type="button" class="opcao" [attr.aria-pressed]="objetivo() === o.key" (click)="objetivo.set(o.key)">
              <strong>{{ o.label }}</strong><span>{{ o.detalhe }}</span>
            </button>
          }
        </div>
      </fieldset>

      <fieldset>
        <legend>Experiência</legend>
        <div class="chips-linha">
          @for (n of niveis; track n.key) {
            <button type="button" class="chip" [attr.aria-pressed]="nivel() === n.key" (click)="nivel.set(n.key)">
              {{ n.label }}
            </button>
          }
        </div>
      </fieldset>

      <fieldset>
        <legend>Dias de treino por semana</legend>
        <div class="chips-linha">
          @for (d of diasOpcoes; track d) {
            <button type="button" class="chip" [attr.aria-pressed]="dias() === d" (click)="dias.set(d)">{{ d }}</button>
          }
        </div>
      </fieldset>

      <fieldset>
        <legend>Onde você treina</legend>
        <div class="opcoes">
          @for (l of locais; track l.key) {
            <button type="button" class="opcao" [attr.aria-pressed]="local() === l.key" (click)="local.set(l.key)">
              <strong>{{ l.label }}</strong><span>{{ l.detalhe }}</span>
            </button>
          }
        </div>
      </fieldset>

      <h2 class="sub">Sua semana</h2>
      @if (!ex.ready()) {
        @if (ex.error()) {
          <p class="apoio">Não foi possível carregar os exercícios.</p>
          <button type="button" class="btn btn--escuro" (click)="ex.carregar()">Tentar de novo</button>
        } @else {
          <app-carregando texto="Carregando exercícios…" />
        }
      } @else {
        <ol class="semana">
          @for (f of fichas(); track f.nome; let i = $index) {
            <li class="card ficha">
              <h3><span class="letra">{{ letra(i) }}</span> {{ f.nome }}</h3>
              <ul>
                @for (it of f.itens; track it.exerciseId) {
                  <li>
                    <a [routerLink]="['/exercicio', it.exerciseId]">{{ nome(it.exerciseId) }}</a>
                    <span class="apoio">{{ it.unidade === 'min' ? it.reps + ' min' : it.series + '×' + it.reps }}</span>
                  </li>
                }
              </ul>
            </li>
          }
        </ol>

        <div class="acoes">
          <button type="button" class="btn btn--escuro" (click)="adicionar()">
            <app-icon name="plus" [size]="20" [stroke]="2.5" />
            Adicionar ficha com {{ fichas().length }} treinos
          </button>
          <button type="button" class="btn btn--claro" (click)="variacao.set(variacao() + 1)">Gerar outra variação</button>
        </div>
        @if (local() === 'corpo') {
          <p class="apoio nota">
            Sem equipamento há poucas opções de puxar e de ombros. Uma barra fixa ou um par de halteres abre
            bem mais variedade.
          </p>
        }
        <p class="apoio nota">
          Sugestão geral para treino de musculação, sem considerar lesões ou restrições. Ajuste as cargas na hora
          e, se tiver dúvida, consulte um profissional.
        </p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .page {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .voltar {
      border: 0;
      background: none;
      padding: 0;
      font: inherit;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 44px;
      color: var(--muted);
      font-size: 14px;
    }
    fieldset {
      border: none;
      padding: 0;
      margin: 0;
      min-width: 0;
    }
    legend {
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 8px;
      padding: 0;
    }
    .opcoes {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .opcao {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      min-height: 56px;
      padding: 10px 16px;
      border-radius: 14px;
      border: 1.5px solid transparent;
      background: var(--card);
      text-align: left;
      font-size: 14px;
      color: var(--muted);
    }
    .opcao strong {
      color: var(--ink);
      font-size: 15px;
    }
    .opcao[aria-pressed='true'] {
      border-color: var(--ink);
      background: var(--accent-soft);
    }
    .chips-linha {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sub {
      font-size: 18px;
    }
    .semana {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ficha {
      padding: 14px;
    }
    .ficha h3 {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .letra {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: var(--accent-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
    .ficha ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .ficha li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-top: 1px solid var(--soft);
      font-size: 14px;
    }
    .ficha li a {
      min-width: 0;
    }
    .acoes {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .nota {
      font-size: 12px;
    }
  `,
})
export class Suggest {
  protected readonly nav = inject(NavegacaoService);
  protected readonly ex = inject(ExerciseService);
  private readonly plans = inject(PlanService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly objetivos = OBJETIVOS;
  protected readonly locais = LOCAIS;
  protected readonly niveis: { key: Nivel; label: string }[] = [
    { key: 'beginner', label: 'Iniciante' },
    { key: 'intermediate', label: 'Intermediário' },
    { key: 'expert', label: 'Avançado' },
  ];
  protected readonly diasOpcoes = [2, 3, 4, 5, 6];

  protected readonly objetivo = signal<Objetivo>('hipertrofia');
  protected readonly nivel = signal<Nivel>('beginner');
  protected readonly dias = signal(3);
  protected readonly local = signal<Local>('academia');
  protected readonly variacao = signal(0);

  protected readonly fichas = computed(() =>
    this.ex.ready()
      ? sugerirFichas(
          this.ex.exercises(),
          { objetivo: this.objetivo(), nivel: this.nivel(), dias: this.dias(), local: this.local() },
          this.variacao(),
        )
      : [],
  );

  protected letra(i: number): string {
    return String.fromCharCode(65 + (i % 26));
  }

  protected nome(id: string): string {
    const e = this.ex.get(id);
    return e ? this.ex.nome(e) : id;
  }

  protected adicionar(): void {
    const treinos = this.fichas().filter((f) => f.itens.length > 0);
    const objetivo = OBJETIVOS.find((o) => o.key === this.objetivo())?.label ?? 'Sugestão';
    this.plans.criarConjunto(`${objetivo} · ${treinos.length} dias`, treinos);
    this.toast.mostrar(`Ficha criada com ${treinos.length} treinos`);
    this.router.navigate(['/fichas']);
  }
}
