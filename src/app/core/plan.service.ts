import { Injectable, computed, effect, signal } from '@angular/core';
import { EmAndamento, Ficha, ItemFicha, RegistroExercicio, Sessao } from './models';

const CHAVE_FICHAS = 'app-workout:fichas:v1';
const CHAVE_ATIVA = 'app-workout:ficha-ativa:v1';
const CHAVE_HISTORICO = 'app-workout:historico:v1';
const CHAVE_ANDAMENTO = 'app-workout:andamento:v1';

/** Parte do estado que vai para a nuvem num único documento. */
export interface EstadoNuvem {
  fichas: Ficha[];
  ativaId: string | null;
  emAndamento: EmAndamento | null;
}

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
  readonly historico = signal<Sessao[]>(
    ler<Sessao[]>(CHAVE_HISTORICO, []).map((s) => (s.id ? s : { ...s, id: crypto.randomUUID() })),
  );
  readonly emAndamento = signal<EmAndamento | null>(ler<EmAndamento | null>(CHAVE_ANDAMENTO, null));

  /** Fichas, ficha ativa e treino em andamento: o que o documento da nuvem guarda. */
  readonly estadoNuvem = computed<EstadoNuvem>(() => ({
    fichas: this.fichas(),
    ativaId: this.ativaId(),
    emAndamento: this.emAndamento(),
  }));

  /** Ficha sugerida para hoje: a seguinte à última concluída (rodízio A, B, C...). */
  readonly proxima = computed<Ficha | null>(() => {
    const em = this.emAndamento();
    const emCurso = em ? this.get(em.fichaId) : undefined;
    if (emCurso && emCurso.itens.length > 0) return emCurso;
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
    effect(() => gravar(CHAVE_ANDAMENTO, this.emAndamento()));
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

  /** Cria várias fichas de uma vez (ex.: sugestão automática) e ativa a primeira. */
  criarComItens(modelos: { nome: string; itens: ItemFicha[] }[]): Ficha[] {
    const novas = modelos.map((m) => ({ id: crypto.randomUUID(), nome: m.nome, itens: m.itens }));
    if (novas.length === 0) return novas;
    this.fichas.update((l) => [...l, ...novas]);
    this.ativaId.set(novas[0].id);
    return novas;
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

  /**
   * Altera o treino em andamento da ficha. Se não houver treino começado (ou for de outra
   * ficha), parte de um treino novo.
   */
  andamento(fichaId: string, fn: (a: EmAndamento) => EmAndamento): void {
    this.emAndamento.update((atual) => {
      const base: EmAndamento =
        atual && atual.fichaId === fichaId ? atual : { fichaId, indice: 0, series: {}, iniciadoEm: Date.now() };
      return fn(base);
    });
  }

  descartarAndamento(): void {
    this.emAndamento.set(null);
  }

  /** Conclui o treino: grava a sessão com o que foi realizado e limpa o andamento. */
  registrarSessao(fichaId: string, registros: RegistroExercicio[] = []): void {
    const ficha = this.get(fichaId);
    this.historico.update((h) => [
      ...h,
      { id: crypto.randomUUID(), data: dataLocal(), fichaId, fichaNome: ficha?.nome, concluidaEm: Date.now(), registros },
    ]);
    this.emAndamento.set(null);
  }

  /** Últimos valores realizados de um exercício, para sugerir a carga do próximo treino. */
  ultimoRegistro(exerciseId: string): RegistroExercicio | undefined {
    const h = this.historico();
    for (let i = h.length - 1; i >= 0; i--) {
      const r = h[i].registros?.find((x) => x.exerciseId === exerciseId && x.series.length > 0);
      if (r) return r;
    }
    return undefined;
  }

  /** Aplica o estado vindo da nuvem. Com `mesclar`, junta com o que há no aparelho em vez de trocar. */
  aplicarEstadoNuvem(remoto: EstadoNuvem, mesclar = false): void {
    if (mesclar) {
      const ids = new Set(remoto.fichas.map((f) => f.id));
      this.fichas.set([...remoto.fichas, ...this.fichas().filter((f) => !ids.has(f.id))]);
      this.ativaId.set(remoto.ativaId ?? this.ativaId());
      this.emAndamento.set(remoto.emAndamento ?? this.emAndamento());
    } else {
      this.fichas.set(remoto.fichas);
      this.ativaId.set(remoto.ativaId);
      this.emAndamento.set(remoto.emAndamento);
    }
  }

  /** Junta sessões recebidas da nuvem ao histórico (união por id, em ordem de data). */
  mesclarSessoes(remotas: Sessao[]): void {
    const atuais = this.historico();
    const ids = new Set(atuais.map((s) => s.id));
    const novas = remotas.filter((s) => s.id && !ids.has(s.id));
    if (novas.length === 0) return;
    const todas = [...atuais, ...novas].sort(
      (a, b) => (a.concluidaEm ?? 0) - (b.concluidaEm ?? 0) || a.data.localeCompare(b.data),
    );
    this.historico.set(todas);
  }

  /** Apaga os dados deste aparelho (usado ao sair da conta). */
  limparLocal(): void {
    this.fichas.set([]);
    this.ativaId.set(null);
    this.historico.set([]);
    this.emAndamento.set(null);
  }

  private atualizar(id: string, fn: (f: Ficha) => Ficha): void {
    this.fichas.update((l) => l.map((f) => (f.id === id ? fn(f) : f)));
  }
}
