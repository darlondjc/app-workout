import { Injectable } from '@angular/core';

/**
 * Mantém a tela acesa enquanto o treino está aberto (Screen Wake Lock). O navegador solta o bloqueio sozinho
 * quando o app vai para segundo plano; por isso o pedido é refeito ao voltar. Onde a API não existe (iPhone
 * antes do iOS 18.4 no app instalado, por exemplo) ou o aparelho recusa (bateria fraca), nada acontece e a tela
 * se comporta como antes.
 */
@Injectable({ providedIn: 'root' })
export class TelaLigada {
  private sentinela: WakeLockSentinel | null = null;
  private querendo = false;
  private pedindo = false;

  private readonly aoVoltar = (): void => {
    if (this.querendo && document.visibilityState === 'visible') void this.pedir();
  };

  /** Pede para a tela ficar acesa e continua pedindo ao voltar para o app, até `desligar()`. */
  ligar(): void {
    if (this.querendo) return;
    this.querendo = true;
    document.addEventListener('visibilitychange', this.aoVoltar);
    void this.pedir();
  }

  /** Solta o bloqueio e para de pedir. */
  desligar(): void {
    this.querendo = false;
    document.removeEventListener('visibilitychange', this.aoVoltar);
    const atual = this.sentinela;
    this.sentinela = null;
    if (atual && !atual.released) void atual.release().catch(() => undefined);
  }

  private async pedir(): Promise<void> {
    if (this.pedindo || (this.sentinela && !this.sentinela.released)) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    this.pedindo = true;
    try {
      const nova = await navigator.wakeLock.request('screen');
      // Saiu do treino enquanto o navegador respondia: solta na hora.
      if (!this.querendo) {
        void nova.release().catch(() => undefined);
        return;
      }
      this.sentinela = nova;
    } catch {
      // Bateria fraca, economia de energia ou recusa do sistema: segue sem o bloqueio.
    } finally {
      this.pedindo = false;
    }
  }
}
