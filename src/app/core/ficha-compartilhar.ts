import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import qrcode from 'qrcode-generator';
import { Dialogo } from './dialogo';
import { FichaCompartilhada, MAX_LINK_PARA_QR, codificarFicha, linkDaFicha } from './ficha-link';
import { Icon } from './icon';

/** Diálogo para mandar uma ficha a outra pessoa: compartilhar, copiar o link ou mostrar o QR code. */
@Component({
  selector: 'app-ficha-compartilhar',
  imports: [Dialogo, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo titulo="Compartilhar ficha" [subtitulo]="ficha().nome" (fechar)="fechar.emit()">
      @if (link(); as l) {
        <p class="apoio">
          Quem abrir o link vê a ficha, com {{ resumo() }}, e escolhe se quer adicionar às próprias fichas. Os seus treinos e dados não vão junto.
        </p>
        <div class="acoes">
          @if (podeCompartilhar) {
            <button type="button" class="btn btn--escuro" (click)="enviar(l)"><app-icon name="share" [size]="18" [stroke]="2.2" /> Compartilhar</button>
          }
          <button type="button" class="btn btn--claro" (click)="copiar(l)">
            <app-icon name="copy" [size]="18" [stroke]="2.2" /> {{ copiado() ? 'Link copiado' : 'Copiar link' }}
          </button>
        </div>
        @if (qr(); as q) {
          <div class="qr" role="img" [attr.aria-label]="'QR code da ficha ' + ficha().nome">
            <svg [attr.viewBox]="q.viewBox" shape-rendering="crispEdges" aria-hidden="true">
              <rect width="100%" height="100%" fill="#fff" />
              <path [attr.d]="q.caminho" fill="#000" />
            </svg>
          </div>
          <p class="apoio centro">Ou peça para a pessoa apontar a câmera do celular para este código.</p>
        } @else {
          <p class="apoio">Esta ficha é grande demais para caber num QR code legível. Use o link.</p>
        }
        @if (erro()) {
          <p class="erro" role="alert">{{ erro() }}</p>
        }
      } @else {
        <p class="apoio" role="status">Gerando o link…</p>
      }
    </app-dialogo>
  `,
  styles: `
    .acoes { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; }
    .acoes .btn { flex: 1 1 140px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
    .qr { display: flex; justify-content: center; padding: 12px; background: #fff; border-radius: 12px; margin-bottom: 12px; }
    .qr svg { width: min(260px, 100%); height: auto; }
    .centro { text-align: center; margin: 0; }
    .erro { color: var(--perigo); font-size: 14px; }
  `,
})
export class FichaCompartilhar {
  readonly ficha = input.required<FichaCompartilhada>();
  readonly fechar = output<void>();

  protected readonly link = signal<string | null>(null);
  protected readonly copiado = signal(false);
  protected readonly erro = signal('');
  protected readonly podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.share;

  protected readonly resumo = computed(() => {
    const t = this.ficha().treinos;
    const ex = t.reduce((n, x) => n + x.itens.length, 0);
    return `${t.length} ${t.length === 1 ? 'treino' : 'treinos'} e ${ex} ${ex === 1 ? 'exercício' : 'exercícios'}`;
  });

  /** QR code do link como um único caminho SVG, com a margem de 4 módulos que a leitura pede. */
  protected readonly qr = computed(() => {
    const l = this.link();
    if (!l || l.length > MAX_LINK_PARA_QR) return null;
    const qr = qrcode(0, 'L');
    qr.addData(l);
    qr.make();
    const n = qr.getModuleCount();
    const margem = 4;
    let caminho = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) caminho += `M${x + margem} ${y + margem}h1v1h-1z`;
    return { viewBox: `0 0 ${n + margem * 2} ${n + margem * 2}`, caminho };
  });

  constructor() {
    effect(() => {
      const f = this.ficha();
      void codificarFicha(f).then((c) => this.link.set(linkDaFicha(document.baseURI.split(/[?#]/)[0].replace(/[^/]*$/, ''), c)));
    });
  }

  protected async enviar(l: string): Promise<void> {
    try {
      await navigator.share({ title: this.ficha().nome, text: `Ficha "${this.ficha().nome}" no App Workout`, url: l });
    } catch {
      // compartilhamento cancelado
    }
  }

  protected async copiar(l: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(l);
      this.erro.set('');
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      this.erro.set('Não deu para copiar. Use Compartilhar ou o QR code.');
    }
  }
}
