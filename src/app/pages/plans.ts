import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
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
          <li class="item">
            <button
              type="button"
              class="lixeira"
              [attr.aria-label]="'Excluir ficha ' + f.nome"
              [attr.tabindex]="aberta() === f.id ? 0 : -1"
              [style.opacity]="deslocamento(f.id) > 0 ? 1 : 0"
              (click)="excluir(f.id, f.nome)"
            >
              <app-icon name="trash" [size]="22" [stroke]="2" />
            </button>
            <div
              class="card linha frente"
              [class.arrastando]="arrasto()?.id === f.id"
              [style.transform]="'translateX(' + deslocamento(f.id) + 'px)'"
              (pointerdown)="iniciar($event, f.id)"
              (pointermove)="mover($event)"
              (pointerup)="soltar($event)"
              (pointercancel)="soltar($event)"
            >
            <a class="link" draggable="false" [routerLink]="['/ficha', f.id]" (click)="plans.definirAtiva(f.id)">
              <span class="letra">{{ plans.letra(f.id) }}</span>
              <span class="linha__texto">
                <span class="linha__nome">{{ f.nome }}</span>
                <span class="apoio">{{ f.itens.length }} {{ f.itens.length === 1 ? 'exercício' : 'exercícios' }}</span>
              </span>
            </a>
            @if (f.itens.length > 0) {
              <a class="btn-icone" draggable="false" [routerLink]="['/treino', f.id]" [attr.aria-label]="'Iniciar treino ' + f.nome">
                <app-icon name="play" [size]="18" />
              </a>
            }
            </div>
          </li>
        } @empty {
          <li class="apoio vazio">Você ainda não tem fichas. Crie a primeira para começar.</li>
        }
      </ul>

      <a class="btn btn--destaque" routerLink="/treino-do-dia">
        <app-icon name="play" [size]="18" /> Treino customizado para hoje
      </a>
      <a class="btn btn--claro" routerLink="/fichas/sugestao">
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
    .item {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
    }
    .lixeira {
      position: absolute;
      inset: 0 auto 0 0;
      width: 88px;
      border: 0;
      background: #b3261e;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s ease;
    }
    .frente {
      position: relative;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
      transition: transform 0.2s ease;
    }
    .frente.arrastando {
      transition: none;
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

  /** Largura da lixeira que aparece ao arrastar a ficha para a direita. */
  private static readonly ABERTURA = 88;

  /** Ficha com a lixeira à mostra. */
  protected readonly aberta = signal<string | null>(null);
  protected readonly arrasto = signal<{ id: string; x: number } | null>(null);
  private gesto: { id: string; x0: number; y0: number; base: number; movendo: boolean; pointer: number } | null = null;
  /** Depois de arrastar (ou de tocar com a lixeira aberta), o clique que vem em seguida não deve abrir a ficha. */
  private engolirClique = false;

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const aoClicar = (e: Event) => {
      const alvo = e.target as Element;
      if (this.engolirClique) {
        this.engolirClique = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (this.aberta() !== null && !alvo.closest('.lixeira')) {
        this.aberta.set(null);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    host.addEventListener('click', aoClicar, true);
    inject(DestroyRef).onDestroy(() => host.removeEventListener('click', aoClicar, true));
  }

  protected deslocamento(id: string): number {
    const a = this.arrasto();
    if (a?.id === id) return a.x;
    return this.aberta() === id ? Plans.ABERTURA : 0;
  }

  protected iniciar(e: PointerEvent, id: string): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.gesto = { id, x0: e.clientX, y0: e.clientY, base: this.aberta() === id ? Plans.ABERTURA : 0, movendo: false, pointer: e.pointerId };
  }

  protected mover(e: PointerEvent): void {
    const g = this.gesto;
    if (!g || e.pointerId !== g.pointer) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.movendo) {
      // Só vira arrasto se for mais horizontal que vertical, para não atrapalhar a rolagem.
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      g.movendo = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    this.arrasto.set({ id: g.id, x: Math.min(Plans.ABERTURA, Math.max(0, g.base + dx)) });
  }

  protected soltar(e: PointerEvent): void {
    const g = this.gesto;
    if (!g || e.pointerId !== g.pointer) return;
    this.gesto = null;
    if (!g.movendo) return;
    this.engolirClique = true;
    // O navegador nem sempre dispara o clique depois de um arrasto; não deixa a trava "grudada".
    setTimeout(() => (this.engolirClique = false), 400);
    const x = this.arrasto()?.x ?? 0;
    this.arrasto.set(null);
    this.aberta.set(x > Plans.ABERTURA / 2 ? g.id : null);
  }

  protected excluir(id: string, nome: string): void {
    if (!confirm(`Excluir a ficha “${nome}”? Essa ação não pode ser desfeita.`)) return;
    this.aberta.set(null);
    this.plans.remover(id);
  }

  protected nova(): void {
    const ficha = this.plans.criar(`Ficha ${String.fromCharCode(65 + (this.plans.fichas().length % 26))}`);
    this.router.navigate(['/ficha', ficha.id]);
  }
}
