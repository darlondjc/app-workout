import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CORPO, RegiaoCorpo } from './corpo-svg';
import { ExerciseService } from './exercise.service';
import { Sessao } from './models';
import { MUSCULOS, calcularMusculos, corDoNivel, maisEMenos, rotuloDoNivel, ultimaVez } from './musculos';

type Lado = 'frente' | 'costas';

const COR_SEM_MUSCULO = '#d5d9dd';
const NIVEIS_LEGENDA = [0, 0.18, 0.4, 0.68, 1];

/**
 * Mapa do corpo (frente e costas) colorido pelo quanto cada músculo foi trabalhado nos treinos recentes: azul escuro
 * para quem está parado, até vermelho escuro para quem foi muito treinado. Tocar num músculo mostra os detalhes, e as
 * listas embaixo destacam os mais e os menos trabalhados. A conta fica em `core/musculos.ts`.
 */
@Component({
  selector: 'app-mapa-muscular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" aria-labelledby="t-musculos">
      <div class="topo">
        <h2 id="t-musculos" class="titulo">Músculos trabalhados</h2>
        <div class="lados" role="group" aria-label="Lado do corpo">
          <button type="button" [attr.aria-pressed]="lado() === 'frente'" (click)="lado.set('frente')">Frente</button>
          <button type="button" [attr.aria-pressed]="lado() === 'costas'" (click)="lado.set('costas')">Costas</button>
        </div>
      </div>
      <p class="apoio">Treinos recentes pesam mais. Toque num músculo para ver os detalhes.</p>

      <div class="palco">
        <div class="giro" [class.giro--costas]="lado() === 'costas'">
          @for (v of vistas; track v) {
            <svg
              class="face"
              [class.face--costas]="v === 'costas'"
              [attr.inert]="lado() !== v ? '' : null"
              viewBox="-52 0 204 204"
              role="group"
              [attr.aria-label]="v === 'frente' ? 'Corpo visto de frente' : 'Corpo visto de costas'"
            >
              @for (r of regioes()[v]; track r.musculo) {
                @if (r.musculo; as m) {
                  <g
                    class="musculo"
                    [class.musculo--sel]="selecionado() === m"
                    role="button"
                    tabindex="0"
                    [attr.aria-pressed]="selecionado() === m"
                    [attr.aria-label]="descricao(m)"
                    (click)="selecionar(m)"
                    (keydown.enter)="selecionar(m)"
                    (keydown.space)="selecionar(m); $event.preventDefault()"
                  >
                    @for (p of r.pontos; track $index) {
                      <polygon [attr.points]="p" [style.fill]="cor(m)" />
                    }
                  </g>
                } @else {
                  <g aria-hidden="true">
                    @for (p of r.pontos; track $index) {
                      <polygon class="neutro" [attr.points]="p" />
                    }
                  </g>
                }
              }
              @for (s of corpo[v].setas; track s.musculo) {
                <g class="seta" [class.seta--sel]="selecionado() === s.musculo" aria-hidden="true" (click)="selecionar(s.musculo)">
                  <line [attr.x1]="s.lado === 'e' ? -5 : 105" [attr.y1]="s.ly" [attr.x2]="s.x" [attr.y2]="s.y" />
                  <circle [attr.cx]="s.x" [attr.cy]="s.y" r="0.9" />
                  <text [attr.x]="s.lado === 'e' ? -6.5 : 106.5" [attr.y]="s.ly + 2" [attr.text-anchor]="s.lado === 'e' ? 'end' : 'start'">{{ curto(s.musculo) }}</text>
                </g>
              }
            </svg>
          }
        </div>
      </div>

      <div class="legenda" aria-hidden="true">
        <span>Pouco</span>
        <span class="legenda__barra" [style.background]="gradiente"></span>
        <span>Muito</span>
      </div>

      <div class="detalhe" aria-live="polite">
        @if (escolhido(); as e) {
          <p class="detalhe__nome"><span class="ponto" [style.background]="e.cor"></span><strong>{{ e.nome }}</strong></p>
          <p>{{ e.rotulo }}</p>
          <p class="apoio">Último treino direto: {{ e.ultima }}.</p>
          <p class="apoio">Últimos 7 dias: {{ e.series7 }} {{ e.series7 === 1 ? 'série' : 'séries' }} como músculo principal.</p>
        } @else {
          <p class="apoio">Toque num músculo para ver quando ele foi treinado pela última vez.</p>
        }
      </div>

      @if (semDados()) {
        <p class="vazio">Ainda não há treinos com exercícios nas últimas 8 semanas. Conclua um treino e o mapa começa a se preencher.</p>
      } @else {
        <div class="listas">
          <section aria-labelledby="mm-menos">
            <h3 id="mm-menos" class="sub">Menos trabalhados</h3>
            <ul>
              @for (e of rankings().menos; track e.id) {
                <li>
                  <button type="button" class="linha" (click)="selecionar(e.id)">
                    <span class="ponto" [style.background]="cor(e.id)"></span>
                    <span class="linha__txt">
                      <strong>{{ nome(e.id) }}</strong>
                      <span class="apoio">{{ e.diasDesdeUltimo === null ? 'sem treino direto' : ultima(e) }}</span>
                    </span>
                  </button>
                </li>
              }
            </ul>
          </section>
          <section aria-labelledby="mm-mais">
            <h3 id="mm-mais" class="sub">Mais trabalhados</h3>
            <ul>
              @for (e of rankings().mais; track e.id) {
                <li>
                  <button type="button" class="linha" (click)="selecionar(e.id)">
                    <span class="ponto" [style.background]="cor(e.id)"></span>
                    <span class="linha__txt">
                      <strong>{{ nome(e.id) }}</strong>
                      <span class="apoio">{{ e.series7 > 0 ? e.series7 + (e.series7 === 1 ? ' série' : ' séries') + ' em 7 dias' : 'último treino ' + ultima(e) }}</span>
                    </span>
                  </button>
                </li>
              }
            </ul>
          </section>
        </div>
      }

      <details class="como">
        <summary>Como é calculado?</summary>
        <p class="apoio">
          Cada série conta para o músculo principal do exercício e um pouco para os secundários. Treinos recentes pesam mais:
          o peso cai pela metade a cada 7 dias, então treinar várias vezes seguidas deixa o músculo mais vermelho e ficar
          semanas sem treinar o deixa azul. Só entram os últimos 56 dias. Alongamentos, cardio e atividades registradas fora
          da ficha não entram, porque não dá para saber que músculos trabalharam. É uma estimativa para orientar o treino.
        </p>
      </details>
    </article>
  `,
  styles: `
    :host { display: block; }
    .card { display: flex; flex-direction: column; gap: 10px; }
    .topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .titulo { margin: 0; font-size: 16px; }
    .lados { display: inline-flex; padding: 3px; border-radius: 999px; background: var(--soft); }
    .lados button { min-height: 32px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--ink); font: inherit; font-size: 13px; font-weight: 600; }
    .lados button[aria-pressed='true'] { background: var(--ink); color: var(--accent); }

    .palco { perspective: 1000px; }
    .giro { position: relative; width: 100%; max-width: 440px; margin: 0 auto; aspect-ratio: 1 / 1; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.2, 1); }
    .giro--costas { transform: rotateY(180deg); }
    .face { position: absolute; inset: 0; width: 100%; height: 100%; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: visible; }
    .face--costas { transform: rotateY(180deg); }
    @media (prefers-reduced-motion: reduce) { .giro { transition: none; } }

    .musculo { cursor: pointer; outline: none; }
    .musculo polygon { stroke: #8a93a0; stroke-width: 0.25; stroke-linejoin: round; transition: fill 0.3s; }
    .musculo--sel polygon, .musculo:focus-visible polygon { stroke: var(--ink); stroke-width: 1; }
    .neutro { fill: ${COR_SEM_MUSCULO}; stroke: #8a93a0; stroke-width: 0.25; stroke-linejoin: round; }
    .seta { cursor: pointer; }
    .seta line { stroke: #6b7280; stroke-width: 0.3; pointer-events: none; }
    .seta circle { fill: var(--ink); stroke: #fff; stroke-width: 0.3; }
    .seta text { font-size: 6.2px; fill: var(--ink); }
    .seta--sel text { font-weight: 700; }

    .legenda { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
    .legenda__barra { flex: 1; height: 8px; border-radius: 999px; border: 1px solid var(--line); }

    .detalhe { min-height: 76px; padding: 10px 12px; border-radius: 14px; background: var(--soft); display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
    .detalhe p { margin: 0; }
    .detalhe__nome { display: flex; align-items: center; gap: 8px; font-size: 16px; }
    .ponto { flex: none; width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.25); }

    .vazio { margin: 0; font-size: 14px; color: var(--muted); }
    .listas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .sub { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--muted); }
    .listas ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .linha { width: 100%; min-height: 44px; padding: 6px 10px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); font: inherit; text-align: left; }
    .linha__txt { display: flex; flex-direction: column; min-width: 0; font-size: 14px; line-height: 1.25; }
    .linha__txt .apoio { font-size: 12px; }

    .como summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--muted); min-height: 32px; display: flex; align-items: center; }
    .como p { margin: 4px 0 0; }
  `,
})
export class MapaMuscular {
  /** Treinos da pessoa; só os com exercícios registrados entram na conta. */
  readonly historico = input.required<Sessao[]>();

  private readonly ex = inject(ExerciseService);
  private readonly hoje = new Date();

  protected readonly vistas: Lado[] = ['frente', 'costas'];
  protected readonly corpo = CORPO;
  protected readonly lado = signal<Lado>('frente');
  protected readonly selecionado = signal<string | null>(null);
  protected readonly gradiente = `linear-gradient(to right, ${NIVEIS_LEGENDA.map((n) => `${corDoNivel(n)} ${n * 100}%`).join(', ')})`;
  protected readonly ultima = ultimaVez;

  protected readonly estados = computed(() => calcularMusculos(this.historico(), this.hoje, (id) => this.ex.get(id)));
  private readonly porId = computed(() => new Map(this.estados().map((e) => [e.id, e])));
  protected readonly semDados = computed(() => this.estados().every((e) => e.pontos === 0));
  protected readonly rankings = computed(() => maisEMenos(this.estados(), 3));

  /** As regiões de cada lado, com a selecionada por último para a borda dela não ficar escondida pelas vizinhas. */
  protected readonly regioes = computed(() => {
    const sel = this.selecionado();
    const ordenar = (lista: RegiaoCorpo[]) => [...lista].sort((a, b) => Number(a.musculo === sel && sel !== null) - Number(b.musculo === sel && sel !== null));
    return { frente: ordenar(CORPO.frente.regioes), costas: ordenar(CORPO.costas.regioes) };
  });

  protected readonly escolhido = computed(() => {
    const id = this.selecionado();
    const e = id ? this.porId().get(id) : undefined;
    if (!id || !e) return null;
    return { nome: this.nome(id), cor: corDoNivel(e.nivel), rotulo: rotuloDoNivel(e), ultima: ultimaVez(e), series7: e.series7 };
  });

  protected nome(id: string): string {
    return MUSCULOS.find((m) => m.id === id)?.nome ?? id;
  }

  protected curto(id: string): string {
    return MUSCULOS.find((m) => m.id === id)?.curto ?? id;
  }

  protected cor(id: string | null): string {
    if (id === null) return COR_SEM_MUSCULO;
    return corDoNivel(this.porId().get(id)?.nivel ?? 0);
  }

  /** Texto lido por leitores de tela, já que a cor sozinha não diz nada: "Peito: bem trabalhado, último treino direto ontem". */
  protected descricao(id: string): string {
    const e = this.porId().get(id);
    return e ? `${this.nome(id)}: ${rotuloDoNivel(e).toLowerCase()}, último treino direto ${ultimaVez(e)}` : this.nome(id);
  }

  /** Marca o músculo (ou desmarca, se já estava marcado) e vira o corpo para o lado em que ele aparece. */
  protected selecionar(id: string): void {
    if (this.selecionado() === id) {
      this.selecionado.set(null);
      return;
    }
    this.selecionado.set(id);
    const aparece = (l: Lado) => CORPO[l].regioes.some((r) => r.musculo === id);
    if (!aparece(this.lado())) this.lado.set(aparece('frente') ? 'frente' : 'costas');
  }
}
