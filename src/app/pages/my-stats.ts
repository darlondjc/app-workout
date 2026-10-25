import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';
import { Progress } from './progress';

/** As estatísticas da própria pessoa, abertas pelo ícone no topo do Perfil. */
@Component({
  selector: 'app-my-stats',
  imports: [Icon, Progress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="cabeca">
        <button type="button" class="voltar" aria-label="Voltar" (click)="nav.voltar('/perfil')"><app-icon name="back" [size]="20" [stroke]="2.2" /></button>
        <h1 class="titulo">Minhas estatísticas</h1>
      </header>
      <app-progress [historico]="plans.historico()" />
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .cabeca { display: flex; align-items: center; gap: 10px; }
    .voltar { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--soft); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .titulo { margin: 0; font-size: 24px; }
  `,
})
export class MyStats {
  protected readonly plans = inject(PlanService);
  protected readonly nav = inject(NavegacaoService);
}
