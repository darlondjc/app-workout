import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CloudService } from './cloud.service';
import { ExerciseService } from './exercise.service';
import { RegistroPeso, Sessao } from './models';
import { resumoAtividade } from './atividade';
import { MedalhasService } from './medalhas.service';
import { PesoService } from './peso.service';
import { PlanService } from './plan.service';
import {
  AcessoGrupo,
  Amizade,
  Atividade,
  Comentario,
  Conexao,
  Evento,
  Grupo,
  ItemTimeline,
  Perfil,
  fotoParaItens,
  SocialBackend,
  TAMANHO_NOME_GRUPO,
  chaveConexao,
  gerarCodigo,
  timelineDaPessoa,
  idEvento,
  marcoDoTreino,
  montarTimeline,
  nomeComMaiuscula,
  normalizarCodigo,
  timelineDoGrupo,
} from './social';
import { recordesDaSessao, volumeSessao } from './stats';
import { Cancelar, NuvemBackend } from './sync';

const CHAVE_PUBLICADOS = 'app-workout:publicados:v1';
/** Até quando a timeline já foi vista, por conta (a chave leva o uid no fim). */
const CHAVE_VISTO = 'app-workout:social-visto:v1';
/** Quem já estava em cada grupo na última vez que a pessoa o abriu, por conta (a chave leva o uid no fim). */
const CHAVE_MEMBROS_VISTOS = 'app-workout:grupos-membros-vistos:v1';
/** Treinos mais antigos que isto não vão para a timeline (evita despejar o histórico ao entrar). */
const JANELA_PUBLICACAO_MS = 3 * 24 * 3600 * 1000;
/** Quantos treinos de cada colega de grupo são lidos para as estatísticas (os mais recentes). */
export const LIMITE_SESSOES_MEMBRO = 400;

/** Quantos itens da timeline aparecem de cada vez; ao chegar ao fim da tela entram mais. */
export const PAGINA_TIMELINE = 10;
/** Quanto cada pessoa (treinos) e a caixa de reações (curtidas e comentários) são lidos, e quanto cresce a leitura a cada página. */
const BUSCA_EVENTOS = 15;
const BUSCA_ATIVIDADES = 30;

/** O que acontece quando alguém usa um link de convite. */
export type ResultadoEntrada =
  | { estado: 'entrou' | 'ja-membro' | 'pedido-enviado' | 'pedido-pendente'; grupo: Grupo }
  | { estado: 'inexistente' | 'erro'; mensagem: string };

/** Resultado de pedir amizade a alguém. */
export type ResultadoAmizade =
  | { estado: 'pedido-enviado' | 'pedido-pendente' | 'ja-amigos' | 'aceito'; perfil: Perfil }
  | { estado: 'inexistente' | 'proprio' | 'erro'; mensagem: string };

export interface PedidoDeEntrada {
  grupo: Grupo;
  perfil: Perfil;
}

