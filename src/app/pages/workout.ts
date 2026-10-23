import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConcluirTreino } from '../core/concluir-treino';
import { ExerciseImage } from '../core/exercise-image';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { RegistroExercicio, SerieEmAndamento } from '../core/models';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';
import { SocialService } from '../core/social.service';
import { ToastService } from '../core/toast.service';

const CHAVE_MARCAR_AO_FINALIZAR = 'app-workout:marcar-tudo-ao-finalizar:v1';

function lerPreferencia(): boolean {
  try {
    return localStorage.getItem(CHAVE_MARCAR_AO_FINALIZAR) === '1';
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-workout',
  imports: [RouterLink, Icon, ExerciseImage, ConcluirTreino],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ficha(); as f) {
      @if (item(); as it) {
        <div class="treino">
          <header class="topo">
            <button type="button" class="sair" (click)="sair()" aria-label="Sair do treino">
              <app-icon name="close" [size]="20" [stroke]="2.2" />
            </button>
            <div>
              <p class="rotulo">{{ plans.rotulo(f.id) }} · {{ f.nome }}</p>
              <p class="posicao">Exercício {{ indice() + 1 }} de {{ f.itens.length }}</p>
            </div>
          </header>

          @if (confirmandoSaida()) {
            <button type="button" class="fundo" tabindex="-1" aria-label="Fechar e continuar treinando" (click)="confirmandoSaida.set(false)"></button>
            <div class="folha" role="alertdialog" aria-modal="true" aria-labelledby="saida-titulo" aria-describedby="saida-texto" (keydown.escape)="confirmandoSaida.set(false)">
              <h2 id="saida-titulo" class="folha__titulo">Sair do treino?</h2>
              <p id="saida-texto" class="folha__texto">Pausando, o treino fica guardado e você continua de onde parou. Cancelando, o que você marcou neste treino é descartado.</p>
              <button type="button" class="btn btn--destaque" (click)="pausar()">Pausar treino</button>
              <button type="button" class="btn btn--perigo" (click)="cancelarTreino()">Cancelar treino</button>
              <button type="button" class="btn btn--escuro-suave" (click)="confirmandoSaida.set(false)">Continuar treinando</button>
            </div>
          }

          @if (perguntandoFaltantes()) {
            <button type="button" class="fundo" tabindex="-1" aria-label="Voltar ao treino" (click)="perguntandoFaltantes.set(false)"></button>
            <div class="folha" role="alertdialog" aria-modal="true" aria-labelledby="falta-titulo" aria-describedby="falta-texto" (keydown.escape)="perguntandoFaltantes.set(false)">
              <h2 id="falta-titulo" class="folha__titulo">Marcar o que falta como feito?</h2>
              <p id="falta-texto" class="folha__texto">
                {{ faltantes() === 1 ? 'Falta 1 série' : 'Faltam ' + faltantes() + ' séries' }} sem marcar. Posso marcar
                {{ faltantes() === 1 ? 'ela' : 'todas' }} como feita{{ faltantes() === 1 ? '' : 's' }}, com as repetições e cargas que estão na tela.
              </p>
              <button type="button" class="btn btn--destaque" (click)="finalizarMarcandoTudo()">Marcar e finalizar</button>
              <button type="button" class="btn btn--escuro-suave" (click)="finalizarSemMarcar()">Finalizar sem marcar</button>
              <button type="button" class="btn btn--escuro-suave" (click)="perguntandoFaltantes.set(false)">Voltar ao treino</button>
            </div>
          }

          @if (concluindo()) {
            <app-concluir-treino (concluir)="finalizar($event)" (cancelar)="concluindo.set(false)" />
          }

          <div class="barra" role="progressbar" aria-label="Progresso do treino" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progresso()">
            <div class="barra__cheia" [style.width.%]="progresso()"></div>
          </div>

          <div class="exercicio">
            <a class="foto" [routerLink]="['/exercicio', it.exerciseId]" [queryParams]="{ ficha: f.id, treino: 1 }" aria-label="Ver instruções do exercício">
              <app-exercise-image [id]="it.exerciseId" [descricao]="'Demonstração: ' + nome()" />
            </a>
            <div>
              <h1>{{ nome() }}</h1>
              <a class="ver" [routerLink]="['/exercicio', it.exerciseId]" [queryParams]="{ ficha: f.id, treino: 1 }">Ver instruções <app-icon name="chevron" [size]="14" [stroke]="2.6" /></a>
            </div>
          </div>

          <div class="tabela" role="group" aria-label="Séries">
            <div class="todos">
              <button type="button" class="todos__botao" (click)="marcarTodos()">
                <app-icon name="check" [size]="16" [stroke]="3" />
                {{ feitas() === series().length ? 'Desmarcar todos' : 'Marcar todos' }}
              </button>
            </div>
            <div class="cabecalho" aria-hidden="true">
              <span>Série</span><span>{{ it.unidade === 'min' ? 'Min' : 'Reps' }}</span><span>Carga (kg)</span><span>Feito</span>
            </div>
            @for (s of series(); track s.n) {
              <div class="serie" [class.feita]="s.feita">
                <span class="n">{{ s.n }}</span>
                <input class="valor" type="number" inputmode="numeric" min="0" [value]="s.reps"
                  [attr.aria-label]="(it.unidade === 'min' ? 'Minutos' : 'Repetições') + ' da série ' + s.n" (change)="editar(s.n - 1, 'reps', $event)" />
                <input class="valor" type="number" inputmode="decimal" min="0" step="0.5" [value]="s.carga"
                  [attr.aria-label]="'Carga da série ' + s.n + ' (kg)'" (change)="editar(s.n - 1, 'carga', $event)" />
                <button
                  type="button"
                  class="marca"
                  [attr.aria-pressed]="s.feita"
                  [attr.aria-label]="'Marcar série ' + s.n + ' como feita'"
                  (click)="alternar(s.n - 1)"
                >
                  <app-icon name="check" [size]="20" [stroke]="3" />
                </button>
              </div>
            }
          </div>

          @if (ultima(); as u) {
            <p class="ultima">Última vez: {{ u }}</p>
          }

          <!-- Com uma série só (como o cardio) não há descanso entre séries: o cronômetro não faz sentido. -->
          @if (series().length > 1) {
            <div class="descanso" role="timer" aria-live="off">
              <div>
                <p class="rotulo">{{ descansando() ? 'Descansando' : 'Descanso' }}</p>
                <p class="tempo" [class.estourou]="descansoAtivo() >= limiteDescanso()">{{ tempo() }}</p>
              </div>
              <span class="selo">{{ feitas() }} de {{ series().length }} séries</span>
            </div>
          }

          <label class="chave">
            <input type="checkbox" role="switch" [checked]="marcarAoFinalizar()" (change)="alternarMarcarAoFinalizar()" />
            <span class="trilho" aria-hidden="true"></span>
            <span class="chave__texto">Marcar tudo como feito ao finalizar treino</span>
          </label>

          <div class="rodape">
            @if (indice() > 0) {
              <button type="button" class="btn btn--claro-escuro" (click)="anterior()">Anterior</button>
            }
            <button type="button" class="btn btn--destaque" (click)="proximo()">
              {{ ultimo() ? 'Finalizar treino' : indice() > 0 ? 'Próximo' : 'Próximo exercício' }}
              @if (!ultimo()) {
                <app-icon name="chevron" [size]="18" [stroke]="2.5" />
              }
            </button>
          </div>
        </div>
      } @else {
        <section class="page">
          <h1 class="titulo">Ficha vazia</h1>
          <p class="apoio">Adicione exercícios antes de iniciar o treino.</p>
          <a class="btn btn--claro" [routerLink]="['/ficha', f.id]">Montar ficha</a>
        </section>
      }
    } @else {
      <section class="page">
        <h1 class="titulo">Ficha não encontrada</h1>
        <a class="btn btn--claro" routerLink="/fichas">Voltar para as fichas</a>
      </section>
    }
  `,
  styles: `
    .treino {
      min-height: 100dvh;
      background: var(--ink);
      color: #fff;
      padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .topo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .fundo {
      border: 0;
      padding: 0;
      cursor: default;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 30;
    }
    .folha {
      position: fixed;
      z-index: 31;
      left: 50%;
      transform: translateX(-50%);
      bottom: 0;
      width: 100%;
      max-width: 480px;
      box-sizing: border-box;
      padding: 24px 20px calc(20px + env(safe-area-inset-bottom));
      border-radius: 24px 24px 0 0;
      background: var(--dark2);
      color: #fff;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .folha__titulo {
      font-family: var(--font-display);
      font-size: 22px;
    }
    .folha__texto {
      font-size: 14px;
      color: #b9c0ba;
      margin-bottom: 6px;
    }
    .btn--perigo {
      background: transparent;
      color: #ff8a80;
      border: 1.5px solid #6b2a26;
    }
    .btn--escuro-suave {
      background: transparent;
      color: #fff;
    }
    .sair {
      border: 0;
      color: inherit;
      padding: 0;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--dark2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rotulo {
      font-size: 13px;
      color: #b9c0ba;
    }
    .posicao {
      font-weight: 700;
      font-size: 15px;
    }
    .barra {
      height: 6px;
      border-radius: 3px;
      background: var(--dark2);
      overflow: hidden;
    }
    .barra__cheia {
      height: 100%;
      background: var(--accent);
      transition: width 0.25s;
    }
    .exercicio {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .foto {
      flex: none;
      width: 96px;
      height: 96px;
      border-radius: 16px;
      overflow: hidden;
    }
    h1 {
      font-family: var(--font-display);
      font-size: 24px;
      line-height: 1.15;
    }
    .ver {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      min-height: 34px;
      padding: 0 8px 0 14px;
      border-radius: 999px;
      background: rgba(200, 236, 58, 0.14);
      color: var(--accent);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
    }
    .ver:active {
      background: rgba(200, 236, 58, 0.26);
    }
    .tabela {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .todos {
      display: flex;
      justify-content: flex-end;
    }
    .todos__botao {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1.5px solid #8a918c;
      background: transparent;
      color: #fff;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .chave {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      cursor: pointer;
      font-size: 14px;
      color: #d5dad6;
    }
    .chave input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .trilho {
      flex: none;
      position: relative;
      width: 46px;
      height: 28px;
      border-radius: 999px;
      background: #3a4046;
      transition: background 0.15s;
    }
    .trilho::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.15s;
    }
    .chave input:checked + .trilho {
      background: var(--accent);
    }
    .chave input:checked + .trilho::after {
      transform: translateX(18px);
      background: var(--ink);
    }
    .chave input:focus-visible + .trilho {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }
    .cabecalho,
    .serie {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr) minmax(0, 1fr) 52px;
      gap: 8px;
      align-items: center;
      text-align: center;
    }
    .cabecalho {
      padding: 0 8px;
      font-size: 12px;
      color: #b9c0ba;
    }
    .cabecalho span:first-child,
    .serie .n {
      text-align: left;
      padding-left: 8px;
    }
    .serie {
      padding: 6px 8px;
      border-radius: 14px;
      background: #1d2125;
      font-weight: 700;
      font-size: 18px;
    }
    .serie.feita {
      background: #232a1b;
    }
    .valor {
      width: 100%;
      min-width: 0;
      height: 44px;
      border-radius: 10px;
      border: 1px solid #3a4046;
      background: #14171a;
      color: #fff;
      font: inherit;
      text-align: center;
    }
    .ultima {
      font-size: 13px;
      color: #b9c0ba;
    }
    .marca {
      width: 44px;
      height: 44px;
      margin: 0 auto;
      border-radius: 50%;
      border: 1.5px solid #8a918c;
      background: transparent;
      color: #8a918c;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .marca[aria-pressed='true'] {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--ink);
    }
    .descanso {
      background: var(--dark2);
      border-radius: 20px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tempo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 34px;
      line-height: 1.1;
    }
    .tempo.estourou {
      color: #ff6b5e;
    }
    .selo {
      background: var(--accent);
      color: var(--ink);
      font-size: 14px;
      font-weight: 700;
      border-radius: 999px;
      padding: 10px 16px;
    }
    .rodape {
      margin-top: auto;
      display: flex;
      gap: 10px;
    }
    .rodape .btn {
      flex: 1;
      min-height: 56px;
    }
    .btn--claro-escuro {
      background: var(--dark2);
      color: #fff;
    }
  `,
})
export class Workout {
  readonly id = input.required<string>();

  protected readonly plans = inject(PlanService);
  private readonly ex = inject(ExerciseService);
  private readonly toast = inject(ToastService);
  private readonly social = inject(SocialService);
  private readonly router = inject(Router);
  protected readonly nav = inject(NavegacaoService);

  /** Segundos de descanso decorridos desde a última série marcada (o timer é progressivo). */
  protected readonly descansoAtivo = signal(0);
  protected readonly descansando = signal(false);
  /** O descanso definido na ficha é a referência: passado esse tempo o cronômetro fica vermelho, mas continua contando. */
  protected readonly limiteDescanso = computed(() => this.item()?.descanso || 60);
  private descansoDesde = 0;
  protected readonly confirmandoSaida = signal(false);
  /** Último passo aberto: foto opcional antes de concluir. */
  protected readonly concluindo = signal(false);
  /** Ao finalizar com séries sem marcar: pergunta se pode marcá-las como feitas. */
  protected readonly perguntandoFaltantes = signal(false);
  /** Preferência (guardada no aparelho): marcar o que falta sem perguntar ao finalizar. */
  protected readonly marcarAoFinalizar = signal(lerPreferencia());
  private intervalo?: ReturnType<typeof setInterval>;

  protected readonly ficha = computed(() => this.plans.get(this.id()));
  /** Treino em andamento desta ficha, se houver (salvo no aparelho e na nuvem). */
  private readonly estado = computed(() => {
    const a = this.plans.emAndamento();
    return a && a.fichaId === this.id() ? a : null;
  });
  protected readonly indice = computed(() => {
    const max = Math.max(0, (this.ficha()?.itens.length ?? 1) - 1);
    return Math.min(this.estado()?.indice ?? 0, max);
  });
  /** O exercício na posição i: o da ficha, ou o que foi trocado só para este treino. */
  private itemDe(i: number) {
    const base = this.ficha()?.itens[i];
    const troca = this.estado()?.trocas?.[i];
    return base && troca ? { ...base, exerciseId: troca } : base;
  }
  /** O exercício da vez. */
  protected readonly item = computed(() => this.itemDe(this.indice()));
  protected readonly ultimo = computed(() => this.indice() >= (this.ficha()?.itens.length ?? 1) - 1);

  protected readonly nome = computed(() => {
    const it = this.item();
    const e = it ? this.ex.get(it.exerciseId) : undefined;
    return e ? this.ex.nome(e) : (it?.exerciseId ?? '');
  });

  private readonly anterior_ = computed(() => {
    const it = this.item();
    return it ? this.plans.ultimoRegistro(it.exerciseId) : undefined;
  });

  /** Séries do exercício i como a tela as mostra: o que foi salvo, ou os valores sugeridos (última vez ou ficha). */
  private seriesDe(i: number) {
    const it = this.itemDe(i);
    if (!it) return [];
    const salvas = this.estado()?.series[i] ?? [];
    const ant = this.plans.ultimoRegistro(it.exerciseId)?.series ?? [];
    return Array.from({ length: it.series }, (_, k) => ({
      n: k + 1,
      feita: !!salvas[k]?.feita,
      carga: salvas[k]?.carga ?? ant[k]?.carga ?? ant.at(-1)?.carga ?? it.carga,
      reps: salvas[k]?.reps ?? it.reps,
      descanso: salvas[k]?.descanso,
    }));
  }

  protected readonly series = computed(() => this.seriesDe(this.indice()));

  /** Séries de todo o treino que ainda não foram marcadas. */
  protected readonly faltantes = computed(() =>
    (this.ficha()?.itens ?? []).reduce((total, _, i) => total + this.seriesDe(i).filter((s) => !s.feita).length, 0),
  );

  protected readonly ultima = computed(() => {
    const r = this.anterior_();
    if (!r) return '';
    const min = r.unidade === 'min';
    return r.series.map((s) => (min ? `${s.reps} min` : `${s.carga} kg × ${s.reps}`)).join(' · ');
  });

  protected readonly feitas = computed(() => this.series().filter((s) => s.feita).length);

  protected readonly progresso = computed(() => {
    const total = this.ficha()?.itens.length ?? 0;
    const series = this.series().length;
    if (total === 0) return 0;
    const fracao = series > 0 ? this.feitas() / series : 0;
    return Math.round(((this.indice() + fracao) / total) * 100);
  });

  protected readonly tempo = computed(() => {
    const segundos = this.descansoAtivo();
    const m = String(Math.floor(segundos / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    return `${m}:${s}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararDescanso());
  }

  /** Só guarda `descanso` quando existe: o Firestore não aceita campos `undefined`. */
  private paraSalvar(s: { feita: boolean; carga: number; reps: number; descanso?: number }): SerieEmAndamento {
    return { feita: s.feita, carga: s.carga, reps: s.reps, ...(s.descanso != null ? { descanso: s.descanso } : {}) };
  }

  /** Grava a série k (valores atuais da tela + alteração) no treino em andamento. */
  private gravarSerie(k: number, mudanca: Partial<{ feita: boolean; carga: number; reps: number; descanso: number | undefined }>): void {
    const i = this.indice();
    const base = this.series().map((s) => this.paraSalvar(s));
    base[k] = this.paraSalvar({ ...base[k], ...mudanca });
    this.plans.andamento(this.id(), (a) => ({ ...a, indice: i, series: { ...a.series, [i]: base } }));
  }

  /** Ao mudar carga ou repetições de uma série, as de baixo que ainda não foram feitas ganham o mesmo valor. */
  protected editar(k: number, campo: 'carga' | 'reps', evento: Event): void {
    const v = (evento.target as HTMLInputElement).valueAsNumber;
    const valor = Number.isFinite(v) && v >= 0 ? v : 0;
    const i = this.indice();
    const base = this.series().map((s, j) => (j >= k && (j === k || !s.feita) ? { ...s, [campo]: valor } : s));
    this.plans.andamento(this.id(), (a) => ({
      ...a,
      indice: i,
      series: { ...a.series, [i]: base.map((s) => this.paraSalvar(s)) },
    }));
  }

  /** O X: com treino começado pergunta se pausa, cancela ou continua; sem nada marcado, só sai. */
  protected sair(): void {
    if (this.plans.emAndamento()?.fichaId === this.id()) this.confirmandoSaida.set(true);
    else this.nav.voltar('/');
  }

  protected pausar(): void {
    this.confirmandoSaida.set(false);
    this.toast.mostrar('Treino pausado. Continue quando quiser.');
    this.nav.voltar('/');
  }

  protected cancelarTreino(): void {
    this.confirmandoSaida.set(false);
    this.plans.descartarAndamento();
    this.toast.mostrar('Treino cancelado.');
    this.nav.voltar('/');
  }

  /** Marca todas as séries do exercício; se já estão todas marcadas, desmarca. */
  protected marcarTodos(): void {
    const i = this.indice();
    const marcar = this.feitas() < this.series().length;
    const base = this.series().map((s) => this.paraSalvar({ ...s, feita: marcar, descanso: marcar ? s.descanso : undefined }));
    this.plans.andamento(this.id(), (a) => ({ ...a, indice: i, series: { ...a.series, [i]: base } }));
    this.pararDescanso();
  }

  protected alternar(k: number): void {
    const it = this.item();
    if (!it) return;
    const ficouFeita = !this.series()[k].feita;
    // O descanso desta série é o tempo corrido desde a anterior; sem timer rodando (primeira série), não há o que guardar.
    const descanso = ficouFeita && this.descansando() ? Math.round((Date.now() - this.descansoDesde) / 1000) : undefined;
    this.gravarSerie(k, { feita: ficouFeita, descanso });
    const todas = this.series().every((s) => s.feita);
    if (ficouFeita && !todas) this.iniciarDescanso();
    else this.pararDescanso();
  }

  private irPara(indice: number): void {
    this.plans.andamento(this.id(), (a) => ({ ...a, indice }));
  }

  protected anterior(): void {
    this.pararDescanso();
    this.irPara(Math.max(0, this.indice() - 1));
  }

  protected proximo(): void {
    this.pararDescanso();
    if (!this.ultimo()) {
      this.irPara(this.indice() + 1);
      return;
    }
    if (this.faltantes() > 0) {
      if (this.marcarAoFinalizar()) this.marcarFaltantes();
      else {
        this.perguntandoFaltantes.set(true);
        return;
      }
    }
    this.concluir();
  }

  protected finalizarMarcandoTudo(): void {
    this.perguntandoFaltantes.set(false);
    this.marcarFaltantes();
    this.concluir();
  }

  protected finalizarSemMarcar(): void {
    this.perguntandoFaltantes.set(false);
    this.concluir();
  }

  protected alternarMarcarAoFinalizar(): void {
    const novo = !this.marcarAoFinalizar();
    this.marcarAoFinalizar.set(novo);
    try {
      localStorage.setItem(CHAVE_MARCAR_AO_FINALIZAR, novo ? '1' : '0');
    } catch {
      /* sem armazenamento: vale só até sair da tela */
    }
  }

  /** Marca como feitas as séries de todos os exercícios, com os valores que a tela mostra para elas. */
  private marcarFaltantes(): void {
    const itens = this.ficha()?.itens ?? [];
    const porExercicio: Record<number, SerieEmAndamento[]> = {};
    itens.forEach((_, i) => {
      porExercicio[i] = this.seriesDe(i).map((s) => this.paraSalvar({ ...s, feita: true }));
    });
    this.plans.andamento(this.id(), (a) => ({ ...a, series: { ...a.series, ...porExercicio } }));
  }

  /** Com a conta social ativa, oferece uma foto para a timeline; sem ela, conclui direto. */
  private concluir(): void {
    if (this.social.ativo()) this.concluindo.set(true);
    else this.finalizar(null);
  }

  /** Grava o treino; a foto (se houver) vai para a nuvem sem travar a saída da tela. */
  protected finalizar(foto: string | null): void {
    this.concluindo.set(false);
    const f = this.ficha();
    const salvo = this.estado();
    const efetivos = f ? this.plans.exerciciosEfetivos(f) : [];
    const registros: RegistroExercicio[] = (f?.itens ?? []).flatMap((it, i) => {
      const series = (salvo?.series[i] ?? [])
        .filter((s) => s.feita)
        .map((s) => ({ carga: s.carga, reps: s.reps, ...(s.descanso != null ? { descanso: s.descanso } : {}) }));
      return series.length ? [{ exerciseId: efetivos[i], ...(it.unidade ? { unidade: it.unidade } : {}), series }] : [];
    });
    const sessaoId = this.plans.registrarSessao(this.id(), registros, foto !== null);
    if (foto) void this.social.salvarFoto(sessaoId, foto);
    this.toast.mostrar('Treino concluído. Bom trabalho!');
    this.router.navigate(['/']);
  }

  /** Cronômetro progressivo: conta a partir de zero e não para sozinho. Usa a hora real para não atrasar com a tela apagada. */
  private iniciarDescanso(): void {
    this.pararDescanso();
    this.descansoDesde = Date.now();
    this.descansando.set(true);
    this.intervalo = setInterval(() => {
      const antes = this.descansoAtivo();
      const agora = Math.floor((Date.now() - this.descansoDesde) / 1000);
      this.descansoAtivo.set(agora);
      const limite = this.limiteDescanso();
      if (antes < limite && agora >= limite) navigator.vibrate?.(200);
    }, 500);
  }

  private pararDescanso(): void {
    clearInterval(this.intervalo);
    this.intervalo = undefined;
    this.descansando.set(false);
    this.descansoAtivo.set(0);
  }
}
