import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Nivel } from './medalhas';

let contador = 0;

interface Tema {
  claro: string;
  escuro: string;
  fita: string;
  fitaEscura: string;
  anel: string;
  estrela: string;
}

const TEMAS: Record<Nivel | 'bloqueada', Tema> = {
  bronze: { claro: '#e8ab7c', escuro: '#a05e32', fita: '#b9693c', fitaEscura: '#8a4b27', anel: '#f6cfae', estrela: '#fbe3cd' },
  prata: { claro: '#fafbfc', escuro: '#98a3b0', fita: '#7a8aa0', fitaEscura: '#5f6f86', anel: '#ffffff', estrela: '#ffffff' },
  ouro: { claro: '#ffe985', escuro: '#d19700', fita: '#c4452f', fitaEscura: '#9c3322', anel: '#fff3b8', estrela: '#fff8d6' },
  diamante: { claro: '#d4f6ff', escuro: '#379ae6', fita: '#2c6fbd', fitaEscura: '#1f4f8f', anel: '#ffffff', estrela: '#ffffff' },
  bloqueada: { claro: '#eef0e9', escuro: '#e0e3da', fita: '#d6d9cf', fitaEscura: '#c9cdc3', anel: '#cfd3c8', estrela: '#cfd3c8' },
};

/** Pontos de um polígono em forma de estrela: `pontas` pontas, entre o raio externo `R` e o interno `r`. */
function estrela(cx: number, cy: number, R: number, r: number, pontas = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < pontas * 2; i++) {
    const raio = i % 2 === 0 ? R : r;
    const ang = (Math.PI * i) / pontas - Math.PI / 2;
    pts.push(`${(cx + raio * Math.cos(ang)).toFixed(2)},${(cy + raio * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const ESTRELA_PEQUENA = estrela(32, 28, 8, 3.4);
const ESTRELA_MEDIA = estrela(32, 28, 10.5, 4.4);
const ESTRELA_GRANDE = estrela(32, 28, 12.5, 5.2);
const EXPLOSAO = estrela(32, 28, 29, 21, 12);
const BRILHOS = [
  estrela(10, 9, 5.5, 1.3, 4),
  estrela(55, 14, 4, 1, 4),
  estrela(52, 50, 3.2, 0.8, 4),
];
/** Bolinhas da borda festonada do ouro. */
const FESTAO = Array.from({ length: 14 }, (_, i) => {
  const ang = (2 * Math.PI * i) / 14;
  return { cx: +(32 + 23 * Math.cos(ang)).toFixed(2), cy: +(28 + 23 * Math.sin(ang)).toFixed(2) };
});

/**
 * Medalha desenhada em SVG. O nível muda o acabamento, cada vez mais elaborado: bronze liso, prata com anel duplo e
 * brilho, ouro com borda festonada e estrela maior, diamante com pontas em volta e brilhos. Sem nível, aparece
 * apagada (ainda não conquistada). Decorativa: o nome do nível vai sempre em texto ao lado.
 */
@Component({
  selector: 'app-medalha',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 64 76" [attr.width]="size()" [attr.height]="(size() * 76) / 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient [attr.id]="idDisco" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" [attr.stop-color]="t().claro" />
          <stop offset="1" [attr.stop-color]="t().escuro" />
        </linearGradient>
      </defs>

      <polygon points="20,34 34,34 30,70 24,62 16,66" [attr.fill]="t().fita" />
      <polygon points="44,34 30,34 34,70 40,62 48,66" [attr.fill]="t().fitaEscura" />

      @switch (nivel()) {
        @case ('bronze') {
          <circle cx="32" cy="28" r="22" [attr.fill]="'url(#' + idDisco + ')'" [attr.stroke]="t().escuro" stroke-width="1.5" />
          <circle cx="32" cy="28" r="16.5" fill="none" [attr.stroke]="t().anel" stroke-width="1.6" />
          <polygon [attr.points]="estrelaPequena" [attr.fill]="t().estrela" [attr.stroke]="t().escuro" stroke-width="0.8" stroke-linejoin="round" />
        }
        @case ('prata') {
          <circle cx="32" cy="28" r="22" [attr.fill]="'url(#' + idDisco + ')'" [attr.stroke]="t().escuro" stroke-width="1.5" />
          <circle cx="32" cy="28" r="17" fill="none" [attr.stroke]="t().anel" stroke-width="1.8" />
          <circle cx="32" cy="28" r="13.5" fill="none" [attr.stroke]="t().escuro" stroke-width="0.8" stroke-opacity="0.6" />
          <path d="M15 20 A19 19 0 0 1 30 9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-opacity="0.85" />
          <polygon [attr.points]="estrelaMedia" [attr.fill]="t().estrela" [attr.stroke]="t().escuro" stroke-width="0.9" stroke-linejoin="round" />
        }
        @case ('ouro') {
          @for (b of festao; track $index) {
            <circle [attr.cx]="b.cx" [attr.cy]="b.cy" r="4.4" [attr.fill]="t().escuro" />
          }
          <circle cx="32" cy="28" r="22" [attr.fill]="'url(#' + idDisco + ')'" [attr.stroke]="t().escuro" stroke-width="1.5" />
          <circle cx="32" cy="28" r="17.5" fill="none" [attr.stroke]="t().anel" stroke-width="2" />
          <circle cx="32" cy="28" r="14" fill="none" [attr.stroke]="t().escuro" stroke-width="0.8" stroke-opacity="0.55" />
          <path d="M14.5 20 A20 20 0 0 1 29 8.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.9" />
          <polygon [attr.points]="estrelaGrande" [attr.fill]="t().estrela" [attr.stroke]="t().escuro" stroke-width="1" stroke-linejoin="round" />
        }
        @case ('diamante') {
          <circle cx="32" cy="28" r="31" [attr.fill]="t().claro" fill-opacity="0.22" />
          <polygon [attr.points]="explosao" [attr.fill]="'url(#' + idDisco + ')'" [attr.stroke]="t().escuro" stroke-width="1.2" stroke-linejoin="round" />
          <circle cx="32" cy="28" r="19.5" [attr.fill]="'url(#' + idDisco + ')'" [attr.stroke]="'#ffffff'" stroke-width="2" />
          <circle cx="32" cy="28" r="15.5" fill="none" [attr.stroke]="t().escuro" stroke-width="0.9" stroke-opacity="0.6" />
          <path d="M16 19 A18 18 0 0 1 29 10" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.95" />
          <polygon [attr.points]="estrelaGrande" [attr.fill]="t().estrela" [attr.stroke]="t().escuro" stroke-width="1" stroke-linejoin="round" />
          @for (b of brilhos; track $index) {
            <polygon [attr.points]="b" fill="#ffffff" [attr.stroke]="t().escuro" stroke-width="0.6" stroke-linejoin="round" />
          }
        }
        @default {
          <circle cx="32" cy="28" r="22" [attr.fill]="t().claro" [attr.stroke]="t().anel" stroke-width="2" stroke-dasharray="4 4" />
          <polygon [attr.points]="estrelaMedia" fill="none" [attr.stroke]="t().estrela" stroke-width="1.6" stroke-linejoin="round" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      flex: none;
    }
  `,
})
export class Medalha {
  /** `null` = ainda não conquistada. */
  readonly nivel = input<Nivel | null>(null);
  /** Largura em pixels; a altura acompanha. */
  readonly size = input(56);

  protected readonly idDisco = `medalha-disco-${++contador}`;
  protected readonly t = computed(() => TEMAS[this.nivel() ?? 'bloqueada']);

  protected readonly estrelaPequena = ESTRELA_PEQUENA;
  protected readonly estrelaMedia = ESTRELA_MEDIA;
  protected readonly estrelaGrande = ESTRELA_GRANDE;
  protected readonly explosao = EXPLOSAO;
  protected readonly brilhos = BRILHOS;
  protected readonly festao = FESTAO;
}
