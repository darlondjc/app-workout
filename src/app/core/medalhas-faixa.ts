import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Medalha } from './medalha';
import { Conquista, NOMES_NIVEL, TipoConquista } from './medalhas';

/** Só as medalhas conquistadas, lado a lado, com rolagem horizontal. Tocar em uma abre a galeria. */
@Component({
  selector: 'app-medalhas-faixa',
  imports: [Medalha],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ganhas().length) {
      <ul class="faixa" aria-label="Medalhas conquistadas">
        @for (c of ganhas(); track c.id) {
          <li>
            <button type="button" class="item" aria-haspopup="dialog" [attr.aria-label]="c.titulo + ', ' + nomes[c.nivel!]" (click)="abrir.emit(c.id)">
              <app-medalha [nivel]="c.nivel" [size]="56" />
              <span class="titulo-meta">{{ c.titulo }}</span>
              <span class="nivel" [class]="'nivel nivel--' + c.nivel">{{ nomes[c.nivel!] }}</span>
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="apoio vazio">Ainda sem medalhas conquistadas.</p>
    }
  `,
  styles: `
    .faixa { display: flex; gap: 10px; margin: 0 -20px; padding: 2px 20px 8px; list-style: none; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; }
    .faixa::-webkit-scrollbar { display: none; }
    li { flex: none; scroll-snap-align: start; }
    .item { width: 104px; min-height: 124px; padding: 12px 8px; border: 0; border-radius: 16px; background: var(--card); font: inherit; color: var(--ink); display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
    .titulo-meta { font-size: 13px; font-weight: 700; line-height: 1.2; }
    .nivel { font-size: 12px; font-weight: 700; color: var(--muted); }
    .vazio { margin: 0; }
  `,
})
export class MedalhasFaixa {
  readonly conquistas = input.required<Conquista[]>();
  readonly abrir = output<TipoConquista>();

  protected readonly nomes = NOMES_NIVEL;
  protected readonly ganhas = computed(() => this.conquistas().filter((c) => c.nivel !== null));
}
