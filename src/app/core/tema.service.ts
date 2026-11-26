import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';

export const CHAVE_TEMA = 'app-workout:tema:v1';
export const CHAVE_PALETA = 'app-workout:paleta:v1';

/** Paletas de cores. As cores de cada uma ficam em `styles.scss` (`data-paleta`); `cores` (fundo, texto, destaque) é só a amostra em Ajustes. */
export const PALETAS = [
  { valor: 'padrao', rotulo: 'Padrão', cores: ['#f3f4f0', '#14171a', '#cdeb3b'] },
  { valor: 'oceano', rotulo: 'Oceano', cores: ['#f1f4f4', '#14171a', '#3dd9c5'] },
  { valor: 'azul', rotulo: 'Azul', cores: ['#f1f2f4', '#14171a', '#6ab4ff'] },
  { valor: 'violeta', rotulo: 'Violeta', cores: ['#f1f1f4', '#14171a', '#b79cff'] },
  { valor: 'coral', rotulo: 'Coral', cores: ['#f4f1f1', '#14171a', '#ff8a6b'] },
  { valor: 'ambar', rotulo: 'Âmbar', cores: ['#f4f3f1', '#14171a', '#ffc233'] },
] as const;

export type Paleta = (typeof PALETAS)[number]['valor'];

export function paletaValida(v: unknown): v is Paleta {
  return PALETAS.some((p) => p.valor === v);
}

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
  readonly paleta = signal<Paleta>(this.lerPaleta());
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

  definirPaleta(p: Paleta): void {
    this.paleta.set(p);
    try {
      localStorage.setItem(CHAVE_PALETA, p);
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

  private lerPaleta(): Paleta {
    try {
      const v = localStorage.getItem(CHAVE_PALETA);
      return paletaValida(v) ? v : 'padrao';
    } catch {
      return 'padrao';
    }
  }

  private aplicar(): void {
    this.doc.documentElement.dataset['paleta'] = this.paleta();
    const t = this.efetivo();
    this.escuro.set(t === 'escuro');
    this.doc.documentElement.dataset['tema'] = t;
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[t]);
  }
}
