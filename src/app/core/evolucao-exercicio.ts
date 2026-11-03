import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { dataCurta, formatarKg } from './data-texto';
import { Evolucao, Metrica, evolucaoDoExercicio, valorDe } from './evolucao';
import { PlanService } from './plan.service';

const LARGURA = 320;
const ALTURA = 150;
const MARGEM = { esq: 42, dir: 14, topo: 14, base: 26 };

const METRICAS: { valor: Metrica; rotulo: string; unidade: string; ajuda: string }[] = [
  { valor: 'carga', rotulo: 'Carga', unidade: 'kg', ajuda: 'a maior carga usada em uma série' },
  {
    valor: 'rm',
    rotulo: '1RM',
    unidade: 'kg',
    ajuda: 'a carga que você levantaria uma vez, estimada pelas suas séries',
  },
  {
    valor: 'volume',
    rotulo: 'Volume',
    unidade: 'kg',
    ajuda: 'carga × repetições, somando as séries',
  },
];

/** Como a carga de um exercício evoluiu de treino em treino (a partir do histórico). Sem treinos feitos, não aparece. */
@Component({
  selector: 'app-evolucao-exercicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (grafico(); as g) {
      <section class="evolucao" aria-labelledby="t-evolucao">
        <div class="topo">
          <h2 id="t-evolucao" class="sub">Sua evolução</h2>
          @if (!dados().minutos && dados().pontos.length > 0) {
            <div class="periodos" role="radiogroup" aria-label="O que mostrar no gráfico">
              @for (m of metricas; track m.valor) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="metrica() === m.valor"
                  (click)="metrica.set(m.valor)"
                >
                  {{ m.rotulo }}
                </button>
              }
            </div>
          }
        </div>

        <p class="grande">
          {{ g.ultimo }} <small>{{ g.unidade }} · {{ g.quando }}</small>
        </p>
        <p class="apoio variacao">{{ g.variacao }}</p>
        <svg
          class="grafico"
          [attr.viewBox]="'0 0 ' + largura + ' ' + altura"
          role="img"
          [attr.aria-label]="g.descricao"
        >
          @for (l of g.linhas; track l.y) {
            <line
              class="grade"
              [attr.x1]="margem.esq"
              [attr.x2]="largura - margem.dir"
              [attr.y1]="l.y"
              [attr.y2]="l.y"
            />
            <text class="eixo" [attr.x]="margem.esq - 6" [attr.y]="l.y + 4" text-anchor="end">
              {{ l.rotulo }}
            </text>
          }
          @if (g.pontos.length > 1) {
            <path class="linha" [attr.d]="g.caminho" />
          }
          @for (p of g.pontos; track $index) {
            <circle class="ponto" [attr.cx]="p.cx" [attr.cy]="p.cy" r="4" />
          }
          <text class="eixo" [attr.x]="margem.esq" [attr.y]="altura - 6" text-anchor="start">
            {{ g.inicio }}
          </text>
          <text
            class="eixo"
            [attr.x]="largura - margem.dir"
            [attr.y]="altura - 6"
            text-anchor="end"
          >
            {{ g.fim }}
          </text>
        </svg>
        <p class="apoio nota">
          {{
            g.pontos.length === 1
              ? 'Um treino registrado. A partir do segundo, o gráfico mostra a evolução. '
              : ''
          }}{{ ajuda() }}
        </p>
      </section>
    }
  `,
  styles: `
    .evolucao {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .sub {
      margin: 0;
    }
    .periodos {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border-radius: 999px;
      background: var(--soft);
    }
    .periodos button {
      min-height: 32px;
      padding: 0 12px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      font-size: 13px;
      font-weight: 700;
      color: var(--muted);
    }
    .periodos button[aria-checked='true'] {
      background: var(--ink-bg);
      color: var(--accent);
    }
    .grande {
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
      margin: 0;
    }
    .grande small {
      font-family: var(--font);
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
    }
    .variacao {
      margin: 0;
      font-weight: 700;
      color: var(--ink);
    }
    .nota {
      font-size: 12px;
      margin: 0;
    }
    .grafico {
      width: 100%;
      height: auto;
      display: block;
    }
    .grade {
      stroke: var(--soft);
      stroke-width: 1;
    }
    .eixo {
      font-size: 11px;
      fill: var(--muted);
      font-family: var(--font);
    }
    .linha {
      fill: none;
      stroke: var(--ink);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .ponto {
      fill: var(--accent);
      stroke: var(--ink);
      stroke-width: 2;
    }
  `,
})
export class EvolucaoExercicio {
  readonly exerciseId = input.required<string>();

  private readonly plans = inject(PlanService);
  protected readonly metricas = METRICAS;
  protected readonly metrica = signal<Metrica>('carga');
  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;
  protected readonly margem = MARGEM;
  private readonly hoje = new Date();

  protected readonly dados = computed<Evolucao>(() =>
    evolucaoDoExercicio(this.plans.historico(), this.exerciseId()),
  );
  private readonly metricaAtual = computed<Metrica>(() =>
    this.dados().minutos ? 'minutos' : this.metrica(),
  );
  protected readonly ajuda = computed(() => {
    const m = this.metricaAtual();
    if (m === 'minutos') return 'Total de minutos em cada treino.';
    const a = METRICAS.find((x) => x.valor === m)?.ajuda ?? '';
    return `Cada ponto é um treino: ${a}.`;
  });

  private fmt(v: number): string {
    return this.metricaAtual() === 'volume' ? Math.round(v).toLocaleString('pt-BR') : formatarKg(v);
  }

  protected readonly grafico = computed(() => {
    const { pontos } = this.dados();
    if (pontos.length === 0) return null;
    const m = this.metricaAtual();
    const unidade = m === 'minutos' ? 'min' : 'kg';
    const valores = pontos.map((p) => valorDe(p, m));
    const minimo = Math.min(...valores);
    const maximo = Math.max(...valores);
    const folga = maximo - minimo < 0.5 ? 1 : (maximo - minimo) * 0.2;
    const baixo = Math.max(0, minimo - folga);
    const alto = maximo + folga;
    const x = (i: number) =>
      pontos.length === 1
        ? (MARGEM.esq + LARGURA - MARGEM.dir) / 2
        : MARGEM.esq + (i / (pontos.length - 1)) * (LARGURA - MARGEM.esq - MARGEM.dir);
    const y = (v: number) =>
      MARGEM.topo + (1 - (v - baixo) / (alto - baixo)) * (ALTURA - MARGEM.topo - MARGEM.base);
    const xy = valores.map((v, i) => ({ cx: x(i), cy: y(v) }));
    const extremos = minimo === maximo ? [maximo] : [maximo, minimo];
    const ultimo = valores.at(-1) ?? 0;
    const primeiro = valores[0];
    const dif = ultimo - primeiro;
    const variacao =
      pontos.length < 2
        ? 'Faça de novo para ver a variação.'
        : dif === 0
          ? `Igual ao primeiro treino mostrado (${this.fmt(primeiro)} ${unidade}).`
          : `${dif > 0 ? '+' : '−'}${this.fmt(Math.abs(dif))} ${unidade} desde ${dataCurta(pontos[0].data, this.hoje)}.`;
    return {
      pontos: xy,
      caminho: xy
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
        .join(' '),
      linhas: extremos.map((v) => ({ y: y(v), rotulo: this.fmt(v) })),
      inicio: dataCurta(pontos[0].data, this.hoje),
      fim: dataCurta(pontos.at(-1)!.data, this.hoje),
      ultimo: this.fmt(ultimo),
      unidade,
      quando: dataCurta(pontos.at(-1)!.data, this.hoje),
      variacao,
      descricao: `Gráfico da evolução: ${pontos.length} ${pontos.length === 1 ? 'treino' : 'treinos'}, entre ${this.fmt(minimo)} e ${this.fmt(maximo)} ${unidade}. ${variacao}`,
    };
  });
}
