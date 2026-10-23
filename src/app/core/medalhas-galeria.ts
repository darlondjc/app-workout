import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { dataCurta } from './data-texto';
import { Icon } from './icon';
import { GrupoMedalha, Medalha, NOMES_GRUPO } from './medalhas';

export interface RecordeNaGaleria {
  nome: string;
  carga: number;
  data: string;
}

const ORDEM_GRUPOS: GrupoMedalha[] = ['recordes', 'marcos', 'constancia', 'volume'];

function carga(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` : `${Math.round(kg)} kg`;
}

/** Conteúdo do diálogo de conquistas: recordes recentes e todas as medalhas, as não conquistadas em cinza com o progresso. */
@Component({
  selector: 'app-medalhas-galeria',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recordes().length > 0) {
      <section class="secao" aria-labelledby="g-rec">
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

    @for (g of grupos(); track g.chave) {
      <section class="secao" [attr.aria-labelledby]="'g-' + g.chave">
        <h3 [id]="'g-' + g.chave" class="rot">{{ g.nome }} · {{ g.conquistadas }} de {{ g.itens.length }}</h3>
        <ul class="medalhas">
          @for (m of g.itens; track m.id) {
            <li class="medalha" [class.medalha--bloqueada]="!m.conquistada">
              <span [class]="'selo selo--' + m.grupo" aria-hidden="true"><app-icon name="medal" [size]="22" [stroke]="2" /></span>
              <span class="medalha__txt">
                <strong>{{ m.titulo }}@if (m.conquistada && m.data === hoje()) { <span class="nova">Nova</span> }</strong>
                <span class="apoio">{{ m.descricao }}</span>
                @if (m.conquistada) {
                  @if (m.data) {
                    <span class="apoio data">Conquistada em {{ data(m.data) }}</span>
                  } @else {
                    <span class="apoio data">Conquistada</span>
                  }
                } @else {
                  <span class="trilha" role="progressbar" [attr.aria-label]="'Progresso: ' + m.titulo" aria-valuemin="0" [attr.aria-valuemax]="m.alvo" [attr.aria-valuenow]="m.atual">
                    <span class="trilha__cheia" [style.width.%]="percentual(m)"></span>
                  </span>
                  <span class="apoio data">{{ progresso(m) }}</span>
                }
              </span>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 18px; }
    .secao { display: flex; flex-direction: column; gap: 8px; }
    .rot { margin: 0; font-size: 14px; font-weight: 500; color: var(--muted); }
    .recordes, .medalhas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .recordes li { display: flex; align-items: baseline; gap: 10px; font-size: 14px; }
    .recordes__nome { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .medalha { display: flex; align-items: flex-start; gap: 12px; }
    .medalha__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .medalha__txt strong { font-size: 15px; line-height: 1.25; }
    .data { font-size: 12px; }
    .nova { margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: var(--accent); color: var(--ink); font-size: 11px; font-weight: 700; vertical-align: 1px; }
    .selo { flex: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--ink); color: var(--accent); }
    .selo--recordes { background: var(--accent); color: var(--ink); }
    .selo--constancia { background: #2f6f4f; color: #fff; }
    .selo--volume { background: #3b4a8a; color: #fff; }
    .medalha--bloqueada .selo { background: var(--soft); color: var(--muted); }
    .medalha--bloqueada strong { color: var(--muted); }
    .trilha { display: block; height: 6px; margin-top: 4px; border-radius: 3px; background: var(--soft); overflow: hidden; }
    .trilha__cheia { display: block; height: 100%; background: var(--ink); border-radius: 3px; }
  `,
})
export class MedalhasGaleria {
  readonly medalhas = input.required<Medalha[]>();
  readonly recordes = input<RecordeNaGaleria[]>([]);
  /** Dia de hoje (yyyy-mm-dd), para destacar o que foi conquistado hoje. */
  readonly hoje = input<string>('');

  protected readonly grupos = computed(() =>
    ORDEM_GRUPOS.map((chave) => {
      const itens = this.medalhas().filter((m) => m.grupo === chave);
      return { chave, nome: NOMES_GRUPO[chave], itens, conquistadas: itens.filter((m) => m.conquistada).length };
    }).filter((g) => g.itens.length > 0),
  );

  protected percentual(m: Medalha): number {
    return Math.min(100, Math.round((m.atual / m.alvo) * 100));
  }

  protected progresso(m: Medalha): string {
    return m.grupo === 'volume' ? `${carga(m.atual)} de ${carga(m.alvo)}` : `${m.atual} de ${m.alvo}`;
  }

  protected kg(v: number): string {
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  protected data(iso: string): string {
    return dataCurta(iso);
  }
}
