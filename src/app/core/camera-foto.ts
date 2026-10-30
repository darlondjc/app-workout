import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { Icon } from './icon';

type Lado = 'user' | 'environment';

/**
 * Tela com a câmera do aparelho para tirar a foto. A frontal começa ligada e a imagem aparece espelhada, como num
 * espelho, mas a foto sai sem espelhar, como as outras pessoas veem. Também deixa escolher da galeria.
 */
@Component({
  selector: 'app-camera-foto',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- <dialog> nativo: vai para a camada de cima da tela, mesmo dentro de outro diálogo. -->
    <dialog #caixa class="camera" aria-label="Tirar foto" (close)="fechar.emit()">
      @if (erro(); as e) {
        <div class="falha">
          <p class="erro" role="alert">{{ e }}</p>
        </div>
      } @else {
        <video #video playsinline muted aria-label="Imagem da câmera" [class.espelho]="lado() === 'user'"></video>
      }
      <button type="button" class="fechar" aria-label="Fechar" (click)="caixa.close()">
        <app-icon name="close" [size]="22" [stroke]="2.4" />
      </button>
      <div class="controles">
        <button type="button" class="galeria" (click)="galeria.emit()">Galeria</button>
        <button type="button" class="disparo" aria-label="Tirar foto" [disabled]="iniciando() || !!erro()" (click)="tirar()"></button>
        <button type="button" class="virar" aria-label="Virar câmera" [disabled]="iniciando() || !!erro()" (click)="virar()">
          <app-icon name="rotate" [size]="22" [stroke]="2.2" />
        </button>
      </div>
    </dialog>
  `,
  styles: `
    .camera { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: #000; color: #fff; overflow: hidden; }
    .camera::backdrop { background: #000; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .espelho { transform: scaleX(-1); }
    .falha { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; }
    .erro { margin: 0; font-size: 15px; line-height: 1.4; }
    .fechar { position: absolute; top: calc(12px + env(safe-area-inset-top)); right: 12px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.55); color: #fff; display: flex; align-items: center; justify-content: center; }
    .controles { position: absolute; left: 0; right: 0; bottom: 0; padding: 20px 24px calc(20px + env(safe-area-inset-bottom)); display: flex; align-items: center; justify-content: space-between; background: linear-gradient(transparent, rgba(0, 0, 0, 0.6)); }
    .galeria, .virar { min-width: 64px; min-height: 48px; border: 0; border-radius: 999px; background: rgba(255, 255, 255, 0.18); color: #fff; font: inherit; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; padding: 0 14px; }
    .virar { width: 48px; min-width: 48px; padding: 0; }
    .disparo { width: 72px; height: 72px; border-radius: 50%; border: 4px solid #fff; background: #fff; box-shadow: inset 0 0 0 4px #000; }
    .disparo:disabled, .virar:disabled { opacity: 0.5; }
  `,
})
export class CameraFoto {
  /** A foto tirada, sem espelhar, como JPEG. */
  readonly tirada = output<Blob>();
  /** Pediu para escolher da galeria. */
  readonly galeria = output<void>();
  readonly fechar = output<void>();

  protected readonly erro = signal('');
  protected readonly iniciando = signal(true);
  protected readonly lado = signal<Lado>('user');
  private readonly caixa = viewChild.required<ElementRef<HTMLDialogElement>>('caixa');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private fluxo: MediaStream | null = null;
  private fechado = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.fechado = true;
      this.parar();
    });
    afterNextRender(() => {
      this.caixa().nativeElement.showModal();
      void this.iniciar();
    });
  }

  protected virar(): void {
    this.lado.set(this.lado() === 'user' ? 'environment' : 'user');
    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    this.iniciando.set(true);
    this.parar();
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: this.lado() } }, audio: false });
      if (this.fechado) {
        fluxo.getTracks().forEach((t) => t.stop());
        return;
      }
      this.fluxo = fluxo;
      // Se o aparelho não tem a câmera pedida, o que vale é a que abriu.
      const real = fluxo.getVideoTracks()[0]?.getSettings().facingMode;
      if (real === 'user' || real === 'environment') this.lado.set(real);
      const v = this.video()?.nativeElement;
      if (!v) return;
      v.muted = true; // só o atributo não basta: sem isto o navegador pode barrar o início automático
      v.srcObject = fluxo;
      await v.play();
      this.iniciando.set(false);
    } catch (e) {
      const nome = (e as { name?: string }).name;
      this.erro.set(
        nome === 'NotAllowedError' || nome === 'SecurityError'
          ? 'Sem permissão para usar a câmera. Libere o acesso nas configurações, ou escolha uma foto da galeria.'
          : nome === 'NotFoundError' || nome === 'OverconstrainedError'
            ? 'Não encontrei uma câmera neste aparelho. Escolha uma foto da galeria.'
            : 'Não foi possível abrir a câmera. Escolha uma foto da galeria.',
      );
    }
  }

  /** Congela o quadro atual, tal qual a câmera vê (sem o espelho do preview), e entrega o JPEG. */
  protected tirar(): void {
    const v = this.video()?.nativeElement;
    if (!v || v.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        this.parar();
        this.tirada.emit(blob);
      },
      'image/jpeg',
      0.92,
    );
  }

  private parar(): void {
    this.fluxo?.getTracks().forEach((t) => t.stop());
    this.fluxo = null;
  }
}
