import { EstadoNuvem } from './plan.service';
import { Sessao } from './models';

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  foto: string | null;
}

/** Documento único com fichas, ficha ativa e treino em andamento. */
export interface DocEstado {
  estado: EstadoNuvem;
  atualizadoEm: number;
  /** Quem gravou por último (cada abertura do app tem a sua), para ignorar o próprio eco. */
  origem: string;
}

export type Cancelar = () => void;

/** O que o Sincronizador precisa da nuvem; a implementação real usa Firebase. */
export interface NuvemBackend {
  ouvirEstado(uid: string, cb: (doc: DocEstado | null, pendente: boolean) => void, erro: (e: unknown) => void): Cancelar;
  gravarEstado(uid: string, doc: DocEstado): Promise<void>;
  /**
   * Com `limite`, lê só os treinos mais recentes (usado para amigos). Sem ele lê tudo, o que a
   * sincronização das próprias sessões exige: sem o histórico inteiro, outro aparelho não o recebe.
   */
  ouvirSessoes(uid: string, cb: (sessoes: Sessao[]) => void, erro: (e: unknown) => void, limite?: number): Cancelar;
  gravarSessao(uid: string, sessao: Sessao): Promise<void>;
  aguardarGravacoes(): Promise<void>;
}

/** O que o Sincronizador precisa do estado local. */
export interface AlvoLocal {
  lerEstado(): EstadoNuvem;
  aplicarEstado(e: EstadoNuvem, mesclar: boolean): void;
  lerSessoes(): Sessao[];
  mesclarSessoes(s: Sessao[]): void;
}

export type StatusSync = 'parado' | 'conectando' | 'ok' | 'sincronizando' | 'erro';

const ATRASO_MS = 1200;

/**
 * Mantém o estado local e o da nuvem iguais. Local primeiro: o app lê e grava no aparelho,
 * e este objeto envia as mudanças e aplica as que chegam de outro aparelho.
 * Conflito no documento principal: vale a última gravação; as sessões concluídas são unidas.
 */
export class Sincronizador {
  private readonly origem = crypto.randomUUID();
  private cancelar: Cancelar[] = [];
  private primeiroEstado = true;
  private primeiroSessoes = true;
  private ultimoJson = '';
  private timer?: ReturnType<typeof setTimeout>;
  private enviadas = new Set<string>();
  private parado = false;
  /** Quantas gravações estão em andamento. */
  private emVoo = 0;

  constructor(
    private readonly nuvem: NuvemBackend,
    private readonly alvo: AlvoLocal,
    private readonly uid: string,
    private readonly aoStatus: (s: StatusSync, erro?: unknown) => void = () => undefined,
    private readonly agora: () => number = Date.now,
  ) {}

  iniciar(): void {
    this.aoStatus('conectando');
    const falha = (e: unknown) => this.aoStatus('erro', e);
    this.cancelar.push(
      this.nuvem.ouvirEstado(this.uid, (doc, pendente) => this.aoReceberEstado(doc, pendente), falha),
      this.nuvem.ouvirSessoes(this.uid, (s) => this.aoReceberSessoes(s), falha),
    );
  }

  parar(): void {
    this.parado = true;
    clearTimeout(this.timer);
    this.cancelar.forEach((c) => c());
    this.cancelar = [];
    this.aoStatus('parado');
  }

  /** Envia o que ainda estiver pendente (usado antes de sair da conta). */
  async descarregar(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
      await this.enviarEstado();
    }
    this.enviarSessoes();
  }

  /** Avisa que o estado local mudou. */
  estadoMudou(): void {
    if (this.parado || this.primeiroEstado) return;
    if (JSON.stringify(this.alvo.lerEstado()) === this.ultimoJson) return;
    clearTimeout(this.timer);
    this.aoStatus('sincronizando');
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.enviarEstado();
    }, ATRASO_MS);
  }

  /** Avisa que o histórico local mudou. */
  sessoesMudaram(): void {
    if (this.parado || this.primeiroSessoes) return;
    this.enviarSessoes();
  }

  private aoReceberEstado(doc: DocEstado | null, pendente: boolean): void {
    if (this.parado || pendente) return;
    if (this.primeiroEstado) {
      this.primeiroEstado = false;
      if (doc) {
        // Primeiro contato: junta o que há no aparelho com o que está na nuvem.
        this.alvo.aplicarEstado(doc.estado, true);
        this.ultimoJson = JSON.stringify(doc.estado);
        if (JSON.stringify(this.alvo.lerEstado()) !== this.ultimoJson) void this.enviarEstado();
      } else {
        void this.enviarEstado();
      }
      this.aoStatus('ok');
      return;
    }
    if (!doc || doc.origem === this.origem) return;
    // Alterações locais ainda não enviadas prevalecem: serão gravadas em seguida.
    if (this.timer) return;
    this.alvo.aplicarEstado(doc.estado, false);
    this.ultimoJson = JSON.stringify(this.alvo.lerEstado());
    this.aoStatus('ok');
  }

  private aoReceberSessoes(remotas: Sessao[]): void {
    if (this.parado) return;
    remotas.forEach((s) => s.id && this.enviadas.add(s.id));
    this.alvo.mesclarSessoes(remotas);
    if (this.primeiroSessoes) {
      this.primeiroSessoes = false;
      this.enviarSessoes();
    }
  }

  private async enviarEstado(): Promise<void> {
    const estado = this.alvo.lerEstado();
    const json = JSON.stringify(estado);
    if (json === this.ultimoJson) {
      this.aoStatus('ok');
      return;
    }
    this.ultimoJson = json;
    await this.gravar(() => this.nuvem.gravarEstado(this.uid, { estado, atualizadoEm: this.agora(), origem: this.origem }), () => {
      this.ultimoJson = '';
    });
  }

  private enviarSessoes(): void {
    for (const s of this.alvo.lerSessoes()) {
      if (!s.id || this.enviadas.has(s.id)) continue;
      const id = s.id;
      this.enviadas.add(id);
      void this.gravar(() => this.nuvem.gravarSessao(this.uid, s), () => this.enviadas.delete(id));
    }
  }

  private async gravar(acao: () => Promise<void>, desfazer: () => void): Promise<void> {
    this.emVoo++;
    this.aoStatus('sincronizando');
    try {
      await acao();
    } catch (e) {
      desfazer();
      this.aoStatus('erro', e);
      return;
    } finally {
      this.emVoo--;
    }
    if (this.emVoo === 0 && !this.timer) this.aoStatus('ok');
  }
}
