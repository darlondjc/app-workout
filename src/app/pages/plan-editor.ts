import { dataCurta, diasParaVencer, somarDias, textoDoPrazo } from '../core/ciclo';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BarraTopo } from '../core/barra-topo';
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
  imports: [BarraTopo, Confirmacao, FichaCompartilhar, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'fecharMenu()', '(document:keydown.escape)': 'fecharMenu()' },
  template: `
    @if (ficha(); as f) {
      <section class="page">
        <app-barra-topo [titulo]="f.nome" [inicio]="110">
          <button antes type="button" class="barra-btn" tabindex="-1" aria-label="Voltar" (click)="nav.voltar('/fichas')">
            <app-icon name="back" [size]="18" [stroke]="2.2" />
          </button>
          @if (f.itens.length > 0) {
            <button type="button" class="barra-btn" tabindex="-1" aria-label="Compartilhar" (click)="compartilhando.set(paraCompartilhar())">
              <app-icon name="share" [size]="18" [stroke]="2.2" />
            </button>
          }
        </app-barra-topo>
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
          <p class="apoio">{{ plans.textoUltimaVez(f.id) }}</p>
          <!-- O prazo é da ficha e se altera na lista de fichas; só um treino solto (que é a própria ficha) mostra o prazo aqui. -->
          @if (!f.conjunto && periodo(); as per) {
            <div class="periodo">
              <span class="apoio">{{ per }}</span>
              <label class="periodo__btn">
                Alterar prazo
                <input class="periodo__data" type="date" lang="pt-BR" [min]="amanha()" [value]="fimAtual()" aria-label="Alterar o prazo da ficha" (click)="abrirSeletor($event)" (change)="salvarPrazo($event)" />
              </label>
            </div>
          }
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
            <li class="card item" [class.item--aberto]="aberto(l.item)" [class.item--arrastando]="arrasto()?.i === l.i" [style.transform]="deslocamento(l.i)">
              <div class="item__topo">
                <button
                  type="button"
                  class="alca"
                  aria-hidden="true"
                  tabindex="-1"
                  title="Arraste para mudar a ordem"
                  (mousedown)="$event.preventDefault()"
                  (pointerdown)="iniciarArrasto($event, l.i)"
                  (pointermove)="moverArrasto($event)"
                  (pointerup)="soltarArrasto($event)"
                  (pointercancel)="cancelarArrasto()"
                >
                  <app-icon name="grip" [size]="20" [stroke]="2" />
                </button>
                @if (l.ex) {
                  <a [routerLink]="['/exercicio', l.item.exerciseId]" [queryParams]="{ ficha: id() }" aria-label="Ver instruções do exercício">
                    <img class="mini" [src]="ex.imagem(l.ex.id, 0)" alt="" loading="lazy" />
                  </a>
                }
                <div class="item__texto">
                  <a class="item__nome" [routerLink]="['/exercicio', l.item.exerciseId]" [queryParams]="{ ficha: id() }">{{ l.ex ? ex.nome(l.ex) : l.item.exerciseId }}</a>
                  <button type="button" class="item__resumo" [attr.aria-expanded]="aberto(l.item)" [attr.aria-controls]="'campos-' + l.i" (click)="alternarCampos(l.item)">
                    <span>{{ resumo(l.item) }}</span>
                    <app-icon [name]="aberto(l.item) ? 'up' : 'down'" [size]="14" [stroke]="2.6" />
                  </button>
                </div>
                <div class="menu-ancora">
                  <button
                    type="button"
                    class="btn-icone btn-icone--neutro"
                    data-menu
                    aria-haspopup="menu"
                    [attr.aria-expanded]="menuAberto() === l.i"
                    [attr.aria-label]="'Mais opções de ' + (l.ex ? ex.nome(l.ex) : l.item.exerciseId)"
                    (click)="alternarMenu(l.i, $event)"
                  >
                    <app-icon name="more" [size]="20" [stroke]="2.4" />
                  </button>
                  @if (menuAberto() === l.i) {
                    <div class="menu" role="menu">
                      <button type="button" role="menuitem" data-mover="cima" [disabled]="l.i === 0" (click)="moverDoMenu(l.i, -1)">Mover para cima</button>
                      <button type="button" role="menuitem" data-mover="baixo" [disabled]="l.i === linhas().length - 1" (click)="moverDoMenu(l.i, 1)">Mover para baixo</button>
                      <button type="button" role="menuitem" class="menu__perigo" aria-haspopup="dialog" (click)="removerDoMenu(l.i)">Remover da ficha</button>
                    </div>
                  }
                </div>
              </div>
              @if (aberto(l.item)) {
                <div class="campos" [id]="'campos-' + l.i">
                  <label class="cp"><small>Séries</small>
                    <input class="cp__input" type="number" inputmode="numeric" min="1" max="20" [value]="l.item.series" (change)="editar(l.i, 'series', $event)" />
                  </label>
                  <label class="cp"><small>{{ l.item.unidade === 'min' ? 'Minutos' : 'Reps' }}</small>
                    <input class="cp__input" type="number" inputmode="numeric" min="1" max="100" [value]="l.item.reps" (change)="editar(l.i, 'reps', $event)" />
                  </label>
                  <label class="cp"><small>Carga (kg)</small>
                    <input class="cp__input" type="number" inputmode="decimal" min="0" step="0.5" [value]="l.item.carga" (change)="editar(l.i, 'carga', $event)" />
                  </label>
                  <label class="cp"><small>Desc. (s)</small>
                    <input class="cp__input" type="number" inputmode="numeric" min="0" step="5" [value]="l.item.descanso" (change)="editar(l.i, 'descanso', $event)" />
                  </label>
                </div>
              }
            </li>
          } @empty {
            <li class="apoio vazio">Esta ficha está vazia. Adicione exercícios pela biblioteca.</li>
          }
        </ul>

        <a class="btn btn--tracejado" routerLink="/biblioteca" [queryParams]="{ ficha: f.id }" (click)="plans.definirAtiva(f.id)">
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
          <app-confirmacao titulo="Excluir ficha?" [subtitulo]="f.nome" rotulo="Excluir" (confirmar)="excluir()" (cancelar)="excluindo.set(false)" />
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
    .periodo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .periodo .apoio { margin: 0; }
    .periodo__btn { position: relative; display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; font-weight: 700; color: var(--ink); text-decoration: underline; cursor: pointer; }
    .periodo__data { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
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
    .barra-btn {
      flex: none;
      width: 38px;
      height: 38px;
      border: 0;
      border-radius: 50%;
      background: var(--soft);
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .topo-editor { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .item {
      transition: transform 0.15s ease;
      position: relative;
      padding: 10px 6px 10px 4px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item--aberto {
      box-shadow: inset 0 0 0 1.5px var(--accent-soft-borda);
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
    .item--arrastando {
      transition: none;
      z-index: 2;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
      opacity: 0.96;
    }
    .alca {
      flex: none;
      width: 24px;
      height: 44px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .item__topo {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mini {
      display: block;
      width: 52px;
      height: 52px;
      border-radius: 10px;
      object-fit: cover;
      background: var(--bg);
    }
    .item__texto {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .item__nome {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 15.5px;
      line-height: 1.2;
      color: inherit;
      text-decoration: none;
    }
    .item__resumo {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      align-self: flex-start;
      min-height: 28px;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      font-size: 13px;
      color: var(--muted);
      text-align: left;
    }
    .menu-ancora {
      position: relative;
      flex: none;
    }
    .item .btn-icone {
      width: 36px;
      height: 44px;
      border-radius: 10px;
    }
    .menu {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 6;
      min-width: 200px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      border-radius: 14px;
      background: var(--card);
      box-shadow: 0 0 0 1px var(--line), 0 10px 28px rgba(0, 0, 0, 0.18);
    }
    .menu button {
      min-height: 44px;
      padding: 0 12px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--ink);
      font: inherit;
      font-size: 15px;
      text-align: left;
    }
    .menu button:disabled {
      opacity: 0.35;
    }
    .menu .menu__perigo {
      color: var(--perigo);
    }
    .campos {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin: 0 4px 2px 30px;
    }
    .cp {
      display: flex;
      flex-direction: column;
      min-height: 46px;
      padding: 4px 8px 5px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg);
    }
    .cp small {
      font-size: 10.5px;
      line-height: 1.3;
      color: var(--muted);
      white-space: nowrap;
    }
    .cp__input {
      width: 100%;
      min-width: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.3;
    }
    .cp__input:focus {
      outline: none;
    }
    .cp:focus-within {
      border-color: var(--ink);
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
      margin-bottom: 88px; /* folga para o botão de play flutuante não cobrir o fim da tela */
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
  /** Exercícios com os campos abertos (séries, repetições, carga e descanso); fechados mostram só o resumo. */
  private readonly abertos = signal<ReadonlySet<string>>(new Set());
  protected readonly menuAberto = signal<number | null>(null);

  protected aberto(item: ItemFicha): boolean {
    return this.abertos().has(item.exerciseId);
  }

  protected alternarCampos(item: ItemFicha): void {
    this.abertos.update((a) => {
      const novo = new Set(a);
      if (!novo.delete(item.exerciseId)) novo.add(item.exerciseId);
      return novo;
    });
  }

  /** "3 × 12 · 47,5 kg · desc. 60 s" (exercícios em minutos: "3 × 12 min · …"). */
  protected resumo(item: ItemFicha): string {
    const n = (v: number) => v.toLocaleString('pt-BR');
    return `${n(item.series)} × ${n(item.reps)}${item.unidade === 'min' ? ' min' : ''} · ${n(item.carga)} kg · desc. ${n(item.descanso)} s`;
  }

  protected alternarMenu(indice: number, evento: Event): void {
    evento.stopPropagation();
    this.menuAberto.set(this.menuAberto() === indice ? null : indice);
  }

  protected fecharMenu(): void {
    if (this.menuAberto() !== null) this.menuAberto.set(null);
  }

  protected moverDoMenu(indice: number, direcao: -1 | 1): void {
    this.menuAberto.set(null);
    this.mover(indice, direcao);
  }

  protected removerDoMenu(indice: number): void {
    this.menuAberto.set(null);
    this.remover(indice);
  }

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
  private readonly blocoDaFicha = computed(() => {
    const f = this.ficha();
    return f ? this.plans.blocos().find((b) => b.fichas.some((x) => x.id === f.id)) ?? null : null;
  });
  protected readonly fimAtual = computed(() => this.blocoDaFicha()?.fim ?? '');
  protected readonly amanha = computed(() => somarDias(this.plans.hoje(), 1));
  protected readonly periodo = computed(() => {
    const b = this.blocoDaFicha();
    if (!b || !b.fim || this.rascunho()) return '';
    const sit = this.plans.situacaoDe(b.fichas[0]);
    const dias = diasParaVencer(b, this.plans.hoje()) ?? 0;
    if (sit === 'arquivada') return `Arquivada · terminou em ${dataCurta(b.fim)}`;
    if (sit === 'vencida') return `Vencida · terminou em ${dataCurta(b.fim)}`;
    return `${textoDoPrazo(dias)} · até ${dataCurta(b.fim)}`;
  });

  /** Alguns navegadores só abrem o seletor ao tocar no ícone do campo; com o campo invisível, abre ao tocar em qualquer parte. */
  protected abrirSeletor(evento: Event): void {
    try {
      (evento.target as HTMLInputElement).showPicker?.();
    } catch {
      /* sem showPicker, vale o comportamento do navegador */
    }
  }

  protected salvarPrazo(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const fim = campo.value;
    const b = this.blocoDaFicha();
    if (!b) return;
    if (!fim || fim <= this.plans.hoje()) {
      if (fim) this.toast.mostrar('Escolha uma data a partir de amanhã');
      campo.value = b.fim ?? '';
      return;
    }
    if (this.plans.situacaoDe(b.fichas[0]) !== 'ativa') this.plans.reativarBloco(b.chave);
    if (this.plans.definirFimBloco(b.chave, fim)) this.toast.mostrar('Prazo atualizado');
  }
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
  /** Arrastar pela alça: o cartão acompanha o dedo, os outros abrem espaço, e a ordem só muda ao soltar. */
  protected readonly arrasto = signal<{ i: number; dy: number; alvo: number; passo: number } | null>(null);
  private gestoArrasto: { y0: number; centros: number[] } | null = null;

  protected iniciarArrasto(e: PointerEvent, i: number): void {
    if (e.button > 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const cartoes = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('li.item')).map((c) => c.getBoundingClientRect());
    if (!cartoes[i]) return;
    this.gestoArrasto = { y0: e.clientY, centros: cartoes.map((r) => r.top + r.height / 2) };
    this.arrasto.set({ i, dy: 0, alvo: i, passo: cartoes[i].height + 10 });
  }

  protected moverArrasto(e: PointerEvent): void {
    const a = this.arrasto();
    const g = this.gestoArrasto;
    if (!a || !g) return;
    const dy = e.clientY - g.y0;
    const centro = g.centros[a.i] + dy;
    let alvo = a.i;
    g.centros.forEach((c, j) => {
      if (Math.abs(c - centro) < Math.abs(g.centros[alvo] - centro)) alvo = j;
    });
    this.arrasto.set({ ...a, dy, alvo });
  }

  protected soltarArrasto(e: PointerEvent): void {
    const a = this.arrasto();
    this.cancelarArrasto();
    if (!a || a.alvo === a.i) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    this.plans.reordenarItem(this.id(), a.i, a.alvo);
    const nome = this.linhas()[a.alvo]?.ex;
    this.anuncio.set(`${nome ? this.ex.nome(nome) : 'Exercício'} movido para a posição ${a.alvo + 1} de ${this.linhas().length}`);
  }

  protected cancelarArrasto(): void {
    this.arrasto.set(null);
    this.gestoArrasto = null;
  }

  /** Quanto cada cartão sai do lugar enquanto um deles é arrastado. */
  protected deslocamento(j: number): string | null {
    const a = this.arrasto();
    if (!a) return null;
    if (j === a.i) return `translateY(${a.dy}px)`;
    if (a.i < a.alvo && j > a.i && j <= a.alvo) return `translateY(${-a.passo}px)`;
    if (a.i > a.alvo && j >= a.alvo && j < a.i) return `translateY(${a.passo}px)`;
    return null;
  }

  protected mover(indice: number, direcao: -1 | 1): void {
    const cartoes = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('li.item'));
    const movido = cartoes[indice];
    const vizinho = cartoes[indice + direcao];
    const animar = !!movido && !!vizinho && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Termina qualquer animação em curso para medir as posições reais (toques em sequência).
    if (animar) for (const c of [movido, vizinho]) c.getAnimations().forEach((a) => a.finish());
    const antesMovido = animar ? movido.getBoundingClientRect().top : 0;
    const antesVizinho = animar ? vizinho.getBoundingClientRect().top : 0;

    this.plans.moverItem(this.id(), indice, direcao);
    const nome = this.linhas()[indice + direcao]?.ex;
    this.anuncio.set(`${nome ? this.ex.nome(nome) : 'Exercício'} movido para a posição ${indice + direcao + 1} de ${this.linhas().length}`);

    afterNextRender(
      () => {
        // A troca de lugar dos elementos tira o foco; devolve para o botão ⋯ do exercício movido.
        movido?.querySelector<HTMLButtonElement>('[data-menu]')?.focus({ preventScroll: true });
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
    this.toast.mostrar('Ficha excluída', { rotulo: 'Desfazer', executar: this.plans.remover(f.id) });
    this.router.navigate(['/fichas']);
  }

  /** Desiste de uma ficha que ainda não tem exercícios: nada foi gravado. */
  protected cancelar(): void {
    this.plans.descartarRascunho();
    this.router.navigate(['/fichas']);
  }
}
