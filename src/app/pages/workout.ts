import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TituloEmDuasLinhas } from '../core/ajuste-titulo';
import { ConcluirTreino } from '../core/concluir-treino';
import { Dialogo } from '../core/dialogo';
import { ExerciseImage } from '../core/exercise-image';
import { ExerciseService } from '../core/exercise.service';
import { blocosDe, letraDoPar } from '../core/conjugado';
import { Icon } from '../core/icon';
import { RegistroExercicio, SerieEmAndamento } from '../core/models';
import { NavegacaoService } from '../core/navegacao.service';
import { NOTA_EXERCICIO_MAX, NOTA_TREINO_MAX } from '../core/notas';
import { MedalhasService } from '../core/medalhas.service';
import { caloriasDaSessao } from '../core/calorias';
import { PesoService } from '../core/peso.service';
import { DadosResumo, ResumoTreino } from '../core/resumo-treino';
import { PlanService } from '../core/plan.service';
import { sugerirCarga } from '../core/progressao';
import { SocialService } from '../core/social.service';
import { volumeSessao } from '../core/stats';
import { TelaLigada } from '../core/tela-ligada';
import { ToastService } from '../core/toast.service';

/** Mesmo limite do editor da ficha. */
const SERIES_MAX = 20;

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
  imports: [RouterLink, Icon, ExerciseImage, ConcluirTreino, Dialogo, ResumoTreino, TituloEmDuasLinhas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'fecharMenuMembro()', '(document:keydown.escape)': 'fecharMenuMembro()' },
  templateUrl: './workout.html',
  styleUrl: './workout.scss',
})
export class Workout {
  readonly id = input.required<string>();

  protected readonly plans = inject(PlanService);
  private readonly medalhas = inject(MedalhasService);
  /** Resumo mostrado depois de gravar o treino; ao fechar, volta para o início. */
  protected readonly resumo = signal<DadosResumo | null>(null);
  private readonly ex = inject(ExerciseService);
  private readonly toast = inject(ToastService);
  private readonly social = inject(SocialService);
  private readonly peso = inject(PesoService);
  private readonly router = inject(Router);
  private readonly tela = inject(TelaLigada);
  protected readonly nav = inject(NavegacaoService);

  /** Segundos de descanso decorridos desde a última série marcada (o timer é progressivo). */
  protected readonly descansoAtivo = signal(0);
  protected readonly descansando = signal(false);
  /** O descanso definido na ficha é a referência: passado esse tempo o cronômetro fica vermelho, mas continua contando. */
  /** Limite do descanso que está contando agora. */
  protected readonly limiteAtivo = signal(60);
  /** O descanso do exercício da vez; num par, o do par (depois de cada rodada), que é o do segundo exercício. */
  protected readonly limiteDescanso = computed(() => {
    const p = this.par();
    return (p ? this.itemDe(p.b)?.descanso : this.item()?.descanso) || 60;
  });
  private descansoDesde = 0;
  protected readonly confirmandoSaida = signal(false);
  /** Quantas vezes cada série (pela chave do exercício e do número) foi preenchida sozinha; o valor mudando refaz a animação. */
  protected readonly piscadas = signal<Record<number, number>>({});
  protected chave(i: number, n: number): number {
    return i * 100 + n;
  }
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
  /** A lista como o treino a percorre: cada exercício sozinho ou cada par conjugado (que se faz junto, em rodadas). */
  private readonly blocos = computed(() => blocosDe(this.ficha()?.itens ?? []));
  private readonly indiceBruto = computed(() => {
    const max = Math.max(0, (this.ficha()?.itens.length ?? 1) - 1);
    return Math.min(this.estado()?.indice ?? 0, max);
  });
  /** Posição do bloco da vez entre os blocos. */
  protected readonly numBloco = computed(() => {
    const i = this.indiceBruto();
    return Math.max(0, this.blocos().findIndex((b) => (b.tipo === 'solo' ? b.i === i : b.a === i || b.b === i)));
  });
  /** Posição do exercício da vez; num par, o primeiro dos dois (o que a tela mostra como A1). */
  protected readonly indice = computed(() => {
    const b = this.blocos()[this.numBloco()];
    return b ? (b.tipo === 'solo' ? b.i : b.a) : this.indiceBruto();
  });
  /** O par da vez, se o bloco atual for um par conjugado. */
  protected readonly par = computed(() => {
    const b = this.blocos()[this.numBloco()];
    return b?.tipo === 'par' ? b : null;
  });
  /** O exercício na posição i: o da ficha, ou o que foi trocado só para este treino. */
  protected itemDe(i: number) {
    const base = this.ficha()?.itens[i];
    const troca = this.estado()?.trocas?.[i];
    return base && troca ? { ...base, exerciseId: troca } : base;
  }
  /** O exercício da vez. */
  protected readonly item = computed(() => this.itemDe(this.indice()));
  protected readonly ultimo = computed(() => this.numBloco() >= this.blocos().length - 1);

