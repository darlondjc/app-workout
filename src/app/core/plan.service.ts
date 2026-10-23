import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { EmAndamento, Ficha, ItemFicha, RegistroExercicio, RegistroPeso, Sessao } from './models';
import { PesoService } from './peso.service';

const CHAVE_FICHAS = 'app-workout:fichas:v1';
const CHAVE_ATIVA = 'app-workout:ficha-ativa:v1';
const CHAVE_HISTORICO = 'app-workout:historico:v1';
const CHAVE_ANDAMENTO = 'app-workout:andamento:v1';

/** Parte do estado que vai para a nuvem num único documento. */
export interface EstadoNuvem {
  fichas: Ficha[];
  ativaId: string | null;
  emAndamento: EmAndamento | null;
  /** Registros de peso corporal. Ausente em documentos gravados por versões antigas do app. */
  pesos?: RegistroPeso[];
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
  private readonly pesos = inject(PesoService);
  readonly fichas = signal<Ficha[]>(ler<Ficha[]>(CHAVE_FICHAS, []));
  readonly ativaId = signal<string | null>(ler<string | null>(CHAVE_ATIVA, null));
  readonly historico = signal<Sessao[]>(
    ler<Sessao[]>(CHAVE_HISTORICO, []).map((s) => (s.id ? s : { ...s, id: crypto.randomUUID() })),
  );
  /**
   * Ficha recém-criada e ainda vazia: só existe na memória. Vira ficha de verdade (e é gravada)
   * quando recebe o primeiro exercício.
   */
  readonly rascunho = signal<Ficha | null>(null);
  /** O próximo exercício adicionado pela biblioteca vai para o rascunho (o usuário tocou em "Adicionar exercício" nele). */
  private readonly alvoRascunho = signal(false);
  readonly emAndamento = signal<EmAndamento | null>(ler<EmAndamento | null>(CHAVE_ANDAMENTO, null));

