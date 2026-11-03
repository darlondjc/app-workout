import { Injectable, effect, signal } from '@angular/core';

const CHAVE = 'app-workout:favoritos:v1';

function limpar(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];
}

function ler(): string[] {
  try {
    return limpar(JSON.parse(localStorage.getItem(CHAVE) ?? '[]'));
  } catch {
    return [];
  }
}

/** Exercícios marcados com estrela na biblioteca. Guardados no aparelho e levados à nuvem junto com as fichas. */
@Injectable({ providedIn: 'root' })
export class FavoritosService {
  readonly ids = signal<ReadonlySet<string>>(new Set(ler()));

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify([...this.ids()]));
      } catch {
        /* sem armazenamento: vale só até fechar o app */
      }
    });
  }

  eFavorito(id: string): boolean {
    return this.ids().has(id);
  }

  alternar(id: string): boolean {
    const novo = new Set(this.ids());
    const ficou = !novo.delete(id);
    if (ficou) novo.add(id);
    this.ids.set(novo);
    return ficou;
  }

  /**
   * Aplica o que veio da nuvem. Com `mesclar` (primeiro contato), junta com os daqui.
   * Sem `remotos` (documento de uma versão antiga), mantém o que há no aparelho.
   */
  aplicar(remotos: string[] | undefined, mesclar: boolean): void {
    if (!remotos) return;
    const limpos = limpar(remotos);
    this.ids.set(new Set(mesclar ? [...this.ids(), ...limpos] : limpos));
  }

  /** Apaga os favoritos deste aparelho (usado ao sair da conta). */
  limpar(): void {
    this.ids.set(new Set());
  }
}
