import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';

export const CHAVE_TEMA = 'app-workout:tema:v1';

/** Cor da barra de status do aparelho (`theme-color`) em cada tema. */
const COR_BARRA = { claro: '#14171A', escuro: '#14171A' } as const;

export function preferenciaValida(v: unknown): v is PreferenciaTema {
  return v === 'sistema' || v === 'claro' || v === 'escuro';
}

/**
 * Tema claro, escuro ou o do aparelho. A escolha fica só neste aparelho. O `index.html` aplica o tema antes de o app
 * carregar, para a tela não piscar; este serviço mantém o atributo `data-tema` em dia e acompanha o aparelho em "Sistema".
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly doc = inject(DOCUMENT);
  private readonly consulta = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  readonly preferencia = signal<PreferenciaTema>(this.ler());
  /** `true` quando o tema em uso agora é o escuro (já resolvido, inclusive em "Sistema"). */
  readonly escuro = signal(false);

  constructor() {
    this.aplicar();
    this.consulta?.addEventListener?.('change', () => this.aplicar());
  }

  definir(p: PreferenciaTema): void {
    this.preferencia.set(p);
    try {
      localStorage.setItem(CHAVE_TEMA, p);
    } catch {
      // armazenamento bloqueado: vale só até fechar o app
    }
    this.aplicar();
  }

  /** O tema em uso agora, já resolvido ("Sistema" vira claro ou escuro). */
  efetivo(): 'claro' | 'escuro' {
    const p = this.preferencia();
    if (p !== 'sistema') return p;
    return this.consulta?.matches ? 'escuro' : 'claro';
  }

  private ler(): PreferenciaTema {
    try {
      const v = localStorage.getItem(CHAVE_TEMA);
      return preferenciaValida(v) ? v : 'sistema';
    } catch {
      return 'sistema';
    }
  }

  private aplicar(): void {
    const t = this.efetivo();
    this.escuro.set(t === 'escuro');
    this.doc.documentElement.dataset['tema'] = t;
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[t]);
  }
}
