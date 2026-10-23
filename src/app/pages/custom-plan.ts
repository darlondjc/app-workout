import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExerciseService, GRUPOS } from '../core/exercise.service';
import { DiaPersonalizado, diaValido, gerarFichas, nomeDoDia } from '../core/ficha-personalizada';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';
import { Carregando } from '../core/spinner';
import { Nivel } from '../core/suggestion';
import { ToastService } from '../core/toast.service';

const MAX_DIAS = 6;
const dia = (): DiaPersonalizado => ({ grupos: [], cardio: false, nome: '' });

@Component({
  selector: 'app-custom-plan',
  imports: [RouterLink, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/fichas')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Ficha personalizada</h1>
        <p class="apoio">Monte uma ficha com vários treinos, um para cada dia: quantos são, o que treinar em cada um e em quais tem cardio.</p>
      </header>

      @if (!ex.ready()) {
        @if (ex.error()) {
          <p class="apoio">Não foi possível carregar os exercícios.</p>
          <button type="button" class="btn btn--escuro" (click)="ex.carregar()">Tentar de novo</button>
        } @else {
          <app-carregando texto="Carregando exercícios…" />
        }
      } @else if (!resultado()) {
        <fieldset>
          <legend>Nome da ficha</legend>
          <input class="texto" type="text" maxlength="40" [value]="nomeFicha()" aria-label="Nome da ficha" [placeholder]="'Ex.: ' + nomeSugerido()" (input)="nomeFicha.set($any($event.target).value)" />
        </fieldset>

        <fieldset>
          <legend>Quantos treinos na ficha? (um por dia)</legend>
          <div class="chips-linha">
            @for (n of opcoesDias; track n) {
              <button type="button" class="chip" [attr.aria-pressed]="dias().length === n" (click)="definirDias(n)">{{ n }}</button>
            }
          </div>
        </fieldset>

        @for (d of dias(); track $index; let i = $index) {
          <fieldset class="card dia">
            <legend class="dia__titulo">Treino {{ letra(i) }}</legend>
            <input class="texto" type="text" maxlength="40" [value]="d.nome" [attr.aria-label]="'Nome do treino ' + letra(i)" [placeholder]="'Nome (opcional): ' + nomeDoDia(d)" (input)="renomear(i, $event)" />
            <p class="rotulo">Grupos musculares (até {{ maxGrupos }})</p>
            <div class="chips-linha">
              @for (g of grupos; track g.key) {
                <button type="button" class="chip" [attr.aria-pressed]="d.grupos.includes(g.key)" [disabled]="!d.grupos.includes(g.key) && d.grupos.length >= maxGrupos" (click)="alternarGrupo(i, g.key)">{{ g.label }}</button>
              }
            </div>
            <p class="rotulo">Cardio no final</p>
            <div class="chips-linha">
              <button type="button" class="chip" [attr.aria-pressed]="d.cardio" (click)="definirCardio(i, true)">Com cardio</button>
              <button type="button" class="chip" [attr.aria-pressed]="!d.cardio" (click)="definirCardio(i, false)">Sem cardio</button>
            </div>
          </fieldset>
        }

        <fieldset>
          <legend>Exercícios por dia</legend>
          <div class="chips-linha">
            <button type="button" class="chip" [attr.aria-pressed]="maximo() === 0" (click)="maximo.set(0)">Automático</button>
            @for (m of opcoesMaximo; track m) {
              <button type="button" class="chip" [attr.aria-pressed]="maximo() === m" (click)="maximo.set(m)">{{ m }}</button>
            }
          </div>
          <p class="apoio nota">Automático divide os exercícios entre os grupos do dia. Com número, esse é o máximo por dia (o cardio conta).</p>
        </fieldset>

        <fieldset>
          <legend>Nível</legend>
          <div class="chips-linha">
            @for (n of niveis; track n.key) {
              <button type="button" class="chip" [attr.aria-pressed]="nivel() === n.key" (click)="nivel.set(n.key)">{{ n.label }}</button>
            }
          </div>
        </fieldset>

        <button type="button" class="btn btn--escuro" [disabled]="!todosValidos()" (click)="gerar()">
          <app-icon name="clipboard" [size]="18" [stroke]="2.2" /> Montar ficha
        </button>
        @if (!todosValidos()) {
          <p class="apoio nota">Cada treino precisa de pelo menos um grupo muscular ou de cardio.</p>
        }
      } @else {
        @let fichas = resultado()!;
        <h2 class="sub">{{ nomeFinal() }}</h2>
        @for (f of fichas; track $index; let i = $index) {
          <section class="bloco" [attr.aria-label]="'Treino ' + letra(i)">
            <div class="bloco__topo">
              <h3>Treino {{ letra(i) }} · {{ f.nome }}</h3>
              <button type="button" class="btn-mini" (click)="outros(i)">
                <app-icon name="refresh" [size]="16" [stroke]="2.2" /> Outros exercícios
              </button>
            </div>
            @if (f.itens.length === 0) {
              <p class="apoio">Não encontrei exercícios para esse dia com esse nível. Volte e ajuste.</p>
            } @else {
              <ol class="lista">
                @for (it of f.itens; track it.exerciseId) {
                  <li class="card item">
                    <a class="item__foto" [routerLink]="['/exercicio', it.exerciseId]" aria-label="Ver instruções do exercício">
                      <img [src]="ex.imagem(it.exerciseId, 0)" alt="" loading="lazy" />
                    </a>
                    <span class="item__txt">
                      <a class="item__nome" [routerLink]="['/exercicio', it.exerciseId]">{{ nome(it.exerciseId) }}</a>
                      <span class="apoio">{{ it.unidade === 'min' ? it.reps + ' min' : it.series + ' × ' + it.reps + ' · descanso ' + it.descanso + ' s' }}</span>
                    </span>
                  </li>
                }
              </ol>
            }
            @if (f.semCardio) {
              <p class="apoio nota">Não encontrei cardio disponível para esse dia.</p>
            }
          </section>
        }
        <div class="acoes">
          <button type="button" class="btn btn--escuro" [disabled]="criaveis() === 0" (click)="criar()">
            <app-icon name="check" [size]="20" [stroke]="2.5" /> Criar ficha com {{ criaveis() === 1 ? '1 treino' : criaveis() + ' treinos' }}
          </button>
          <button type="button" class="btn btn--claro" (click)="voltarAoForm()">
            <app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar e ajustar
          </button>
        </div>
        <p class="apoio nota">Depois de criada, você pode trocar, remover e ajustar séries, repetições e cargas em cada treino. As fichas que você já tem não mudam.</p>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { display: flex; flex-direction: column; gap: 16px; }
    .voltar { border: 0; background: none; padding: 0; font: inherit; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; color: var(--muted); font-size: 14px; }
    fieldset { border: none; padding: 0; margin: 0; min-width: 0; }
    legend { font-weight: 700; font-size: 15px; margin-bottom: 8px; padding: 0; }
    .dia { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .dia__titulo { font-family: var(--font-display); font-size: 17px; float: left; width: 100%; margin: 0; }
    .dia__titulo + * { clear: both; }
    .dia .chip { background: var(--bg); }
    .dia .chip[aria-pressed='true'] { background: var(--ink); }
    .rotulo { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
    .texto { width: 100%; box-sizing: border-box; height: 44px; padding: 0 12px; border: 1.5px solid var(--line); border-radius: 12px; background: var(--bg); font-size: 15px; }
    .chips-linha { display: flex; flex-wrap: wrap; gap: 8px; }
    .sub { font-size: 18px; }
    .bloco { display: flex; flex-direction: column; gap: 8px; }
    .bloco__topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .bloco__topo h3 { font-family: var(--font-display); font-size: 16px; margin: 0; min-width: 0; }
    .btn-mini { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1.5px solid var(--line); background: transparent; font: inherit; font-size: 13px; font-weight: 600; }
    .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .item { display: flex; align-items: center; gap: 12px; padding: 10px; }
    .item__foto img { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; background: #fff; display: block; }
    .item__txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .item__nome { font-weight: 600; }
    .acoes { display: flex; flex-direction: column; gap: 10px; }
    .nota { font-size: 12px; }
    button:disabled { opacity: 0.45; }
  `,
})
export class CustomPlan {
  protected readonly nav = inject(NavegacaoService);
  protected readonly ex = inject(ExerciseService);
  private readonly plans = inject(PlanService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly grupos = GRUPOS;
  protected readonly nomeDoDia = nomeDoDia;
  protected readonly opcoesDias = Array.from({ length: MAX_DIAS }, (_, i) => i + 1);
  protected readonly opcoesMaximo = [4, 5, 6, 8, 10];
  protected readonly maxGrupos = 3;
  protected readonly niveis: { key: Nivel; label: string }[] = [
    { key: 'beginner', label: 'Iniciante' },
    { key: 'intermediate', label: 'Intermediário' },
    { key: 'expert', label: 'Avançado' },
  ];

  protected readonly dias = signal<DiaPersonalizado[]>([dia(), dia(), dia()]);
  protected readonly nomeFicha = signal('');
  protected readonly nivel = signal<Nivel>('intermediate');
  /** 0 = automático. */
  protected readonly maximo = signal(0);
  protected readonly nomeSugerido = computed(() => `Divisão de ${this.dias().length} treinos`);
  protected readonly todosValidos = computed(() => this.dias().every(diaValido));

  /** Só depois de "Montar fichas": as escolhas ficam fixas até criar ou voltar. */
  private readonly pedido = signal<{ dias: DiaPersonalizado[]; nivel: Nivel; maximo: number; nome: string } | null>(null);
  private readonly variacoes = signal<number[]>([]);

  protected readonly resultado = computed(() => {
    const p = this.pedido();
    if (!p || !this.ex.ready()) return null;
    return gerarFichas(this.ex.exercises(), p.dias, { nivel: p.nivel, maximo: p.maximo || undefined, variacoes: this.variacoes() });
  });
  protected readonly nomeFinal = computed(() => this.pedido()?.nome ?? '');
  protected readonly criaveis = computed(() => this.resultado()?.filter((f) => f.itens.length > 0).length ?? 0);

  protected letra(i: number): string {
    return String.fromCharCode(65 + (i % 26));
  }

  protected definirDias(n: number): void {
    this.dias.update((l) => (n <= l.length ? l.slice(0, n) : [...l, ...Array.from({ length: n - l.length }, dia)]));
  }

  private mudar(i: number, fn: (d: DiaPersonalizado) => DiaPersonalizado): void {
    this.dias.update((l) => l.map((d, j) => (j === i ? fn(d) : d)));
  }

  protected alternarGrupo(i: number, chave: string): void {
    this.mudar(i, (d) => {
      if (d.grupos.includes(chave)) return { ...d, grupos: d.grupos.filter((g) => g !== chave) };
      return d.grupos.length >= this.maxGrupos ? d : { ...d, grupos: [...d.grupos, chave] };
    });
  }

  protected definirCardio(i: number, cardio: boolean): void {
    this.mudar(i, (d) => ({ ...d, cardio }));
  }

  protected renomear(i: number, evento: Event): void {
    const nome = (evento.target as HTMLInputElement).value;
    this.mudar(i, (d) => ({ ...d, nome }));
  }

  protected gerar(): void {
    if (!this.todosValidos()) return;
    this.variacoes.set(this.dias().map(() => 0));
    this.pedido.set({ dias: this.dias(), nivel: this.nivel(), maximo: this.maximo(), nome: this.nomeFicha().trim() || this.nomeSugerido() });
  }

  protected outros(i: number): void {
    this.variacoes.update((l) => l.map((v, j) => (j === i ? v + 1 : v)));
  }

  protected voltarAoForm(): void {
    this.pedido.set(null);
  }

  protected nome(id: string): string {
    const e = this.ex.get(id);
    return e ? this.ex.nome(e) : id;
  }

  protected criar(): void {
    const fichas = (this.resultado() ?? []).filter((f) => f.itens.length > 0);
    if (fichas.length === 0) return;
    this.plans.criarConjunto(this.nomeFinal(), fichas.map((f) => ({ nome: f.nome, itens: f.itens })));
    this.toast.mostrar(`Ficha criada com ${fichas.length} ${fichas.length === 1 ? 'treino' : 'treinos'}`);
    this.router.navigate(['/fichas'], { replaceUrl: true });
  }
}
