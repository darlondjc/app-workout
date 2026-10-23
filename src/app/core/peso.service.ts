import { Injectable, computed, effect, signal } from '@angular/core';
import { RegistroPeso } from './models';
import { limparPesos, mesclarPesos, registrarPeso } from './peso';

const CHAVE_PESO = 'app-workout:peso:v1';

function ler(): RegistroPeso[] {
  try {
    const bruto = localStorage.getItem(CHAVE_PESO);
    return bruto ? limparPesos(JSON.parse(bruto)) : [];
  } catch {
    return [];
  }
}

function gravar(lista: RegistroPeso[]): void {
  try {
    localStorage.setItem(CHAVE_PESO, JSON.stringify(lista));
  } catch {
    // Armazenamento indisponível (modo privado, cota cheia): segue só em memória.
  }
}

/** Registros de peso corporal: um por dia, guardados no aparelho e levados à nuvem junto com as fichas. */
@Injectable({ providedIn: 'root' })
export class PesoService {
  /** Em ordem de data, do mais antigo ao mais recente. */
  readonly registros = signal<RegistroPeso[]>(ler());
  /** O registro mais recente, ou `null` se a pessoa ainda não registrou nenhum. */
  readonly atual = computed(() => this.registros().at(-1) ?? null);

  constructor() {
    effect(() => gravar(this.registros()));
  }

  /** Registra o peso do dia `data` (yyyy-mm-dd); se o dia já tinha um registro, ele é substituído. */
  registrar(data: string, kg: number): void {
    this.registros.update((l) => registrarPeso(l, { data, kg, em: Date.now() }));
  }

  remover(data: string): void {
    this.registros.update((l) => l.filter((r) => r.data !== data));
  }

  /** Aplica o que veio da nuvem. Sem `remotos` (documento de uma versão antiga), mantém o que há no aparelho. */
  aplicar(remotos: RegistroPeso[] | undefined, mesclar: boolean): void {
    if (!remotos) return;
    const limpos = limparPesos(remotos);
    this.registros.set(mesclar ? mesclarPesos(this.registros(), limpos) : limpos);
  }

  /** Apaga os dados deste aparelho (usado ao sair da conta). */
  limpar(): void {
    this.registros.set([]);
  }
}
