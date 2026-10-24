import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, signal } from '@angular/core';
import { dataCurta } from './data-texto';
import { Medalha } from './medalha';
import { Conquista, NOMES_NIVEL, TipoConquista, formatarProgresso, formatarValor, fracaoAteOProximo } from './medalhas';

export interface RecordeNaGaleria {
  nome: string;
  carga: number;
  data: string;
}

/**
 * Conteúdo do diálogo de medalhas: recordes recentes e, para cada meta, a medalha atual com o caminho até o
 * próximo nível e a trilha completa (bronze, prata, ouro, diamante).
 */
@Component({
  selector: 'app-medalhas-galeria',
  imports: [Medalha],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (c of conquistas(); track c.id) {
      <section class="meta" [id]="'sec-' + c.id" [class.meta--nova]="novas().includes(c.id)" [class.meta--piscando]="piscando() === c.id" [attr.aria-labelledby]="'m-' + c.id">
        <header class="meta__topo">
          <app-medalha [nivel]="c.nivel" [size]="60" />
          <div class="meta__txt">
            <h3 [id]="'m-' + c.id" class="meta__nome">{{ c.titulo }}</h3>
            <p class="meta__nivel">
              @if (c.nivel) {
                {{ nomes[c.nivel] }}@if (c.dataDoNivel) { <span class="apoio"> · desde {{ data(c.dataDoNivel) }}</span> }
              } @else {
                <span class="apoio">Sem medalha ainda</span>
              }
            </p>
            <p class="apoio">{{ c.descricao }}</p>
          </div>
        </header>

        @if (c.proximo; as p) {
          <div class="caminho">
            <span class="trilha" role="progressbar" [attr.aria-label]="'Caminho até ' + nomes[p.nivel] + ': ' + c.titulo" aria-valuemin="0" [attr.aria-valuemax]="p.alvo" [attr.aria-valuenow]="c.atual">
              <span class="trilha__cheia" [style.width.%]="percentual(c)"></span>
            </span>
            <span class="apoio">{{ progresso(c, p.alvo) }} para a medalha de {{ nomes[p.nivel].toLowerCase() }}</span>
          </div>
        } @else {
          <p class="apoio">Nível máximo alcançado. {{ valor(c, c.atual) }} no total.</p>
        }

        <ol class="degraus" aria-label="Trilha de medalhas">
          @for (d of c.degraus; track d.nivel) {
            <li class="degrau" [class.degrau--atual]="d.nivel === c.nivel" [class.degrau--bloqueado]="!d.conquistado">
              <app-medalha [nivel]="d.conquistado ? d.nivel : null" [size]="38" />
              <span class="degrau__nivel">{{ nomes[d.nivel] }}</span>
              <span class="apoio degrau__alvo">{{ valor(c, d.alvo) }}</span>
              @if (d.conquistado && d.data) {
                <span class="apoio degrau__alvo">{{ data(d.data) }}</span>
              }
            </li>
          }
        </ol>
      </section>
    }

    @if (recordes().length > 0) {
      <section class="meta" aria-labelledby="g-rec">
        <h3 id="g-rec" class="rot">Recordes pessoais recentes</h3>
        <ul class="recordes">
          @for (r of recordes(); track r.nome + r.data) {
            <li>
              <span class="recordes__nome">{{ r.nome }}</span>
              <strong>{{ kg(r.carga) }} kg</strong>
              <span class="apoio">{{ data(r.data) }}</span>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .meta { display: flex; flex-direction: column; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--soft); }
    .meta { position: relative; }
    .meta--nova .meta__nivel::after {
      content: 'Nova';
      margin-left: 8px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--accent);
      color: var(--ink);
      font-size: 11px;
      font-weight: 700;
      vertical-align: 1px;
    }
    /* Piscar: um halo que acende duas vezes e some, só com opacidade e sombra (barato e suave). */
    .meta::before {
      content: '';
      position: absolute;
      inset: -8px -10px 2px;
      border-radius: 18px;
      background: color-mix(in srgb, var(--accent) 45%, transparent);
      box-shadow: 0 0 0 2px var(--accent-ink);
      opacity: 0;
      pointer-events: none;
    }
    .meta--piscando::before { animation: piscar 1.6s cubic-bezier(0.4, 0, 0.2, 1) both; }
    @keyframes piscar {
      0% { opacity: 0; }
      15% { opacity: 1; }
      40% { opacity: 0.15; }
      60% { opacity: 1; }
      100% { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .meta--piscando::before { animation: piscar-simples 1.6s linear both; }
      @keyframes piscar-simples { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }
    }
    .meta > * { position: relative; }
    .meta:last-child { border-bottom: 0; padding-bottom: 0; }
    .meta__topo { display: flex; align-items: center; gap: 14px; }
    .meta__txt { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .meta__nome { margin: 0; font-family: var(--font-display); font-size: 18px; line-height: 1.2; }
    .meta__nivel { margin: 0; font-weight: 700; font-size: 15px; }
    .rot { margin: 0; font-size: 14px; font-weight: 500; color: var(--muted); }
    .caminho { display: flex; flex-direction: column; gap: 6px; }
    .trilha { display: block; height: 8px; border-radius: 4px; background: var(--soft); overflow: hidden; }
    .trilha__cheia { display: block; height: 100%; background: var(--ink); border-radius: 4px; }
    .degraus { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .degrau { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 2px; border-radius: 12px; text-align: center; }
    .degrau--atual { background: #f1f8cf; box-shadow: inset 0 0 0 1.5px var(--accent-ink); }
    .degrau__nivel { margin-top: 4px; font-size: 13px; font-weight: 700; }
    .degrau--bloqueado .degrau__nivel { color: var(--muted); font-weight: 500; }
    .degrau__alvo { font-size: 11px; line-height: 1.25; }
    .recordes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .recordes li { display: flex; align-items: baseline; gap: 10px; font-size: 14px; }
    .recordes__nome { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  `,
})
export class MedalhasGaleria {
  readonly conquistas = input.required<Conquista[]>();
  readonly recordes = input<RecordeNaGaleria[]>([]);
  /** Meta para rolar até ela e piscar assim que a galeria abre. */
  readonly foco = input<TipoConquista | null>(null);
  /** Metas com nível novo: ficam realçadas. */
  readonly novas = input<TipoConquista[]>([]);

  protected readonly piscando = signal<TipoConquista | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private quadro = 0;
  private timer = 0;

  constructor() {
    afterNextRender(() => {
      const id = this.foco();
      if (id) this.irPara(id);
    });
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.quadro);
      clearTimeout(this.timer);
    });
  }

  /** Rola o corpo do diálogo até a seção, com ease-in-out, e então faz a seção piscar. */
  private irPara(id: TipoConquista): void {
    const alvo = this.host.nativeElement.querySelector<HTMLElement>('#sec-' + id);
    const rolavel = this.rolavelDe(this.host.nativeElement);
    if (!alvo || !rolavel) return;
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const topoAlvo = alvo.getBoundingClientRect().top - rolavel.getBoundingClientRect().top + rolavel.scrollTop;
    // Centraliza a seção na área visível, sem passar do fim.
    const desejado = topoAlvo - (rolavel.clientHeight - alvo.offsetHeight) / 2;
    const fim = Math.max(0, Math.min(desejado, rolavel.scrollHeight - rolavel.clientHeight));
    const ini = rolavel.scrollTop;
    const dist = fim - ini;
    const piscar = () => {
      this.piscando.set(id);
      this.timer = window.setTimeout(() => this.piscando.set(null), 1700);
    };
    if (reduzido || Math.abs(dist) < 4) {
      rolavel.scrollTop = fim;
      piscar();
      return;
    }
    const duracao = Math.min(900, 420 + Math.abs(dist) * 0.45);
    // Pequena pausa para o diálogo terminar de abrir antes de a tela começar a andar.
    this.timer = window.setTimeout(() => {
      const t0 = performance.now();
      const passo = (agora: number) => {
        const k = Math.min(1, (agora - t0) / duracao);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        rolavel.scrollTop = ini + dist * e;
        if (k < 1) this.quadro = requestAnimationFrame(passo);
        else piscar();
      };
      this.quadro = requestAnimationFrame(passo);
    }, 260);
  }

  private rolavelDe(el: HTMLElement): HTMLElement | null {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  }

  protected readonly nomes = NOMES_NIVEL;

  protected percentual(c: Conquista): number {
    return Math.round(fracaoAteOProximo(c) * 100);
  }

  protected valor(c: Conquista, v: number): string {
    return formatarValor(c.id, v);
  }

  protected progresso(c: Conquista, alvo: number): string {
    return formatarProgresso(c.id, c.atual, alvo);
  }

  protected kg(v: number): string {
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  protected data(iso: string): string {
    return dataCurta(iso);
  }
}
