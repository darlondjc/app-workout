import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExerciseService } from '../core/exercise.service';
import { FichaCompartilhada as Ficha, TreinoCompartilhado, decodificarFicha } from '../core/ficha-link';
import { PlanService } from '../core/plan.service';
import { Carregando } from '../core/spinner';
import { ToastService } from '../core/toast.service';

/** Abre um link de ficha (`/ficha-compartilhada?d=…`): mostra o que vem nela e deixa a pessoa decidir se adiciona. */
@Component({
  selector: 'app-ficha-compartilhada',
  imports: [RouterLink, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      @if (ex.error()) {
        <div class="card bloco">
          <h1 class="sub">Não foi possível abrir a ficha</h1>
          <p class="apoio">A lista de exercícios não carregou. Verifique a conexão e tente de novo.</p>
          <button type="button" class="btn btn--escuro" (click)="ex.carregar()">Tentar de novo</button>
        </div>
      } @else if (estado() === 'lendo' || !ex.ready()) {
        <app-carregando texto="Abrindo a ficha…" />
      } @else if (ficha(); as f) {
        <header>
          <p class="apoio">Ficha compartilhada com você</p>
          <h1 class="titulo">{{ f.nome }}</h1>
          <p class="apoio">{{ resumo() }}</p>
        </header>

        @for (t of f.treinos; track $index) {
          <article class="card treino">
            <h2 class="sub">{{ f.treinos.length > 1 ? 'Treino ' + letra($index) + ' · ' : '' }}{{ t.nome }}</h2>
            <ul>
              @for (i of t.itens; track $index) {
                <li>
                  <span class="nome">{{ i.nome }}</span>
                  <span class="apoio">{{ i.series }} × {{ i.reps }}{{ i.minutos ? ' min' : '' }}@if (i.carga > 0) { · {{ i.carga }} kg }</span>
                  @if (i.nota) {
                    <span class="nota">{{ i.nota }}</span>
                  }
                </li>
              }
            </ul>
          </article>
        }

        @if (ignorados() > 0) {
          <p class="apoio">{{ ignorados() }} {{ ignorados() === 1 ? 'exercício não existe' : 'exercícios não existem' }} neste app e {{ ignorados() === 1 ? 'ficou de fora' : 'ficaram de fora' }}.</p>
        }

        <div class="acoes">
          <a class="btn btn--claro" routerLink="/fichas">Agora não</a>
          <button type="button" class="btn btn--escuro" (click)="adicionar()">Adicionar às minhas fichas</button>
        </div>
      } @else {
        <div class="card bloco">
          <h1 class="sub">Link de ficha inválido</h1>
          <p class="apoio">O link está incompleto ou foi alterado. Peça para a pessoa mandar de novo.</p>
          <a class="btn btn--escuro" routerLink="/fichas">Ver minhas fichas</a>
        </div>
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 14px; padding-top: 12px; }
    .titulo { margin: 0; overflow-wrap: anywhere; }
    header .apoio { margin: 0; }
    .bloco { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .sub { font-size: 18px; margin: 0; overflow-wrap: anywhere; }
    .treino { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
    .treino ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .treino li { display: flex; flex-direction: column; gap: 1px; }
    .nome { font-weight: 600; }
    .nota { font-size: 13px; color: var(--muted); font-style: italic; overflow-wrap: anywhere; }
    .acoes { display: flex; gap: 10px; }
    .acoes .btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; text-align: center; }
  `,
})
export class FichaCompartilhada {
  protected readonly ex = inject(ExerciseService);
  private readonly plans = inject(PlanService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Parâmetro `d` do endereço. */
  readonly d = input<string | undefined>(undefined);

  protected readonly estado = signal<'lendo' | 'pronto'>('lendo');
  private readonly bruta = signal<Ficha | null>(null);

  /** A ficha só com os exercícios que existem neste app. */
  protected readonly ficha = computed<Previa | null>(() => {
    const f = this.bruta();
    if (!f || !this.ex.ready()) return null;
    const treinos = f.treinos
      .map((t) => {
        const validos = t.itens.filter((i) => this.ex.get(i.exerciseId));
        return {
          nome: t.nome,
          originais: validos,
          itens: validos.map((i) => ({ nome: this.ex.nome(this.ex.get(i.exerciseId)!), series: i.series, reps: i.reps, carga: i.carga, minutos: i.unidade === 'min', nota: i.nota })),
        };
      })
      .filter((t) => t.itens.length > 0);
    return treinos.length ? { nome: f.nome, treinos } : null;
  });

  protected readonly ignorados = computed(() => {
    const f = this.bruta();
    const ok = this.ficha();
    if (!f || !ok) return 0;
    return f.treinos.reduce((n, t) => n + t.itens.length, 0) - ok.treinos.reduce((n, t) => n + t.itens.length, 0);
  });

  protected readonly resumo = computed(() => {
    const t = this.ficha()?.treinos ?? [];
    const ex = t.reduce((n, x) => n + x.itens.length, 0);
    return `${t.length} ${t.length === 1 ? 'treino' : 'treinos'} · ${ex} ${ex === 1 ? 'exercício' : 'exercícios'}`;
  });

  constructor() {
    effect(() => {
      const codigo = this.d();
      untracked(() => {
        this.estado.set('lendo');
        void decodificarFicha(codigo).then((f) => {
          this.bruta.set(f);
          this.estado.set('pronto');
        });
      });
    });
  }

  protected letra(i: number): string {
    return String.fromCharCode(65 + (i % 26));
  }

  protected adicionar(): void {
    const f = this.ficha();
    if (!f) return;
    const treinos = f.treinos.map((t) => ({ nome: t.nome, itens: t.originais.map((i) => ({ ...i })) }));
    if (treinos.length === 1) this.plans.criarComItens([{ nome: f.nome, itens: treinos[0].itens }]);
    else this.plans.criarConjunto(f.nome, treinos);
    this.toast.mostrar('Ficha adicionada');
    void this.router.navigateByUrl('/fichas', { replaceUrl: true });
  }
}

interface Previa {
  nome: string;
  treinos: { nome: string; itens: ItemPrevia[]; originais: TreinoCompartilhado['itens'] }[];
}

interface ItemPrevia {
  nome: string;
  series: number;
  reps: number;
  carga: number;
  minutos: boolean;
  nota?: string;
}
