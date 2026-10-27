import { ChangeDetectionStrategy, Component, Injector, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { dataCurta, formatarKg } from './data-texto';
import { RegistroPeso } from './models';
import { PesoService } from './peso.service';
import { PeriodoPeso, serieDePeso } from './peso';

const LARGURA = 320;
const ALTURA = 150;
const MARGEM = { esq: 42, dir: 14, topo: 14, base: 26 };

const PERIODOS: { valor: PeriodoPeso; rotulo: string; sufixo: string }[] = [
  { valor: 'semana', rotulo: 'Semana', sufixo: 'na semana' },
  { valor: 'mes', rotulo: 'Mês', sufixo: 'no mês' },
  { valor: 'ano', rotulo: 'Ano', sufixo: 'no ano' },
];

/** Evolução do peso corporal: linha com botões para ver a semana, o mês ou o ano. */
@Component({
  selector: 'app-peso-grafico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" aria-labelledby="t-peso-graf">
      <div class="topo">
        <h2 id="t-peso-graf" class="rot">Evolução do peso</h2>
        <div class="periodos" role="radiogroup" aria-label="Período do gráfico">
          @for (p of periodos; track p.valor) {
            <button type="button" role="radio" [attr.aria-checked]="periodo() === p.valor" (click)="periodo.set(p.valor)">{{ p.rotulo }}</button>
          }
        </div>
      </div>

      @if (atual(); as a) {
        <p class="grande">{{ kg(a.kg) }} <small>kg · {{ data(a.data) }}</small></p>
        @if (grafico().pontos.length > 0) {
          <p class="apoio variacao" [class.variacao--vazia]="grafico().variacao === null">{{ textoVariacao() }}</p>
          <svg class="grafico" [attr.viewBox]="'0 0 ' + largura + ' ' + altura" role="img" [attr.aria-label]="descricao()">
            @for (l of grafico().linhas; track l.kg) {
              <line class="grade" [attr.x1]="margem.esq" [attr.x2]="largura - margem.dir" [attr.y1]="l.y" [attr.y2]="l.y" />
              <text class="eixo" [attr.x]="margem.esq - 6" [attr.y]="l.y + 4" text-anchor="end">{{ kg(l.kg) }}</text>
            }
            @if (grafico().pontos.length > 1) {
              <path class="linha-peso" [attr.d]="grafico().caminho" />
            }
            @for (p of grafico().pontos; track p.rotulo) {
              <circle class="ponto-peso" [attr.cx]="p.cx" [attr.cy]="p.cy" r="4" />
            }
            <text class="eixo" [attr.x]="margem.esq" [attr.y]="altura - 6" text-anchor="start">{{ grafico().inicio }}</text>
            <text class="eixo" [attr.x]="largura - margem.dir" [attr.y]="altura - 6" text-anchor="end">{{ grafico().fim }}</text>
          </svg>
          @if (periodo() === 'ano') {
            <p class="apoio nota">Cada ponto é a média do mês.</p>
          }
        } @else {
          <p class="apoio">Nenhum registro {{ nomePeriodo() }}.{{ somenteLeitura() ? '' : ' Registre o peso em Perfil.' }}</p>
        }
      } @else if (somenteLeitura()) {
        <p class="apoio">Ainda não há registros de peso.</p>
      } @else {
        <p class="apoio">Registre o seu peso em Perfil para acompanhar a evolução aqui.</p>
        <button type="button" class="btn btn--claro" (click)="irParaAjustes()">Registrar peso</button>
      }
    </article>
  `,
  styles: `
    .card { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
    .topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .rot { font-size: 14px; font-weight: 500; color: var(--muted); margin: 0; }
    .periodos { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: var(--soft); }
    .periodos button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; font-size: 13px; font-weight: 700; color: var(--muted); }
    .periodos button[aria-checked='true'] { background: var(--ink-bg); color: var(--accent); }
    .grande { font-family: var(--font-display); font-size: 32px; font-weight: 700; line-height: 1; margin: 0; }
    .grande small { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--muted); }
    .variacao { margin: 0; font-weight: 700; color: var(--ink); }
    .variacao--vazia { font-weight: 400; color: var(--muted); }
    .nota { font-size: 12px; margin: 0; }
    .grafico { width: 100%; height: auto; display: block; }
    .grade { stroke: var(--soft); stroke-width: 1; }
    .eixo { font-size: 11px; fill: var(--muted); font-family: var(--font); }
    .linha-peso { fill: none; stroke: var(--ink); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .ponto-peso { fill: var(--accent); stroke: var(--ink); stroke-width: 2; }
  `,
})
export class PesoGrafico {
  private readonly peso = inject(PesoService);
  /** Registros de outra pessoa (amigo que compartilha o peso); sem isto, mostra os da própria pessoa. */
  readonly registros = input<RegistroPeso[] | null>(null);
  /** Sem o botão de registrar peso (o gráfico é de outra pessoa). */
  readonly somenteLeitura = input(false);
  private readonly lista = computed(() => this.registros() ?? this.peso.registros());
  protected readonly atual = computed(() => this.lista().at(-1) ?? null);
  /** O roteador só é pedido no clique: o gráfico também aparece em telas montadas sem rotas. */
  private readonly injector = inject(Injector);
  protected readonly periodos = PERIODOS;
  protected readonly periodo = signal<PeriodoPeso>('mes');
  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;
  protected readonly margem = MARGEM;
  private readonly hoje = new Date();

  protected readonly grafico = computed(() => {
    const s = serieDePeso(this.lista(), this.periodo(), this.hoje);
    const folga = s.maximo - s.minimo < 0.5 ? 1 : (s.maximo - s.minimo) * 0.2;
    const min = s.minimo - folga;
    const max = s.maximo + folga;
    const x = (v: number) => MARGEM.esq + v * (LARGURA - MARGEM.esq - MARGEM.dir);
    const y = (kg: number) => MARGEM.topo + (1 - (kg - min) / (max - min)) * (ALTURA - MARGEM.topo - MARGEM.base);
    const pontos = s.pontos.map((p) => ({ cx: x(p.x), cy: y(p.kg), kg: p.kg, rotulo: p.rotulo }));
    const caminho = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ');
    const extremos = s.minimo === s.maximo ? [s.maximo] : [s.maximo, s.minimo];
    return {
      pontos,
      caminho,
      linhas: extremos.map((kg) => ({ kg, y: y(kg) })),
      inicio: s.inicio,
      fim: s.fim,
      variacao: s.variacao,
      minimo: s.minimo,
      maximo: s.maximo,
    };
  });

  protected readonly textoVariacao = computed(() => {
    const v = this.grafico().variacao;
    if (v === null) return 'Registre mais pesos neste período para ver a variação.';
    const sufixo = PERIODOS.find((p) => p.valor === this.periodo())?.sufixo ?? '';
    if (v === 0) return `Sem variação ${sufixo}`;
    return `${v > 0 ? '+' : '−'}${formatarKg(Math.abs(v))} kg ${sufixo}`;
  });

  protected readonly descricao = computed(() => {
    const g = this.grafico();
    const n = g.pontos.length;
    return `Gráfico do peso: ${n} ${n === 1 ? 'registro' : 'registros'}, entre ${formatarKg(g.minimo)} e ${formatarKg(g.maximo)} kg. ${this.textoVariacao()}`;
  });

  protected irParaAjustes(): void {
    void this.injector.get(Router).navigateByUrl('/perfil');
  }

  protected nomePeriodo(): string {
    return { semana: 'nesta semana', mes: 'neste mês', ano: 'neste ano' }[this.periodo()];
  }

  protected kg(v: number): string {
    return formatarKg(v);
  }

  protected data(iso: string): string {
    return dataCurta(iso, this.hoje);
  }
}