  protected nomeDe(i: number): string {
    const it = this.itemDe(i);
    const e = it ? this.ex.get(it.exerciseId) : undefined;
    return e ? this.ex.nome(e) : (it?.exerciseId ?? '');
  }

  protected readonly nome = computed(() => this.nomeDe(this.indice()));

  private anteriorDe(i: number) {
    const it = this.itemDe(i);
    return it ? this.plans.ultimoRegistro(it.exerciseId) : undefined;
  }

  /** Séries do exercício i como a tela as mostra: o que foi salvo, ou o que foi feito na última vez (carga e repetições; sem histórico, a ficha). */
  protected seriesDe(i: number) {
    const it = this.itemDe(i);
    if (!it) return [];
    const salvas = this.estado()?.series[i] ?? [];
    const ultimo = this.plans.ultimoRegistro(it.exerciseId);
    const ant = ultimo?.series ?? [];
    // Repetições do último treino só valem se a unidade for a mesma (repetições ou minutos).
    const repsAnt = !!ultimo && (ultimo.unidade === 'min') === (it.unidade === 'min') ? ant : [];
    const total = this.estado()?.qtdSeries?.[i] ?? it.series;
    return Array.from({ length: total }, (_, k) => ({
      n: k + 1,
      feita: !!salvas[k]?.feita,
      carga: salvas[k]?.carga ?? ant[k]?.carga ?? ant.at(-1)?.carga ?? it.carga,
      reps: salvas[k]?.reps ?? repsAnt[k]?.reps ?? repsAnt.at(-1)?.reps ?? it.reps,
      descanso: salvas[k]?.descanso,
    }));
  }

  protected readonly maxSeries = SERIES_MAX;
  protected readonly series = computed(() => this.seriesDe(this.indice()));

  /** Séries de todo o treino que ainda não foram marcadas. */
  protected readonly faltantes = computed(() =>
    (this.ficha()?.itens ?? []).reduce((total, _, i) => total + this.seriesDe(i).filter((s) => !s.feita).length, 0),
  );

  /** Exercício cujo último treino está aberto no diálogo (posição na ficha), ou nenhum. */
  protected readonly verUltimo = signal<number | null>(null);

  /** Séries do último treino do exercício, na ordem repetições × carga (ex.: "10 × 45 kg"). */
  protected ultimasSeriesDe(i: number): string[] {
    const r = this.anteriorDe(i);
    if (!r) return [];
    const min = r.unidade === 'min';
    return r.series.map((s) => (min ? `${s.reps} min` : `${s.reps} × ${s.carga} kg`));
  }

  protected readonly ultimasSeries = computed(() => this.ultimasSeriesDe(this.indice()));
  protected readonly ultimasDoDialogo = computed(() => (this.verUltimo() === null ? [] : this.ultimasSeriesDe(this.verUltimo()!)));

