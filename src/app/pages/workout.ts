import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TituloEmDuasLinhas } from '../core/ajuste-titulo';
import { ConcluirTreino } from '../core/concluir-treino';
import { Dialogo } from '../core/dialogo';
import { ExerciseImage } from '../core/exercise-image';
import { ExerciseService } from '../core/exercise.service';
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
  protected readonly limiteDescanso = computed(() => this.item()?.descanso || 60);
  private descansoDesde = 0;
  protected readonly confirmandoSaida = signal(false);
  /** Quantas vezes cada série (pelo número) foi preenchida sozinha; o valor mudando refaz a animação. */
  protected readonly piscadas = signal<Record<number, number>>({});
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
    // A tela fica acesa enquanto o treino está aberto, para não apagar entre as séries.
    this.tela.ligar();
    // Treino retomado depois de uma pausa: o cronômetro continua de onde estava.
    effect(() => {
      const d = this.estado()?.descanso;
      if (!d || this.descansando()) return;
      untracked(() => {
        const fora = d.pausado ? 0 : Math.max(0, Math.floor((Date.now() - d.saiuEm) / 1000));
        this.iniciarDescanso(d.decorrido + fora, d.limite);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      // Saiu com o treino ainda em andamento (pausa, ou ver as instruções de um exercício): guarda o cronômetro para retomar.
      if (this.descansando() && this.estado()) {
        const descanso = { decorrido: this.descansoAtivo(), limite: this.limiteAtivo(), saiuEm: Date.now(), pausado: this.pausado };
        this.plans.andamento(this.id(), (a) => ({ ...a, descanso }));
      }
      this.pararDescanso();
      this.tela.desligar();
    });
  }

  /** Sugestão de subir a carga, enquanto nenhuma série do exercício foi marcada e a carga sugerida ainda não está na tela. */
  protected readonly sugestaoCarga = computed(() => {
    const it = this.item();
    if (!it || this.feitas() > 0) return null;
    const s = sugerirCarga(it, this.anterior_());
    if (!s) return null;
    return this.series().every((x) => x.carga === s.para) ? null : s;
  });

  /** Põe a carga sugerida em todas as séries do exercício (todas mudam juntas e piscam, como na cópia automática). */
  protected aplicarSugestao(): void {
    const s = this.sugestaoCarga();
    if (!s) return;
    const i = this.indice();
    const base = this.series().map((x) => this.paraSalvar({ ...x, carga: s.para }));
    this.piscadas.update((p) => {
      const novo = { ...p };
      for (const x of this.series()) novo[x.n] = (novo[x.n] ?? 0) + 1;
      return novo;
    });
    this.plans.andamento(this.id(), (a) => ({ ...a, indice: i, series: { ...a.series, [i]: base } }));
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
  /** Exercício trocado só neste treino: a nota da ficha é do exercício original e não vale para o que entrou. */
  protected readonly trocado = computed(() => !!this.estado()?.trocas?.[this.indice()]);
  protected readonly notaExercicio = computed(() => (this.trocado() ? '' : (this.item()?.nota ?? '')));
  protected readonly notaTreino = computed(() => this.estado()?.nota ?? '');

  protected abrirNotas(): void {
    this.rascunhoExercicio.set(this.notaExercicio());
    this.rascunhoTreino.set(this.notaTreino());
    this.editandoNotas.set(true);
  }

  protected lerCampo(evento: Event): string {
    return (evento.target as HTMLTextAreaElement).value;
  }

  /** Grava só o que mudou: a nota do exercício vai para a ficha, a do treino para o treino em andamento. */
  protected salvarNotas(): void {
    if (!this.trocado() && this.rascunhoExercicio().trim() !== this.notaExercicio()) {
      this.plans.definirNotaDoItem(this.id(), this.indice(), this.rascunhoExercicio());
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
    // Só as linhas de baixo que mudaram sozinhas piscam, para a pessoa notar o que foi copiado.
    const copiadas = this.series().filter((s, j) => j > k && !s.feita && s[campo] !== valor).map((s) => s.n);
    if (copiadas.length > 0) {
      this.piscadas.update((p) => {
        const novo = { ...p };
        for (const n of copiadas) novo[n] = (novo[n] ?? 0) + 1;
        return novo;
      });
    }
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
  protected marcarTodos(): void {
    const i = this.indice();
    const marcar = this.feitas() < this.series().length;
    const base = this.series().map((s) => this.paraSalvar({ ...s, feita: marcar, descanso: marcar ? s.descanso : undefined }));
    this.plans.andamento(this.id(), (a) => ({ ...a, indice: i, series: { ...a.series, [i]: base } }));
    if (marcar) this.iniciarDescansoSeFizerSentido();
  }

  /** O descanso só conta com várias séries: com uma só (como o cardio) não há descanso entre séries. */
  private iniciarDescansoSeFizerSentido(): void {
    if (this.series().length > 1) this.iniciarDescanso();
  }

  protected alternar(k: number): void {
    const it = this.item();
    if (!it) return;
    const ficouFeita = !this.series()[k].feita;
    // O descanso desta série é o tempo corrido desde a anterior; sem timer rodando (primeira série), não há o que guardar.
    const descanso = ficouFeita && this.descansando() ? Math.round((Date.now() - this.descansoDesde) / 1000) : undefined;
    this.gravarSerie(k, { feita: ficouFeita, descanso });
    // Marcar uma série (inclusive a última do exercício) reinicia o cronômetro. Ele não depende do exercício:
    // segue contando ao trocar de tela. Desmarcar não mexe nele.
    if (ficouFeita) this.iniciarDescansoSeFizerSentido();
  }

  private irPara(indice: number): void {
    this.piscadas.set({});
    this.plans.andamento(this.id(), (a) => ({ ...a, indice }));
  }

  protected anterior(): void {
    this.irPara(Math.max(0, this.indice() - 1));
  }

  protected proximo(): void {
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
    this.descansoAtivo.set(decorrido);
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
