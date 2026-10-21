import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CloudService } from './cloud.service';
import { ExerciseService } from './exercise.service';
import { Sessao } from './models';
import { PlanService } from './plan.service';
import {
  Amizade,
  Atividade,
  Comentario,
  Evento,
  Perfil,
  SocialBackend,
  chaveAmizade,
  gerarCodigo,
  idEvento,
  marcoDoTreino,
  montarTimeline,
  normalizarCodigo,
} from './social';
import { recordesDaSessao, volumeSessao } from './stats';
import { Cancelar, NuvemBackend } from './sync';

const CHAVE_PUBLICADOS = 'app-workout:publicados:v1';
/** Treinos mais antigos que isto não vão para a timeline (evita despejar o histórico ao entrar). */
const JANELA_PUBLICACAO_MS = 3 * 24 * 3600 * 1000;
/** Quantos treinos de cada amigo são lidos para as estatísticas (os mais recentes). */
export const LIMITE_SESSOES_AMIGO = 400;

export interface Pessoa {
  perfil: Perfil;
  amizade: Amizade;
}

@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly cloud = inject(CloudService);
  private readonly plans = inject(PlanService);
  private readonly ex = inject(ExerciseService);

  readonly eu = signal<Perfil | null>(null);
  readonly erro = signal('');
  readonly amizades = signal<Amizade[]>([]);
  private readonly perfis = signal<Record<string, Perfil>>({});
  private readonly eventosPor = signal<Record<string, Evento[]>>({});
  private readonly atividades = signal<Atividade[]>([]);
  private readonly sessoesPor = signal<Record<string, Sessao[]>>({});

  private api?: SocialBackend;
  private nuvem?: NuvemBackend;
  private uid = '';
  private parar: Cancelar[] = [];
  private ouvintesEventos = new Map<string, Cancelar>();
  private ouvintesSessoes = new Map<string, Cancelar>();
  private buscando = new Set<string>();
  private publicados = new Set<string>(lerPublicados());

  private pessoa(a: Amizade): Pessoa {
    const outro = a.membros.find((m) => m !== this.uid) ?? '';
    return { amizade: a, perfil: this.perfis()[outro] ?? { uid: outro, nome: 'Amigo', foto: null } };
  }

  readonly amigos = computed(() =>
    this.amizades()
      .filter((a) => a.status === 'aceita')
      .map((a) => this.pessoa(a))
      .sort((a, b) => a.perfil.nome.localeCompare(b.perfil.nome, 'pt-BR')),
  );
  readonly convitesRecebidos = computed(() => this.amizades().filter((a) => a.status === 'pendente' && a.de !== this.uid).map((a) => this.pessoa(a)));
  readonly convitesEnviados = computed(() => this.amizades().filter((a) => a.status === 'pendente' && a.de === this.uid).map((a) => this.pessoa(a)));
  readonly ativo = computed(() => this.eu() !== null);

  readonly timeline = computed(() => montarTimeline(Object.values(this.eventosPor()).flat(), this.atividades()));

  constructor() {
    effect(() => {
      const s = this.cloud.social();
      untracked(() => (s ? void this.iniciar(s.uid, s.api, s.nuvem) : this.encerrar()));
    });
    effect(() => {
      this.plans.historico();
      this.eu();
      untracked(() => void this.publicarNovos());
    });
    effect(() => {
      const ids = new Set(this.amigos().map((p) => p.perfil.uid));
      ids.add(this.uid);
      untracked(() => this.ajustarEventos(ids));
    });
  }

  // --- Perfil e código ---------------------------------------------------------------------

  private async iniciar(uid: string, api: SocialBackend, nuvem: NuvemBackend): Promise<void> {
    this.encerrar();
    this.uid = uid;
    this.api = api;
    this.nuvem = nuvem;
    const u = this.cloud.usuario();
    try {
      const existente = await api.lerPerfil(uid);
      let codigo = existente?.codigo;
      for (let i = 0; !codigo && i < 6; i++) {
        const tentativa = gerarCodigo();
        if (await api.reservarCodigo(uid, tentativa)) codigo = tentativa;
      }
      const perfil: Perfil = {
        uid,
        nome: u?.nome || u?.email || existente?.nome || 'Você',
        foto: u?.foto ?? existente?.foto ?? null,
        codigo,
        metaSemanal: existente?.metaSemanal,
      };
      await api.gravarPerfil(perfil);
      if (this.uid !== uid) return; // saiu da conta enquanto carregava
      this.eu.set(perfil);
      this.parar.push(
        api.ouvirAmizades(uid, (l) => this.aoAmizades(l), (e) => this.falhou(e)),
        api.ouvirAtividades(uid, (l) => this.atividades.set(l), (e) => this.falhou(e)),
      );
    } catch (e) {
      this.falhou(e);
    }
  }

  private encerrar(): void {
    this.parar.forEach((c) => c());
    this.ouvintesEventos.forEach((c) => c());
    this.ouvintesSessoes.forEach((c) => c());
    this.parar = [];
    this.ouvintesEventos.clear();
    this.ouvintesSessoes.clear();
    this.buscando.clear();
    this.api = undefined;
    this.nuvem = undefined;
    this.uid = '';
    this.eu.set(null);
    this.amizades.set([]);
    this.perfis.set({});
    this.eventosPor.set({});
    this.atividades.set([]);
    this.sessoesPor.set({});
    this.erro.set('');
  }

  private falhou(e: unknown): void {
    const codigo = (e as { code?: string }).code;
    this.erro.set(
      codigo === 'permission-denied'
        ? 'Sem permissão. Publique as regras novas do Firestore (veja o README) e tente de novo.'
        : 'Não foi possível falar com o servidor agora. Tente de novo em instantes.',
    );
  }

  /** Salva a meta semanal no perfil, para os amigos verem a barra de progresso certa. */
  async publicarMeta(meta: number): Promise<void> {
    const eu = this.eu();
    if (!eu || !this.api) return;
    const novo = { ...eu, metaSemanal: meta };
    this.eu.set(novo);
    try {
      await this.api.gravarPerfil(novo);
    } catch (e) {
      this.falhou(e);
    }
  }

  // --- Amizades ----------------------------------------------------------------------------

  private aoAmizades(lista: Amizade[]): void {
    this.amizades.set(lista);
    const faltam = lista.flatMap((a) => a.membros).filter((m) => m !== this.uid && !this.perfis()[m] && !this.buscando.has(m));
    for (const m of new Set(faltam)) {
      this.buscando.add(m);
      this.api?.lerPerfil(m).then(
        (p) => p && this.perfis.update((x) => ({ ...x, [m]: p })),
        () => this.buscando.delete(m),
      );
    }
  }

  /** Atualiza o perfil de um amigo (nome, foto, meta) a partir da nuvem. */
  async atualizarPerfil(uid: string): Promise<void> {
    const p = await this.api?.lerPerfil(uid);
    if (p) this.perfis.update((x) => ({ ...x, [uid]: p }));
  }

  perfilDe(uid: string): Perfil | undefined {
    return uid === this.uid ? (this.eu() ?? undefined) : this.perfis()[uid];
  }

  async adicionarPorCodigo(texto: string): Promise<{ ok: boolean; mensagem: string }> {
    const eu = this.eu();
    if (!eu || !this.api) return { ok: false, mensagem: 'Entre na sua conta para adicionar amigos.' };
    const codigo = normalizarCodigo(texto);
    if (codigo.length !== 8) return { ok: false, mensagem: 'O código tem 8 letras e números.' };
    if (codigo === eu.codigo) return { ok: false, mensagem: 'Esse é o seu próprio código.' };
    try {
      const uid = await this.api.uidDoCodigo(codigo);
      if (!uid) return { ok: false, mensagem: 'Não encontramos ninguém com esse código.' };
      const id = chaveAmizade(this.uid, uid);
      const existente = this.amizades().find((a) => a.id === id);
      const perfil = (await this.api.lerPerfil(uid)) ?? { uid, nome: 'Amigo', foto: null };
      this.perfis.update((x) => ({ ...x, [uid]: perfil }));
      if (existente?.status === 'aceita') return { ok: false, mensagem: `Você e ${perfil.nome} já são amigos.` };
      if (existente && existente.de === this.uid) return { ok: false, mensagem: `O convite para ${perfil.nome} já foi enviado.` };
      if (existente) {
        await this.api.aceitarAmizade(id);
        return { ok: true, mensagem: `${perfil.nome} já tinha convidado você. Agora vocês são amigos!` };
      }
      await this.api.pedirAmizade({ id, membros: [this.uid, uid].sort(), de: this.uid, status: 'pendente', criadoEm: Date.now() });
      return { ok: true, mensagem: `Convite enviado para ${perfil.nome}. Falta a pessoa aceitar.` };
    } catch (e) {
      this.falhou(e);
      return { ok: false, mensagem: this.erro() };
    }
  }

  async aceitar(a: Amizade): Promise<void> {
    try {
      await this.api?.aceitarAmizade(a.id);
    } catch (e) {
      this.falhou(e);
    }
  }

  /** Recusa um convite, cancela um enviado ou desfaz a amizade. */
  async remover(a: Amizade): Promise<void> {
    try {
      await this.api?.removerAmizade(a.id);
    } catch (e) {
      this.falhou(e);
    }
  }

  // --- Timeline ----------------------------------------------------------------------------

  private ajustarEventos(ids: Set<string>): void {
    const api = this.api;
    if (!api || !this.uid) return;
    for (const uid of ids) {
      if (!uid || this.ouvintesEventos.has(uid)) continue;
      this.ouvintesEventos.set(
        uid,
        api.ouvirEventos(uid, (l) => this.eventosPor.update((x) => ({ ...x, [uid]: l })), (e) => this.aoErroDe(uid, e)),
      );
    }
    // Quem deixou de ser amigo sai da timeline e das estatísticas: para de ouvir os dois.
    const sobras = new Set([...this.ouvintesEventos.keys(), ...this.ouvintesSessoes.keys()]);
    for (const uid of sobras) {
      if (!ids.has(uid)) this.soltar(uid);
    }
  }

  /** Para de acompanhar uma pessoa (treinos publicados e histórico) e esquece o que veio dela. */
  private soltar(uid: string): void {
    this.ouvintesEventos.get(uid)?.();
    this.ouvintesEventos.delete(uid);
    this.ouvintesSessoes.get(uid)?.();
    this.ouvintesSessoes.delete(uid);
    const sem = <T>(x: Record<string, T>) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== uid));
    this.eventosPor.update(sem);
    this.sessoesPor.update(sem);
  }

  /**
   * Erro ao ouvir uma pessoa. Se for um amigo, "sem permissão" quase sempre quer dizer que a amizade
   * acabou (a lista de amizades ainda não chegou); isso não é problema do app e não vira aviso na tela.
   */
  private aoErroDe(uid: string, e: unknown): void {
    if (uid !== this.uid && (e as { code?: string }).code === 'permission-denied') {
      this.soltar(uid);
      return;
    }
    this.falhou(e);
  }

  /** Publica na timeline os treinos concluídos há pouco que ainda não foram publicados. */
  private async publicarNovos(): Promise<void> {
    const eu = this.eu();
    const api = this.api;
    if (!eu || !api) return;
    const historico = this.plans.historico();
    const ordenados = [...historico].sort((a, b) => a.data.localeCompare(b.data) || (a.concluidaEm ?? 0) - (b.concluidaEm ?? 0));
    const agora = Date.now();
    for (const s of historico) {
      if (!s.id || !s.concluidaEm || this.publicados.has(s.id) || agora - s.concluidaEm > JANELA_PUBLICACAO_MS) continue;
      this.publicados.add(s.id);
      const evento: Evento = {
        id: idEvento(s.concluidaEm, s.id),
        autor: eu.uid,
        autorNome: eu.nome,
        autorFoto: eu.foto,
        tipo: 'treino',
        criadoEm: s.concluidaEm,
        sessaoId: s.id,
        data: s.data,
        fichaNome: s.fichaNome ?? this.plans.get(s.fichaId)?.nome ?? 'Treino',
        exercicios: s.registros?.length ?? 0,
        volume: volumeSessao(s),
        recordes: recordesDaSessao(historico, s).slice(0, 3).map((r) => ({ nome: this.nomeExercicio(r.exerciseId), carga: r.carga })),
        marco: marcoDoTreino(ordenados.findIndex((x) => x.id === s.id) + 1),
      };
      try {
        await api.publicarEvento(evento);
        salvarPublicados(this.publicados);
      } catch (e) {
        this.publicados.delete(s.id);
        this.falhou(e);
      }
    }
  }

  private nomeExercicio(id: string): string {
    const e = this.ex.get(id);
    return e ? this.ex.nome(e) : id;
  }

  // --- Reações -----------------------------------------------------------------------------

  ouvirCurtidas(dono: string, eventoId: string, cb: (uids: string[]) => void): Cancelar {
    return this.api?.ouvirCurtidas(dono, eventoId, cb) ?? (() => undefined);
  }

  ouvirComentarios(dono: string, eventoId: string, cb: (c: Comentario[]) => void): Cancelar {
    return this.api?.ouvirComentarios(dono, eventoId, cb) ?? (() => undefined);
  }

  async alternarCurtida(dono: string, eventoId: string, curtido: boolean): Promise<void> {
    const eu = this.eu();
    if (!eu || !this.api) return;
    try {
      if (curtido) await this.api.descurtir(dono, eventoId, eu.uid);
      else await this.api.curtir(dono, eventoId, eu);
    } catch (e) {
      this.falhou(e);
    }
  }

  async comentar(dono: string, eventoId: string, texto: string): Promise<void> {
    const eu = this.eu();
    if (!eu || !this.api) return;
    try {
      await this.api.comentar(dono, eventoId, eu, texto);
    } catch (e) {
      this.falhou(e);
    }
  }

  async apagarComentario(dono: string, eventoId: string, c: Comentario): Promise<void> {
    try {
      await this.api?.apagarComentario(dono, eventoId, c.id);
    } catch (e) {
      this.falhou(e);
    }
  }

  // --- Estatísticas de amigos --------------------------------------------------------------

  /** Treinos concluídos de um amigo (começa a acompanhar na primeira chamada). */
  sessoesDe(uid: string): Sessao[] {
    if (uid && uid !== this.uid && this.nuvem && !this.ouvintesSessoes.has(uid)) {
      this.ouvintesSessoes.set(
        uid,
        this.nuvem.ouvirSessoes(uid, (l) => this.sessoesPor.update((x) => ({ ...x, [uid]: l })), (e) => this.aoErroDe(uid, e), LIMITE_SESSOES_AMIGO),
      );
    }
    return this.sessoesPor()[uid] ?? [];
  }

  sessoesCarregadas(uid: string): boolean {
    return uid in this.sessoesPor();
  }
}

function lerPublicados(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_PUBLICADOS) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function salvarPublicados(s: Set<string>): void {
  try {
    localStorage.setItem(CHAVE_PUBLICADOS, JSON.stringify([...s].slice(-300)));
  } catch {
    // sem armazenamento: pode publicar de novo (o id é fixo, não duplica)
  }
}