  protected readonly feitas = computed(() => this.series().filter((s) => s.feita).length);

  /** As rodadas do par da vez: a série k de cada exercício. Se um tem mais séries, as últimas rodadas têm só um. */
  protected readonly rodadas = computed(() => {
    const p = this.par();
    if (!p) return [];
    const sa = this.seriesDe(p.a);
    const sb = this.seriesDe(p.b);
    return Array.from({ length: Math.max(sa.length, sb.length) }, (_, k) => {
      const a = sa[k] ?? null;
      const b = sb[k] ?? null;
      return { n: k + 1, k, a, b, feita: (!a || a.feita) && (!b || b.feita) };
    });
  });
  /** Rodadas feitas em ordem, a partir da primeira: a rodada "agora" é a primeira que falta. */
  protected readonly rodadaAgora = computed(() => {
    const k = this.rodadas().findIndex((r) => !r.feita);
    return k < 0 ? this.rodadas().length : k;
  });
  protected readonly mostrarConcluidas = signal(false);
  /** Quantas rodadas já feitas ficam recolhidas numa linha só (nenhuma se todas estiverem feitas). */
  protected readonly recolhidas = computed(() => {
    const agora = this.rodadaAgora();
    return !this.mostrarConcluidas() && agora > 0 && agora < this.rodadas().length ? agora : 0;
  });
  protected readonly rodadasVisiveis = computed(() => this.rodadas().slice(this.recolhidas()));
  protected readonly letraDoPar = computed(() => {
    const p = this.par();
    return p ? letraDoPar(this.ficha()?.itens ?? [], p.id) : '';
  });

  protected readonly progresso = computed(() => {
    const total = this.blocos().length;
    if (total === 0) return 0;
    const rodadas = this.rodadas();
    const series = this.series().length;
    const fracao = this.par() ? (rodadas.length > 0 ? rodadas.filter((r) => r.feita).length / rodadas.length : 0) : series > 0 ? this.feitas() / series : 0;
    return Math.round(((this.numBloco() + fracao) / total) * 100);
  });

