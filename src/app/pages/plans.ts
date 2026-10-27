import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlocoFichas, dataCurta, diasParaVencer, emAviso, textoDoPrazo } from '../core/ciclo';
import { Confirmacao } from '../core/confirmacao';
import { ExerciseService } from '../core/exercise.service';
import { FichaCompartilhar } from '../core/ficha-compartilhar';
import { FichaCompartilhada, fichaParaCompartilhar } from '../core/ficha-link';
import { Icon } from '../core/icon';
import { Ficha } from '../core/models';
import { PlanService } from '../core/plan.service';

@Component({
  selector: 'app-plans',
  imports: [Confirmacao, FichaCompartilhar, RouterLink, Icon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <h1 class="titulo">Fichas</h1>
        <p class="apoio">
          {{ plans.blocosAtivos().length }} {{ plans.blocosAtivos().length === 1 ? 'ficha ativa' : 'fichas ativas' }}
        </p>
      </header>

      <a class="btn btn--escuro" routerLink="/fichas/nova">
        <app-icon name="plus" [size]="18" [stroke]="2.5" /> Nova ficha
      </a>

      @if (!plans.treinouHoje()) {
        <a class="btn btn--destaque" routerLink="/treino-do-dia">
          <app-icon name="play" [size]="18" /> Treino customizado para hoje
        </a>
      }

      <ul class="lista">
        @for (b of plans.blocosAtivos(); track b.chave) {
          <ng-container [ngTemplateOutlet]="blocoTpl" [ngTemplateOutletContext]="{ $implicit: b }" />
        } @empty {
          @if (plans.blocosVencidos().length === 0) {
            <li class="apoio vazio">Você ainda não tem fichas. Crie a primeira para começar.</li>
          } @else {
            <li class="apoio vazio">Nenhuma ficha em andamento. Renove uma vencida ou crie uma nova.</li>
          }
        }
      </ul>

      @if (plans.blocosVencidos().length > 0) {
        <section class="vencidas" aria-label="Fichas vencidas">
          <button type="button" class="vencidas__topo" [attr.aria-expanded]="vencidasAbertas()" aria-controls="vencidas-lista" (click)="vencidasAbertas.set(!vencidasAbertas())">
            <span class="conjunto__texto">
              <strong>Vencida</strong>
              <span class="apoio">{{ vencidasResumo() }}</span>
            </span>
            <app-icon [name]="vencidasAbertas() ? 'up' : 'down'" [size]="22" [stroke]="2.2" />
          </button>
          @if (vencidasAbertas()) {
            <ul class="lista" id="vencidas-lista">
              @for (b of plans.blocosVencidos(); track b.chave) {
                <ng-container [ngTemplateOutlet]="blocoTpl" [ngTemplateOutletContext]="{ $implicit: b }" />
                <li class="vencida__acoes">
                  <button type="button" class="btn btn--claro" (click)="renovar(b.chave)">Renovar por {{ plans.mesesPadrao() }} {{ plans.mesesPadrao() === 1 ? 'mês' : 'meses' }}</button>
                  <button type="button" class="btn btn--claro" (click)="plans.arquivarBloco(b.chave)">Arquivar</button>
                </li>
              }
            </ul>
          }
        </section>
      }

      @if (plans.blocosArquivados().length > 0) {
        <a class="btn btn--claro" routerLink="/fichas/arquivadas">Fichas arquivadas ({{ plans.blocosArquivados().length }})</a>
      }

      <ng-template #blocoTpl let-b>
        @if (b.conjunto; as c) {
          <li class="conjunto">
            <button type="button" class="conjunto__topo" [attr.aria-expanded]="aberto(b)" [attr.aria-controls]="'conj-' + c.id" (click)="alternar(b)">
              <span class="conjunto__texto">
                <strong class="conjunto__nome">{{ c.nome }}</strong>
                <span class="apoio">{{ b.fichas.length }} {{ b.fichas.length === 1 ? 'treino' : 'treinos' }}@if (!aberto(b)) { · {{ resumo(b) }} }</span>
                <span class="prazo" [class.prazo--aviso]="aviso(b)">{{ prazo(b) }}</span>
              </span>
              <app-icon [name]="aberto(b) ? 'up' : 'down'" [size]="22" [stroke]="2.2" />
            </button>
            @if (aberto(b)) {
              <ul class="lista" [id]="'conj-' + c.id">
                @for (f of b.fichas; track f.id) {
                  <ng-container [ngTemplateOutlet]="linha" [ngTemplateOutletContext]="{ $implicit: f }" />
                }
              </ul>
              <div class="conjunto__acoes">
                <button type="button" class="conjunto__compartilhar" aria-haspopup="dialog" (click)="compartilhar(c.nome, b.fichas)">
                  <app-icon name="share" [size]="18" [stroke]="2" /> Compartilhar
                </button>
                <button type="button" class="conjunto__excluir" aria-haspopup="dialog" (click)="excluindoConjunto.set({ id: c.id, nome: c.nome, treinos: b.fichas.length })">
                  <app-icon name="trash" [size]="18" [stroke]="2" /> Excluir ficha
                </button>
              </div>
            }
          </li>
        } @else {
          <ng-container [ngTemplateOutlet]="linha" [ngTemplateOutletContext]="{ $implicit: b.fichas[0] }" />
        }
      </ng-template>

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
                  @if (gs.length > 0 || plans.proxima()?.id === f.id) {
                    <ul class="grupos" aria-label="Grupos musculares">
                      @if (plans.proxima()?.id === f.id) {
                        <li class="grupo chip-proximo">{{ plans.emAndamento() ? 'Em andamento' : 'Próximo sugerido' }}</li>
                      }
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

      @if (compartilhando(); as c) {
        <app-ficha-compartilhar [ficha]="c" (fechar)="compartilhando.set(null)" />
      }
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
    .chip-proximo {
      background: var(--accent);
      border-color: transparent;
      color: var(--on-accent);
      font-weight: 700;
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
      width: 100%;
      min-height: 52px;
      padding: 6px 10px;
      border: 0;
      border-radius: 16px;
      background: transparent;
      font: inherit;
      color: inherit;
      text-align: left;
    }
    .conjunto__texto {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .conjunto__texto .apoio {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .conjunto__nome {
      font-family: var(--font-display);
      font-size: 17px;
    }
    .conjunto__acoes { display: flex; flex-wrap: wrap; gap: 4px 12px; }
    .conjunto__compartilhar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 0 10px;
      border: 0;
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: 14px;
      font-weight: 600;
    }
    .conjunto__excluir {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 0 10px;
      border: 0;
      background: transparent;
      color: var(--perigo);
      font: inherit;
      font-size: 14px;
      font-weight: 600;
    }
    .conjunto .lista {
      padding-left: 10px;
      border-left: 3px solid var(--accent-soft-borda);
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
      background: var(--accent-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
    .prazo { font-size: 12px; color: var(--muted); }
    .prazo--aviso { color: var(--ink); font-weight: 700; }
    .vencidas { border: 1px dashed var(--line); border-radius: 18px; padding: 4px 8px 8px; display: flex; flex-direction: column; gap: 8px; }
    .vencidas__topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 52px; padding: 6px 6px; border: 0; background: transparent; font: inherit; color: inherit; text-align: left; }
    .vencida__acoes { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
    .vencida__acoes .btn { flex: 1 1 140px; }
    .vazio {
      padding: 24px 0;
      text-align: center;
    }
  `,
})
export class Plans {
  protected readonly compartilhando = signal<FichaCompartilhada | null>(null);

  protected readonly plans = inject(PlanService);
  private readonly exercicios = inject(ExerciseService);

  protected readonly vencidasAbertas = signal(false);

  protected vencidasResumo(): string {
    const v = this.plans.blocosVencidos();
    return v.map((b) => `${b.nome} · terminou em ${b.fim ? dataCurta(b.fim) : ''}`).join(' · ');
  }

  protected prazo(b: BlocoFichas): string {
    const hoje = this.plans.hoje();
    const dias = diasParaVencer(b, hoje);
    if (dias === null || !b.fim) return '';
    return dias > 0 ? `${textoDoPrazo(dias)} · até ${dataCurta(b.fim)}` : `Terminou em ${dataCurta(b.fim)}`;
  }

  protected aviso(b: BlocoFichas): boolean {
    return emAviso(b, this.plans.hoje());
  }

  protected renovar(chave: string): void {
    this.plans.reativarBloco(chave);
  }

  /** Fichas que a pessoa abriu ou fechou à mão; as demais seguem o padrão: só a ficha atual fica aberta. */
  private readonly manual = signal<Record<string, boolean>>({});

  protected compartilhar(nome: string, treinos: Ficha[]): void {
    this.compartilhando.set(fichaParaCompartilhar(nome, treinos));
  }

  protected aberto(b: BlocoFichas): boolean {
    const escolha = this.manual()[b.chave];
    return escolha ?? b.fichas.some((f) => f.id === this.plans.ativaId());
  }

  protected alternar(b: BlocoFichas): void {
    const agora = !this.aberto(b);
    this.manual.update((m) => ({ ...m, [b.chave]: agora }));
  }

  /** Nomes dos treinos, para a ficha fechada mostrar do que se trata. */
  protected resumo(b: BlocoFichas): string {
    return b.fichas.map((f) => f.nome).join(' · ');
  }

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
}
