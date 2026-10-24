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
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.scss',
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