  /** Fichas, ficha ativa e treino em andamento: o que o documento da nuvem guarda. */
  readonly estadoNuvem = computed<EstadoNuvem>(() => ({
    fichas: this.fichas(),
    ativaId: this.ativaId(),
    emAndamento: this.emAndamento(),
    pesos: this.pesos.registros(),
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
    return this.fichas().find((f) => f.id === id) ?? (this.rascunho()?.id === id ? this.rascunho()! : undefined);
  }

  /** Letra do treino dentro da sua ficha: A, B, C… Treinos soltos (sem ficha com vários treinos) seguem juntos na ordem da lista. */
  letra(id: string): string {
    const alvo = this.fichas().find((f) => f.id === id);
    if (!alvo) return '?';
    const grupo = this.fichas().filter((f) => f.conjunto?.id === alvo.conjunto?.id);
    return String.fromCharCode(65 + (grupo.findIndex((f) => f.id === id) % 26));
  }

  /** "Ficha A" para um treino solto; "Minha divisão · Treino B" para um treino de uma ficha com vários. */
  rotulo(id: string): string {
    const f = this.get(id);
    return f?.conjunto ? `${f.conjunto.nome} · Treino ${this.letra(id)}` : `Ficha ${this.letra(id)}`;
  }

  criar(nome = 'Nova ficha'): Ficha {
    const ficha: Ficha = { id: crypto.randomUUID(), nome, itens: [] };
    this.fichas.update((l) => [...l, ficha]);
    this.ativaId.set(ficha.id);
    return ficha;
  }

  /** Começa uma ficha nova sem gravá-la: ela só é salva ao receber o primeiro exercício. */
  criarRascunho(nome: string): Ficha {
    const ficha: Ficha = { id: crypto.randomUUID(), nome, itens: [] };
    this.rascunho.set(ficha);
    this.alvoRascunho.set(false);
    return ficha;
  }

  descartarRascunho(): void {
    this.rascunho.set(null);
    this.alvoRascunho.set(false);
  }

  /** Cria várias fichas de uma vez (ex.: sugestão automática) e ativa a primeira. */
  criarComItens(modelos: { nome: string; itens: ItemFicha[] }[]): Ficha[] {
    const novas = modelos.map((m) => ({ id: crypto.randomUUID(), nome: m.nome, itens: m.itens }));
    if (novas.length === 0) return novas;
    this.fichas.update((l) => [...l, ...novas]);
    this.ativaId.set(novas[0].id);
    return novas;
  }

  /** Cria uma ficha com vários treinos (A, B, C…) e ativa o primeiro. As fichas que já existem não mudam. */
  criarConjunto(nome: string, treinos: { nome: string; itens: ItemFicha[] }[]): Ficha[] {
    const conjunto = { id: crypto.randomUUID(), nome: nome.trim() || 'Minha ficha' };
    const novas: Ficha[] = treinos.map((t) => ({ id: crypto.randomUUID(), nome: t.nome, itens: t.itens, conjunto }));
    if (novas.length === 0) return novas;
    this.fichas.update((l) => [...l, ...novas]);
    this.ativaId.set(novas[0].id);
    return novas;
  }

  /**
   * Acrescenta um treino à ficha atual (a ativa): ele entra como o próximo treino dela, depois dos que já tem.
   * Se a ficha atual tinha um treino só, ela passa a ser uma ficha com dois. Sem nenhuma ficha, o treino vira a primeira.
   */
  adicionarTreino(nome: string, itens: ItemFicha[]): { treino: Ficha; ficha: string } {
    const atual = this.fichas().find((f) => f.id === this.ativaId()) ?? this.fichas()[0];
    if (!atual) {
      const [primeiro] = this.criarComItens([{ nome, itens }]);
      return { treino: primeiro, ficha: nome };
    }
    const conjunto = atual.conjunto ?? { id: crypto.randomUUID(), nome: atual.nome };
    const treino: Ficha = { id: crypto.randomUUID(), nome, itens, conjunto };
    this.fichas.update((l) => {
      const marcada = l.map((f) => (f.id === atual.id ? { ...f, conjunto } : f));
      let ultimo = -1;
      marcada.forEach((f, i) => {
        if (f.conjunto?.id === conjunto.id) ultimo = i;
      });
      return [...marcada.slice(0, ultimo + 1), treino, ...marcada.slice(ultimo + 1)];
    });
    return { treino, ficha: conjunto.nome };
  }

  /** Exclui a ficha inteira, com todos os seus treinos. */
  removerConjunto(conjuntoId: string): void {
    for (const f of this.fichas().filter((x) => x.conjunto?.id === conjuntoId)) this.remover(f.id);
  }

  remover(id: string): void {
    this.fichas.update((l) => l.filter((f) => f.id !== id));
    if (this.ativaId() === id) this.ativaId.set(this.fichas()[0]?.id ?? null);
  }

  renomear(id: string, nome: string): void {
    if (this.rascunho()?.id === id) {
      this.rascunho.update((r) => (r ? { ...r, nome } : r));
      return;
    }
    this.atualizar(id, (f) => ({ ...f, nome }));
  }

  definirAtiva(id: string): void {
    if (this.rascunho()?.id === id) {
      this.alvoRascunho.set(true);
      return;
    }
    this.alvoRascunho.set(false);
    this.ativaId.set(id);
  }

  /** Adiciona à ficha ativa (cria a primeira ficha se ainda não existir). */
  adicionar(exerciseId: string): { ficha: Ficha; jaEstava: boolean } {
    const rascunho = this.rascunho();
    if (rascunho && this.alvoRascunho()) {
      // Primeiro exercício: a ficha passa a existir de verdade.
      this.descartarRascunho();
      this.fichas.update((l) => [...l, rascunho]);
      this.ativaId.set(rascunho.id);
    }
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

  /** Exercícios da ficha como estão hoje: com as trocas feitas só no treino em andamento, se houver. */
  exerciciosEfetivos(ficha: Ficha): string[] {
    const a = this.emAndamento();
    const trocas = a && a.fichaId === ficha.id ? a.trocas : undefined;
    return ficha.itens.map((it, i) => trocas?.[i] ?? it.exerciseId);
  }

  /** Séries já marcadas na posição passam a "não feitas": eram de outro exercício. Cargas e repetições ficam. */
  private liberarSeries(a: EmAndamento, pos: number): EmAndamento['series'] {
    const salvas = a.series[pos];
    if (!salvas) return a.series;
    return { ...a.series, [pos]: salvas.map((s) => ({ ...s, feita: false })) };
  }

  /**
   * Troca o exercício da posição `pos` da ficha por outro, para sempre. Séries, repetições, carga e
   * descanso continuam os mesmos. Uma troca só para o treino em andamento nessa posição deixa de valer.
   */
  trocarNaFicha(fichaId: string, pos: number, para: string): void {
    this.atualizar(fichaId, (f) => ({
      ...f,
      itens: f.itens.map((it, i) => (i === pos ? { ...it, exerciseId: para } : it)),
    }));
    const a = this.emAndamento();
    if (a && a.fichaId === fichaId) {
      const { [pos]: _removida, ...trocas } = a.trocas ?? {};
      this.emAndamento.set({ ...a, series: this.liberarSeries(a, pos), trocas });
    }
  }

  /** Troca o exercício só no treino atual: a ficha não muda. */
  trocarNoTreino(fichaId: string, pos: number, para: string): void {
    this.andamento(fichaId, (a) => ({
      ...a,
      series: this.liberarSeries(a, pos),
      trocas: { ...a.trocas, [pos]: para },
    }));
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

  /** Já há um treino concluído hoje (pela data local do aparelho). */
  treinouHoje(): boolean {
    const hoje = dataLocal();
    return this.historico().some((s) => s.data === hoje);
  }

  descartarAndamento(): void {
    this.emAndamento.set(null);
  }

  /**
   * Conclui o treino: grava a sessão com o que foi realizado e limpa o andamento.
   * `temFoto` marca a sessão desde o início, para o card publicado já levar o aviso de foto. Devolve o id da sessão.
   */
  registrarSessao(fichaId: string, registros: RegistroExercicio[] = [], temFoto = false): string {
    const ficha = this.get(fichaId);
    const id = crypto.randomUUID();
    this.historico.update((h) => [
      ...h,
      { id, data: dataLocal(), fichaId, fichaNome: ficha?.nome, concluidaEm: Date.now(), registros, ...(temFoto ? { temFoto: true } : {}) },
    ]);
    this.emAndamento.set(null);
    return id;
  }

  /** Liga ou desliga o aviso de foto de um treino já concluído. */
  marcarFoto(sessaoId: string, tem: boolean): void {
    this.historico.update((h) =>
      h.map((s) => {
        if (s.id !== sessaoId) return s;
        const { temFoto: _antes, ...resto } = s;
        return tem ? { ...resto, temFoto: true } : resto;
      }),
    );
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
    this.pesos.aplicar(remoto.pesos, mesclar);
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
    this.pesos.limpar();
  }

  private atualizar(id: string, fn: (f: Ficha) => Ficha): void {
    this.fichas.update((l) => l.map((f) => (f.id === id ? fn(f) : f)));
  }
}
