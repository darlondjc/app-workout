import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Medalha } from './medalha';
import { Conquista, NOMES_NIVEL, TipoConquista, formatarProgresso, fracaoAteOProximo } from './medalhas';

/**
 * Quadro com a medalha atual de cada meta. Quando a pessoa sobe de nível, a medalha nova toma o lugar da anterior
 * (não se acumulam), e a barra mostra o caminho até o próximo nível. Tocar abre a galeria.
 */
@Component({
  selector: 'app-quadro-medalhas',
  imports: [Medalha],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="quadro" aria-label="Quadro de medalhas">
      @for (c of conquistas(); track c.id) {
        <li>
          <button type="button" class="medalha-card" aria-haspopup="dialog" [attr.aria-label]="rotulo(c)" [class.medalha-card--nova]="ehNova(c)" (click)="abrir.emit(c.id)">
            <app-medalha [nivel]="c.nivel" [size]="52" />
            <span class="titulo-meta">{{ c.titulo }}</span>
            <span class="nivel" [class]="'nivel nivel--' + (c.nivel ?? 'nenhum')">
              {{ c.nivel ? nomes[c.nivel] : 'Sem medalha' }}
              @if (ehNova(c)) {
                <span class="nova">Nova</span>
              }
            </span>
            @if (c.proximo; as p) {
              <span class="trilha" aria-hidden="true"><span class="trilha__cheia" [style.width.%]="percentual(c)"></span></span>
              <span class="apoio progresso">{{ progresso(c, p.alvo) }}</span>
            } @else {
              <span class="apoio progresso">Nível máximo</span>
            }
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    .quadro {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    /* Número ímpar de medalhas: a última ocupa a linha toda, sem deixar buraco. */
    li:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }
    .medalha-card {
      width: 100%;
      height: 100%;
      padding: 14px 10px 12px;
      border: 0;
      border-radius: 16px;
      background: var(--card);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      text-align: center;
      font: inherit;
      color: inherit;
    }
    .medalha-card--nova {
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 2px var(--accent-ink);
      animation: chegou 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    @keyframes chegou {
      from { transform: scale(0.94); }
      60% { transform: scale(1.025); }
      to { transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .medalha-card--nova { animation: none; }
    }
    .titulo-meta {
      margin-top: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    .nivel {
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 700;
      line-height: 1.15;
    }
    .nivel--nenhum {
      color: var(--muted);
      font-size: 15px;
    }
    .nova {
      margin-left: 6px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--accent);
      color: var(--on-accent);
      font-family: var(--font);
      font-size: 11px;
      font-weight: 700;
      vertical-align: 2px;
    }
    .trilha {
      align-self: stretch;
      height: 6px;
      margin-top: 6px;
      border-radius: 3px;
      background: var(--soft);
      overflow: hidden;
    }
    .trilha__cheia {
      display: block;
      height: 100%;
      background: var(--progresso);
      border-radius: 3px;
    }
    .progresso {
      font-size: 12px;
      line-height: 1.3;
    }
  `,
})
export class QuadroMedalhas {
  readonly conquistas = input.required<Conquista[]>();
  /** Metas que subiram de nível e ainda não foram vistas: ganham destaque. */
  readonly novas = input<TipoConquista[]>([]);
  /** Medalha tocada (a galeria abre já rolando até ela). */
  readonly abrir = output<TipoConquista>();

  protected readonly nomes = NOMES_NIVEL;

  protected ehNova(c: Conquista): boolean {
    return !!c.nivel && this.novas().includes(c.id);
  }

  protected percentual(c: Conquista): number {
    return Math.round(fracaoAteOProximo(c) * 100);
  }

  protected progresso(c: Conquista, alvo: number): string {
    return formatarProgresso(c.id, c.atual, alvo);
  }

  protected rotulo(c: Conquista): string {
    const atual = c.nivel ? `medalha de ${NOMES_NIVEL[c.nivel].toLowerCase()}` : 'sem medalha ainda';
    const resto = c.proximo ? `${formatarProgresso(c.id, c.atual, c.proximo.alvo)} para ${NOMES_NIVEL[c.proximo.nivel].toLowerCase()}` : 'nível máximo';
    return `${c.titulo}: ${atual}, ${resto}. Abrir galeria de medalhas.`;
  }
}
