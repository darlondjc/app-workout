import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { equivalentes } from '../core/equivalentes';
import { ExerciseImage } from '../core/exercise-image';
import { Carregando } from '../core/spinner';
import { ExerciseService } from '../core/exercise.service';
import { NavegacaoService } from '../core/navegacao.service';
import { Icon } from '../core/icon';
import { PlanService } from '../core/plan.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-exercise-detail',
  imports: [Icon, ExerciseImage, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (exercicio(); as e) {
      <div class="foto">
        <app-exercise-image [id]="e.id" [descricao]="'Demonstração: ' + nome()" />
        <button type="button" class="voltar" (click)="voltar()" aria-label="Voltar">
          <app-icon name="back" [size]="22" [stroke]="2.2" />
        </button>
      </div>

      <section class="corpo">
        <header>
          <h1 class="nome">{{ nome() }}</h1>
          <p class="apoio">Original em inglês: {{ e.name }}</p>
        </header>

        <div class="tags">
          @for (m of e.primaryMuscles; track m) {
            <span class="tag tag--destaque">{{ ex.musculo(m) }}</span>
          }
          @for (m of e.secondaryMuscles; track m) {
            <span class="tag">{{ ex.musculo(m) }}</span>
          }
          <span class="tag">{{ ex.equipamento(e.equipment) }}</span>
          <span class="tag">{{ ex.nivel(e.level) }}</span>
          @if (ex.mecanica(e.mechanic); as mec) {
            <span class="tag">{{ mec }}</span>
          }
        </div>

        @if (daFicha(); as f) {
          <section aria-labelledby="trocar">
            <h2 id="trocar" class="sub">Trocar por equivalente</h2>
            <p class="apoio">Mesmo grupo muscular e mesmo efeito, fora das suas fichas.</p>
            <button type="button" class="btn btn--claro trocar-btn" (click)="trocando.set(!trocando())" [attr.aria-expanded]="trocando()">
              @if (trocando()) {
                <app-icon name="close" [size]="20" [stroke]="2.5" /> Cancelar
              } @else {
                Ver opções para esse exercício
              }
            </button>
            @if (trocando()) {
              @if (opcoes().length === 0) {
                <p class="apoio">Nenhum exercício equivalente disponível.</p>
              }
              <ul class="opcoes">
                @for (o of opcoes(); track o.id) {
                  <li class="opcao-linha" [class.selecionada]="pendente() === o.id">
                    <button type="button" class="opcao" [attr.aria-pressed]="pendente() === o.id" (click)="trocar(o.id)">
                      <img class="opcao__img" [src]="ex.imagem(o.id, 0)" alt="" loading="lazy" />
                      <span class="opcao__txt">
                        <span class="opcao__nome">{{ ex.nome(o) }}</span>
                        <span class="apoio">{{ ex.equipamento(o.equipment) }} · {{ ex.nivel(o.level) }}</span>
                      </span>
                      @if (pendente() === o.id) {
                        <span class="opcao__marca" aria-hidden="true"><app-icon name="check" [size]="16" [stroke]="3" /></span>
                      }
                    </button>
                    <button type="button" class="lupa" [attr.aria-label]="'Ver imagem de ' + ex.nome(o)" (click)="verImagem(o.id)">
                      <app-icon name="search" [size]="20" [stroke]="2.2" />
                    </button>
                  </li>
                }
              </ul>
              @if (pendente(); as novoId) {
                <div class="card pergunta pergunta--fixa" role="group" aria-label="Confirmar a troca do exercício">
                  @if (emTreino()) {
                    <p><strong>Trocar por “{{ nomeDe(novoId) }}”</strong> só neste treino ou na ficha toda?</p>
                    <button type="button" class="btn btn--escuro" (click)="aplicar(novoId, 'treino')">Só neste treino</button>
                    <button type="button" class="btn btn--claro" (click)="aplicar(novoId, 'ficha')">Na ficha “{{ f.nome }}”</button>
                  } @else {
                    <p><strong>Trocar por “{{ nomeDe(novoId) }}”</strong> na ficha “{{ f.nome }}”?</p>
                    <button type="button" class="btn btn--escuro" (click)="aplicar(novoId, 'ficha')">Confirmar troca</button>
                  }
                  <button type="button" class="btn btn--claro" (click)="pendente.set(null)">
                    <app-icon name="close" [size]="18" [stroke]="2.2" /> Cancelar
                  </button>
                </div>
              }
            }
          </section>
        }

        <section aria-labelledby="como-fazer">
          <h2 id="como-fazer" class="sub">Como fazer</h2>
          @if (!instrucoes().traduzido) {
            <p class="apoio aviso-idioma">Instruções disponíveis apenas em inglês.</p>
          }
          <ol class="passos" [attr.lang]="instrucoes().traduzido ? 'pt-BR' : 'en'">
            @for (p of instrucoes().passos; track $index) {
              <li>{{ p }}</li>
            }
          </ol>
        </section>
      </section>

      @if (previaEx(); as p) {
        <button type="button" class="fundo" tabindex="-1" aria-label="Fechar a imagem" (click)="fecharImagem()"></button>
        <div class="dialogo" role="dialog" aria-modal="true" [attr.aria-label]="'Imagem de ' + ex.nome(p)">
          <div class="dialogo__img">
            <app-exercise-image [id]="p.id" [descricao]="'Demonstração: ' + ex.nome(p)" />
          </div>
          <h3 class="dialogo__nome">{{ ex.nome(p) }}</h3>
          <p class="apoio">{{ ex.equipamento(p.equipment) }} · {{ ex.nivel(p.level) }}</p>
          <button type="button" class="btn btn--escuro" (click)="escolherDaImagem(p.id)">Selecionar este exercício</button>
          <button #fecharBtn type="button" class="btn btn--claro" (click)="fecharImagem()">Fechar</button>
        </div>
      }

      @if (!daFicha()) {
        <div class="rodape">
          @if (naAtiva(); as ficha) {
            <button type="button" class="btn btn--claro" disabled>
              <app-icon name="check" [size]="20" [stroke]="2.5" /> Já está em “{{ ficha.nome }}”
            </button>
          } @else {
            <button type="button" class="btn btn--escuro" (click)="adicionar()">
              <app-icon name="plus" [size]="20" [stroke]="2.5" /> {{ rotuloAdicionar() }}
            </button>
          }
        </div>
      }
    } @else if (ex.ready()) {
      <section class="page">
        <h1 class="titulo">Exercício não encontrado</h1>
        <button type="button" class="btn btn--claro" (click)="voltar()">Voltar</button>
      </section>
    } @else if (ex.error()) {
      <section class="page">
        <h1 class="titulo">Sem conexão</h1>
        <p class="apoio">Não foi possível carregar os exercícios.</p>
        <button type="button" class="btn btn--escuro" (click)="ex.carregar()">Tentar de novo</button>
      </section>
    } @else {
      <section class="page"><app-carregando texto="Carregando exercício…" /></section>
    }
  `,
  styles: `
    .foto {
      position: relative;
      height: 300px;
      background: #fff;
    }
    .voltar {
      position: absolute;
      top: 20px;
      left: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 4px rgba(20, 23, 26, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      padding: 0;
      color: var(--ink);
    }
    .corpo {
      padding: 20px 20px 110px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .nome {
      font-family: var(--font-display);
      font-size: 26px;
      line-height: 1.15;
      letter-spacing: -0.3px;
      margin-bottom: 6px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sub {
      font-size: 18px;
    }
    .aviso-idioma {
      margin: 4px 0 10px;
    }
    .passos {
      margin: 0;
      padding-left: 22px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 15px;
      line-height: 1.45;
    }
    .trocar-btn {
      width: 100%;
      margin-top: 8px;
    }
    .pergunta {
      margin-top: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pergunta p {
      margin: 0 0 4px;
    }
    .opcoes {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .opcao-linha {
      display: flex;
      align-items: stretch;
      gap: 8px;
    }
    .opcao-linha .opcao {
      flex: 1;
      min-width: 0;
    }
    .opcao-linha.selecionada .opcao {
      border: 2px solid var(--accent-ink);
      background: #f3f9d6;
    }
    .opcao__marca {
      margin-left: auto;
      flex: none;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--ink);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lupa {
      flex: none;
      width: 48px;
      border: 1px solid var(--line, rgba(20, 23, 26, 0.12));
      border-radius: 14px;
      background: #fff;
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pergunta--fixa {
      position: sticky;
      bottom: calc(12px + env(safe-area-inset-bottom));
      z-index: 5;
      box-shadow: 0 8px 24px rgba(20, 23, 26, 0.22);
    }
    .fundo {
      position: fixed;
      inset: 0;
      border: 0;
      padding: 0;
      cursor: default;
      background: rgba(0, 0, 0, 0.6);
      z-index: 30;
    }
    .dialogo {
      position: fixed;
      z-index: 31;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(92%, 440px);
      max-height: 90vh;
      overflow: auto;
      box-sizing: border-box;
      padding: 16px;
      border-radius: 24px;
      background: var(--card, #fff);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dialogo__img {
      height: 260px;
      border-radius: 16px;
      overflow: hidden;
    }
    .dialogo__nome {
      font-family: var(--font-display);
      font-size: 20px;
      margin: 4px 0 0;
    }
    .opcao {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border: 1px solid var(--line, rgba(20, 23, 26, 0.12));
      border-radius: 14px;
      background: #fff;
      text-align: left;
      color: var(--ink);
    }
    .opcao__img {
      width: 56px;
      height: 56px;
      border-radius: 10px;
      object-fit: cover;
      background: #fff;
      flex: none;
    }
    .opcao__txt {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .opcao__nome {
      font-weight: 600;
    }
    .rodape {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      padding: 12px 20px calc(20px + env(safe-area-inset-bottom));
      background: linear-gradient(to top, var(--bg) 70%, transparent);
    }
    .rodape .btn {
      width: 100%;
      min-height: 56px;
    }
  `,
})
export class ExerciseDetail {
  readonly id = input.required<string>();
  /** Ficha de onde a pessoa veio (vem do endereço), para oferecer a troca de exercício. */
  readonly ficha = input<string>();
  /** "1" quando a pessoa abriu o exercício de dentro do treino (a tela de treino manda isso). */
  readonly treino = input<string>();

  protected readonly ex = inject(ExerciseService);
  private readonly plans = inject(PlanService);
  private readonly toast = inject(ToastService);
  private readonly nav = inject(NavegacaoService);
  private readonly router = inject(Router);

  protected readonly trocando = signal(false);
  /** Exercício escolhido para a troca, esperando a confirmação (e, em treino, "só neste treino ou na ficha"). */
  protected readonly pendente = signal<string | null>(null);

  protected readonly exercicio = computed(() => this.ex.get(this.id()));
  protected readonly nome = computed(() => {
    const e = this.exercicio();
    return e ? this.ex.nome(e) : '';
  });

  protected readonly instrucoes = computed(() => {
    const e = this.exercicio();
    return e ? this.ex.instrucoes(e) : { passos: [], traduzido: true };
  });

  private readonly fichaAtiva = computed(() => this.plans.fichas().find((f) => f.id === this.plans.ativaId()) ?? this.plans.fichas()[0]);

  /** A ficha ativa, se o exercício já estiver nela (é nela que o botão adicionaria). */
  protected readonly naAtiva = computed(() => {
    const f = this.fichaAtiva();
    return f?.itens.some((i) => i.exerciseId === this.id()) ? f : null;
  });

  protected readonly rotuloAdicionar = computed(() => {
    const f = this.fichaAtiva();
    return f ? `Adicionar a “${f.nome}”` : 'Adicionar à ficha';
  });

  private readonly efetivos = computed(() => {
    const f = this.plans.get(this.ficha() ?? '');
    return f ? this.plans.exerciciosEfetivos(f) : [];
  });

  /** Posição do exercício na ficha de origem (considera trocas feitas só no treino atual). */
  private readonly posicao = computed(() => this.efetivos().indexOf(this.id()));

  /** A ficha de origem, se o exercício realmente estiver nela. */
  protected readonly daFicha = computed(() => (this.posicao() >= 0 ? (this.plans.get(this.ficha() ?? '') ?? null) : null));

  /** Há treino começado dessa ficha (ou a pessoa veio da tela de treino): a troca pode valer só para ele. */
  protected readonly emTreino = computed(() => {
    const f = this.daFicha();
    return !!f && (this.treino() === '1' || this.plans.emAndamento()?.fichaId === f.id);
  });

  /** Equivalentes que não estão na ficha de origem nem na ficha ativa. */
  protected readonly opcoes = computed(() => {
    const e = this.exercicio();
    const f = this.daFicha();
    if (!e || !f) return [];
    const ids = [...this.efetivos(), ...f.itens.map((i) => i.exerciseId), ...(this.fichaAtiva()?.itens ?? []).map((i) => i.exerciseId)];
    // Em ordem crescente pelo nome que aparece na tela (o traduzido, quando há).
    return equivalentes(e, this.ex.exercises(), new Set(ids)).sort((x, y) =>
      this.ex.nome(x).localeCompare(this.ex.nome(y), 'pt', { sensitivity: 'base', numeric: true }),
    );
  });

  protected nomeDe(id: string): string {
    const e = this.ex.get(id);
    return e ? this.ex.nome(e) : id;
  }

  /** Marca o exercício como escolhido (com destaque na lista); a troca só acontece ao confirmar. Tocar de novo desmarca. */
  protected trocar(novoId: string): void {
    if (!this.daFicha() || !this.ex.get(novoId)) return;
    this.pendente.update((atual) => (atual === novoId ? null : novoId));
  }

  /** Exercício aberto na imagem ampliada (a lupa de cada opção). */
  private readonly previa = signal<string | null>(null);
  protected readonly previaEx = computed(() => {
    const id = this.previa();
    return id ? this.ex.get(id) : undefined;
  });
  private readonly botaoFechar = viewChild<ElementRef<HTMLButtonElement>>('fecharBtn');

  protected verImagem(id: string): void {
    this.previa.set(id);
    setTimeout(() => this.botaoFechar()?.nativeElement.focus());
  }

  protected fecharImagem(): void {
    this.previa.set(null);
  }

  protected escolherDaImagem(id: string): void {
    this.previa.set(null);
    this.pendente.set(id);
  }

  @HostListener('document:keydown.escape')
  protected aoApertarEsc(): void {
    if (this.previa()) this.previa.set(null);
  }

  protected aplicar(novoId: string, onde: 'treino' | 'ficha'): void {
    const f = this.daFicha();
    if (!f) return;
    if (onde === 'treino') this.plans.trocarNoTreino(f.id, this.posicao(), novoId);
    else this.plans.trocarNaFicha(f.id, this.posicao(), novoId);
    this.toast.mostrar(onde === 'treino' ? `Trocado só neste treino por “${this.nomeDe(novoId)}”` : `Trocado por “${this.nomeDe(novoId)}”`);
    this.pendente.set(null);
    this.trocando.set(false);
    void this.router.navigate(['/exercicio', novoId], { queryParams: { ficha: f.id, ...(this.treino() ? { treino: this.treino() } : {}) }, replaceUrl: true });
  }

  protected voltar(): void {
    this.nav.voltar('/biblioteca');
  }

  protected adicionar(): void {
    const { ficha, jaEstava } = this.plans.adicionar(this.id());
    this.toast.mostrar(jaEstava ? `Já está em “${ficha.nome}”` : `Adicionado a “${ficha.nome}”`);
  }
}
