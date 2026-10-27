import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { Dialogo } from './dialogo';
import { lerQr } from './qr-leitura';

/** Diálogo que abre a câmera traseira e procura um QR code. Emite o texto lido e fecha. */
@Component({
  selector: 'app-qr-leitor',
  imports: [Dialogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo titulo="Escanear QR code" subtitulo="Aponte a câmera para o QR da ficha" (fechar)="fechar.emit()">
      @if (erro(); as e) {
        <p class="erro" role="alert">{{ e }}</p>
      } @else {
        <div class="visor">
          <video #video playsinline muted aria-label="Imagem da câmera"></video>
          <div class="mira" aria-hidden="true"></div>
        </div>
        <p class="apoio" role="status">{{ iniciando() ? 'Abrindo a câmera…' : 'Procurando o QR code…' }}</p>
      }
    </app-dialogo>
  `,
  styles: `
    .visor { position: relative; overflow: hidden; border-radius: 16px; background: #000; aspect-ratio: 1; }
    video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .mira { position: absolute; inset: 18%; border: 3px solid #d0f03c; border-radius: 16px; box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.35); }
    .erro { color: var(--perigo); font-size: 14px; }
    .apoio { text-align: center; margin: 10px 0 0; }
  `,
})
export class QrLeitor {
  readonly lido = output<string>();
  readonly fechar = output<void>();

  protected readonly erro = signal('');
  protected readonly iniciando = signal(true);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private fluxo: MediaStream | null = null;
  private parado = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.parar());
    afterNextRender(() => void this.iniciar());
  }

  private async iniciar(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.erro.set('Este aparelho ou navegador não permite usar a câmera aqui. Use a opção de colar o link.');
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (this.parado) {
        fluxo.getTracks().forEach((t) => t.stop());
        return;
      }
      this.fluxo = fluxo;
      const v = this.video()?.nativeElement;
      if (!v) return;
      v.srcObject = fluxo;
      await v.play();
      this.iniciando.set(false);
      this.varrer(v);
    } catch (e) {
      const nome = (e as { name?: string }).name;
      this.erro.set(
        nome === 'NotAllowedError' || nome === 'SecurityError'
          ? 'Sem permissão para usar a câmera. Libere o acesso nas configurações do navegador, ou use a opção de colar o link.'
          : nome === 'NotFoundError' || nome === 'OverconstrainedError'
            ? 'Não encontrei uma câmera neste aparelho. Use a opção de colar o link.'
            : 'Não foi possível abrir a câmera. Use a opção de colar o link.',
      );
    }
  }

  /** Olha um quadro da câmera umas 8 vezes por segundo, em tamanho reduzido para ser leve. */
  private varrer(v: HTMLVideoElement): void {
    const tela = document.createElement('canvas');
    const ctx = tela.getContext('2d', { willReadFrequently: true });
    const passo = () => {
      if (this.parado || !ctx) return;
      if (v.videoWidth > 0) {
        const escala = Math.min(1, 640 / v.videoWidth);
        tela.width = Math.round(v.videoWidth * escala);
        tela.height = Math.round(v.videoHeight * escala);
        ctx.drawImage(v, 0, 0, tela.width, tela.height);
        const texto = lerQr(ctx.getImageData(0, 0, tela.width, tela.height));
        if (texto) {
          this.parar();
          this.lido.emit(texto);
          return;
        }
      }
      this.temporizador = setTimeout(passo, 120);
    };
    passo();
  }

  private parar(): void {
    this.parado = true;
    clearTimeout(this.temporizador);
    this.fluxo?.getTracks().forEach((t) => t.stop());
    this.fluxo = null;
  }
}
