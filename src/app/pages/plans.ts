import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Confirmacao } from '../core/confirmacao';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { Ficha } from '../core/models';
import { PlanService } from '../core/plan.service';

@Component({
  selector: 'app-plans',
  imports: [Confirmacao, RouterLink, Icon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <h1 class="titulo">Fichas</h1>
        <p class="apoio">
          {{ blocos().length }} {{ blocos().length === 1 ? 'ficha' : 'fichas' }}
        </p>
      </header>

      <ul class="lista">
        @for (b of blocos(); track b.chave) {
          @if (b.conjunto; as c) {
            <li class="conjunto">
              <div class="conjunto__topo">
                <span class="conjunto__texto">
                  <strong class="conjunto__nome">{{ c.nome }}</strong>
                  <span class="apoio">{{ b.fichas.length }} {{ b.fichas.length === 1 ? 'treino' : 'treinos' }}</span>
                </span>
                <button type="button" class="conjunto__excluir" [attr.aria-label]="'Excluir a ficha ' + c.nome + ' com todos os treinos'" aria-haspopup="dialog" (click)="excluindoConjunto.set({ id: c.id, nome: c.nome, treinos: b.fichas.length })">
                  <app-icon name="trash" [size]="20" [stroke]="2" />
                </button>
              </div>
              <ul class="lista">
                @for (f of b.fichas; track f.id) {
                  <ng-container [ngTemplateOutlet]="linha" [ngTemplateOutletContext]="{ $implicit: f }" />
                }
              </ul>
            </li>
          } @else {
            <ng-container [ngTemplateOutlet]="linha" [ngTemplateOutletContext]="{ $implicit: b.fichas[0] }" />
          }
        } @empty {
          <li class="apoio vazio">Você ainda não tem fichas. Crie a primeira para começar.</li>
        }
      </ul>


      <ng-template #linha let-f>
          <li class="item">
            <button
              type="button"
              class="lixeira"
              [attr.aria-label]="(f.conjunto ? 'Excluir treino ' : 'Excluir ficha ') + f.nome"
              [attr.tabindex]="aberta() === f.id ? 0 : -1"
              [style.opacity]="deslocamento(f.id) > 0 ? 1 : 0"
              aria-haspopup="dialog" (click)="excluindo.set({ id: f.id, nome: f.nome, treino: !!f.conjunto })"
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
                @if (grupos(f.itens); as gs) {
                  @if (gs.length > 0) {
                    <ul class="grupos" aria-label="Grupos musculares">
                      @for (g of gs; track g) {
                        <li class="grupo">{{ g }}</li>
                      }
                    </ul>
                  }
                }
              </span>
            </a>
            @if (f.itens.length > 0) {
              <a class="btn-icone" draggable="false" [routerLink]="['/treino', f.id]" [attr.aria-label]="'Iniciar treino ' + f.nome">
                <app-icon name="play" [size]="18" />
              </a>
            }
            </div>
          </li>
      </ng-template>

      @if (!plans.treinouHoje()) {
        <a class="btn btn--destaque" routerLink="/treino-do-dia">
          <app-icon name="play" [size]="18" /> Treino customizado para hoje
        </a>
      }
      <a class="btn btn--claro" routerLink="/fichas/sugestao">
        <app-icon name="clipboard" [size]="18" [stroke]="2.2" /> Sugerir ficha
      </a>
      <a class="btn btn--claro" routerLink="/fichas/personalizada">
        <app-icon name="settings" [size]="18" [stroke]="2.2" /> Criar ficha personalizada
      </a>
      <button type="button" class="btn btn--tracejado" (click)="nova()">
        <app-icon name="plus" [size]="18" [stroke]="2.5" /> Nova ficha
      </button>

      @if (excluindoConjunto(); as c) {
        <app-confirmacao titulo="Excluir ficha?" [subtitulo]="c.nome" [mensagem]="'Os ' + c.treinos + ' treinos dela também serão excluídos. Essa ação não pode ser desfeita.'" rotulo="Excluir" (confirmar)="confirmarExclusaoConjunto(c.id)" (cancelar)="excluindoConjunto.set(null)" />
      }
      @if (excluindo(); as f) {
        <app-confirmacao [titulo]="f.treino ? 'Excluir treino?' : 'Excluir ficha?'" [subtitulo]="f.nome" mensagem="Essa ação não pode ser desfeita." rotulo="Excluir" (confirmar)="confirmarExclusao(f)" (cancelar)="excluindo.set(null); aberta.set(null)" />
      }
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
    .conjunto {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 0 4px;
      border-radius: 20px;
    }
    .conjunto__topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 4px 0 6px;
    }
    .conjunto__texto {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .conjunto__nome {
      font-family: var(--font-display);
      font-size: 17px;
    }
    .conjunto__excluir {
      flex: none;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: #b3261e;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .conjunto .lista {
      padding-left: 10px;
      border-left: 3px solid #d8e6a0;
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
  private readonly exercicios = inject(ExerciseService);
  private readonly router = inject(Router);

  /** Fichas na ordem da lista: cada treino solto é uma ficha; os treinos de uma ficha com vários ficam juntos, onde está o primeiro. */
  protected readonly blocos = computed(() => {
    const out: { chave: string; conjunto?: { id: string; nome: string }; fichas: Ficha[] }[] = [];
    const porConjunto = new Map<string, (typeof out)[number]>();
    for (const f of this.plans.fichas()) {
      if (!f.conjunto) {
        out.push({ chave: f.id, fichas: [f] });
        continue;
      }
      const existente = porConjunto.get(f.conjunto.id);
      if (existente) existente.fichas.push(f);
      else {
        const novo = { chave: f.conjunto.id, conjunto: f.conjunto, fichas: [f] };
        porConjunto.set(f.conjunto.id, novo);
        out.push(novo);
      }
    }
    return out;
  });
  protected readonly excluindoConjunto = signal<{ id: string; nome: string; treinos: number } | null>(null);

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

  protected confirmarExclusaoConjunto(id: string): void {
    this.plans.removerConjunto(id);
    this.excluindoConjunto.set(null);
  }

  protected grupos(itens: { exerciseId: string }[]): string[] {
    return this.exercicios.gruposDe(itens.map((i) => i.exerciseId));
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

  protected readonly excluindo = signal<{ id: string; nome: string; treino: boolean } | null>(null);

  protected confirmarExclusao(f: { id: string }): void {
    this.excluindo.set(null);
    this.aberta.set(null);
    this.plans.remover(f.id);
  }

  protected nova(): void {
    const ficha = this.plans.criarRascunho(`Ficha ${String.fromCharCode(65 + (this.plans.fichas().length % 26))}`);
    this.router.navigate(['/ficha', ficha.id]);
  }
}
