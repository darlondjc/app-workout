import { Injectable, effect, signal } from '@angular/core';
import { RegistroMedidas } from './models';
import { ValoresMedidas, limparMedidas, mesclarMedidas, registrarMedidas, restaurarMedidas } from './medidas';

const CHAVE_MEDIDAS = 'app-workout:medidas:v1';

function ler(): RegistroMedidas[] {
  try {
    const bruto = localStorage.getItem(CHAVE_MEDIDAS);
    return bruto ? limparMedidas(JSON.parse(bruto)) : [];
  } catch {
    return [];
  }
}

function gravar(lista: RegistroMedidas[]): void {
  try {
    localStorage.setItem(CHAVE_MEDIDAS, JSON.stringify(lista));
  } catch {
    // Armazenamento indisponível (modo privado, cota cheia): segue só em memória.
  }
}

/** Bioimpedância e circunferência abdominal, independentes do peso: guardadas no aparelho e levadas à nuvem com as fichas. */
@Injectable({ providedIn: 'root' })
export class MedidasService {
  /** Em ordem de data, do mais antigo ao mais recente. */
  readonly registros = signal<RegistroMedidas[]>(ler());

  constructor() {
    effect(() => gravar(this.registros()));
  }

  /** Registra as medidas do dia `data` (yyyy-mm-dd); num dia que já tinha registro, só os campos informados mudam. */
  registrar(data: string, valores: ValoresMedidas): void {
    this.registros.update((l) => registrarMedidas(l, data, valores, Date.now()));
  }

  remover(data: string): RegistroMedidas | undefined {
    const r = this.registros().find((x) => x.data === data);
    this.registros.update((l) => l.filter((x) => x.data !== data));
    return r;
  }

  restaurar(r: RegistroMedidas): void {
    this.registros.update((l) => restaurarMedidas(l, r));
  }

  /** Aplica o que veio da nuvem. Sem `remotos` (documento de uma versão antiga), mantém o que há no aparelho. */
  aplicar(remotos: RegistroMedidas[] | undefined, mesclar: boolean): void {
    if (!remotos) return;
    const limpos = limparMedidas(remotos);
    this.registros.set(mesclar ? mesclarMedidas(this.registros(), limpos) : limpos);
  }

  /** Apaga os dados deste aparelho (usado ao sair da conta). */
  limpar(): void {
    this.registros.set([]);
  }
}
