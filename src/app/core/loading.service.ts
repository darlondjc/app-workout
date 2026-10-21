import { Injectable, computed, signal } from '@angular/core';

/** Conta quantas operações de carregamento (requisições e trocas de tela) estão em andamento. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendentes = signal(0);
  readonly ativo = computed(() => this.pendentes() > 0);

  iniciar(): void {
    this.pendentes.update((n) => n + 1);
  }

  concluir(): void {
    this.pendentes.update((n) => Math.max(0, n - 1));
  }
}
