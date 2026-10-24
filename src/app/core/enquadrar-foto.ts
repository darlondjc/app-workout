import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { PROPORCAO_FOTO, ZOOM_MAXIMO, espelharFoto, girarFoto, posicionar, recortarFoto } from './foto';
import { Icon } from './icon';

/**
 * Quadro para a pessoa escolher o trecho da foto: arrasta para mover e usa dois dedos (ou o controle de zoom)
 * para aproximar. O que aparece no quadro é o que vai para a timeline (`recortar`).
 */
@Component({
  selector: 'app-enquadrar-foto',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #quadro
      class="quadro"
      role="img"
      aria-label="Enquadramento da foto. Arraste para mover."
      (pointerdown)="tocar($event)"
      (pointermove)="mover($event)"
      (pointerup)="soltar($event)"
      (pointercancel)="soltar($event)"
      (wheel)="rolar($event)"
    >
      <img
        [src]="fonte()"
        alt=""
        draggable="false"
        (load)="aoCarregar($event)"
        [style.width.px]="pos()?.largura"
        [style.height.px]="pos()?.altura"
        [style.transform]="'translate(-50%, -50%) translate(' + (pos()?.x ?? 0) + 'px, ' + (pos()?.y ?? 0) + 'px)'"
      />
      <div class="ferramentas" (pointerdown)="$event.stopPropagation()">
        <button type="button" aria-label="Girar foto" [disabled]="girando()" (click)="transformar(girarFoto)">
          <app-icon name="rotate" [size]="20" [stroke]="2.2" />
        </button>
        <button type="button" aria-label="Espelhar foto" [disabled]="girando()" (click)="transformar(espelharFoto)">
          <app-icon name="mirror" [size]="20" [stroke]="2.2" />
        </button>
      </div>
    </div>
    <label class="zoom">
      <span>Zoom</span>
      <input type="range" min="1" [max]="zoomMaximo" step="0.01" [value]="zoom()" aria-label="Zoom da foto" (input)="zoom.set($any($event.target).valueAsNumber)" />
    </label>
    <p class="dica">Arraste a foto para escolher o trecho. Use dois dedos ou o zoom para aproximar.</p>
  `,
  styles: `
    :host { display: block; margin-bottom: 10px; }
    .quadro { position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 16px; background: var(--soft); touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
    .quadro:active { cursor: grabbing; }
    img { position: absolute; left: 50%; top: 50%; max-width: none; pointer-events: none; }
    .ferramentas { position: absolute; top: 8px; right: 8px; display: flex; gap: 8px; }
    .ferramentas button { width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.55); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .zoom { display: flex; align-items: center; gap: 12px; margin-top: 8px; font-size: 13px; color: var(--muted); }
    .zoom input { flex: 1; min-width: 0; accent-color: var(--ink); }
    .dica { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
  `,
})
export class EnquadrarFoto {
  /** Foto escolhida (data URL, já reduzida). */
  readonly foto = input.required<string>();

  protected readonly zoomMaximo = ZOOM_MAXIMO;
  protected readonly zoom = signal(1);
  /** A foto com o giro e o espelhamento já aplicados; volta à original quando chega outra. */
  protected readonly fonte = linkedSignal(() => this.foto());
  protected readonly girando = signal(false);
  protected readonly girarFoto = girarFoto;
  protected readonly espelharFoto = espelharFoto;
  private readonly x = signal(0);
  private readonly y = signal(0);
  private readonly tamanhoFoto = signal<{ w: number; h: number } | null>(null);
  private readonly tamanhoQuadro = signal<{ w: number; h: number }>({ w: 300, h: 300 / PROPORCAO_FOTO });
  private readonly quadro = viewChild.required<ElementRef<HTMLElement>>('quadro');
  private readonly ponteiros = new Map<number, { x: number; y: number }>();

  protected readonly pos = computed(() => {
    const f = this.tamanhoFoto();
    if (!f) return null;
    const q = this.tamanhoQuadro();
    return posicionar(f.w, f.h, q.w, q.h, { zoom: this.zoom(), x: this.x(), y: this.y() });
  });

  constructor() {
    // Foto nova: volta ao enquadramento inicial.
    effect(() => {
      this.foto();
      this.zoom.set(1);
      this.x.set(0);
      this.y.set(0);
      this.tamanhoFoto.set(null);
    });
    effect((onCleanup) => {
      const el = this.quadro().nativeElement;
      const medir = () => this.tamanhoQuadro.set({ w: el.clientWidth || 300, h: el.clientHeight || 300 / PROPORCAO_FOTO });
      medir();
      if (typeof ResizeObserver === 'undefined') return;
      const obs = new ResizeObserver(medir);
      obs.observe(el);
      onCleanup(() => obs.disconnect());
    });
    inject(DestroyRef).onDestroy(() => this.ponteiros.clear());
  }

  /** Gira ou espelha a foto; o enquadramento volta ao início, porque o formato pode ter mudado. */
  protected async transformar(fn: (src: string) => Promise<string>): Promise<void> {
    this.girando.set(true);
    try {
      this.fonte.set(await fn(this.fonte()));
      this.zoom.set(1);
      this.x.set(0);
      this.y.set(0);
      this.tamanhoFoto.set(null);
    } catch {
      /* mantém a foto como estava */
    } finally {
      this.girando.set(false);
    }
  }

  protected aoCarregar(e: Event): void {
    const img = e.target as HTMLImageElement;
    this.tamanhoFoto.set({ w: img.naturalWidth, h: img.naturalHeight });
  }

  /** Aplica o limite à posição atual, para o próximo gesto partir de um valor válido. */
  private assentar(): void {
    const p = this.pos();
    if (!p) return;
    this.zoom.set(p.zoom);
    this.x.set(p.x);
    this.y.set(p.y);
  }

  protected tocar(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  protected mover(e: PointerEvent): void {
    const anterior = this.ponteiros.get(e.pointerId);
    if (!anterior) return;
    const outros = [...this.ponteiros.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    if (outros.length === 0) {
      // Um dedo: move.
      this.x.update((v) => v + e.clientX - anterior.x);
      this.y.update((v) => v + e.clientY - anterior.y);
    } else {
      // Dois dedos: a distância entre eles muda o zoom.
      const o = outros[0];
      const antes = Math.hypot(anterior.x - o.x, anterior.y - o.y);
      const depois = Math.hypot(e.clientX - o.x, e.clientY - o.y);
      if (antes > 0) this.zoom.update((z) => Math.min(ZOOM_MAXIMO, Math.max(1, z * (depois / antes))));
    }
    this.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.assentar();
  }

  protected soltar(e: PointerEvent): void {
    this.ponteiros.delete(e.pointerId);
  }

  /** Roda do mouse (computador): zoom. */
  protected rolar(e: WheelEvent): void {
    e.preventDefault();
    this.zoom.update((z) => Math.min(ZOOM_MAXIMO, Math.max(1, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))));
    this.assentar();
  }

  /** A foto recortada no que está enquadrado. */
  async recortar(): Promise<string> {
    const q = this.tamanhoQuadro();
    return recortarFoto(this.fonte(), q.w, q.h, { zoom: this.zoom(), x: this.x(), y: this.y() });
  }
}
