import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { dataCurta } from './data-texto';
import { Medalha } from './medalha';
import { Conquista, NOMES_NIVEL, formatarProgresso, formatarValor, fracaoAteOProximo } from './medalhas';

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
      <section class="meta" [attr.aria-labelledby]="'m-' + c.id">
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
