import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { dataCurta } from './data-texto';
import { ChaveMedida, MEDIDAS, PeriodoMedida, formatarMedida, serieDeMedida, ultimasMedidas } from './medidas';
import { MedidasService } from './medidas.service';

const LARGURA = 320;
const ALTURA = 160;
const MARGEM = { esq: 14, dir: 14, topo: 24, base: 26 };

const PERIODOS: { valor: PeriodoMedida; rotulo: string }[] = [
  { valor: 'semestre', rotulo: '6 meses' },
  { valor: 'ano', rotulo: 'Ano' },
  { valor: 'tudo', rotulo: 'Tudo' },
];

/** Evolução da bioimpedância e da circunferência abdominal: uma medida por vez, com o valor em cada ponto. */
@Component({
  selector: 'app-medidas-grafico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (disponiveis().length > 0) {
      <article class="card" aria-labelledby="t-med-graf">
        <div class="topo">
          <h2 id="t-med-graf" class="rot">Evolução das medidas</h2>
          <div class="periodos" role="radiogroup" aria-label="Período do gráfico">
            @for (p of periodos; track p.valor) {
              <button type="button" role="radio" [attr.aria-checked]="periodo() === p.valor" (click)="periodo.set(p.valor)">{{ p.rotulo }}</button>
            }
          </div>
        </div>

        <div class="escolha" role="radiogroup" aria-label="Medida">
          @for (m of disponiveis(); track m.chave) {
            <button type="button" role="radio" [attr.aria-checked]="medida().chave === m.chave" (click)="escolhida.set(m.chave)">{{ m.curto }}</button>
          }
        </div>

        @if (ultima(); as u) {
          <p class="grande">{{ valor(u.valor) }} <small>{{ medida().unidade }} · {{ data(u.data) }}</small></p>
        }

        @if (grafico().pontos.length > 0) {
          <p class="apoio variacao" [class.variacao--vazia]="grafico().variacao === null">{{ textoVariacao() }}</p>
          <svg class="grafico" [attr.viewBox]="'0 0 ' + largura + ' ' + altura" role="img" [attr.aria-label]="descricao()">
            <line class="grade" [attr.x1]="margem.esq" [attr.x2]="largura - margem.dir" [attr.y1]="altura - margem.base" [attr.y2]="altura - margem.base" />
            @if (grafico().pontos.length > 1) {
              <path class="linha" [attr.d]="grafico().caminho" />
            }
            @for (p of grafico().pontos; track p.data) {
              <circle class="ponto" [attr.cx]="p.cx" [attr.cy]="p.cy" r="4" />
              <text class="valor" [attr.x]="p.cx" [attr.y]="p.cy - 9" [attr.text-anchor]="p.ancora">{{ p.texto }}</text>
            }
            <text class="eixo" [attr.x]="margem.esq" [attr.y]="altura - 6" text-anchor="start">{{ grafico().inicio }}</text>
            <text class="eixo" [attr.x]="largura - margem.dir" [attr.y]="altura - 6" text-anchor="end">{{ grafico().fim }}</text>
          </svg>
        } @else {
          <p class="apoio">Nenhum registro de {{ medida().curto.toLowerCase() }} neste período.</p>
        }
      </article>
    }
  `,
  styles: `
    .card { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
    .topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .rot { font-size: 14px; font-weight: 500; color: var(--muted); margin: 0; }
    .periodos { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: var(--soft); }
    .periodos button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; font-size: 13px; font-weight: 700; color: var(--muted); }
    .periodos button[aria-checked='true'] { background: var(--ink-bg); color: var(--accent); }
    .escolha { display: flex; flex-wrap: wrap; gap: 6px; }
    .escolha button { min-height: 36px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px; background: transparent; font-size: 13px; font-weight: 700; color: var(--muted); }
    .escolha button[aria-checked='true'] { background: var(--ink-bg); border-color: var(--ink-bg); color: var(--accent); }
    .grande { font-family: var(--font-display); font-size: 32px; font-weight: 700; line-height: 1; margin: 0; }
    .grande small { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--muted); }
    .variacao { margin: 0; font-weight: 700; color: var(--ink); }
    .variacao--vazia { font-weight: 400; color: var(--muted); }
    .grafico { width: 100%; height: auto; display: block; }
    .grade { stroke: var(--soft); stroke-width: 1; }
    .eixo { font-size: 11px; fill: var(--muted); font-family: var(--font); }
    .valor { font-size: 11px; font-weight: 700; fill: var(--ink); font-family: var(--font); }
    .linha { fill: none; stroke: var(--ink); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .ponto { fill: var(--accent); stroke: var(--ink); stroke-width: 2; }
  `,
})
export class MedidasGrafico {
  private readonly servico = inject(MedidasService);
  protected readonly periodos = PERIODOS;
  protected readonly periodo = signal<PeriodoMedida>('ano');
  protected readonly escolhida = signal<ChaveMedida | null>(null);
  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;
  protected readonly margem = MARGEM;
  private readonly hoje = new Date();

  private readonly ultimas = computed(() => ultimasMedidas(this.servico.registros()));
  /** Só as medidas que a pessoa já registrou alguma vez. */
  protected readonly disponiveis = computed(() => this.ultimas().map((u) => u.medida));
  protected readonly medida = computed(() => this.disponiveis().find((m) => m.chave === this.escolhida()) ?? this.disponiveis()[0] ?? MEDIDAS[0]);
  protected readonly ultima = computed(() => this.ultimas().find((u) => u.medida.chave === this.medida().chave) ?? null);

  protected readonly grafico = computed(() => {
    const m = this.medida();
    const s = serieDeMedida(this.servico.registros(), m.chave, this.periodo(), this.hoje);
    const folga = s.maximo - s.minimo === 0 ? Math.max(Math.abs(s.maximo) * 0.05, 1) : (s.maximo - s.minimo) * 0.2;
    const min = s.minimo - folga;
    const max = s.maximo + folga;
    const x = (v: number) => MARGEM.esq + 14 + v * (LARGURA - MARGEM.esq - MARGEM.dir - 28);
    const y = (v: number) => MARGEM.topo + (1 - (v - min) / (max - min)) * (ALTURA - MARGEM.topo - MARGEM.base);
    const pontos = s.pontos.map((p) => ({
      cx: x(p.x),
      cy: y(p.valor),
      data: p.data,
      texto: formatarMedida(p.valor, m),
      ancora: p.x < 0.08 ? 'start' : p.x > 0.92 ? 'end' : 'middle',
    }));
    const caminho = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ');
    return { pontos, caminho, variacao: s.variacao, minimo: s.minimo, maximo: s.maximo, inicio: dataCurta(s.inicio, this.hoje), fim: dataCurta(s.fim, this.hoje) };
  });

  protected readonly textoVariacao = computed(() => {
    const v = this.grafico().variacao;
    if (v === null) return 'Registre mais vezes neste período para ver a variação.';
    const m = this.medida();
    if (v === 0) return 'Sem variação no período';
    return `${v > 0 ? '+' : '−'}${formatarMedida(Math.abs(v), m)} ${m.unidade} no período`;
  });

  protected readonly descricao = computed(() => {
    const n = this.grafico().pontos.length;
    return `Gráfico de ${this.medida().rotulo.toLowerCase()}: ${n} ${n === 1 ? 'registro' : 'registros'}. ${this.textoVariacao()}`;
  });

  protected valor(v: number): string {
    return formatarMedida(v, this.medida());
  }

  protected data(iso: string): string {
    return dataCurta(iso, this.hoje);
  }
}