  protected readonly tempo = computed(() => {
    const segundos = this.descansoAtivo();
    const m = String(Math.floor(segundos / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    return `${m}:${s}`;
  });

  constructor() {
    // A tela fica acesa enquanto o treino está aberto, para não apagar entre as séries.
    this.tela.ligar();
    // Treino retomado depois de uma pausa: o cronômetro continua de onde estava.
    effect(() => {
      const d = this.estado()?.descanso;
      if (!d || this.descansando()) return;
      untracked(() => {
        // Sem arredondar: cada saída e volta perderia até 2 s, e saídas curtas e seguidas travariam o cronômetro.
        const fora = d.pausado ? 0 : Math.max(0, (Date.now() - d.saiuEm) / 1000);
        this.iniciarDescanso(d.decorrido + fora, d.limite);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      // Saiu com o treino ainda em andamento (pausa, ou ver as instruções de um exercício): guarda o cronômetro para retomar.
      if (this.descansando() && this.estado()) {
        const descanso = { decorrido: (Date.now() - this.descansoDesde) / 1000, limite: this.limiteAtivo(), saiuEm: Date.now(), pausado: this.pausado };
        this.plans.andamento(this.id(), (a) => ({ ...a, descanso }));
      }
      this.pararDescanso();
      this.tela.desligar();
    });
  }

  /** Exercícios cuja sugestão de carga a pessoa fechou neste treino (volta só ao abrir o treino de novo). */
  private readonly sugestoesFechadas = signal<ReadonlySet<string>>(new Set());

  protected fecharSugestao(i = this.indice()): void {
    const id = this.itemDe(i)?.exerciseId;
    if (id) this.sugestoesFechadas.update((f) => new Set(f).add(id));
  }

  /** Sugestão de subir a carga, enquanto nenhuma série do exercício foi marcada e a carga sugerida ainda não está na tela. */
  private sugestaoDe(i: number) {
    const it = this.itemDe(i);
    const series = this.seriesDe(i);
    if (!it || series.some((x) => x.feita) || this.sugestoesFechadas().has(it.exerciseId)) return null;
    const s = sugerirCarga(it, this.anteriorDe(i));
    if (!s) return null;
    return series.every((x) => x.carga === s.para) ? null : s;
  }

  protected readonly sugestaoCarga = computed(() => this.sugestaoDe(this.indice()));

  /** As sugestões dos dois exercícios do par da vez (só os que têm uma). */
  protected readonly sugestoesDoPar = computed(() => {
    const p = this.par();
    if (!p) return [];
    return [p.a, p.b].flatMap((i) => {
      const sg = this.sugestaoDe(i);
      return sg ? [{ i, nome: this.nomeDe(i), sg }] : [];
    });
  });

  /** Põe a carga sugerida em todas as séries do exercício (todas mudam juntas e piscam, como na cópia automática). */
  protected aplicarSugestao(i = this.indice()): void {
    const s = this.sugestaoDe(i);
    if (!s) return;
    const alvo = this.itemDe(i)?.reps ?? 0;
    const series = this.seriesDe(i);
    const base = series.map((x) => this.paraSalvar({ ...x, carga: s.para, reps: alvo || x.reps }));
    this.piscadas.update((p) => {
      const novo = { ...p };
      for (const x of series) novo[this.chave(i, x.n)] = (novo[this.chave(i, x.n)] ?? 0) + 1;
      return novo;
    });
    this.plans.andamento(this.id(), (a) => ({ ...a, indice: this.indice(), series: { ...a.series, [i]: base } }));
  }

  /** 22.5 → "22,5". */
  protected kg(valor: number): string {
    return valor.toLocaleString('pt-BR');
  }

  protected readonly editandoNotas = signal(false);
  protected readonly rascunhoExercicio = signal('');
  protected readonly rascunhoTreino = signal('');
  protected readonly notaMaxExercicio = NOTA_EXERCICIO_MAX;
  protected readonly notaMaxTreino = NOTA_TREINO_MAX;
  /** Exercício cuja nota está sendo editada (posição na ficha). */
  protected readonly alvoNotas = signal(0);
  /** Exercício trocado só neste treino: a nota da ficha é do exercício original e não vale para o que entrou. */
  protected trocadoDe(i: number): boolean {
    return !!this.estado()?.trocas?.[i];
  }
  protected notaDoExercicio(i: number): string {
    return this.trocadoDe(i) ? '' : (this.itemDe(i)?.nota ?? '');
  }
  protected readonly trocado = computed(() => this.trocadoDe(this.indice()));
  protected readonly notaExercicio = computed(() => this.notaDoExercicio(this.indice()));
  protected readonly notaTreino = computed(() => this.estado()?.nota ?? '');
  protected readonly trocadoAlvo = computed(() => this.trocadoDe(this.alvoNotas()));
  protected readonly nomeAlvoNotas = computed(() => this.nomeDe(this.alvoNotas()));

  protected abrirNotas(i = this.indice()): void {
    this.alvoNotas.set(i);
    this.rascunhoExercicio.set(this.notaDoExercicio(i));
    this.rascunhoTreino.set(this.notaTreino());
    this.editandoNotas.set(true);
  }

  protected lerCampo(evento: Event): string {
    return (evento.target as HTMLTextAreaElement).value;
  }

  /** Grava só o que mudou: a nota do exercício vai para a ficha, a do treino para o treino em andamento. */
  protected salvarNotas(): void {
    const i = this.alvoNotas();
    if (!this.trocadoDe(i) && this.rascunhoExercicio().trim() !== this.notaDoExercicio(i)) {
      this.plans.definirNotaDoItem(this.id(), i, this.rascunhoExercicio());
    }
    if (this.rascunhoTreino().trim() !== this.notaTreino()) {
      this.plans.definirNotaDoTreino(this.id(), this.rascunhoTreino());
    }
    this.editandoNotas.set(false);
  }

  /** Só guarda `descanso` quando existe: o Firestore não aceita campos `undefined`. */
  private paraSalvar(s: { feita: boolean; carga: number; reps: number; descanso?: number }): SerieEmAndamento {
    return { feita: s.feita, carga: s.carga, reps: s.reps, ...(s.descanso != null ? { descanso: s.descanso } : {}) };
  }

  /** Grava a série k do exercício i (valores atuais da tela + alteração) no treino em andamento. */
  private gravarSerie(i: number, k: number, mudanca: Partial<{ feita: boolean; carga: number; reps: number; descanso: number | undefined }>): void {
    const base = this.seriesDe(i).map((s) => this.paraSalvar(s));
    base[k] = this.paraSalvar({ ...base[k], ...mudanca });
    this.plans.andamento(this.id(), (a) => ({ ...a, indice: this.indice(), series: { ...a.series, [i]: base } }));
  }

  /** Ao mudar carga ou repetições de uma série, as de baixo que ainda não foram feitas ganham o mesmo valor. */
  protected editar(k: number, campo: 'carga' | 'reps', evento: Event, i = this.indice()): void {
    const v = (evento.target as HTMLInputElement).valueAsNumber;
    const valor = Number.isFinite(v) && v >= 0 ? v : 0;
    const series = this.seriesDe(i);
    const base = series.map((s, j) => (j >= k && (j === k || !s.feita) ? { ...s, [campo]: valor } : s));
    // Só as linhas de baixo que mudaram sozinhas piscam, para a pessoa notar o que foi copiado.
    const copiadas = series.filter((s, j) => j > k && !s.feita && s[campo] !== valor).map((s) => s.n);
    if (copiadas.length > 0) {
      this.piscadas.update((p) => {
        const novo = { ...p };
        for (const n of copiadas) novo[this.chave(i, n)] = (novo[this.chave(i, n)] ?? 0) + 1;
        return novo;
      });
    }
    this.plans.andamento(this.id(), (a) => ({
      ...a,
      indice: this.indice(),
      series: { ...a.series, [i]: base.map((s) => this.paraSalvar(s)) },
    }));
  }

  /** Acrescenta uma série só neste treino (a ficha não muda), com os valores da última. */
  protected adicionarSerie(i = this.indice()): void {
    const it = this.itemDe(i);
    const series = this.seriesDe(i);
    if (!it || series.length >= SERIES_MAX) return;
    const base = series.map((s) => this.paraSalvar(s));
    const ultima = base.at(-1) ?? { carga: it.carga, reps: it.reps };
    base.push(this.paraSalvar({ feita: false, carga: ultima.carga, reps: ultima.reps }));
    this.gravarQuantidade(i, base);
  }

  /** Tira a última série, só neste treino. Sempre fica pelo menos uma. */
  protected removerSerie(i = this.indice()): void {
    const series = this.seriesDe(i);
    if (series.length <= 1) return;
    this.gravarQuantidade(i, series.slice(0, -1).map((s) => this.paraSalvar(s)));
  }

  private gravarQuantidade(i: number, base: SerieEmAndamento[]): void {
    this.plans.andamento(this.id(), (a) => ({
      ...a,
      indice: this.indice(),
      series: { ...a.series, [i]: base },
      qtdSeries: { ...a.qtdSeries, [i]: base.length },
    }));
  }

  /** O X: com treino começado pergunta se pausa, cancela ou continua; sem nada marcado, só sai. */
  protected sair(): void {
    if (this.plans.emAndamento()?.fichaId === this.id()) this.confirmandoSaida.set(true);
    else this.nav.voltar('/');
  }

  /** Pausar para o cronômetro; sair por outro caminho (ver instruções) deixa o descanso correr. */
  private pausado = false;

  protected pausar(): void {
    this.pausado = true;
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
  protected marcarTodos(i = this.indice()): void {
    const series = this.seriesDe(i);
    const marcar = series.filter((s) => s.feita).length < series.length;
    const base = series.map((s) => this.paraSalvar({ ...s, feita: marcar, descanso: marcar ? s.descanso : undefined }));
    this.plans.andamento(this.id(), (a) => ({ ...a, indice: this.indice(), series: { ...a.series, [i]: base } }));
    // Exercício terminado: o cronômetro zera e fica parado até a primeira série do próximo.
    if (marcar) this.zerarDescanso();
  }

  /** Terminado o exercício, o tempo até a próxima série (água, banheiro, esperar o aparelho) não conta como descanso: zera e para. */
  private zerarDescanso(): void {
    this.pararDescanso();
    this.plans.andamento(this.id(), (a) => {
      const { descanso: _, ...resto } = a;
      return resto;
    });
  }

  /** O descanso só conta entre séries do mesmo exercício: ao marcar a última (ou com uma só, como o cardio) o cronômetro zera. */
  private iniciarDescansoSeFizerSentido(ultimaDoExercicio: boolean): void {
    const unica = this.par() ? this.rodadas().length <= 1 : this.series().length <= 1;
    if (ultimaDoExercicio || unica) this.zerarDescanso();
    else this.iniciarDescanso();
  }

  protected alternar(k: number): void {
    const it = this.item();
    if (!it) return;
    const ficouFeita = !this.series()[k].feita;
    // O descanso desta série é o tempo corrido desde a anterior; sem timer rodando (primeira série), não há o que guardar.
    const descanso = ficouFeita && this.descansando() ? Math.round((Date.now() - this.descansoDesde) / 1000) : undefined;
    const ultimaDoExercicio = ficouFeita && this.feitas() + 1 === this.series().length;
    this.gravarSerie(this.indice(), k, { feita: ficouFeita, descanso });
    // Marcar uma série reinicia o cronômetro, que segue contando ao trocar de tela; a última do exercício o zera.
    // Desmarcar não mexe nele.
    if (ficouFeita) this.iniciarDescansoSeFizerSentido(ultimaDoExercicio);
  }

  /**
   * Marca (ou desmarca) uma rodada do par: a série k de cada exercício, de uma vez. O descanso entre esta rodada e a
   * anterior é um só, guardado na primeira série da rodada; depois da última rodada o cronômetro zera.
   */
  protected alternarRodada(k: number): void {
    const p = this.par();
    const rodada = this.rodadas()[k];
    if (!p || !rodada) return;
    const marcar = !rodada.feita;
    const descanso = marcar && this.descansando() ? Math.round((Date.now() - this.descansoDesde) / 1000) : undefined;
    const doDescanso = rodada.a ? p.a : p.b;
    const nova = (i: number, existe: boolean) => {
      const base = this.seriesDe(i).map((s) => this.paraSalvar(s));
      if (!existe) return base;
      base[k] = this.paraSalvar({ ...base[k], feita: marcar, descanso: i === doDescanso ? descanso : undefined });
      return base;
    };
    const a = nova(p.a, !!rodada.a);
    const b = nova(p.b, !!rodada.b);
    this.plans.andamento(this.id(), (est) => ({ ...est, indice: this.indice(), series: { ...est.series, [p.a]: a, [p.b]: b } }));
    const ultimaRodada = marcar && this.rodadas().every((r) => r.feita);
    if (marcar) this.iniciarDescansoSeFizerSentido(ultimaRodada);
  }

  /** Menu ⋯ de cada exercício do par (posição na ficha), ou nenhum. */
  protected readonly menuMembro = signal<number | null>(null);

  protected alternarMenuMembro(i: number, evento: Event): void {
    evento.stopPropagation();
    this.menuMembro.set(this.menuMembro() === i ? null : i);
  }

  protected fecharMenuMembro(): void {
    if (this.menuMembro() !== null) this.menuMembro.set(null);
  }

  /** Todas as séries do exercício estão feitas. */
  protected todasFeitas(i: number): boolean {
    const series = this.seriesDe(i);
    return series.length > 0 && series.every((s) => s.feita);
  }

  /** Ações do menu ⋯ de um exercício do par: cada uma fecha o menu e age sobre o exercício `i`. */
  protected adicionarSerieDe(i: number): void {
    this.menuMembro.set(null);
    this.adicionarSerie(i);
  }
  protected removerSerieDe(i: number): void {
    this.menuMembro.set(null);
    this.removerSerie(i);
  }
  protected marcarTodosDe(i: number): void {
    this.menuMembro.set(null);
    this.marcarTodos(i);
  }
  protected abrirNotasDe(i: number): void {
    this.menuMembro.set(null);
    this.abrirNotas(i);
  }

  private irPara(indice: number): void {
    this.piscadas.set({});
    this.mostrarConcluidas.set(false);
    this.menuMembro.set(null);
    this.plans.andamento(this.id(), (a) => ({ ...a, indice }));
  }

  /** Posição do primeiro exercício do bloco `n`. */
  private primeiroDoBloco(n: number): number {
    const b = this.blocos()[n];
    return b ? (b.tipo === 'solo' ? b.i : b.a) : 0;
  }

  protected anterior(): void {
    this.irPara(this.primeiroDoBloco(Math.max(0, this.numBloco() - 1)));
  }

  protected proximo(): void {
    if (!this.ultimo()) {
      this.irPara(this.primeiroDoBloco(this.numBloco() + 1));
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
    this.pararDescanso();
    this.tela.desligar();
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
    const ganhas = this.medalhas.aposTreino(sessaoId);
    if (foto) void this.social.salvarFoto(sessaoId, foto);
    const todas = this.medalhas.conquistas();
    const gravada = this.plans.historico().find((s) => s.id === sessaoId);
    this.resumo.set({
      kcal: gravada ? caloriasDaSessao(gravada, this.peso.registros()) : null,
      semPeso: this.peso.registros().length === 0,
      nome: f?.nome ?? 'Treino',
      exercicios: registros.length,
      series: registros.reduce((t, r) => t + r.series.length, 0),
      volume: volumeSessao({ data: '', fichaId: '', registros }),
      medalhas: ganhas.flatMap((g) => {
        const c = todas.find((x) => x.id === g.id);
        return c ? [{ titulo: c.titulo, nivel: g.nivel }] : [];
      }),
    });
  }

  /** Fecha o resumo e volta para o início. */
  protected fecharResumo(): void {
    this.resumo.set(null);
    this.router.navigate(['/']);
  }

  /** Cronômetro progressivo: conta a partir de zero e não para sozinho. Usa a hora real para não atrasar com a tela apagada. */
  private iniciarDescanso(decorrido = 0, limite = this.limiteDescanso()): void {
    this.pararDescanso();
    this.descansoDesde = Date.now() - decorrido * 1000;
    // O limite é o do exercício em que a série foi marcada, mesmo que a pessoa já esteja em outro.
    this.limiteAtivo.set(limite);
    this.descansoAtivo.set(Math.floor(decorrido));
    this.descansando.set(true);
    // Guardado desde o início: se o app for fechado ou reiniciado, o cronômetro retoma de onde estava (com o tempo fora).
    const descanso = { decorrido, limite, saiuEm: Date.now(), pausado: false };
    this.plans.andamento(this.id(), (a) => ({ ...a, descanso }));
    this.intervalo = setInterval(() => {
      const antes = this.descansoAtivo();
      const agora = Math.floor((Date.now() - this.descansoDesde) / 1000);
      this.descansoAtivo.set(agora);
      const limite = this.limiteAtivo();
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
