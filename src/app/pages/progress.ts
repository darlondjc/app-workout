import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Dialogo } from '../core/dialogo';
import { ExercicioDialogo } from '../core/exercicio-dialogo';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { Sessao } from '../core/models';
import { PlanService } from '../core/plan.service';
import { SessaoDetalhe } from '../core/sessao-detalhe';
import { LIMITE_SESSOES_AMIGO, SocialService } from '../core/social.service';
import { CHAVE_META, lerMeta, metaPadrao } from '../core/meta';
import { PesoGrafico } from '../core/peso-grafico';
import { calcularResumo, dataISO, gerarInsights, volumeSessao } from '../core/stats';

const CHAVE_DISPENSADAS = 'app-workout:mensagens-dispensadas:v1';
const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function lerDispensadas(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE_DISPENSADAS) ?? '[]');
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

@Component({
  selector: 'app-progress',
  imports: [ExercicioDialogo, Icon, SessaoDetalhe, Dialogo, PesoGrafico],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pagina">
      <article class="card meta" aria-labelledby="t-meta">
        <div class="meta__topo">
          <h2 id="t-meta" class="rot">Meta da semana</h2>
          @if (editavel()) {
            <div class="passo" role="group" aria-label="Treinos por semana">
              <button type="button" aria-label="Diminuir a meta" [disabled]="resumo().metaSemanal <= 1" (click)="mudarMeta(-1)">−</button>
              <span>{{ resumo().metaSemanal }}×</span>
              <button type="button" aria-label="Aumentar a meta" [disabled]="resumo().metaSemanal >= 7" (click)="mudarMeta(1)">+</button>
            </div>
          } @else {
            <span class="passo"><span>{{ resumo().metaSemanal }}× por semana</span></span>
          }
        </div>
        <p class="grande">{{ resumo().treinosSemana }} <small>de {{ resumo().metaSemanal }} treinos</small></p>
        <div class="trilha" role="progressbar" aria-label="Treinos da semana" aria-valuemin="0" [attr.aria-valuemax]="resumo().metaSemanal" [attr.aria-valuenow]="resumo().treinosSemana">
          <div class="trilha__cheia" [style.width.%]="percentualMeta()"></div>
        </div>
      </article>

      @if (insights().length) {
        <ul class="insights" aria-label="Motivação">
          @for (i of insights(); track i.texto) {
            <li [class]="'insight insight--' + i.tipo">
              <span class="insight__txt">{{ i.texto }}</span>
              @if (editavel()) {
                <button type="button" class="insight__x" aria-label="Dispensar esta mensagem" (click)="dispensar(i.texto)">
                  <app-icon name="close" [size]="16" [stroke]="2.4" />
                </button>
              }
            </li>
          }
        </ul>
      }

      <article class="card" aria-labelledby="t-cal">
        <div class="cal__topo">
          <button type="button" class="seta" aria-label="Mês anterior" (click)="mudarMes(-1)">
            <app-icon name="back" [size]="20" [stroke]="2.4" />
          </button>
          <h2 id="t-cal" class="mes">{{ tituloMes() }}</h2>
          <button type="button" class="seta" aria-label="Próximo mês" [disabled]="ehMesAtual()" (click)="mudarMes(1)">
            <app-icon name="chevron" [size]="20" [stroke]="2.4" />
          </button>
        </div>
        <div class="cal__semana" aria-hidden="true">
          @for (l of letras; track $index) {
            <span>{{ l }}</span>
          }
        </div>
        <div class="cal__grade" role="grid" [attr.aria-label]="tituloMes()">
          @for (c of celulas(); track c.chave) {
            @if (c.dia) {
              <button
                type="button"
                class="cel"
                [class.feito]="c.feito"
                [class.hoje]="c.hoje"
                [class.sel]="c.iso === selecionado()"
                [attr.aria-label]="c.descricao"
                [attr.aria-pressed]="c.iso === selecionado()"
                (click)="selecionar(c.iso)"
              >
                {{ c.dia }}
              </button>
            } @else {
              <span class="cel cel--vazia"></span>
            }
          }
        </div>
        <p class="legenda apoio">
          <span class="ponto"></span> dia com treino · {{ resumo().treinosMes }} {{ resumo().treinosMes === 1 ? 'treino' : 'treinos' }} neste mês
        </p>

        @if (selecionado(); as iso) {
          <div class="dia-detalhe" aria-live="polite">
            <h3 class="rot">{{ tituloDia(iso) }}</h3>
            @for (s of sessoesDoDia(); track s.chave) {
              <div class="sessao">
                <strong>{{ s.fichaNome || 'Treino' }}</strong>
                <span class="apoio">{{ s.resumo }}</span>
                @if (s.sessao.registros?.length) {
                  <button type="button" class="ver-treino" aria-haspopup="dialog" (click)="sessaoAberta.set(s.chave)">Ver treino</button>
                }
              </div>
            } @empty {
              <p class="apoio">Sem treino neste dia.</p>
            }
          </div>
        }
      </article>

      @if (sessaoDoDialogo(); as d) {
        <app-dialogo [titulo]="d.fichaNome || 'Treino'" [subtitulo]="d.dia" (fechar)="sessaoAberta.set(null); exercicioAberto.set(null)">
          <app-sessao-detalhe [sessao]="d.sessao" (verExercicio)="exercicioAberto.set($event)" />
        </app-dialogo>
      }

      @if (exercicioAberto(); as id) {
        <app-exercicio-dialogo [id]="id" (fechar)="exercicioAberto.set(null)" />
      }

      <div class="numeros">
        <div class="card num"><strong>{{ resumo().semanasSeguidas }}</strong><span class="apoio">{{ resumo().semanasSeguidas === 1 ? 'semana seguida' : 'semanas seguidas' }} na meta</span></div>
        <div class="card num"><strong>{{ resumo().totalTreinos }}</strong><span class="apoio">{{ resumo().totalTreinos === 1 ? 'treino' : 'treinos' }} {{ totalParcial() ? 'recentes' : 'no total' }}</span></div>
        <div class="card num"><strong>{{ volume(resumo().volumeMes) }}</strong><span class="apoio">carga total no mês</span></div>
        <div class="card num">
          <strong>{{ resumo().diasSemTreinar === null ? '—' : resumo().diasSemTreinar }}</strong>
          <span class="apoio">{{ resumo().diasSemTreinar === 1 ? 'dia' : 'dias' }} desde o último</span>
        </div>
        <div class="card num num--largo">
          <strong>{{ duracao(resumo().descansoMedio) }}</strong>
          <span class="apoio">tempo médio entre séries</span>
        </div>
      </div>

      <article class="card" aria-labelledby="t-sem">
        <h2 id="t-sem" class="rot">Últimas 8 semanas</h2>
        <ol class="barras">
          @for (b of barras(); track b.inicio) {
            <li [attr.aria-label]="b.descricao">
              <span class="barra" [class.atual]="b.atual" [class.meta-ok]="b.treinos >= resumo().metaSemanal" [style.height.%]="b.altura"></span>
              <span class="apoio" aria-hidden="true">{{ b.rotulo }}</span>
            </li>
          }
        </ol>
        <p class="apoio">Barras cheias indicam semanas em que você bateu a meta.</p>
      </article>

      @if (editavel()) {
        <app-peso-grafico />
      }

      @if (recordes().length) {
        <article class="card" aria-labelledby="t-rec">
          <h2 id="t-rec" class="rot">Recordes do último treino</h2>
          <ul class="recordes">
            @for (r of recordes(); track r.exerciseId) {
              <li><span>{{ r.nome }}</span><strong>{{ r.carga }} kg</strong></li>
            }
          </ul>
        </article>
      }
    </section>
  `,
  styles: `
    .pagina { display: flex; flex-direction: column; gap: 10px; }
    .card { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
    .rot { font-size: 14px; font-weight: 500; color: var(--muted); margin: 0; }
    .meta__topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .passo { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; }
    .passo button { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--line); background: var(--card); font: inherit; font-size: 18px; }
    .passo span { min-width: 28px; text-align: center; }
    .grande { font-family: var(--font-display); font-size: 32px; font-weight: 700; line-height: 1; margin: 0; }
    .grande small { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--muted); }
    .trilha { height: 8px; border-radius: 4px; background: var(--soft); overflow: hidden; }
    .trilha__cheia { height: 100%; background: var(--ink); border-radius: 4px; transition: width 0.25s; }
    .insights { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .insight { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; border-radius: 12px; background: var(--card); border-left: 4px solid var(--line); font-size: 14px; line-height: 1.35; }
    .insight__txt { flex: 1; min-width: 0; }
    .insight__x { flex: none; width: 32px; height: 32px; margin: -4px -8px -4px 0; border: 0; border-radius: 50%; background: none; color: var(--muted); display: flex; align-items: center; justify-content: center; }
    .insight--conquista { border-left-color: var(--accent); background: #f6fadf; }
    .insight--incentivo { border-left-color: var(--ink); }
    .cal__topo { display: flex; align-items: center; justify-content: space-between; }
    .mes { font-family: var(--font-display); font-size: 18px; margin: 0; }
    .seta { width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--soft); display: flex; align-items: center; justify-content: center; color: var(--ink); }
    .seta:disabled { opacity: 0.35; }
    .cal__semana, .cal__grade { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px 4px; text-align: center; }
    .cal__semana { font-size: 12px; color: var(--muted); }
    .cel { width: 36px; height: 36px; justify-self: center; border-radius: 50%; border: 1.5px solid transparent; background: transparent; font: inherit; font-size: 14px; color: var(--ink); padding: 0; }
    .cel--vazia { pointer-events: none; }
    .cel.hoje { border-color: var(--ink); }
    .cel.feito { background: var(--ink); color: var(--accent); font-weight: 700; }
    .cel.sel { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--accent-ink); }
    .legenda { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 12px; }
    .ponto { width: 10px; height: 10px; border-radius: 50%; background: var(--ink); flex: none; }
    .dia-detalhe { border-top: 1px solid var(--soft); padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
    .sessao { display: flex; flex-direction: column; gap: 2px; }
    .ver-treino { align-self: flex-start; min-height: 36px; padding: 0; border: 0; background: none; font: inherit; font-weight: 700; color: var(--accent-ink); }
    .numeros { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .num--largo { grid-column: 1 / -1; }
    .num { gap: 2px; }
    .num strong { font-family: var(--font-display); font-size: 24px; line-height: 1.1; }
    .num span { font-size: 12px; line-height: 1.3; }
    .barras { list-style: none; margin: 0; padding: 0; height: 88px; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 8px; align-items: end; }
    .barras li { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; font-size: 11px; }
    .barra { width: 100%; min-height: 4px; border-radius: 6px; background: var(--line); }
    .barra.meta-ok { background: var(--ink); }
    .barra.atual { outline: 2px solid var(--accent-ink); outline-offset: 1px; }
    .recordes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
    .recordes li { display: flex; justify-content: space-between; gap: 12px; }
    button:disabled { cursor: default; }
  `,
})
export class Progress {
  private readonly plans = inject(PlanService);
  private readonly social = inject(SocialService);
  private readonly ex = inject(ExerciseService);

  /** Treinos da pessoa exibida: os seus ou os de um amigo. */
  readonly historico = input.required<Sessao[]>();
  /** Só a própria pessoa muda a meta. */
  readonly editavel = input(true);
  /** Preenchido ao ver um amigo: as mensagens falam dele. */
  readonly nome = input<string | undefined>(undefined);
  /** Meta publicada pelo amigo. */
  readonly metaBase = input<number | undefined>(undefined);

  constructor() {
    // Esquece as dispensadas que deixaram de existir: se a mesma mensagem voltar mais tarde, é novidade de novo.
    effect(() => {
      if (!this.editavel()) return;
      const atuais = new Set(this.mensagens().map((m) => m.texto));
      untracked(() => {
        const mantidas = this.dispensadas().filter((t) => atuais.has(t));
        if (mantidas.length !== this.dispensadas().length) this.dispensadas.set(mantidas);
      });
    });
    effect(() => {
      const lista = this.dispensadas();
      try {
        localStorage.setItem(CHAVE_DISPENSADAS, JSON.stringify(lista));
      } catch {
        // sem armazenamento: a dispensa vale só até fechar o app
      }
    });
  }

  protected readonly letras = LETRAS;
  private readonly hoje = new Date();
  private readonly metaEscolhida = signal<number | null>(lerMeta());
  /** Primeiro dia do mês exibido no calendário. */
  protected readonly mes = signal(new Date(this.hoje.getFullYear(), this.hoje.getMonth(), 1));
  protected readonly selecionado = signal<string | null>(dataISO(this.hoje));
  /** Treino do dia aberto no diálogo, para ver os exercícios e séries. */
  protected readonly sessaoAberta = signal<string | null>(null);
  /** Exercício cuja imagem está aberta por cima do detalhe do treino. */
  protected readonly exercicioAberto = signal<string | null>(null);

  /** Sem meta escolhida, usa o número de fichas (entre 2 e 6). */
  private readonly meta = computed(() =>
    this.editavel() ? (this.metaEscolhida() ?? metaPadrao(this.plans.fichas().length)) : (this.metaBase() ?? 3),
  );
  protected readonly resumo = computed(() => calcularResumo(this.historico(), this.hoje, this.meta()));
  /** Do amigo só se leem os treinos mais recentes: com o limite atingido, o total deixa de ser o total. */
  protected readonly totalParcial = computed(() => !this.editavel() && this.historico().length >= LIMITE_SESSOES_AMIGO);
  private readonly mensagens = computed(() => gerarInsights(this.resumo(), this.hoje, this.nome()));
  /** Mensagens que a própria pessoa dispensou; uma mensagem nova (texto diferente) aparece de novo. */
  private readonly dispensadas = signal<string[]>(lerDispensadas());
  protected readonly insights = computed(() => {
    const fora = this.dispensadas();
    const lista = this.editavel() ? this.mensagens().filter((m) => !fora.includes(m.texto)) : this.mensagens();
    return lista.slice(0, 4);
  });

  protected dispensar(texto: string): void {
    this.dispensadas.update((l) => (l.includes(texto) ? l : [...l, texto]));
  }
  protected readonly percentualMeta = computed(() =>
    Math.min(100, Math.round((this.resumo().treinosSemana / this.resumo().metaSemanal) * 100)),
  );
  private readonly diasFeitos = computed(() => new Set(this.historico().map((s) => s.data)));

  protected readonly tituloMes = computed(() => {
    const m = this.mes().toLocaleDateString('pt-BR', { month: 'long' });
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${this.mes().getFullYear()}`;
  });
  protected readonly ehMesAtual = computed(
    () => this.mes().getFullYear() === this.hoje.getFullYear() && this.mes().getMonth() === this.hoje.getMonth(),
  );

  protected readonly celulas = computed(() => {
    const m = this.mes();
    const total = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const vazias = (m.getDay() + 6) % 7; // semana começa na segunda
    const feitos = this.diasFeitos();
    const hojeISO = dataISO(this.hoje);
    const lista: { chave: string; dia: number; iso: string; feito: boolean; hoje: boolean; descricao: string }[] = [];
    for (let i = 0; i < vazias; i++) lista.push({ chave: 'v' + i, dia: 0, iso: '', feito: false, hoje: false, descricao: '' });
    for (let d = 1; d <= total; d++) {
      const iso = dataISO(new Date(m.getFullYear(), m.getMonth(), d));
      const feito = feitos.has(iso);
      lista.push({
        chave: iso,
        dia: d,
        iso,
        feito,
        hoje: iso === hojeISO,
        descricao: `${d} de ${m.toLocaleDateString('pt-BR', { month: 'long' })}${iso === hojeISO ? ', hoje' : ''}: ${feito ? 'treino feito' : 'sem treino'}`,
      });
    }
    return lista;
  });

  protected readonly sessoesDoDia = computed(() => {
    const iso = this.selecionado();
    return this.historico()
      .filter((s) => s.data === iso)
      .map((s, i) => {
        const exercicios = s.registros?.length ?? 0;
        const vol = volumeSessao(s);
        const partes = [exercicios ? `${exercicios} ${exercicios === 1 ? 'exercício' : 'exercícios'}` : '', vol ? `${this.volume(vol)} de carga` : ''].filter(Boolean);
        return { chave: `${iso}:${s.id ?? i}`, sessao: s, fichaNome: s.fichaNome ?? this.plans.get(s.fichaId)?.nome, resumo: partes.join(' · ') || 'Treino concluído' };
      });
  });

  protected readonly barras = computed(() => {
    const semanas = this.resumo().ultimasSemanas;
    const max = Math.max(this.resumo().metaSemanal, ...semanas.map((s) => s.treinos), 1);
    return semanas.map((s, i) => {
      const [a, m, d] = s.inicio.split('-').map(Number);
      return {
        inicio: s.inicio,
        treinos: s.treinos,
        atual: i === semanas.length - 1,
        altura: Math.max(4, Math.round((s.treinos / max) * 100)),
        rotulo: `${d}/${m}`,
        descricao: `Semana de ${d}/${m}/${a}: ${s.treinos} ${s.treinos === 1 ? 'treino' : 'treinos'}`,
      };
    });
  });

  protected readonly recordes = computed(() =>
    this.resumo().recordes.map((r) => {
      const e = this.ex.get(r.exerciseId);
      return { ...r, nome: e ? this.ex.nome(e) : r.exerciseId };
    }),
  );

  /** O treino aberto no diálogo, com o dia por extenso. */
  protected readonly sessaoDoDialogo = computed(() => {
    const aberta = this.sessaoAberta();
    const iso = this.selecionado();
    const s = aberta && iso ? this.sessoesDoDia().find((x) => x.chave === aberta) : undefined;
    return s && iso ? { sessao: s.sessao, fichaNome: s.fichaNome, dia: this.tituloDia(iso) } : null;
  });

  protected mudarMeta(delta: number): void {
    const nova = Math.max(1, Math.min(7, this.resumo().metaSemanal + delta));
    this.metaEscolhida.set(nova);
    void this.social.publicarMeta(nova);
    try {
      localStorage.setItem(CHAVE_META, String(nova));
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
  }

  protected mudarMes(delta: number): void {
    const m = this.mes();
    this.mes.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
    this.selecionado.set(null);
  }

  protected selecionar(iso: string): void {
    this.selecionado.set(this.selecionado() === iso ? null : iso);
  }

  protected tituloDia(iso: string): string {
    const [a, m, d] = iso.split('-').map(Number);
    const t = new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /** 45 → "45 s"; 72 → "1 min 12 s"; sem registro → "—". */
  protected duracao(segundos: number | null): string {
    if (segundos === null) return '—';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return m === 0 ? `${s} s` : s === 0 ? `${m} min` : `${m} min ${s} s`;
  }

  protected volume(kg: number): string {
    return kg >= 1000 ? `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` : `${Math.round(kg)} kg`;
  }
}