@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly cloud = inject(CloudService);
  private readonly plans = inject(PlanService);
  private readonly ex = inject(ExerciseService);
  private readonly medalhas = inject(MedalhasService);
  private readonly peso = inject(PesoService);

  readonly eu = signal<Perfil | null>(null);
  readonly erro = signal('');
  readonly grupos = signal<Grupo[]>([]);
  /** Grupos com aprovação em que a pessoa pediu para entrar e ainda espera o dono responder. */
  readonly gruposPendentes = signal<Grupo[]>([]);
  readonly amizades = signal<Amizade[]>([]);
  private readonly conexoes = signal<Conexao[]>([]);
  /** Falso até a primeira resposta da nuvem com os grupos da pessoa. */
  readonly gruposCarregados = signal(false);
  readonly conexoesCarregadas = signal(false);
  readonly amizadesCarregadas = signal(false);
  private readonly perfis = signal<Record<string, Perfil>>({});
  private readonly eventosPor = signal<Record<string, Evento[]>>({});
  private readonly atividades = signal<Atividade[]>([]);
  private readonly sessoesPor = signal<Record<string, Sessao[]>>({});
  /** Peso que cada amigo compartilha; `null` = ele não compartilha. */
  private readonly pesosPor = signal<Record<string, RegistroPeso[] | null>>({});

  private api?: SocialBackend;
  private nuvem?: NuvemBackend;
  private uid = '';
  private parar: Cancelar[] = [];
  private ouvintesEventos = new Map<string, Cancelar>();
  private ouvinteAtividades?: Cancelar;
  private ouvintesSessoes = new Map<string, Cancelar>();
  private ouvintesPeso = new Map<string, Cancelar>();
  private buscando = new Set<string>();
  private publicados = new Set<string>(lerPublicados());
  private ligando = new Set<string>();

  /** Amigos mais chegados (pedido aceito), pelo nome. */
  readonly amigos = computed(() =>
    this.amizades()
      .filter((a) => a.status === 'aceita')
      .map((a) => this.perfilDeAmizade(a))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );
  /** Pedidos de amizade que outras pessoas me fizeram e esperam resposta. */
  readonly pedidosDeAmizade = computed(() => this.amizades().filter((a) => a.status === 'pendente' && a.de !== this.uid).map((a) => ({ amizade: a, perfil: this.perfilDeAmizade(a) })));
  /** Pedidos que eu fiz e ainda não foram aceitos. */
  readonly pedidosEnviados = computed(() => this.amizades().filter((a) => a.status === 'pendente' && a.de === this.uid).map((a) => ({ amizade: a, perfil: this.perfilDeAmizade(a) })));

  private perfilDeAmizade(a: Amizade): Perfil {
    const outro = a.membros.find((m) => m !== this.uid) ?? '';
    return this.perfis()[outro] ?? { uid: outro, nome: 'Amigo', foto: null };
  }

  /** A amizade com `uid` (em qualquer estado), se existir. */
  amizadeCom(uid: string): Amizade | undefined {
    const id = chaveConexao(this.uid, uid);
    return this.amizades().find((a) => a.id === id);
  }

  ehAmigo(uid: string): boolean {
    return this.amizadeCom(uid)?.status === 'aceita';
  }

  /** Quem está em algum grupo comigo ou é amigo mais chegado (as pessoas cujos treinos eu posso ler). */
  private readonly colegas = computed(
    () =>
      new Set([
        ...this.conexoes().flatMap((c) => c.membros),
        ...this.amizades().filter((a) => a.status === 'aceita').flatMap((a) => a.membros),
      ].filter((m) => m !== this.uid)),
  );

  /** Grupos em ordem alfabética. */
  readonly gruposOrdenados = computed(() => [...this.grupos()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));

  grupo(id: string): Grupo | undefined {
    return this.grupos().find((g) => g.id === id);
  }

  /** Membros de um grupo, eu primeiro e os demais em ordem alfabética. */
  membrosDe(g: Grupo): Perfil[] {
    const outros = g.membros
      .filter((m) => m !== this.uid)
      .map((m) => this.perfilDe(m) ?? { uid: m, nome: 'Membro', foto: null })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const eu = this.eu();
    return eu && g.membros.includes(eu.uid) ? [eu, ...outros] : outros;
  }

  /** A pessoa pode ver treinos e estatísticas de `uid`: é ela mesma ou está em algum grupo com ela. */
  podeVer(uid: string): boolean {
    return uid === this.uid || this.colegas().has(uid);
  }

  /** Minha conta com a foto que vale (a escolhida no app, se houver). */
  readonly meuUsuario = computed(() => {
    const u = this.cloud.usuario();
    const eu = this.eu();
    return u && eu?.fotoPropria ? { ...u, foto: eu.foto } : u;
  });

  /** Pedidos de entrada nos grupos que eu criei e que pedem aprovação. */
  readonly pedidosRecebidos = computed<PedidoDeEntrada[]>(() =>
    this.grupos()
      .filter((g) => g.dono === this.uid)
      .flatMap((g) => (g.pedidos ?? []).map((uid) => ({ grupo: g, perfil: this.perfilDe(uid) ?? { uid, nome: 'Alguém', foto: null } }))),
  );
  readonly ativo = computed(() => this.eu() !== null);

  /** Tudo o que já foi lido da nuvem, do mais novo para o mais antigo. */
  readonly timeline = computed(() => montarTimeline(Object.values(this.eventosPor()).flat(), this.atividades()));

  private readonly paginas = signal(1);
  private readonly limiteEventos = signal(BUSCA_EVENTOS);
  private readonly limiteAtividades = signal(BUSCA_ATIVIDADES);

  /** A timeline de um grupo: só treinos (e reações) das pessoas dele. */
  timelineDe(grupoId: string): ItemTimeline[] {
    const g = this.grupo(grupoId);
    return g ? timelineDoGrupo(this.timeline(), g.membros) : [];
  }

  /** O que a tela mostra agora de um grupo: as primeiras páginas da timeline dele. */
  timelineVisivelDe(grupoId: string): ItemTimeline[] {
    return this.timelineDe(grupoId).slice(0, this.paginas() * PAGINA_TIMELINE);
  }

  /** Ainda há o que mostrar neste grupo: itens já lidos fora da tela ou mais na nuvem. */
  temMaisDe(grupoId: string): boolean {
    return this.timelineVisivelDe(grupoId).length < this.timelineDe(grupoId).length || this.nuvemTemMais();
  }

  /** Leitura que veio cheia (no limite) pode ter mais para trás; vazia ou parcial é o fim. */
  private readonly nuvemTemMais = computed(
    () =>
      Object.values(this.eventosPor()).some((l) => l.length >= this.limiteEventos()) ||
      this.atividades().length >= this.limiteAtividades(),
  );

  /** A timeline de uma pessoa (um amigo, por exemplo): só os treinos dela. */
  timelineDePessoa(uid: string): ItemTimeline[] {
    return timelineDaPessoa(this.timeline(), uid);
  }

  timelineVisivelDePessoa(uid: string): ItemTimeline[] {
    return this.timelineDePessoa(uid).slice(0, this.paginas() * PAGINA_TIMELINE);
  }

  temMaisDePessoa(uid: string): boolean {
    return this.timelineVisivelDePessoa(uid).length < this.timelineDePessoa(uid).length || this.nuvemTemMais();
  }

  carregarMaisDePessoa(uid: string): void {
    if (!this.temMaisDePessoa(uid)) return;
    this.paginas.update((p) => p + 1);
    if (this.paginas() * PAGINA_TIMELINE > this.timelineDePessoa(uid).length && this.nuvemTemMais()) this.ampliarLeitura();
  }

  /** Chegou ao fim da tela de um grupo: mostra mais uma página e, se já mostrou tudo o que foi lido, lê mais da nuvem. */
  carregarMais(grupoId: string): void {
    if (!this.temMaisDe(grupoId)) return;
    this.paginas.update((p) => p + 1);
    if (this.paginas() * PAGINA_TIMELINE > this.timelineDe(grupoId).length && this.nuvemTemMais()) this.ampliarLeitura();
  }

  private ampliarLeitura(): void {
    this.limiteEventos.update((l) => l + BUSCA_EVENTOS);
    this.limiteAtividades.update((l) => l + BUSCA_ATIVIDADES);
    // Reabre as leituras com o limite maior; o que já chegou continua na tela até o novo resultado.
    for (const uid of [...this.ouvintesEventos.keys()]) {
      this.ouvintesEventos.get(uid)?.();
      this.ouvirEventosDe(uid);
    }
    this.ouvirAtividadesProprias();
  }

  /** `criadoEm` da novidade mais recente que a pessoa já viu na timeline (neste aparelho). */
  private readonly vistoAte = signal(0);

  /** Quantas novidades de outras pessoas (treinos de colegas de grupo, curtidas, comentários) chegaram depois da última vez que a timeline foi vista. */
  readonly novidades = computed(() => {
    const visto = this.vistoAte();
    const eu = this.eu()?.uid;
    if (!eu) return 0;
    return this.timeline().filter((i) => i.criadoEm > visto && (i.tipo === 'evento' ? i.evento.autor : i.atividade.autor) !== eu).length;
  });

  /** Membros de cada grupo que a pessoa já viu (ao abrir o grupo); quem entra depois disso é novo. */
  private readonly membrosVistos = signal<Record<string, string[]>>({});

  /** Quantas pessoas entraram neste grupo desde a última vez que a pessoa o abriu. */
  novosMembrosDe(grupoId: string): number {
    const g = this.grupo(grupoId);
    if (!g) return 0;
    const vistos = this.membrosVistos()[g.id] ?? g.membros; // grupo ainda não registrado: tudo o que há nele já conta como visto
    return g.membros.filter((m) => m !== this.uid && !vistos.includes(m)).length;
  }

  /** Total de pessoas novas em todos os grupos. */
  readonly novosMembros = computed(() => this.grupos().reduce((t, g) => t + this.novosMembrosDe(g.id), 0));

  /** A pessoa abriu o grupo: quem está nele agora passa a ser conhecido. */
  marcarMembrosVistos(grupoId: string): void {
    const g = this.grupo(grupoId);
    if (!g || !this.uid || this.novosMembrosDe(g.id) === 0) return;
    this.guardarMembrosVistos({ ...this.membrosVistos(), [g.id]: [...g.membros] });
  }

  private guardarMembrosVistos(v: Record<string, string[]>): void {
    this.membrosVistos.set(v);
    gravarMembrosVistos(this.uid, v);
  }

  /** O que o selo da aba Social mostra: novidades, pedidos de entrada e de amizade esperando resposta e gente nova nos grupos. */
  readonly avisosDaAba = computed(() => this.novidades() + this.pedidosRecebidos().length + this.novosMembros() + this.pedidosDeAmizade().length);

  /** A pessoa está olhando a timeline: tudo o que há nela passa a ser visto. */
  marcarTimelineVista(): void {
    if (!this.uid) return;
    const mais = this.timeline().reduce((m, i) => Math.max(m, i.criadoEm), this.vistoAte());
    if (mais <= this.vistoAte()) return;
    this.vistoAte.set(mais);
    gravarVisto(this.uid, mais);
  }

  constructor() {
    effect(() => {
      const s = this.cloud.social();
      untracked(() => (s ? void this.iniciar(s.uid, s.api, s.nuvem) : this.encerrar()));
    });
    effect(() => {
      this.plans.historico();
      this.eu();
      this.medalhas.pronto(); // as medalhas do treino só podem ser contadas com o catálogo de exercícios pronto
      untracked(() => void this.publicarNovos());
    });
    effect(() => {
      const ids = new Set(this.colegas());
      ids.add(this.uid);
      untracked(() => this.ajustarEventos(ids));
    });
    // Com o compartilhamento ligado, o peso vai para os amigos (e vai de novo a cada registro novo).
    effect(() => {
      const compartilha = this.eu()?.compartilhaPeso === true;
      const registros = this.peso.registros();
      if (compartilha) untracked(() => void this.publicarPeso(registros));
    });
    effect(() => {
      const grupos = this.grupos();
      const conexoes = this.conexoes();
      untracked(() => this.conectarMembros(grupos, conexoes));
    });
  }

  // --- Perfil ------------------------------------------------------------------------------

  private async iniciar(uid: string, api: SocialBackend, nuvem: NuvemBackend): Promise<void> {
    this.encerrar();
    this.uid = uid;
    this.api = api;
    this.nuvem = nuvem;
    this.vistoAte.set(lerVisto(uid));
    this.membrosVistos.set(lerMembrosVistos(uid));
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
        // Foto escolhida no app vale mais que a da conta Google, que só entra enquanto não houver uma.
        foto: existente?.fotoPropria ? existente.foto : (u?.foto ?? existente?.foto ?? null),
        fotoPropria: existente?.fotoPropria ?? false,
        codigo,
        metaSemanal: existente?.metaSemanal,
        compartilhaPeso: existente?.compartilhaPeso ?? false,
      };
      await api.gravarPerfil(perfil);
      if (this.uid !== uid) return; // saiu da conta enquanto carregava
      this.eu.set(perfil);
      this.parar.push(
        api.ouvirGrupos(uid, (l) => this.aoGrupos(l), (e) => this.falhou(e, 'ouvir grupos')),
        api.ouvirPedidosFeitos(uid, (l) => this.aoPedidosFeitos(l), (e) => this.falhou(e, 'ouvir pedidos de entrada')),
        api.ouvirAmizades(uid, (l) => this.aoAmizades(l), (e) => this.falhou(e, 'ouvir amigos')),
        api.ouvirConexoes(uid, (l) => { this.conexoes.set(l); this.conexoesCarregadas.set(true); }, (e) => this.falhou(e, 'ouvir ligações entre membros')),
      );
      this.ouvirAtividadesProprias();
    } catch (e) {
      this.falhou(e, 'entrar na conta social (gravar perfil)');
    }
  }

  private ouvirAtividadesProprias(): void {
    this.ouvinteAtividades?.();
    if (!this.api || !this.uid) return;
    this.ouvinteAtividades = this.api.ouvirAtividades(this.uid, (l) => this.atividades.set(l), (e) => this.falhou(e, 'ouvir reações (atividades)'), this.limiteAtividades());
  }

  private encerrar(): void {
    this.ouvinteAtividades?.();
    this.ouvinteAtividades = undefined;
    this.paginas.set(1);
    this.limiteEventos.set(BUSCA_EVENTOS);
    this.limiteAtividades.set(BUSCA_ATIVIDADES);
    this.parar.forEach((c) => c());
    this.ouvintesEventos.forEach((c) => c());
    this.ouvintesSessoes.forEach((c) => c());
    this.ouvintesPeso.forEach((c) => c());
    this.ouvintesPeso.clear();
    this.parar = [];
    this.ouvintesEventos.clear();
    this.ouvintesSessoes.clear();
    this.buscando.clear();
    this.api = undefined;
    this.nuvem = undefined;
    this.uid = '';
    this.vistoAte.set(0);
    this.membrosVistos.set({});
    this.eu.set(null);
    this.grupos.set([]);
    this.gruposPendentes.set([]);
    this.amizades.set([]);
    this.pesosPor.set({});
    this.conexoes.set([]);
    this.gruposCarregados.set(false);
    this.conexoesCarregadas.set(false);
    this.amizadesCarregadas.set(false);
    this.ligando.clear();
    this.perfis.set({});
    this.eventosPor.set({});
    this.atividades.set([]);
    this.sessoesPor.set({});
    this.fotos.clear();
    this.erro.set('');
  }

  /** Mostra o erro na tela, dizendo em que operação foi (a pessoa testa no celular e não vê o console). */
  private falhou(e: unknown, onde = ''): void {
    const codigo = (e as { code?: string }).code;
    console.error('[social]', onde, e);
    const em = onde ? ` ao ${onde}` : '';
    this.erro.set(
      codigo === 'permission-denied'
        ? `Sem permissão${em}. Publique as regras novas do Firestore (veja o README) e tente de novo.`
        : `Não foi possível falar com o servidor agora${em}. Tente de novo em instantes.${codigo ? ` (${codigo})` : ''}${codigo === 'failed-precondition' ? ` ${(e as { message?: string }).message ?? ''}` : ''}`,
    );
  }

  /** Salva a meta semanal no perfil, para os colegas de grupo verem a barra de progresso certa. */
  async publicarMeta(meta: number): Promise<void> {
    const eu = this.eu();
    if (!eu || !this.api) return;
    const novo = { ...eu, metaSemanal: meta };
    this.eu.set(novo);
    try {
      await this.api.gravarPerfil(novo);
    } catch (e) {
      this.falhou(e, 'gravar meta no perfil');
    }
  }

  /** Troca a foto do perfil por uma escolhida no app (JPEG pequeno em data URL). */
  async trocarFoto(dados: string): Promise<void> {
    await this.gravarFoto({ foto: dados, fotoPropria: true });
  }

  /** Volta a usar a foto da conta Google (ou a inicial do nome, se a conta não tem foto). */
  async usarFotoDaConta(): Promise<void> {
    await this.gravarFoto({ foto: this.cloud.usuario()?.foto ?? null, fotoPropria: false });
  }

  private async gravarFoto(campos: Pick<Perfil, 'foto' | 'fotoPropria'>): Promise<void> {
    const eu = this.eu();
    if (!eu || !this.api) throw new Error('Entre na sua conta para trocar a foto.');
    const novo = { ...eu, ...campos };
    await this.api.gravarPerfil(novo);
    this.eu.set(novo);
  }

  // --- Amigos mais chegados -----------------------------------------------------------------

  private aoAmizades(lista: Amizade[]): void {
    this.amizades.set(lista);
    this.amizadesCarregadas.set(true);
    // Quem vem de uma amizade tenta de novo se a busca falhar: a próxima atualização da lista repete.
    for (const m of new Set(lista.flatMap((a) => a.membros))) this.garantirPerfil(m, true);
  }

  /** Quem é a pessoa por trás de um código de amigo (para mostrar antes de pedir amizade). */
  async previaPorCodigo(texto: string): Promise<Perfil | null> {
    const api = this.api;
    const codigo = normalizarCodigo(texto);
    if (!api || codigo.length !== 8) return null;
    try {
      const uid = await api.uidDoCodigo(codigo);
      if (!uid) return null;
      const perfil = (await api.lerPerfil(uid)) ?? { uid, nome: 'Amigo', foto: null };
      this.perfis.update((x) => ({ ...x, [uid]: perfil }));
      return perfil;
    } catch (e) {
      this.falhou(e, 'procurar pelo código');
      return null;
    }
  }

  /** Pede amizade pelo código pessoal (de um link ou digitado). */
  async pedirAmizadePorCodigo(texto: string): Promise<ResultadoAmizade> {
    const eu = this.eu();
    if (!eu || !this.api) return { estado: 'erro', mensagem: 'Entre na sua conta para adicionar amigos.' };
    const codigo = normalizarCodigo(texto);
    if (codigo.length !== 8) return { estado: 'inexistente', mensagem: 'O código tem 8 letras e números.' };
    if (codigo === eu.codigo) return { estado: 'proprio', mensagem: 'Esse é o seu próprio código.' };
    const perfil = await this.previaPorCodigo(codigo);
    if (!perfil) return { estado: 'inexistente', mensagem: this.erro() || 'Não encontramos ninguém com esse código.' };
    return this.pedirAmizade(perfil.uid);
  }

  /**
   * Pede amizade a alguém (de um grupo ou de fora). Se a pessoa já tinha me pedido, aceita; se já são amigos
   * ou o pedido já foi enviado, só avisa.
   */
  async pedirAmizade(uid: string): Promise<ResultadoAmizade> {
    const eu = this.eu();
    const api = this.api;
    if (!eu || !api) return { estado: 'erro', mensagem: 'Entre na sua conta para adicionar amigos.' };
    if (uid === eu.uid) return { estado: 'proprio', mensagem: 'Você não pode adicionar a si mesmo.' };
    try {
      const perfil = (await api.lerPerfil(uid)) ?? { uid, nome: 'Amigo', foto: null };
      this.perfis.update((x) => ({ ...x, [uid]: perfil }));
      const existente = this.amizadeCom(uid);
      if (existente?.status === 'aceita') return { estado: 'ja-amigos', perfil };
      if (existente && existente.de === eu.uid) return { estado: 'pedido-pendente', perfil };
      if (existente) {
        await api.aceitarAmizade(existente.id);
        return { estado: 'aceito', perfil };
      }
      await api.pedirAmizade({ id: chaveConexao(eu.uid, uid), membros: [eu.uid, uid].sort(), de: eu.uid, status: 'pendente', criadoEm: Date.now() });
      return { estado: 'pedido-enviado', perfil };
    } catch (e) {
      this.falhou(e, 'enviar pedido de amizade');
      return { estado: 'erro', mensagem: this.erro() };
    }
  }

  async aceitarAmizade(a: Amizade): Promise<void> {
    try {
      await this.api?.aceitarAmizade(a.id);
    } catch (e) {
      this.falhou(e, 'aceitar amizade');
    }
  }

  /** Recusa um pedido, cancela um enviado ou desfaz a amizade. */
  async removerAmizade(a: Amizade): Promise<void> {
    try {
      await this.api?.removerAmizade(a.id);
    } catch (e) {
      this.falhou(e, 'remover amizade');
    }
  }

  // --- Peso compartilhado ------------------------------------------------------------------

  /** Liga ou desliga o compartilhamento do gráfico de peso com os amigos mais chegados. */
  async compartilharPeso(compartilha: boolean): Promise<void> {
    const eu = this.eu();
    if (!eu || !this.api) return;
    const novo = { ...eu, compartilhaPeso: compartilha };
    this.eu.set(novo);
    try {
      await this.api.gravarPerfil(novo);
      // Desligar apaga o que estava compartilhado; ligar publica pelo efeito acima.
      if (!compartilha) await this.api.publicarPeso(eu.uid, null);
    } catch (e) {
      this.eu.set(eu);
      this.falhou(e, 'mudar o compartilhamento do peso');
    }
  }

  private async publicarPeso(registros: RegistroPeso[] | null): Promise<void> {
    const api = this.api;
    if (!api || !this.uid || !this.eu()) return;
    try {
      await api.publicarPeso(this.uid, registros);
    } catch (e) {
      this.falhou(e, 'compartilhar o peso');
    }
  }

  /**
   * Peso que um amigo compartilha (começa a acompanhar na primeira chamada). `null` se ele não compartilha
   * ou se você não é amigo dele; `undefined` enquanto a primeira resposta não chega.
   */
  pesoDe(uid: string): RegistroPeso[] | null | undefined {
    if (uid && uid !== this.uid && this.api && this.ehAmigo(uid) && !this.ouvintesPeso.has(uid)) {
      this.ouvintesPeso.set(
        uid,
        this.api.ouvirPeso(
          uid,
          (r) => this.pesosPor.update((x) => ({ ...x, [uid]: r })),
          (e) => ((e as { code?: string }).code === 'permission-denied' ? this.pesosPor.update((x) => ({ ...x, [uid]: null })) : this.falhou(e, 'ler o peso de um amigo')),
        ),
      );
    }
    return this.pesosPor()[uid];
  }

  // --- Grupos ------------------------------------------------------------------------------

  private aoGrupos(lista: Grupo[]): void {
    this.grupos.set(lista);
    this.gruposCarregados.set(true);
    // Grupo que a pessoa ainda não tinha registrado (o primeiro uso ou um grupo em que acabou de entrar): quem já está nele não é novo.
    const vistos = this.membrosVistos();
    const faltam = lista.filter((g) => !(g.id in vistos));
    if (faltam.length) this.guardarMembrosVistos({ ...vistos, ...Object.fromEntries(faltam.map((g) => [g.id, [...g.membros]])) });
    // Quem vem de um grupo tenta de novo se a busca falhar: a próxima atualização da lista repete.
    for (const m of new Set(lista.flatMap((g) => [...g.membros, ...(g.pedidos ?? [])]))) this.garantirPerfil(m, true);
  }

  private aoPedidosFeitos(lista: Grupo[]): void {
    // Quem foi aceito já aparece entre os grupos: não repete como pendente.
    this.gruposPendentes.set(lista.filter((g) => !g.membros.includes(this.uid)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    for (const g of lista) this.garantirPerfil(g.dono, true);
  }

  /** A pessoa desiste de um pedido de entrada que ainda não foi respondido. */
  async cancelarPedido(g: Grupo): Promise<void> {
    if (!this.api || !this.uid) return;
    const antes = this.gruposPendentes();
    this.gruposPendentes.set(antes.filter((x) => x.id !== g.id));
    try {
      await this.api.responderPedido(g.id, this.uid, false);
    } catch (e) {
      this.gruposPendentes.set(antes);
      this.falhou(e, 'cancelar o pedido de entrada');
    }
  }

  /**
   * Quem entra num grupo (ou já estava nele quando alguém chega) liga a si mesma a cada outro membro.
   * É a ligação que dá o direito de ler os treinos um do outro.
   */
  private conectarMembros(grupos: Grupo[], conexoes: Conexao[]): void {
    const api = this.api;
    if (!api || !this.uid) return;
    const existentes = new Map(conexoes.map((c) => [c.id, c.grupos ?? []]));
    for (const g of grupos) {
      for (const m of g.membros) {
        if (m === this.uid) continue;
        const id = chaveConexao(this.uid, m);
        const chave = `${id}:${g.id}`;
        if (existentes.get(id)?.includes(g.id) || this.ligando.has(chave)) continue;
        this.ligando.add(chave);
        api.ligar(this.uid, m, g.id).catch((e: unknown) => {
          this.ligando.delete(chave);
          this.falhou(e, 'ligar você aos membros do grupo');
        });
      }
    }
  }

  /** Busca o perfil de uma pessoa uma vez por sessão. Com `repetir`, uma falha libera uma nova tentativa. */
  private garantirPerfil(uid: string, repetir = false): void {
    const api = this.api;
    if (!api || !uid || uid === this.uid || this.perfis()[uid] || this.buscando.has(uid)) return;
    this.buscando.add(uid);
    api.lerPerfil(uid).then(
      (p) => {
        if (p && this.api === api) this.perfis.update((x) => ({ ...x, [uid]: p }));
      },
      () => {
        if (repetir) this.buscando.delete(uid);
      },
    );
  }

  /** Atualiza o perfil de outra pessoa (nome, foto, meta) a partir da nuvem. */
  async atualizarPerfil(uid: string): Promise<void> {
    const p = await this.api?.lerPerfil(uid);
    if (p) this.perfis.update((x) => ({ ...x, [uid]: p }));
  }

  /**
   * Perfil atual de uma pessoa. Se ainda não é conhecido, começa a buscá-lo em segundo plano e devolve
   * `undefined` por ora; quem lê isto em um template ou `computed` é atualizado quando o perfil chega.
   */
  perfilDe(uid: string): Perfil | undefined {
    if (uid === this.uid) return this.eu() ?? undefined;
    const p = this.perfis()[uid];
    if (!p) this.garantirPerfil(uid);
    return p;
  }

  /** Nome atual de uma pessoa. Treinos, comentários e avisos guardam o nome da época em que foram feitos. */
  nomeDe(uid: string, gravado: string): string {
    return nomeComMaiuscula(this.perfilDe(uid)?.nome || gravado);
  }

  /** Foto atual de uma pessoa (ou a gravada no item, enquanto o perfil não chega). */
  fotoDe(uid: string, gravada: string | null): string | null {
    const p = this.perfilDe(uid);
    return p ? p.foto : gravada;
  }

  /** Cria um grupo com a pessoa como dona e único membro. Devolve o grupo, ou `null` se não deu. */
  async criarGrupo(nome: string, acesso: AcessoGrupo = 'aberto'): Promise<Grupo | null> {
    const eu = this.eu();
    const limpo = nome.trim().slice(0, TAMANHO_NOME_GRUPO);
    if (!eu || !this.api || !limpo) return null;
    try {
      for (let i = 0; i < 6; i++) {
        const grupo: Grupo = { id: gerarCodigo(), nome: limpo, dono: eu.uid, membros: [eu.uid], acesso, pedidos: [], criadoEm: Date.now() };
        if (await this.api.criarGrupo(grupo)) {
          this.grupos.update((l) => (l.some((g) => g.id === grupo.id) ? l : [...l, grupo]));
          return grupo;
        }
      }
      this.erro.set('Não foi possível criar o grupo agora. Tente de novo.');
    } catch (e) {
      this.falhou(e, 'criar grupo');
    }
    return null;
  }

  /** O que a pessoa vê ao abrir um convite, antes de decidir entrar. */
  async previaDoGrupo(codigo: string): Promise<Grupo | null> {
    if (!this.api) return null;
    const c = normalizarCodigo(codigo);
    if (c.length !== 8) return null;
    try {
      const g = await this.api.lerGrupo(c);
      if (g) for (const m of g.membros) this.garantirPerfil(m);
      return g;
    } catch (e) {
      this.falhou(e, 'abrir o convite');
      return null;
    }
  }

  /** Usa um convite: entra na hora se o grupo é aberto; senão pede para entrar. */
  async entrarPorCodigo(codigo: string): Promise<ResultadoEntrada> {
    const eu = this.eu();
    const api = this.api;
    if (!eu || !api) return { estado: 'erro', mensagem: 'Entre na sua conta para participar de grupos.' };
    const c = normalizarCodigo(codigo);
    try {
      const g = c.length === 8 ? await api.lerGrupo(c) : null;
      if (!g) return { estado: 'inexistente', mensagem: 'Não encontramos esse grupo. Confira o link com quem convidou.' };
      if (g.membros.includes(eu.uid)) return { estado: 'ja-membro', grupo: g };
      if (g.acesso === 'aberto') {
        await api.entrarNoGrupo(g.id, eu.uid);
        const novo = { ...g, membros: [...g.membros, eu.uid] };
        this.grupos.update((l) => (l.some((x) => x.id === g.id) ? l : [...l, novo]));
        return { estado: 'entrou', grupo: novo };
      }
      if ((g.pedidos ?? []).includes(eu.uid)) return { estado: 'pedido-pendente', grupo: g };
      await api.pedirEntrada(g.id, eu.uid);
      this.gruposPendentes.update((l) => (l.some((x) => x.id === g.id) ? l : [...l, { ...g, pedidos: [...(g.pedidos ?? []), eu.uid] }]));
      return { estado: 'pedido-enviado', grupo: g };
    } catch (e) {
      this.falhou(e, 'entrar no grupo');
      return { estado: 'erro', mensagem: this.erro() };
    }
  }

  /** O dono aceita ou recusa o pedido de entrada de alguém. */
  async responderPedido(g: Grupo, uid: string, aceitar: boolean): Promise<void> {
    try {
      await this.api?.responderPedido(g.id, uid, aceitar);
    } catch (e) {
      this.falhou(e, aceitar ? 'aceitar pedido' : 'recusar pedido');
    }
  }

  async definirAcesso(g: Grupo, acesso: AcessoGrupo): Promise<void> {
    this.grupos.update((l) => l.map((x) => (x.id === g.id ? { ...x, acesso } : x)));
    try {
      await this.api?.definirAcesso(g.id, acesso);
    } catch (e) {
      this.grupos.update((l) => l.map((x) => (x.id === g.id ? { ...x, acesso: g.acesso } : x)));
      this.falhou(e, 'mudar quem pode participar');
    }
  }

  /** O dono troca a imagem do grupo (ou a tira, com `null`). Devolve se deu certo. */
  async definirFotoDoGrupo(g: Grupo, foto: string | null): Promise<boolean> {
    if (!this.api || g.dono !== this.uid) return false;
    const antes = g.foto ?? null;
    this.grupos.update((l) => l.map((x) => (x.id === g.id ? { ...x, foto } : x)));
    try {
      await this.api.definirFotoDoGrupo(g.id, foto);
      return true;
    } catch (e) {
      this.grupos.update((l) => l.map((x) => (x.id === g.id ? { ...x, foto: antes } : x)));
      this.falhou(e, 'trocar a imagem do grupo');
      return false;
    }
  }

  /** Sai do grupo. Quem era dono passa o posto ao próximo membro; o último a sair apaga o grupo. */
  async sairDoGrupo(g: Grupo): Promise<boolean> {
    const api = this.api;
    if (!api || !this.uid) return false;
    try {
      const outros = g.membros.filter((m) => m !== this.uid);
      // Primeiro some a ligação (enquanto ainda sou membro); depois saio do grupo.
      await Promise.all(outros.map((m) => api.desligar(this.uid, m, g.id)));
      await api.sairDoGrupo(g.id, this.uid, g.dono === this.uid ? outros[0] : undefined);
      this.grupos.update((l) => l.filter((x) => x.id !== g.id));
      return true;
    } catch (e) {
      this.falhou(e, 'sair do grupo');
      return false;
    }
  }

  // --- Timeline ----------------------------------------------------------------------------

  private ajustarEventos(ids: Set<string>): void {
    const api = this.api;
    if (!api || !this.uid) return;
    for (const uid of ids) {
      if (!uid || this.ouvintesEventos.has(uid)) continue;
      this.ouvirEventosDe(uid);
    }
    // Quem deixou de dividir um grupo comigo sai da timeline e das estatísticas: para de ouvir os dois.
    const sobras = new Set([...this.ouvintesEventos.keys(), ...this.ouvintesSessoes.keys()]);
    for (const uid of sobras) {
      if (!ids.has(uid)) this.soltar(uid);
    }
  }

  private ouvirEventosDe(uid: string): void {
    const api = this.api;
    if (!api) return;
    this.ouvintesEventos.set(
      uid,
      api.ouvirEventos(uid, (l) => this.eventosPor.update((x) => ({ ...x, [uid]: l })), (e) => this.aoErroDe(uid, e), this.limiteEventos()),
    );
  }

  /** Para de acompanhar uma pessoa (treinos publicados e histórico) e esquece o que veio dela. */
  private soltar(uid: string): void {
    this.ouvintesEventos.get(uid)?.();
    this.ouvintesEventos.delete(uid);
    this.ouvintesSessoes.get(uid)?.();
    this.ouvintesSessoes.delete(uid);
    this.ouvintesPeso.get(uid)?.();
    this.ouvintesPeso.delete(uid);
    const sem = <T>(x: Record<string, T>) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== uid));
    this.eventosPor.update(sem);
    this.sessoesPor.update(sem);
    this.pesosPor.update(sem);
  }

  /**
   * Erro ao ouvir uma pessoa. Se for outra pessoa, "sem permissão" quase sempre quer dizer que vocês não
   * dividem mais um grupo (a lista de ligações ainda não chegou); isso não é problema do app e não vira aviso na tela.
   */
  private aoErroDe(uid: string, e: unknown): void {
    if (uid !== this.uid && (e as { code?: string }).code === 'permission-denied') {
      this.soltar(uid);
      return;
    }
    this.falhou(e, uid === this.uid ? 'ler seus treinos' : 'ler treinos de um membro');
  }

  /** Publica na timeline os treinos concluídos há pouco que ainda não foram publicados. */
  private async publicarNovos(): Promise<void> {
    const eu = this.eu();
    const api = this.api;
    if (!eu || !api || !this.medalhas.pronto()) return;
    const historico = this.plans.historico();
    const ordenados = [...historico].sort((a, b) => a.data.localeCompare(b.data) || (a.concluidaEm ?? 0) - (b.concluidaEm ?? 0));
    const agora = Date.now();
    for (const s of historico) {
      if (!s.id || !s.concluidaEm || this.publicados.has(s.id) || agora - s.concluidaEm > JANELA_PUBLICACAO_MS) continue;
      this.publicados.add(s.id);
      const medalhas = this.medalhas.ganhosDoTreino(historico, s);
      const evento: Evento = {
        id: idEvento(s.concluidaEm, s.id),
        autor: eu.uid,
        autorNome: eu.nome,
        autorFoto: fotoParaItens(eu),
        tipo: 'treino',
        criadoEm: s.concluidaEm,
        sessaoId: s.id,
        data: s.data,
        fichaNome: s.fichaNome ?? this.plans.get(s.fichaId)?.nome ?? 'Treino',
        exercicios: s.registros?.length ?? 0,
        volume: volumeSessao(s),
        recordes: recordesDaSessao(historico, s).slice(0, 3).map((r) => ({ nome: this.nomeExercicio(r.exerciseId), carga: r.carga })),
        marco: marcoDoTreino(ordenados.findIndex((x) => x.id === s.id) + 1),
        ...(medalhas.length ? { medalhas } : {}),
        ...(s.atividade ? { detalhe: resumoAtividade(s.atividade) } : {}),
        ...(s.temFoto ? { temFoto: true } : {}),
      };
      try {
        await api.publicarEvento(evento);
        salvarPublicados(this.publicados);
      } catch (e) {
        this.publicados.delete(s.id);
        this.falhou(e, 'publicar treino na timeline');
      }
    }
  }

  private nomeExercicio(id: string): string {
    const e = this.ex.get(id);
    return e ? this.ex.nome(e) : id;
  }

  // --- Reações -----------------------------------------------------------------------------

  /** Falha ao ler as reações de um treino: mesmo tratamento dos demais ouvintes da pessoa dona dele. */
  ouvirCurtidas(dono: string, eventoId: string, cb: (uids: string[]) => void): Cancelar {
    return this.api?.ouvirCurtidas(dono, eventoId, cb, (e) => this.aoErroDe(dono, e)) ?? (() => undefined);
  }

  ouvirComentarios(dono: string, eventoId: string, cb: (c: Comentario[]) => void): Cancelar {
    return this.api?.ouvirComentarios(dono, eventoId, cb, (e) => this.aoErroDe(dono, e)) ?? (() => undefined);
  }

  // --- Foto do treino ----------------------------------------------------------------------

  /** Fotos já pedidas (ou recém-enviadas) nesta sessão, para um card não buscar a mesma foto duas vezes. */
  private readonly fotos = new Map<string, Promise<string | null>>();

  /** A foto de um treino (seu ou de um membro); `null` se não houver ou não puder ser lida agora. */
  /** Por que a última leitura de uma foto falhou (para o card dizer na tela, já que no celular não há console). */
  readonly motivosFoto = new Map<string, string>();

  lerFoto(uid: string, sessaoId: string): Promise<string | null> {
    const api = this.api;
    if (!api) return Promise.resolve(null);
    const chave = `${uid}/${sessaoId}`;
    let pedido = this.fotos.get(chave);
    if (!pedido) {
      pedido = api.lerFoto(uid, sessaoId).catch((e: unknown) => {
        // Foto que não carrega (sem regra publicada, sem rede) não é motivo para largar a pessoa nem para avisar: o card só fica sem ela.
        console.warn('[social] foto indisponível', e);
        const codigo = (e as { code?: string }).code;
        this.motivosFoto.set(chave, codigo === 'permission-denied' ? 'sem permissão para ler a foto (publique as regras do Firestore)' : `erro ao ler a foto${codigo ? ` (${codigo})` : ''}`);
        this.fotos.delete(chave);
        return null;
      });
      this.fotos.set(chave, pedido);
    }
    return pedido;
  }

  /**
   * Guarda a foto de um treino seu recém-concluído. O treino já nasce marcado com `temFoto`,
   * então o card publicado leva o aviso; aqui só vai a foto. Sem internet, fica na fila do Firestore.
   */
  async salvarFoto(sessaoId: string, dados: string): Promise<boolean> {
    const eu = this.eu();
    if (!eu || !this.api) return false;
    this.fotos.set(`${eu.uid}/${sessaoId}`, Promise.resolve(dados));
    try {
      await this.api.gravarFoto(eu.uid, sessaoId, dados);
      return true;
    } catch (e) {
      this.fotos.delete(`${eu.uid}/${sessaoId}`);
      this.falhou(e, 'gravar foto do treino (usuarios/…/fotos)');
      return false;
    }
  }

  /** Coloca, troca ou tira (`null`) a foto de um card seu já publicado. */
  async definirFoto(evento: Evento, dados: string | null): Promise<boolean> {
    const eu = this.eu();
    if (!eu || !this.api || evento.autor !== eu.uid) return false;
    const chave = `${eu.uid}/${evento.sessaoId}`;
    try {
      if (dados) {
        await this.api.gravarFoto(eu.uid, evento.sessaoId, dados);
        this.fotos.set(chave, Promise.resolve(dados));
      } else {
        await this.api.apagarFoto(eu.uid, evento.sessaoId);
        this.fotos.delete(chave);
      }
      this.plans.marcarFoto(evento.sessaoId, dados !== null);
      await this.api.marcarFotoEvento(eu.uid, evento.id, dados !== null);
      return true;
    } catch (e) {
      this.falhou(e, 'trocar/remover foto do card');
      return false;
    }
  }

  async alternarCurtida(dono: string, eventoId: string, curtido: boolean): Promise<void> {
    const eu = this.eu();
    if (!eu || !this.api) return;
    try {
      if (curtido) await this.api.descurtir(dono, eventoId, eu.uid);
      else await this.api.curtir(dono, eventoId, eu);
    } catch (e) {
      this.falhou(e, 'curtir');
    }
  }

  async comentar(dono: string, eventoId: string, texto: string): Promise<void> {
    const eu = this.eu();
    if (!eu || !this.api) return;
    try {
      await this.api.comentar(dono, eventoId, eu, texto);
    } catch (e) {
      this.falhou(e, 'comentar');
    }
  }

  async apagarComentario(dono: string, eventoId: string, c: Comentario): Promise<void> {
    try {
      await this.api?.apagarComentario(dono, eventoId, c.id);
    } catch (e) {
      this.falhou(e, 'apagar comentário');
    }
  }

  // --- Estatísticas de outros membros --------------------------------------------------------------

  /** Treinos concluídos de um colega de grupo (começa a acompanhar na primeira chamada). */
  sessoesDe(uid: string): Sessao[] {
    if (uid && uid !== this.uid && this.nuvem && !this.ouvintesSessoes.has(uid)) {
      this.ouvintesSessoes.set(
        uid,
        this.nuvem.ouvirSessoes(uid, (l) => this.sessoesPor.update((x) => ({ ...x, [uid]: l })), (e) => this.aoErroDe(uid, e), LIMITE_SESSOES_MEMBRO),
      );
    }
    return this.sessoesPor()[uid] ?? [];
  }

  sessoesCarregadas(uid: string): boolean {
    return uid in this.sessoesPor();
  }
}

/** Primeira vez nesta conta e aparelho: o que já existe conta como visto, para não acusar o histórico todo. */
function lerVisto(uid: string): number {
  try {
    const salvo = Number(localStorage.getItem(`${CHAVE_VISTO}:${uid}`));
    if (Number.isFinite(salvo) && salvo > 0) return salvo;
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
  const agora = Date.now();
  gravarVisto(uid, agora);
  return agora;
}

function gravarVisto(uid: string, t: number): void {
  try {
    localStorage.setItem(`${CHAVE_VISTO}:${uid}`, String(t));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

function lerMembrosVistos(uid: string): Record<string, string[]> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(`${CHAVE_MEMBROS_VISTOS}:${uid}`) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

function gravarMembrosVistos(uid: string, v: Record<string, string[]>): void {
  try {
    localStorage.setItem(`${CHAVE_MEMBROS_VISTOS}:${uid}`, JSON.stringify(v));
  } catch {
    // sem armazenamento: vale só nesta sessão
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
