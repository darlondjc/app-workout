import { Injectable, computed, effect, signal } from '@angular/core';
import { Ficha, ItemFicha, Sessao } from './models';

const CHAVE_FICHAS = 'app-workout:fichas:v1';
const CHAVE_ATIVA = 'app-workout:ficha-ativa:v1';
const CHAVE_HISTORICO = 'app-workout:historico:v1';

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Armazenamento indisponível (modo privado, cota cheia): segue só em memória.
  }
}

export function dataLocal(d: Date = new Date()): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  readonly fichas = signal<Ficha[]>(ler<Ficha[]>(CHAVE_FICHAS, []));
  readonly ativaId = signal<string | null>(ler<string | null>(CHAVE_ATIVA, null));
  readonly historico = signal<Sessao[]>(ler<Sessao[]>(CHAVE_HISTORICO, []));

  /** Ficha sugerida para hoje: a seguinte à última concluída (rodízio A, B, C...). */
  readonly proxima = computed<Ficha | null>(() => {
    const fichas = this.fichas().filter((f) => f.itens.length > 0);
    if (fichas.length === 0) return null;
    const ultima = this.historico().at(-1);
    const idx = ultima ? fichas.findIndex((f) => f.id === ultima.fichaId) : -1;
    return fichas[(idx + 1) % fichas.length];
  });

  constructor() {
    effect(() => gravar(CHAVE_FICHAS, this.fichas()));
    effect(() => gravar(CHAVE_ATIVA, this.ativaId()));
    effect(() => gravar(CHAVE_HISTORICO, this.historico()));
  }

  get(id: string): Ficha | undefined {
    return this.fichas().find((f) => f.id === id);
  }

  letra(id: string): string {
    const i = this.fichas().findIndex((f) => f.id === id);
    return i < 0 ? '?' : String.fromCharCode(65 + (i % 26));
  }

  criar(nome = 'Nova ficha'): Ficha {
    const ficha: Ficha = { id: crypto.randomUUID(), nome, itens: [] };
    this.fichas.update((l) => [...l, ficha]);
    this.ativaId.set(ficha.id);
    return ficha;
  }

  remover(id: string): void {
    this.fichas.update((l) => l.filter((f) => f.id !== id));
    if (this.ativaId() === id) this.ativaId.set(this.fichas()[0]?.id ?? null);
  }

  renomear(id: string, nome: string): void {
    this.atualizar(id, (f) => ({ ...f, nome }));
  }

  definirAtiva(id: string): void {
    this.ativaId.set(id);
  }

  /** Adiciona à ficha ativa (cria a primeira ficha se ainda não existir). */
  adicionar(exerciseId: string): { ficha: Ficha; jaEstava: boolean } {
    let ficha = this.fichas().find((f) => f.id === this.ativaId()) ?? this.fichas()[0];
    if (!ficha) ficha = this.criar('Minha primeira ficha');
    this.ativaId.set(ficha.id);
    if (ficha.itens.some((i) => i.exerciseId === exerciseId)) {
      return { ficha, jaEstava: true };
    }
    const item: ItemFicha = { exerciseId, series: 3, reps: 10, carga: 0, descanso: 60 };
    const atualizada = { ...ficha, itens: [...ficha.itens, item] };
    this.atualizar(ficha.id, () => atualizada);
    return { ficha: atualizada, jaEstava: false };
  }

  removerItem(fichaId: string, indice: number): void {
    this.atualizar(fichaId, (f) => ({ ...f, itens: f.itens.filter((_, i) => i !== indice) }));
  }

  moverItem(fichaId: string, indice: number, direcao: -1 | 1): void {
    this.atualizar(fichaId, (f) => {
      const alvo = indice + direcao;
      if (alvo < 0 || alvo >= f.itens.length) return f;
      const itens = [...f.itens];
      [itens[indice], itens[alvo]] = [itens[alvo], itens[indice]];
      return { ...f, itens };
    });
  }

  editarItem(fichaId: string, indice: number, campo: keyof Omit<ItemFicha, 'exerciseId'>, valor: number): void {
    const v = Number.isFinite(valor) && valor >= 0 ? valor : 0;
    this.atualizar(fichaId, (f) => ({
      ...f,
      itens: f.itens.map((item, i) => (i === indice ? { ...item, [campo]: v } : item)),
    }));
  }

  registrarSessao(fichaId: string): void {
    this.historico.update((h) => [...h, { data: dataLocal(), fichaId }]);
  }

  private atualizar(id: string, fn: (f: Ficha) => Ficha): void {
    this.fichas.update((l) => l.map((f) => (f.id === id ? fn(f) : f)));
  }
}
