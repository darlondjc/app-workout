import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AtividadeRegistro, EmAndamento, Ficha, ItemFicha, RegistroExercicio, RegistroPeso, Sessao } from './models';
import { duracaoDoTreino } from './calorias';
import { BlocoFichas, MESES_PADRAO, Situacao, agruparEmBlocos, chaveDe, limitarMeses, situacoes, somarMeses } from './ciclo';
import { NOTA_EXERCICIO_MAX, NOTA_TREINO_MAX, limparNota } from './notas';
import { FavoritosService } from './favoritos.service';
import { PesoService } from './peso.service';

const CHAVE_FICHAS = 'app-workout:fichas:v1';
const CHAVE_ATIVA = 'app-workout:ficha-ativa:v1';
const CHAVE_HISTORICO = 'app-workout:historico:v1';
const CHAVE_EXCLUIDAS = 'app-workout:sessoes-excluidas:v1';
const CHAVE_ANDAMENTO = 'app-workout:andamento:v1';
const CHAVE_MESES = 'app-workout:ficha-meses:v1';

/** Parte do estado que vai para a nuvem num único documento. */
export interface EstadoNuvem {
  fichas: Ficha[];
  ativaId: string | null;
  emAndamento: EmAndamento | null;
  /** Registros de peso corporal. Ausente em documentos gravados por versões antigas do app. */
  pesos?: RegistroPeso[];
  /** Exercícios favoritos da biblioteca. Ausente em documentos gravados por versões antigas do app. */
  favoritos?: string[];
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
  private readonly favoritos = inject(FavoritosService);
  readonly fichas = signal<Ficha[]>(ler<Ficha[]>(CHAVE_FICHAS, []));
  readonly ativaId = signal<string | null>(ler<string | null>(CHAVE_ATIVA, null));
  /** Treinos apagados (id → dia e momento), guardados para o apagar valer também nos outros aparelhos. */
  private readonly excluidas = signal<Record<string, { data: string; em: number }>>(ler(CHAVE_EXCLUIDAS, {}));
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
  /** Duração padrão de uma ficha nova, em meses (só neste aparelho). */
  readonly mesesPadrao = signal<number>(limitarMeses(ler<number>(CHAVE_MESES, MESES_PADRAO)));
  /** Dia de hoje (data local); atualiza ao voltar para o app, para as fichas vencerem na virada do dia. */
  readonly hoje = signal(dataLocal());
  /** As fichas como a pessoa as vê (treino solto ou conjunto de treinos), na ordem da lista. */
  readonly blocos = computed<BlocoFichas[]>(() => agruparEmBlocos(this.fichas()));
  private readonly situacaoPorChave = computed(() => situacoes(this.blocos(), this.hoje()));
  readonly blocosAtivos = computed(() => this.blocosEm('ativa'));
  /** Só a vencida mais recente; as anteriores já estão arquivadas. */
  readonly blocosVencidos = computed(() => this.blocosEm('vencida'));
  readonly blocosArquivados = computed(() => this.blocosEm('arquivada'));
  /** Fichas em uso: as ativas; se todas venceram, a vencida à vista, para o app não ficar sem treino. */
  readonly fichasEmUso = computed<Ficha[]>(() => {
    const ativas = this.blocosAtivos();
    return (ativas.length ? ativas : this.blocosVencidos()).flatMap((b) => b.fichas);
  });

  /** Fichas, ficha ativa e treino em andamento: o que o documento da nuvem guarda. */
  readonly estadoNuvem = computed<EstadoNuvem>(() => ({
    fichas: this.fichas(),
    ativaId: this.ativaId(),
    emAndamento: this.emAndamento(),
    pesos: this.pesos.registros(),
    favoritos: [...this.favoritos.ids()],
  }));

  /** Ficha sugerida para hoje: a seguinte à última concluída (rodízio A, B, C...). */
  readonly proxima = computed<Ficha | null>(() => {
    const em = this.emAndamento();
    const emCurso = em ? this.get(em.fichaId) : undefined;
    if (emCurso && emCurso.itens.length > 0) return emCurso;
    const fichas = this.fichasEmUso().filter((f) => f.itens.length > 0);
    if (fichas.length === 0) return null;
    // Atividade fora da ficha não avança o rodízio.
    const ultima = this.historico().filter((s) => s.fichaId).at(-1);
    const idx = ultima ? fichas.findIndex((f) => f.id === ultima.fichaId) : -1;
    return fichas[(idx + 1) % fichas.length];
  });

