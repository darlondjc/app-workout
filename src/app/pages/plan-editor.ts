import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Confirmacao } from '../core/confirmacao';
import { FichaCompartilhar } from '../core/ficha-compartilhar';
import { FichaCompartilhada, fichaParaCompartilhar } from '../core/ficha-link';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { ItemFicha } from '../core/models';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';
import { ToastService } from '../core/toast.service';

type Campo = keyof Omit<ItemFicha, 'exerciseId'>;

@Component({
  selector: 'app-plan-editor',
  imports: [Confirmacao, FichaCompartilhar, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ficha(); as f) {
      <section class="page">
        <header>
          <div class="topo-editor">
            <button type="button" class="voltar" (click)="nav.voltar('/fichas')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
            @if (f.itens.length > 0) {
              <button type="button" class="voltar" aria-haspopup="dialog" (click)="compartilhando.set(paraCompartilhar())">
                <app-icon name="share" [size]="18" [stroke]="2.2" /> Compartilhar
              </button>
            }
          </div>
          <p class="apoio">{{ plans.rotulo(f.id) }}</p>
          <label class="sr-only" for="nome-ficha">Nome da ficha</label>
          <input
            id="nome-ficha"
            class="nome"
            type="text"
            [value]="f.nome"
            maxlength="40"
            (change)="renomear($any($event.target).value)"
          />
        </header>

        <p class="sr-only" aria-live="polite">{{ anuncio() }}</p>
        <ul class="itens">
          @for (l of linhas(); track l.item.exerciseId) {
            <li class="card item">
              <div class="item__topo">
                @if (l.ex) {
                  <a [routerLink]="['/exercicio', l.item.exerciseId]" [queryParams]="{ ficha: id() }" aria-label="Ver instruções do exercício">
                    <img class="mini" [src]="ex.imagem(l.ex.id, 0)" alt="" loading="lazy" />
                  </a>
                }
                <a class="item__nome" [routerLink]="['/exercicio', l.item.exerciseId]" [queryParams]="{ ficha: id() }">
                  {{ l.ex ? ex.nome(l.ex) : l.item.exerciseId }}
                  <span class="item__ver">Ver instruções ›</span>
                </a>
                <button type="button" class="btn-icone btn-icone--neutro" data-mover="cima" aria-label="Mover para cima" [disabled]="l.i === 0" (click)="mover(l.i, -1)">
                  <app-icon name="up" [size]="20" />
                </button>
                <button type="button" class="btn-icone btn-icone--neutro" data-mover="baixo" aria-label="Mover para baixo" [disabled]="l.i === linhas().length - 1" (click)="mover(l.i, 1)">
                  <app-icon name="down" [size]="20" />
                </button>
                <button type="button" class="btn-icone btn-icone--neutro" aria-label="Remover da ficha" aria-haspopup="dialog" (click)="remover(l.i)">
                  <app-icon name="close" [size]="20" />
                </button>
              </div>
              <div class="campos">
                <label>Séries
                  <input class="campo-num" type="number" inputmode="numeric" min="1" max="20" [value]="l.item.series" (change)="editar(l.i, 'series', $event)" />
                </label>
                <label>{{ l.item.unidade === 'min' ? 'Minutos' : 'Reps' }}
                  <input class="campo-num" type="number" inputmode="numeric" min="1" max="100" [value]="l.item.reps" (change)="editar(l.i, 'reps', $event)" />
                </label>
                <label>Carga (kg)
                  <input class="campo-num" type="number" inputmode="decimal" min="0" step="0.5" [value]="l.item.carga" (change)="editar(l.i, 'carga', $event)" />
                </label>
                <label>Desc. (s)
                  <input class="campo-num" type="number" inputmode="numeric" min="0" step="5" [value]="l.item.descanso" (change)="editar(l.i, 'descanso', $event)" />
                </label>
              </div>
            </li>
          } @empty {
            <li class="apoio vazio">Esta ficha está vazia. Adicione exercícios pela biblioteca.</li>
          }
        </ul>

        <a class="btn btn--tracejado" routerLink="/biblioteca" (click)="plans.definirAtiva(f.id)">
          <app-icon name="plus" [size]="18" [stroke]="2.5" /> Adicionar exercício
        </a>

        @if (rascunho()) {
          <button type="button" class="excluir" (click)="cancelar()">Cancelar</button>
        } @else {
          <div class="acoes">
            <button type="button" class="btn btn--claro" (click)="salvar()">Salvar ficha</button>
          </div>

          <button type="button" class="excluir" aria-haspopup="dialog" (click)="excluindo.set(true)">Excluir ficha</button>
        }

        @if (f.itens.length > 0) {
          <a
            class="fab"
            [routerLink]="['/treino', f.id]"
            [attr.aria-label]="plans.emAndamento()?.fichaId === f.id ? 'Continuar treino' : 'Iniciar treino'"
          >
            <app-icon name="play" [size]="26" />
          </a>
        }

        @if (excluindo()) {
          <app-confirmacao titulo="Excluir ficha?" [subtitulo]="f.nome" mensagem="Essa ação não pode ser desfeita." rotulo="Excluir" (confirmar)="excluir()" (cancelar)="excluindo.set(false)" />
        }
        @if (compartilhando(); as c) {
          <app-ficha-compartilhar [ficha]="c" (fechar)="compartilhando.set(null)" />
        }
        @if (removendo(); as r) {
          <app-confirmacao titulo="Remover da ficha?" [subtitulo]="r.nome" rotulo="Remover" (confirmar)="confirmarRemocao(r.indice)" (cancelar)="removendo.set(null)" />
        }
      </section>
    } @else {
      <section class="page">
        <h1 class="titulo">Ficha não encontrada</h1>
        <a class="btn btn--claro" routerLink="/fichas">Voltar para as fichas</a>
      </section>
    }
  `,
  styles: `
    .nome {
      width: 100%;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      padding: 2px 0;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: -0.5px;
    }
    .nome:hover,
    .nome:focus {
      border-bottom-color: var(--line);
      outline: none;
    }
    .itens {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .topo-editor { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .item {
      position: relative;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
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
    }
    .item__ver {
      display: block;
      font-size: 12px;
      font-weight: 400;
      color: var(--muted);
    }
    .item__topo {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .mini {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      object-fit: cover;
      background: var(--bg);
      margin-right: 8px;
    }
    .item__nome {
      flex: 1;
      min-width: 0;
      font-weight: 700;
      font-size: 15px;
      line-height: 1.25;
    }
    .item .btn-icone {
      width: 36px;
      height: 44px;
      border-radius: 10px;
    }
    .item .btn-icone:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .campos {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .campos label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: var(--muted);
    }
    .fab {
      position: fixed;
      z-index: 9;
      bottom: calc(84px + 16px + env(safe-area-inset-bottom));
      /* O app tem no máximo 480px de largura e fica centralizado. */
      right: max(20px, calc(50% - 240px + 20px));
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--accent);
      color: var(--on-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(20, 23, 26, 0.28);
      transition: transform 0.15s ease;
    }
    .fab:active {
      transform: scale(0.94);
    }
    .acoes {
      display: flex;
      gap: 10px;
    }
    .acoes .btn {
      flex: 1;
    }
    .excluir {
      align-self: center;
      margin-bottom: 64px; /* espaço para o botão de play flutuante não cobrir o fim da tela */
      min-height: 44px;
      padding: 0 12px;
      border: none;
      background: transparent;
      color: var(--perigo);
      font-weight: 700;
      font-size: 14px;
    }
    .vazio {
      padding: 24px 0;
      text-align: center;
    }
  `,
})
export class PlanEditor {
  readonly id = input.required<string>();

  protected readonly plans = inject(PlanService);
  protected readonly ex = inject(ExerciseService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly nav = inject(NavegacaoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /** Texto para leitores de tela quando a ordem muda. */
  protected readonly anuncio = signal('');

  protected readonly ficha = computed(() => this.plans.get(this.id()));
  protected readonly compartilhando = signal<FichaCompartilhada | null>(null);

  /** Se o treino faz parte de uma ficha com vários, vai a ficha inteira; senão, só este treino. */
  protected paraCompartilhar(): FichaCompartilhada {
    const f = this.ficha()!;
    const treinos = f.conjunto ? this.plans.fichas().filter((x) => x.conjunto?.id === f.conjunto?.id) : [f];
    return fichaParaCompartilhar(f.conjunto?.nome ?? f.nome, treinos);
  }
  /** Ficha ainda vazia e não gravada: em vez de excluir, só dá para cancelar. */
  protected readonly rascunho = computed(() => this.plans.rascunho()?.id === this.id());
  protected readonly excluindo = signal(false);
  protected readonly removendo = signal<{ indice: number; nome: string } | null>(null);
  protected readonly linhas = computed(() =>
    (this.ficha()?.itens ?? []).map((item, i) => ({ item, i, ex: this.ex.get(item.exerciseId) })),
  );

  protected renomear(nome: string): void {
    const limpo = nome.trim();
    if (limpo) this.plans.renomear(this.id(), limpo);
  }

  protected editar(indice: number, campo: Campo, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).valueAsNumber;
    const minimo = campo === 'series' || campo === 'reps' ? 1 : 0;
    this.plans.editarItem(this.id(), indice, campo, Math.max(minimo, Number.isNaN(valor) ? minimo : valor));
  }

  /**
   * Troca dois exercícios de lugar com animação (técnica FLIP): mede onde cada cartão está, grava a nova ordem
   * e, depois que a tela se reorganiza, anima cada cartão do lugar antigo até o novo. O que foi movido sobe
   * um pouco (escala e sombra) enquanto cruza o outro, e depois pousa.
   */
  protected mover(indice: number, direcao: -1 | 1): void {
    const cartoes = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('li.item'));
    const movido = cartoes[indice];
    const vizinho = cartoes[indice + direcao];
    const animar = !!movido && !!vizinho && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Termina qualquer animação em curso para medir as posições reais (toques em sequência).
    if (animar) for (const c of [movido, vizinho]) c.getAnimations().forEach((a) => a.finish());
    const antesMovido = animar ? movido.getBoundingClientRect().top : 0;
    const antesVizinho = animar ? vizinho.getBoundingClientRect().top : 0;
    const botao = direcao === -1 ? 'cima' : 'baixo';

    this.plans.moverItem(this.id(), indice, direcao);
    const nome = this.linhas()[indice + direcao]?.ex;
    this.anuncio.set(`${nome ? this.ex.nome(nome) : 'Exercício'} movido para a posição ${indice + direcao + 1} de ${this.linhas().length}`);

    afterNextRender(
      () => {
        // A troca de lugar dos elementos tira o foco do botão; devolve para a mesma ação (ou a oposta, se chegou ao limite).
        const alvo = movido?.querySelector<HTMLButtonElement>(`[data-mover="${botao}"]`);
        const par = movido?.querySelector<HTMLButtonElement>(`[data-mover="${botao === 'cima' ? 'baixo' : 'cima'}"]`);
        (alvo && !alvo.disabled ? alvo : par)?.focus({ preventScroll: true });
        if (!animar) return;
        const dMovido = antesMovido - movido.getBoundingClientRect().top;
        const dVizinho = antesVizinho - vizinho.getBoundingClientRect().top;
        const duracao = 420;
        const curva = 'cubic-bezier(0.22, 0.9, 0.28, 1)';
        // Quem foi movido passa por cima: sobe, cruza e pousa.
        movido.style.zIndex = '2';
        const subida = movido.animate(
          [
            { transform: `translateY(${dMovido}px) scale(1)`, boxShadow: '0 0 0 rgba(20,23,26,0)' },
            { transform: `translateY(${dMovido * 0.55}px) scale(1.025)`, boxShadow: '0 14px 28px rgba(20,23,26,0.16)', offset: 0.35 },
            { transform: 'translateY(0) scale(1)', boxShadow: '0 0 0 rgba(20,23,26,0)' },
          ],
          { duration: duracao, easing: curva },
        );
        subida.finished.then(() => (movido.style.zIndex = ''), () => (movido.style.zIndex = ''));
        vizinho.animate([{ transform: `translateY(${dVizinho}px)` }, { transform: 'translateY(0)' }], { duration: duracao, easing: curva });
        // Ênfase no chevron tocado: o ícone dá um pulo curto na direção da troca e o botão acende de leve.
        const empurra = direcao === -1 ? -4 : 4;
        alvo?.querySelector('app-icon')?.animate(
          [
            { transform: 'translateY(0) scale(1)' },
            { transform: `translateY(${empurra}px) scale(1.4)`, offset: 0.3 },
            { transform: 'translateY(0) scale(1)' },
          ],
          { duration: 460, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' },
        );
        alvo?.animate([{ backgroundColor: 'rgba(205, 235, 59, 0.9)' }, { backgroundColor: 'rgba(205, 235, 59, 0)' }], { duration: 560, easing: 'ease-out' });
      },
      { injector: this.injector },
    );
  }

  protected remover(indice: number): void {
    const item = this.ficha()?.itens[indice];
    if (!item) return;
    const e = this.ex.get(item.exerciseId);
    this.removendo.set({ indice, nome: e ? this.ex.nome(e) : item.exerciseId });
  }

  protected confirmarRemocao(indice: number): void {
    this.removendo.set(null);
    this.plans.removerItem(this.id(), indice);
  }

  protected salvar(): void {
    // As alterações já são gravadas a cada edição; aqui só confirmamos e voltamos à lista.
    this.toast.mostrar('Ficha salva');
    this.router.navigate(['/fichas']);
  }

  protected excluir(): void {
    const f = this.ficha();
    this.excluindo.set(false);
    if (!f) return;
    this.plans.remover(f.id);
    this.toast.mostrar('Ficha excluída');
    this.router.navigate(['/fichas']);
  }

  /** Desiste de uma ficha que ainda não tem exercícios: nada foi gravado. */
  protected cancelar(): void {
    this.plans.descartarRascunho();
    this.router.navigate(['/fichas']);
  }
}
