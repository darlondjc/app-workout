import { Injectable, signal } from '@angular/core';

export interface AcaoAviso {
  rotulo: string;
  executar: () => void;
}

export interface Aviso {
  texto: string;
  acao?: AcaoAviso;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly aviso = signal<Aviso | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  /** Com `acao` (por exemplo, Desfazer), o aviso fica mais tempo na tela para dar tempo de tocar. */
  mostrar(texto: string, acao?: AcaoAviso): void {
    clearTimeout(this.timer);
    this.aviso.set(acao ? { texto, acao } : { texto });
    this.timer = setTimeout(() => this.aviso.set(null), acao ? 6000 : 2600);
  }

  /** Executa a ação do aviso e o fecha. */
  agir(): void {
    const acao = this.aviso()?.acao;
    clearTimeout(this.timer);
    this.aviso.set(null);
    acao?.executar();
  }
}