  constructor() {
    this.garantirPeriodos();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.hoje.set(dataLocal());
      });
    }
    effect(() => gravar(CHAVE_FICHAS, this.fichas()));
    effect(() => gravar(CHAVE_MESES, this.mesesPadrao()));
    effect(() => gravar(CHAVE_ATIVA, this.ativaId()));
    effect(() => gravar(CHAVE_HISTORICO, this.historico()));
    effect(() => gravar(CHAVE_EXCLUIDAS, this.excluidas()));
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
    if (f?.conjunto && this.rascunho()?.id === id) return `${f.conjunto.nome} · Novo treino`;
    return f?.conjunto ? `${f.conjunto.nome} · Treino ${this.letra(id)}` : `Ficha ${this.letra(id)}`;
  }

  private blocosEm(s: Situacao): BlocoFichas[] {
    const m = this.situacaoPorChave();
    return this.blocos().filter((b) => m.get(b.chave) === s);
  }

  /** Situação de uma ficha (ativa, vencida ou arquivada), pelo bloco a que pertence. */
  situacaoDe(f: Ficha): Situacao {
    return this.situacaoPorChave().get(chaveDe(f)) ?? 'ativa';
  }

  /** Período de uma ficha que começa hoje, com a duração padrão. */
  private novoPeriodo(): { inicio: string; fim: string } {
    const inicio = dataLocal();
    return { inicio, fim: somarMeses(inicio, this.mesesPadrao()) };
  }

  /** Fichas criadas antes do período existir começam a contar a partir de hoje, para não vencerem de surpresa. */
  private garantirPeriodos(): void {
    if (this.fichas().every((f) => f.fim)) return;
    const p = this.novoPeriodo();
    // Os treinos de uma mesma ficha recebem o mesmo período.
    this.fichas.update((l) => {
      const comPeriodo = new Map(l.filter((f) => f.fim).map((f) => [chaveDe(f), { inicio: f.inicio ?? p.inicio, fim: f.fim! }]));
      return l.map((f) => (f.fim ? f : { ...f, ...(comPeriodo.get(chaveDe(f)) ?? p) }));
    });
  }

  /** Criar uma ficha nova encerra, hoje, as que estão ativas: elas passam a vencidas. */
  private vencerAtivas(): void {
    const chaves = new Set(this.blocosAtivos().map((b) => b.chave));
    if (chaves.size === 0) return;
    const hoje = dataLocal();
    this.fichas.update((l) => l.map((f) => (chaves.has(chaveDe(f)) ? { ...f, fim: hoje } : f)));
  }

  criar(nome = 'Nova ficha'): Ficha {
    this.vencerAtivas();
    const ficha: Ficha = { id: crypto.randomUUID(), nome, itens: [], ...this.novoPeriodo() };
    this.fichas.update((l) => [...l, ficha]);
    this.ativaId.set(ficha.id);
    return ficha;
  }

  /** Começa uma ficha nova sem gravá-la: ela só é salva ao receber o primeiro exercício. */
  criarRascunho(nome: string, conjunto?: { id: string; nome: string }): Ficha {
    // O período começa quando a ficha passa a existir de verdade (ao receber o primeiro exercício), não agora.
    // Com `conjunto`, é um treino novo de uma ficha que já existe: entra nela, com o período dela.
    const ficha: Ficha = { id: crypto.randomUUID(), nome, itens: [], ...(conjunto ? { conjunto } : {}) };
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
    if (modelos.length === 0) return [];
    this.vencerAtivas();
    const periodo = this.novoPeriodo();
    const novas = modelos.map((m) => ({ id: crypto.randomUUID(), nome: m.nome, itens: m.itens, ...periodo }));
    this.fichas.update((l) => [...l, ...novas]);
    this.ativaId.set(novas[0].id);
    return novas;
  }

  /** Cria uma ficha com vários treinos (A, B, C…) e ativa o primeiro. As fichas que já existem não mudam. */
  criarConjunto(nome: string, treinos: { nome: string; itens: ItemFicha[] }[]): Ficha[] {
    if (treinos.length === 0) return [];
    this.vencerAtivas();
    const conjunto = { id: crypto.randomUUID(), nome: nome.trim() || 'Minha ficha' };
    const periodo = this.novoPeriodo();
    const novas: Ficha[] = treinos.map((t) => ({ id: crypto.randomUUID(), nome: t.nome, itens: t.itens, conjunto, ...periodo }));
    this.fichas.update((l) => [...l, ...novas]);
    this.ativaId.set(novas[0].id);
    return novas;
  }

  /**
   * Acrescenta um treino a uma ficha: a indicada por `conjuntoId` ou, sem ela, a ficha atual (a ativa). Ele entra como o
   * último treino da ficha. Se a ficha tinha um treino só, ela passa a ser uma ficha com dois. Sem nenhuma ficha, o treino vira a primeira.
   */
  adicionarTreino(nome: string, itens: ItemFicha[], conjuntoId?: string): { treino: Ficha; ficha: string } {
    const doConjunto = conjuntoId ? this.fichas().find((f) => f.conjunto?.id === conjuntoId) : undefined;
    const emUso = this.fichasEmUso();
    const atual = doConjunto ?? emUso.find((f) => f.id === this.ativaId()) ?? emUso[0];
    if (!atual) {
      const [primeiro] = this.criarComItens([{ nome, itens }]);
      return { treino: primeiro, ficha: nome };
    }
    const conjunto = atual.conjunto ?? { id: crypto.randomUUID(), nome: atual.nome };
    const treino: Ficha = { id: crypto.randomUUID(), nome, itens, conjunto };
    this.inserirNoConjunto(treino, atual);
    return { treino: this.fichas().find((f) => f.id === treino.id)!, ficha: conjunto.nome };
  }

  /** Põe o treino depois dos que a ficha já tem, com o período dela. `membro` é um treino que já está na ficha. */
  private inserirNoConjunto(treino: Ficha, membro: Ficha): void {
    const conjunto = treino.conjunto!;
    const periodo = membro.fim ? { inicio: membro.inicio ?? this.novoPeriodo().inicio, fim: membro.fim } : this.novoPeriodo();
    const novo: Ficha = { ...treino, ...periodo };
    this.fichas.update((l) => {
      const marcada = l.map((f) => (f.id === membro.id ? { ...f, conjunto } : f));
      let ultimo = -1;
      marcada.forEach((f, i) => {
        if (f.conjunto?.id === conjunto.id) ultimo = i;
      });
      return [...marcada.slice(0, ultimo + 1), novo, ...marcada.slice(ultimo + 1)];
    });
  }

  /** Duração padrão das fichas novas, em meses (1 a 12). */
  definirMesesPadrao(meses: number): void {
    this.mesesPadrao.set(limitarMeses(meses));
  }

  /** Guarda a ficha (todos os treinos dela) em "Fichas arquivadas". */
  arquivarBloco(chave: string): void {
    this.fichas.update((l) => l.map((f) => (chaveDe(f) === chave ? { ...f, arquivada: true as const } : f)));
  }

  /** Tira a ficha dos arquivados e começa um período novo, com a duração padrão: ela volta a ficar ativa. */
  reativarBloco(chave: string): void {
    const p = this.novoPeriodo();
    this.fichas.update((l) =>
      l.map((f) => {
        if (chaveDe(f) !== chave) return f;
        const { arquivada: _arquivada, ...resto } = f;
        return { ...resto, ...p };
      }),
    );
  }

  /** Muda a data de fim da ficha. Precisa ser depois de hoje; devolve `false` se não for. */
  definirFimBloco(chave: string, fim: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fim) || fim <= dataLocal()) return false;
    this.fichas.update((l) => l.map((f) => (chaveDe(f) === chave ? { ...f, fim } : f)));
    return true;
  }

  /** Exclui a ficha inteira (um treino solto ou o conjunto), com todos os seus treinos. */
  removerBloco(chave: string): () => void {
    return this.removerOnde((f) => chaveDe(f) === chave);
  }

  /** Exclui a ficha inteira, com todos os seus treinos. */
  removerConjunto(conjuntoId: string): () => void {
    return this.removerOnde((f) => f.conjunto?.id === conjuntoId);
  }

  /** Exclui uma ficha. Devolve a função que a traz de volta (o Desfazer do aviso). */
  remover(id: string): () => void {
    return this.removerOnde((f) => f.id === id);
  }

  /**
   * Tira as fichas que passam em `cond`. O desfazer as devolve nas mesmas posições
   * e, se a ativa estava entre elas, a reativa. Fichas que já voltaram (pela nuvem) não duplicam.
   */
  private removerOnde(cond: (f: Ficha) => boolean): () => void {
    const antes = this.fichas();
    const tiradas = antes.flatMap((f, i) => (cond(f) ? [{ f, i }] : []));
    const ativa = this.ativaId();
    this.fichas.set(antes.filter((f) => !cond(f)));
    const ativaSaiu = tiradas.some((t) => t.f.id === ativa);
    if (ativaSaiu) this.ativaId.set(this.fichas()[0]?.id ?? null);
    return () => {
      let l = this.fichas();
      for (const { f, i } of tiradas) if (!l.some((x) => x.id === f.id)) l = [...l.slice(0, i), f, ...l.slice(i)];
      this.fichas.set(l);
      if (ativaSaiu) this.ativaId.set(ativa);
    };
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
      const membro = rascunho.conjunto ? this.fichas().find((f) => f.conjunto?.id === rascunho.conjunto!.id) : undefined;
      if (membro) {
        // Treino novo de uma ficha que já existe: não encerra as outras fichas.
        this.inserirNoConjunto(rascunho, membro);
      } else {
        this.vencerAtivas();
        const { conjunto: _conjunto, ...solto } = rascunho;
        this.fichas.update((l) => [...l, { ...solto, ...this.novoPeriodo() }]);
      }
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

  /** Leva o exercício da posição `de` para a posição `para` (arrastar na ficha). */
  reordenarItem(fichaId: string, de: number, para: number): void {
    this.atualizar(fichaId, (f) => {
      if (de === para || de < 0 || para < 0 || de >= f.itens.length || para >= f.itens.length) return f;
      const itens = [...f.itens];
      const [item] = itens.splice(de, 1);
      itens.splice(para, 0, item);
      return { ...f, itens };
    });
  }

  /** Nota fixa do exercício na ficha; texto vazio apaga a nota. */
  definirNotaDoItem(fichaId: string, indice: number, texto: string): void {
    const nota = limparNota(texto, NOTA_EXERCICIO_MAX);
    this.atualizar(fichaId, (f) => ({
      ...f,
      itens: f.itens.map((item, i) => {
        if (i !== indice) return item;
        const { nota: _antes, ...resto } = item;
        return nota ? { ...resto, nota } : resto;
      }),
    }));
  }

  /** Nota do treino em andamento; texto vazio apaga a nota. */
  definirNotaDoTreino(fichaId: string, texto: string): void {
    const nota = limparNota(texto, NOTA_TREINO_MAX);
    this.andamento(fichaId, (a) => {
      const { nota: _antes, ...resto } = a;
      return nota ? { ...resto, nota } : resto;
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
    const agora = Date.now();
    const andamento = this.emAndamento();
    // Sem treino em andamento desta ficha não há horário de início, e a duração fica sem registro.
    const duracaoMin = andamento && andamento.fichaId === fichaId ? duracaoDoTreino(andamento.iniciadoEm, agora, registros) : null;
    const nota = andamento && andamento.fichaId === fichaId ? limparNota(andamento.nota, NOTA_TREINO_MAX) : undefined;
    this.historico.update((h) => [
      ...h,
      {
        id,
        data: dataLocal(),
        fichaId,
        fichaNome: ficha?.nome,
        concluidaEm: agora,
        ...(duracaoMin !== null ? { duracaoMin } : {}),
        ...(nota ? { nota } : {}),
        registros,
        ...(temFoto ? { temFoto: true } : {}),
      },
    ]);
    this.emAndamento.set(null);
    return id;
  }

  /**
   * Registra uma atividade fora da ficha. Ela vale como o treino do dia (fica no histórico, conta na semana
   * e nas medalhas), mas não avança o rodízio das fichas. Devolve o id da sessão.
   */
  registrarAtividade(atividade: AtividadeRegistro, temFoto = false): string {
    const id = crypto.randomUUID();
    this.historico.update((h) => [
      ...h,
      { id, data: dataLocal(), fichaId: '', fichaNome: atividade.nome, atividade, concluidaEm: Date.now(), registros: [], ...(temFoto ? { temFoto: true } : {}) },
    ]);
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
    this.aplicarFichasDaNuvem(remoto, mesclar);
    this.pesos.aplicar(remoto.pesos, mesclar);
    this.favoritos.aplicar(remoto.favoritos, mesclar);
  }

  private aplicarFichasDaNuvem(remoto: EstadoNuvem, mesclar: boolean): void {
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
    this.garantirPeriodos();
  }

  /** O histórico como a nuvem o guarda: os treinos e os marcadores dos que foram apagados. */
  readonly sessoesParaSincronizar = computed<Sessao[]>(() => [
    ...this.historico(),
    ...Object.entries(this.excluidas()).map(([id, x]) => ({ id, data: x.data, fichaId: '', excluida: true as const, editadaEm: x.em })),
  ]);

  /** Corrige um treino já concluído (séries e nota). Os outros aparelhos recebem a versão nova. */
  editarSessao(id: string, mudanca: { registros: RegistroExercicio[]; nota: string }): void {
    const nota = limparNota(mudanca.nota, NOTA_TREINO_MAX);
    this.historico.update((h) =>
      h.map((s) => {
        if (s.id !== id) return s;
        const { nota: _antes, ...resto } = s;
        return { ...resto, registros: mudanca.registros, ...(nota ? { nota } : {}), editadaEm: Date.now() };
      }),
    );
  }

  /** Apaga um treino do histórico (some das estatísticas, do calendário e das medalhas) e avisa os outros aparelhos. */
  excluirSessao(id: string): Sessao | undefined {
    const s = this.historico().find((x) => x.id === id);
    if (!s) return undefined;
    this.historico.update((h) => h.filter((x) => x.id !== id));
    this.excluidas.update((e) => ({ ...e, [id]: { data: s.data, em: Date.now() } }));
    return s;
  }

  /**
   * Desfaz `excluirSessao`. O treino volta com uma versão mais nova que a da exclusão,
   * para que os outros aparelhos (que talvez já o tenham apagado) o recebam de novo.
   */
  restaurarSessao(s: Sessao): void {
    if (!s.id || this.historico().some((x) => x.id === s.id)) return;
    const id = s.id;
    const em = Math.max(Date.now(), (this.excluidas()[id]?.em ?? 0) + 1);
    this.excluidas.update(({ [id]: _apagada, ...resto }) => resto);
    this.mesclarSessoes([{ ...s, editadaEm: em }]);
  }

  /**
   * Junta sessões recebidas da nuvem ao histórico: o que falta entra, o que foi corrigido em outro aparelho
   * substitui a versão daqui (vale a mais nova) e o que foi apagado lá sai daqui. Em ordem de data.
   */
  mesclarSessoes(remotas: Sessao[]): void {
    let h = this.historico();
    let mudou = false;
    const apagadas = this.excluidas();
    for (const r of remotas) {
      if (!r.id) continue;
      const i = h.findIndex((s) => s.id === r.id);
      if (r.excluida) {
        // Uma exclusão mais antiga que a versão daqui (treino restaurado depois) não apaga.
        if (i >= 0 && (r.editadaEm ?? 0) >= (h[i].editadaEm ?? 0)) {
          h = h.filter((s) => s.id !== r.id);
          mudou = true;
        }
      } else if (apagadas[r.id]) {
        continue;
      } else if (i < 0) {
        h = [...h, r];
        mudou = true;
      } else if ((r.editadaEm ?? 0) > (h[i].editadaEm ?? 0)) {
        h = h.map((s, j) => (j === i ? r : s));
        mudou = true;
      }
    }
    if (!mudou) return;
    this.historico.set([...h].sort((a, b) => (a.concluidaEm ?? 0) - (b.concluidaEm ?? 0) || a.data.localeCompare(b.data)));
  }

  /** Apaga os dados deste aparelho (usado ao sair da conta). */
  limparLocal(): void {
    this.fichas.set([]);
    this.ativaId.set(null);
    this.historico.set([]);
    this.excluidas.set({});
    this.emAndamento.set(null);
    this.pesos.limpar();
    this.favoritos.limpar();
  }

  private atualizar(id: string, fn: (f: Ficha) => Ficha): void {
    this.fichas.update((l) => l.map((f) => (f.id === id ? fn(f) : f)));
  }
}
