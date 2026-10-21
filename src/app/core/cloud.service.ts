import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { FIREBASE_CONFIG } from './firebase.config';
import type { FirebaseBackend } from './firebase.backend';
import { PlanService } from './plan.service';
import { SocialBackend } from './social';
import { AlvoLocal, NuvemBackend, Sincronizador, StatusSync, Usuario } from './sync';

const CHAVE_CONTA = 'app-workout:conta:v1';

/** Login com Google e sincronização das fichas e treinos com a nuvem (Firebase). */
@Injectable({ providedIn: 'root' })
export class CloudService {
  /** Falso enquanto `firebase.config.ts` não for preenchido: o app segue só no aparelho. */
  readonly configurado = FIREBASE_CONFIG !== null;
  /** Verdadeiro quando já se sabe se há alguém logado. */
  readonly pronto = signal(!this.configurado);
  readonly usuario = signal<Usuario | null>(null);
  readonly status = signal<StatusSync>('parado');
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly erro = signal('');
  readonly ocupado = signal(false);

  /** Disponível quando há alguém logado de verdade; a parte social começa daí. */
  readonly social = signal<{ uid: string; api: SocialBackend; nuvem: NuvemBackend } | null>(null);

  private backend?: FirebaseBackend;
  private sinc?: Sincronizador;
  private iniciando?: Promise<void>;
  private resolverPronto!: () => void;
  private readonly prontoPromessa = new Promise<void>((r) => (this.resolverPronto = r));
  /** Falso se o Firebase não carregou (ex.: sem conexão na primeira abertura). */
  readonly carregado = signal(false);

  private readonly plans = inject(PlanService);

  private readonly alvo: AlvoLocal = {
    lerEstado: () => this.plans.estadoNuvem(),
    aplicarEstado: (e, mesclar) => this.plans.aplicarEstadoNuvem(e, mesclar),
    lerSessoes: () => this.plans.historico(),
    mesclarSessoes: (s) => this.plans.mesclarSessoes(s),
  };

  constructor() {
    if (!this.configurado) this.resolverPronto();
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
    effect(() => {
      this.plans.estadoNuvem();
      untracked(() => this.sinc?.estadoMudou());
    });
    effect(() => {
      this.plans.historico();
      untracked(() => this.sinc?.sessoesMudaram());
    });
    // Quem já entrou antes retoma a sincronização logo após abrir o app.
    if (this.configurado && this.lembrado()) setTimeout(() => void this.iniciar(), 0);
  }

  /**
   * Espera saber se há alguém logado. Quem já entrou antes não fica preso se a verificação
   * demorar (por exemplo, sem internet): depois de alguns segundos segue com a conta lembrada.
   */
  async aguardarPronto(): Promise<void> {
    await Promise.race([this.prontoPromessa, new Promise<void>((r) => setTimeout(r, 8000))]);
    if (!this.pronto() && this.lembrado() && !this.usuario()) {
      this.usuario.set({ uid: 'lembrado', nome: '', email: '', foto: null });
    }
  }

  /** Carrega o Firebase (sob demanda) e passa a acompanhar o login. */
  iniciar(): Promise<void> {
    if (!this.configurado) return Promise.resolve();
    this.iniciando ??= this.carregar();
    return this.iniciando;
  }

  async entrar(): Promise<void> {
    this.erro.set('');
    this.ocupado.set(true);
    try {
      await this.iniciar();
      await this.backend?.entrar();
    } catch (e) {
      const codigo = (e as { code?: string }).code ?? '';
      if (codigo !== 'auth/popup-closed-by-user' && codigo !== 'auth/cancelled-popup-request') {
        this.erro.set(this.mensagem(codigo));
      }
    } finally {
      this.ocupado.set(false);
    }
  }

  async sair(): Promise<void> {
    this.ocupado.set(true);
    try {
      // Tenta enviar o que faltar; sem conexão não espera para sempre.
      await Promise.race([this.sinc?.descarregar(), new Promise((r) => setTimeout(r, 4000))]);
      this.sinc?.parar();
      this.sinc = undefined;
      // Os dados continuam na nuvem; o aparelho fica limpo para a próxima pessoa.
      this.social.set(null);
      this.plans.limparLocal();
      this.esquecer();
      await this.backend?.sair();
    } finally {
      this.ocupado.set(false);
    }
  }

  private async carregar(): Promise<void> {
    try {
      const { FirebaseBackend } = await import('./firebase.backend');
      this.backend = await FirebaseBackend.criar(FIREBASE_CONFIG!);
      this.carregado.set(true);
      this.backend.aoMudarUsuario(
        (u) => this.aoMudarUsuario(u),
        (e) => this.erro.set(this.mensagem((e as { code?: string }).code ?? '')),
      );
    } catch {
      this.iniciando = undefined;
      this.pronto.set(true);
      this.resolverPronto();
      this.erro.set('Não foi possível carregar o login. Confira a conexão e tente de novo.');
    }
  }

  private aoMudarUsuario(u: Usuario | null): void {
    if (this.usuario()?.uid !== u?.uid) {
      this.sinc?.parar();
      this.sinc = undefined;
    }
    this.usuario.set(u);
    this.pronto.set(true);
    this.resolverPronto();
    this.social.set(u && this.backend ? { uid: u.uid, api: this.backend.social(), nuvem: this.backend } : null);
    if (!u || !this.backend) return;
    this.lembrar();
    this.sinc ??= new Sincronizador(this.backend, this.alvo, u.uid, (s, e) => {
      this.status.set(s);
      if (s === 'erro') this.erro.set(this.mensagem((e as { code?: string } | undefined)?.code ?? ''));
      else if (s === 'ok') this.erro.set('');
    });
    if (this.status() === 'parado' || this.status() === 'erro') this.sinc.iniciar();
  }

  private mensagem(codigo: string): string {
    switch (codigo) {
      case 'permission-denied':
        return 'Sem permissão para salvar. Confira as regras do Firestore (veja o README).';
      case 'auth/unauthorized-domain':
        return 'Este endereço não está autorizado no Firebase. Adicione o domínio em Authentication → Configurações → Domínios autorizados.';
      case 'auth/network-request-failed':
        return 'Sem conexão. Tente de novo quando estiver online.';
      case 'auth/popup-blocked':
        return 'O navegador bloqueou a janela de login. Libere pop-ups e tente de novo.';
      default:
        return 'Não foi possível concluir. Tente de novo.';
    }
  }

  private lembrado(): boolean {
    try {
      return localStorage.getItem(CHAVE_CONTA) === '1';
    } catch {
      return false;
    }
  }

  private lembrar(): void {
    try {
      localStorage.setItem(CHAVE_CONTA, '1');
    } catch {
      // sem armazenamento: o login só será retomado ao abrir Ajustes
    }
  }

  private esquecer(): void {
    try {
      localStorage.removeItem(CHAVE_CONTA);
    } catch {
      // nada a fazer
    }
  }
}
