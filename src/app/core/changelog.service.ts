import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

export interface VersaoApp {
  versao: string;
  data?: string;
  titulo: string;
  itens: string[];
}

/** Histórico de mudanças da versão instalada (vem de data/changelog.json, mais recente primeiro). */
@Injectable({ providedIn: 'root' })
export class ChangelogService {
  private readonly http = inject(HttpClient);

  readonly lista = signal<VersaoApp[]>([]);
  readonly pronto = signal(false);
  readonly erro = signal(false);

  /** Versão que está rodando agora. */
  readonly versaoAtual = computed(() => this.lista()[0]?.versao ?? null);

  constructor() {
    this.carregar();
  }

  carregar(): void {
    this.erro.set(false);
    this.http.get<VersaoApp[]>('data/changelog.json').subscribe({
      next: (l) => {
        this.lista.set(l);
        this.pronto.set(true);
      },
      error: () => this.erro.set(true),
    });
  }
}
