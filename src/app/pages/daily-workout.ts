import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExerciseService, GRUPOS } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';
import { Carregando } from '../core/spinner';
import { Nivel } from '../core/suggestion';
import { ToastService } from '../core/toast.service';
import { TreinoDoDia, treinoDoDia } from '../core/treino-do-dia';

@Component({
  selector: 'app-daily-workout',
  imports: [RouterLink, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/fichas')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Treino do dia</h1>
        <p class="apoio">Escolha o que quer treinar hoje. Eu sugiro um treino com exercícios que não estão nas suas fichas.</p>
      </header>

      @if (!ex.ready()) {
        @if (ex.error()) {
          <p class="apoio">Não foi possível carregar os exercícios.</p>
          <button type="button" class="btn btn--escuro" (click)="ex.carregar()">Tentar de novo</button>
        } @else {
          <app-carregando texto="Carregando exercícios…" />
        }
      } @else if (!resultado()) {
        <fieldset>
          <legend>Grupo muscular</legend>
          <div class="chips-linha">
            @for (g of grupos; track g.key) {
              <button type="button" class="chip" [attr.aria-pressed]="escolhidos().includes(g.key)" [disabled]="!escolhidos().includes(g.key) && escolhidos().length >= maxGrupos" (click)="alternar(g.key)">{{ g.label }}</button>
            }
          </div>
          <p class="apoio nota">Escolha até {{ maxGrupos }} grupos para o treino não ficar enorme.</p>
        </fieldset>

        <fieldset>
          <legend>Cardio no final</legend>
          <div class="chips-linha">
            <button type="button" class="chip" [attr.aria-pressed]="cardio()" (click)="cardio.set(true)">Com cardio</button>
            <button type="button" class="chip" [attr.aria-pressed]="!cardio()" (click)="cardio.set(false)">Sem cardio</button>
          </div>
        </fieldset>

        @if (escolhidos().length > 1) {
          <fieldset>
            <legend>Máximo de exercícios</legend>
            <div class="chips-linha">
              @for (m of opcoesMaximo(); track m) {
                <button type="button" class="chip" [attr.aria-pressed]="maximoAtual() === m" (click)="maximo.set(m)">{{ m }}</button>
              }
            </div>
            <p class="apoio nota">Com vários grupos, o treino pode ficar grande. Divido esse limite entre eles{{ cardio() ? ' (o cardio conta)' : '' }}.</p>
          </fieldset>
        }

        <fieldset>
          <legend>Nível</legend>
          <div class="chips-linha">
            @for (n of niveis; track n.key) {
              <button type="button" class="chip" [attr.aria-pressed]="nivel() === n.key" (click)="nivel.set(n.key)">{{ n.label }}</button>
            }
          </div>
        </fieldset>

        <button type="button" class="btn btn--escuro" [disabled]="escolhidos().length === 0" (click)="sugerir()">
          <app-icon name="clipboard" [size]="18" [stroke]="2.2" /> Sugerir treino
        </button>
        @if (escolhidos().length === 0) {
          <p class="apoio nota">Escolha pelo menos um grupo muscular.</p>
        }
      } @else {
        @let r = resultado()!;
        <h2 class="sub">Seu treino de hoje</h2>
        @if (r.itens.length === 0) {
          <p class="apoio">
            Não encontrei exercícios novos para essa escolha: todos já estão nas suas fichas. Tente outro grupo ou outro nível.
          </p>
          <button type="button" class="btn btn--claro" (click)="descartar()">Voltar às opções</button>
        } @else {
          <ol class="lista">
            @for (it of r.itens; track it.exerciseId) {
              <li class="card item">
                <a class="item__foto" [routerLink]="['/exercicio', it.exerciseId]" aria-label="Ver instruções do exercício">
                  <img [src]="ex.imagem(it.exerciseId, 0)" alt="" loading="lazy" />
                </a>
                <span class="item__txt">
                  <a class="item__nome" [routerLink]="['/exercicio', it.exerciseId]">{{ nome(it.exerciseId) }}</a>
                  <span class="apoio">{{ it.unidade === 'min' ? it.reps + ' min' : it.series + ' × ' + it.reps + ' · descanso ' + it.descanso + ' s' }}</span>
                </span>
              </li>
            }
          </ol>
          @if (r.semCardio) {
            <p class="apoio nota">Não sobrou cardio fora das suas fichas, então ficou sem.</p>
          }
          <div class="acoes">
            <button type="button" class="btn btn--escuro" (click)="aceitar()">
              <app-icon name="check" [size]="20" [stroke]="2.5" /> Aceitar e iniciar treino
            </button>
            <button type="button" class="btn btn--claro" (click)="variacao.set(variacao() + 1)">
              <app-icon name="refresh" [size]="18" [stroke]="2.2" /> Sugerir outro
            </button>
            <button type="button" class="btn btn--claro" (click)="descartar()">
              <app-icon name="close" [size]="18" [stroke]="2.2" /> Descartar
            </button>
          </div>
          <p class="apoio nota">
            Ao aceitar, o treino vira uma ficha nova e você já pode começar. Ajuste as cargas na hora; na dúvida, consulte um profissional.
          </p>
        }
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
    .chips-linha {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sub {
      font-size: 18px;
    }
    .lista {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
    }
    .item__foto img {
      width: 56px;
      height: 56px;
      border-radius: 10px;
      object-fit: cover;
      background: #fff;
      display: block;
    }
    .item__txt {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .item__nome {
      font-weight: 600;
    }
    .acoes {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .nota {
      font-size: 12px;
    }
    button:disabled {
      opacity: 0.45;
    }
  `,
})
export class DailyWorkout {
  protected readonly nav = inject(NavegacaoService);
  protected readonly ex = inject(ExerciseService);
  private readonly plans = inject(PlanService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly grupos = GRUPOS;
  protected readonly niveis: { key: Nivel; label: string }[] = [
    { key: 'beginner', label: 'Iniciante' },
    { key: 'intermediate', label: 'Intermediário' },
    { key: 'expert', label: 'Avançado' },
  ];

  /** Mais que isso deixaria o treino grande demais. */
  protected readonly maxGrupos = 2;
  protected readonly escolhidos = signal<string[]>([]);
  protected readonly cardio = signal(false);
  protected readonly nivel = signal<Nivel>('intermediate');
  protected readonly maximo = signal(8);
  protected readonly variacao = signal(0);

  /** Opções de máximo: pelo menos 1 exercício por grupo (e 1 para o cardio, se pedido). */
  protected readonly opcoesMaximo = computed(() => {
    const minimo = this.escolhidos().length + (this.cardio() ? 1 : 0);
    return [4, 6, 8, 10, 12, 15].filter((m) => m >= minimo);
  });

  /** O máximo escolhido, ajustado para a opção válida mais próxima quando as escolhas mudam. */
  protected readonly maximoAtual = computed(() => {
    const ops = this.opcoesMaximo();
    return ops.find((m) => m >= this.maximo()) ?? ops.at(-1) ?? this.maximo();
  });
  /** Só depois de tocar em "Sugerir treino": as escolhas ficam fixas até aceitar ou descartar. */
  private readonly pedido = signal<{ grupos: string[]; cardio: boolean; nivel: Nivel; maximo?: number } | null>(null);

  protected readonly resultado = computed<TreinoDoDia | null>(() => {
    const p = this.pedido();
    if (!p || !this.ex.ready()) return null;
    const excluidos = new Set(this.plans.fichas().flatMap((f) => f.itens.map((i) => i.exerciseId)));
    return treinoDoDia(this.ex.exercises(), { ...p, excluidos, variacao: this.variacao() });
  });

  protected alternar(chave: string): void {
    this.escolhidos.update((l) => {
      if (l.includes(chave)) return l.filter((c) => c !== chave);
      return l.length >= this.maxGrupos ? l : [...l, chave];
    });
  }

  protected sugerir(): void {
    this.variacao.set(0);
    const varios = this.escolhidos().length > 1;
    this.pedido.set({ grupos: this.escolhidos(), cardio: this.cardio(), nivel: this.nivel(), ...(varios ? { maximo: this.maximoAtual() } : {}) });
  }

  protected descartar(): void {
    this.pedido.set(null);
  }

  protected nome(id: string): string {
    const e = this.ex.get(id);
    return e ? this.ex.nome(e) : id;
  }

  protected aceitar(): void {
    const r = this.resultado();
    if (!r || r.itens.length === 0) return;
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const [ficha] = this.plans.criarComItens([{ nome: `Treino do dia · ${hoje}`, itens: r.itens }]);
    this.toast.mostrar('Treino salvo na sua ficha');
    this.router.navigate(['/treino', ficha.id], { replaceUrl: true });
  }
}
