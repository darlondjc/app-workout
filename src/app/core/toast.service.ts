import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly mensagem = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  mostrar(texto: string): void {
    clearTimeout(this.timer);
    this.mensagem.set(texto);
    this.timer = setTimeout(() => this.mensagem.set(null), 2600);
  }
}
