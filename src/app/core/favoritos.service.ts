import { Injectable, computed, signal } from '@angular/core';

const CHAVE = 'app-workout:favoritos:v1';

function ler(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Exercícios marcados com estrela na biblioteca. Ficam no aparelho e, com a conta ativa, sincronizam com a nuvem junto com as fichas. */
@Injectable({ providedIn: 'root' })
export class FavoritosService {
  readonly ids = signal<ReadonlySet<string>>(new Set(ler()));

  /** Em ordem fixa, para o estado da nuvem só mudar quando os favoritos mudarem. */
  readonly lista = computed(() => [...this.ids()].sort());

  eFavorito(id: string): boolean {
    return this.ids().has(id);
  }

  alternar(id: string): boolean {
    const novo = new Set(this.ids());
    const ficou = !novo.delete(id);
    if (ficou) novo.add(id);
    this.definir(novo);
    return ficou;
  }

  /** Aplica o que veio da nuvem. Sem `remotos` (documento de uma versão antiga), mantém o que há no aparelho. */
  aplicar(remotos: string[] | undefined, mesclar: boolean): void {
    if (!Array.isArray(remotos)) return;
    const limpos = remotos.filter((x): x is string => typeof x === 'string');
    this.definir(new Set(mesclar ? [...this.ids(), ...limpos] : limpos));
  }

  /** Apaga os favoritos deste aparelho (usado ao sair da conta). */
  limpar(): void {
    this.definir(new Set());
  }

  private definir(novo: Set<string>): void {
    this.ids.set(novo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify([...novo]));
    } catch {
      /* sem armazenamento: vale só até fechar o app */
    }
  }
}
