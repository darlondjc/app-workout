import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';

/** Acrescenta um treino a uma ficha que já existe: monta do zero ou pede um treino sugerido. */
@Component({
  selector: 'app-new-workout',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/fichas')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Adicionar treino</h1>
        @if (nome(); as n) {
          <p class="apoio">À ficha “{{ n }}”. Como você quer criar?</p>
        } @else {
          <p class="apoio">Essa ficha não existe mais.</p>
        }
      </header>

      @if (nome()) {
        <ul class="caminhos">
          <li>
            <button type="button" class="caminho" (click)="manual()">
              <span class="caminho__icone"><app-icon name="plus" [size]="24" [stroke]="2" /></span>
              <span class="caminho__txt">
                <strong>Montar do zero</strong>
                <span>Você escolhe cada exercício na biblioteca e ajusta séries, repetições e carga.</span>
              </span>
              <app-icon class="seta" name="chevron" [size]="18" [stroke]="2.2" />
            </button>
          </li>
          <li>
            <a class="caminho" routerLink="/treino-do-dia" [queryParams]="{ conjunto: conjunto() }">
              <span class="caminho__icone"><app-icon name="clipboard" [size]="24" [stroke]="2" /></span>
              <span class="caminho__txt">
                <strong>Treino sugerido</strong>
                <span>Você escolhe os músculos, o nível e o cardio, e o app sugere um treino com exercícios que ainda não estão nas suas fichas.</span>
              </span>
              <app-icon class="seta" name="chevron" [size]="18" [stroke]="2.2" />
            </a>
          </li>
        </ul>
      }
    </section>
  `,
  styles: `
    .voltar { border: 0; background: none; padding: 0; font: inherit; font-size: 14px; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; color: var(--muted); }
    .page { display: flex; flex-direction: column; gap: 14px; }
    header .apoio { margin: 0; }
    .caminhos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .caminho { width: 100%; display: flex; align-items: center; gap: 14px; padding: 16px 14px; border: 1px solid var(--line); border-radius: 18px; background: var(--card); color: var(--ink); font: inherit; text-align: left; text-decoration: none; }
    .caminho__icone { flex: none; width: 48px; height: 48px; border-radius: 14px; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; }
    .caminho__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; font-size: 14px; line-height: 1.35; }
    .caminho__txt strong { font-family: var(--font-display); font-size: 18px; }
    .seta { flex: none; color: var(--muted); }
  `,
})
export class NewWorkout {
  /** Id da ficha (conjunto de treinos) que vai receber o treino; vem do endereço. */
  readonly conjunto = input<string>();

  protected readonly nav = inject(NavegacaoService);
  private readonly plans = inject(PlanService);
  private readonly router = inject(Router);

  private readonly alvo = computed(() => {
    const c = this.conjunto();
    return c ? this.plans.fichas().find((f) => f.conjunto?.id === c)?.conjunto : undefined;
  });
  protected readonly nome = computed(() => this.alvo()?.nome ?? '');

  protected manual(): void {
    const c = this.alvo();
    if (!c) return;
    const n = this.plans.fichas().filter((f) => f.conjunto?.id === c.id).length;
    const ficha = this.plans.criarRascunho(`Treino ${String.fromCharCode(65 + (n % 26))}`, c);
    void this.router.navigate(['/ficha', ficha.id], { replaceUrl: true });
  }
}
