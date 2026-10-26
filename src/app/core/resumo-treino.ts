import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Dialogo } from './dialogo';
import { Icon } from './icon';
import { Medalha } from './medalha';
import { kcalNumero } from './calorias';
import { NOMES_NIVEL, Nivel } from './medalhas';

export interface MedalhaDoResumo {
  titulo: string;
  nivel: Nivel;
}

export interface DadosResumo {
  nome: string;
  exercicios: number;
  series: number;
  /** Carga total em kg (0 quando o treino não teve carga, como o cardio). */
  volume: number;
  /** Calorias estimadas; ausente ou `null` quando não deu para estimar. */
  kcal?: number | null;
  /** Sem peso registrado, o resumo convida a registrar em vez de mostrar calorias. */
  semPeso?: boolean;
  medalhas: MedalhaDoResumo[];
}

/**
 * Janela que aparece ao concluir um treino: um parabéns, os números principais e, se o treino rendeu medalhas
 * novas, elas centralizadas (com rolagem horizontal quando passam de três).
 */
@Component({
  selector: 'app-resumo-treino',
  imports: [Dialogo, Icon, Medalha],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo titulo="Treino concluído" [subtitulo]="dados().nome" (fechar)="ok.emit()">
      <div class="selo" aria-hidden="true"><app-icon name="check" [size]="30" [stroke]="3" /></div>
      <p class="parabens">Bom trabalho! Mais um treino no histórico.</p>

      <dl class="numeros">
        <div>
          <dt>{{ dados().exercicios === 1 ? 'Exercício' : 'Exercícios' }}</dt>
          <dd>{{ dados().exercicios }}</dd>
        </div>
        <div>
          <dt>{{ dados().series === 1 ? 'Série' : 'Séries' }}</dt>
          <dd>{{ dados().series }}</dd>
        </div>
        @if (dados().volume > 0) {
          <div>
            <dt>Carga total</dt>
            <dd>{{ volume() }} <small>kg</small></dd>
          </div>
        }
        @if (dados().kcal; as k) {
          <div class="kcal">
            <dt>Calorias</dt>
            <dd>≈ {{ kcal(k) }} <small>kcal</small></dd>
          </div>
        }
      </dl>
      @if (dados().semPeso) {
        <p class="apoio dica">Registre seu peso no Perfil para ver as calorias estimadas do treino.</p>
      }

      @if (dados().medalhas.length > 0) {
        <section class="medalhas" aria-labelledby="resumo-medalhas">
          <h3 id="resumo-medalhas" class="rot">{{ dados().medalhas.length === 1 ? 'Medalha nova' : 'Medalhas novas' }}</h3>
          <ul class="faixa" tabindex="0" aria-label="Medalhas conquistadas neste treino">
            @for (m of dados().medalhas; track m.titulo) {
              <li class="item">
                <app-medalha [nivel]="m.nivel" [size]="64" />
                <span class="item__nivel">{{ nomes[m.nivel] }}</span>
                <span class="apoio item__meta">{{ m.titulo }}</span>
              </li>
            }
          </ul>
        </section>
      }

      <button type="button" class="btn btn--destaque ok" (click)="ok.emit()">OK</button>
    </app-dialogo>
  `,
  styles: `
    :host { display: contents; }
    .selo { width: 56px; height: 56px; margin: 4px auto 10px; border-radius: 50%; background: var(--accent); color: var(--ink); display: flex; align-items: center; justify-content: center; animation: selo 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes selo { from { transform: scale(0.6); opacity: 0; } to { transform: none; opacity: 1; } }
    .parabens { margin: 0 0 14px; text-align: center; color: var(--muted); }
    .numeros { display: flex; justify-content: center; gap: 8px; margin: 0 0 18px; }
    .numeros div { flex: 1; min-width: 0; max-width: 130px; padding: 10px 6px; border-radius: 14px; background: var(--soft); text-align: center; }
    .numeros dt { font-size: 12px; color: var(--muted); }
    .numeros dd { margin: 2px 0 0; font-family: var(--font-display); font-size: 22px; font-weight: 700; }
    .numeros small { font-family: var(--font); font-size: 12px; font-weight: 500; color: var(--muted); }
    .dica { margin: -8px 0 16px; text-align: center; }
    .medalhas { margin-bottom: 18px; }
    .rot { margin: 0 0 8px; font-size: 14px; font-weight: 500; color: var(--muted); text-align: center; }
    /* "safe center": centraliza quando cabe e, quando passa, deixa rolar desde a primeira medalha. */
    .faixa { list-style: none; margin: 0 -20px; padding: 6px 20px 10px; display: flex; justify-content: safe center; gap: 10px; overflow-x: auto; scroll-snap-type: x proximity; scroll-padding-inline: 20px; scrollbar-width: none; overscroll-behavior-x: contain; }
    .faixa::-webkit-scrollbar { display: none; }
    .item { flex: none; width: 100px; padding: 12px 6px; border-radius: 16px; background: #f6fbdc; box-shadow: inset 0 0 0 2px var(--accent-ink); display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; scroll-snap-align: center; animation: chega 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    .item:nth-child(2) { animation-delay: 0.1s; }
    .item:nth-child(3) { animation-delay: 0.2s; }
    .item:nth-child(n + 4) { animation-delay: 0.3s; }
    @keyframes chega { from { transform: translateY(10px) scale(0.92); opacity: 0; } to { transform: none; opacity: 1; } }
    .item__nivel { margin-top: 6px; font-family: var(--font-display); font-size: 16px; font-weight: 700; }
    .item__meta { font-size: 12px; line-height: 1.25; }
    .ok { width: 100%; }
    @media (prefers-reduced-motion: reduce) { .selo, .item { animation: none; } }
  `,
})
export class ResumoTreino {
  readonly dados = input.required<DadosResumo>();
  readonly ok = output<void>();

  protected readonly nomes = NOMES_NIVEL;

  protected kcal(valor: number): string {
    return kcalNumero(valor);
  }

  protected volume(): string {
    return this.dados().volume.toLocaleString('pt-BR');
  }
}
