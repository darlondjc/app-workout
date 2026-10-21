import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../core/icon';
import { PlanService } from '../core/plan.service';

@Component({
  selector: 'app-plans',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <h1 class="titulo">Fichas</h1>
        <p class="apoio">
          {{ plans.fichas().length }} {{ plans.fichas().length === 1 ? 'ficha' : 'fichas' }}
        </p>
      </header>

      <ul class="lista">
        @for (f of plans.fichas(); track f.id) {
          <li class="card linha">
            <a class="link" [routerLink]="['/ficha', f.id]" (click)="plans.definirAtiva(f.id)">
              <span class="letra">{{ plans.letra(f.id) }}</span>
              <span class="linha__texto">
                <span class="linha__nome">{{ f.nome }}</span>
                <span class="apoio">{{ f.itens.length }} {{ f.itens.length === 1 ? 'exercício' : 'exercícios' }}</span>
              </span>
            </a>
            @if (f.itens.length > 0) {
              <a class="btn-icone" [routerLink]="['/treino', f.id]" [attr.aria-label]="'Iniciar treino ' + f.nome">
                <app-icon name="play" [size]="18" />
              </a>
            }
          </li>
        } @empty {
          <li class="apoio vazio">Você ainda não tem fichas. Crie a primeira para começar.</li>
        }
      </ul>

      <a class="btn btn--destaque" routerLink="/fichas/sugestao">
        <app-icon name="clipboard" [size]="18" [stroke]="2.2" /> Sugerir fichas para mim
      </a>
      <button type="button" class="btn btn--tracejado" (click)="nova()">
        <app-icon name="plus" [size]="18" [stroke]="2.5" /> Nova ficha
      </button>
    </section>
  `,
  styles: `
    .lista {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .link {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .letra {
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #e8f3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
    .vazio {
      padding: 24px 0;
      text-align: center;
    }
  `,
})
export class Plans {
  protected readonly plans = inject(PlanService);
  private readonly router = inject(Router);

  protected nova(): void {
    const ficha = this.plans.criar(`Ficha ${String.fromCharCode(65 + (this.plans.fichas().length % 26))}`);
    this.router.navigate(['/ficha', ficha.id]);
  }
}
