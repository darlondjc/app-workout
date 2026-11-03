import { Injectable, signal } from '@angular/core';

const CHAVE = 'app-workout:favoritos:v1';

function ler(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Exercícios marcados com estrela na biblioteca. Ficam só neste aparelho. */
@Injectable({ providedIn: 'root' })
export class FavoritosService {
  readonly ids = signal<ReadonlySet<string>>(new Set(ler()));

  eFavorito(id: string): boolean {
    return this.ids().has(id);
  }

  alternar(id: string): boolean {
    const novo = new Set(this.ids());
    const ficou = !novo.delete(id);
    if (ficou) novo.add(id);
    this.ids.set(novo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify([...novo]));
    } catch {
      /* sem armazenamento: vale só até fechar o app */
    }
    return ficou;
  }
}
